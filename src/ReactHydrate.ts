import * as t from "@babel/types";
import * as babylon from "babylon";
import traverse from "@babel/traverse";
import generator from "@babel/generator";
import * as loaderUtils from "loader-utils";

function createFunction(name, args) {
	const nameList = name.split(".");
	return t.CallExpression(
		t.MemberExpression(
			t.Identifier(nameList[0]),
			t.Identifier(nameList[1])
		),
		args
	);
}

const parseOption = {
	sourceType: "module",
	plugins: ["jsx", "typescript"]
};

// A babel plugin, add hydrate method to entry file
export = function ReactHydrate(source) {
	const loaderOptions = loaderUtils.getOptions(this) || {};
	const isProd = loaderOptions.isProd;

	let componentName = "";
	const ast = babylon.parse(source, parseOption);
	traverse(ast, {
		ExportDefaultDeclaration: {
			enter(path) {
				path.traverse({
					FunctionDeclaration(path) {
						componentName = path.node.id.name;
					},
					ClassDeclaration(path) {
						componentName = path.node.id.name;
					}
				});
			}
		},
		Program: {
			exit(path) {
				path.unshiftContainer(
					"body",
					t.ImportDeclaration(
						[t.ImportDefaultSpecifier(t.Identifier("ReactDOM"))],
						t.stringLiteral("react-dom")
					)
				);

				let funcName = "render";
				if (isProd) {
					funcName = "hydrate";
				}

				path.pushContainer(
					"body",
					t.ExpressionStatement(
						createFunction(`ReactDOM.${funcName}`, [
							createFunction("React.createElement", [
								t.Identifier(componentName),
								t.Identifier("INIT_PROPS")
							]),
							createFunction("document.getElementById", [
								t.StringLiteral("app")
							])
						])
					)
				);
			}
		}
	});

	return generator(ast, {}, source).code;
};
