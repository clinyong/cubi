import * as t from "@babel/types";
import * as babylon from "@babel/parser";
import traverse from "@babel/traverse";
import generator from "@babel/generator";
import * as loaderUtils from "loader-utils";

function createFunction(name, args) {
	const nameList = name.split(".");
	return t.callExpression(
		t.memberExpression(
			t.identifier(nameList[0]),
			t.identifier(nameList[1])
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
					t.importDeclaration(
						[t.importDefaultSpecifier(t.identifier("ReactDOM"))],
						t.stringLiteral("react-dom")
					)
				);

				let funcName = "render";
				if (isProd) {
					funcName = "hydrate";
				}

				path.pushContainer(
					"body",
					t.expressionStatement(
						createFunction(`ReactDOM.${funcName}`, [
							createFunction("React.createElement", [
								t.identifier(componentName),
								t.identifier("INIT_PROPS")
							]),
							createFunction("document.getElementById", [
								t.stringLiteral("app")
							])
						])
					)
				);
			}
		}
	});

	return generator(ast, {}, source).code;
};
