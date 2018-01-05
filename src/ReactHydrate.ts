import * as t from "@babel/types";
import * as babylon from "babylon";
import traverse from "@babel/traverse";
import generator from "@babel/generator";

function createJSX(name) {
	return t.jSXElement(
		t.jSXOpeningElement(t.JSXIdentifier(name), [], true),
		null,
		[],
		true
	);
}

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
				path.pushContainer(
					"body",
					t.ExpressionStatement(
						createFunction("ReactDOM.hydrate", [
							createJSX(componentName),
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
