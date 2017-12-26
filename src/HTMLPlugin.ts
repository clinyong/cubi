import * as webpack from "webpack";
import * as fse from "fs-extra";
import * as path from "path";
import * as React from "react";
import * as ReactDOMServer from "react-dom/server";
import * as ejs from "ejs";
import { DEFAULT_EXTENSIONS } from "@babel/core";
import * as babelRegister from "@babel/register";
import { minify } from "html-minifier";
import { Route } from "./config";

const MODULE_PATH = path.resolve(__dirname, "../node_modules");

babelRegister({
	presets: [
		"@babel/preset-env",
		"@babel/preset-react",
		"@babel/preset-typescript"
	].map(item => path.join(MODULE_PATH, item)),
	extensions: [...DEFAULT_EXTENSIONS, ".tsx"]
});

export interface HTMLExternalOptions {
	/**
	 * 指定输出的 html 模板，ejs 语法
	 */
	template?: string;
	/**
	 * 页面的 title
	 */
	title?: string;
	/**
	 * map entry 对应 单个输出的 html 模板
	 */
	entryTemplates?: { [key: string]: string };
}

export interface HTMLOptions extends HTMLExternalOptions {
	dllEntry: webpack.Entry;
	entry: webpack.Entry;
	isProd: boolean;
	exportPathMap: () => Promise<{ [index: string]: Route }>;
}

function getAssetName(rawName: string): string {
	let name = rawName;
	if (name.includes("/")) {
		let list = name.split("/");
		name = list[list.length - 1];
	}

	return name.split(".")[0];
}

export class HTMLPlugin {
	options: HTMLOptions;

	constructor(options: HTMLOptions) {
		this.options = Object.assign<Partial<HTMLOptions>, HTMLOptions>(
			{
				template: path.resolve(__dirname, "../config/index.html"),
				title: "ezbuy"
			},
			options
		);
	}

	apply(compiler) {
		compiler.plugin("emit", async (compilation, cb) => {
			const { entry, exportPathMap } = this.options;
			const { assets, chunks } = compilation.getStats().toJson();

			const allAssets = chunks
				.filter(chunk => chunk.initial)
				.map(chunk => chunk.files[0]) as string[];
			const entryAssetMap = {};
			let shareAssets: string[] = [];
			allAssets.forEach(asset => {
				const name = getAssetName(asset);
				if (entry[name]) {
					entryAssetMap[name] = asset;
				} else {
					shareAssets.push(asset);
				}
			});

			const manifestIndex = shareAssets.findIndex(item =>
				item.includes("manifest")
			);
			let manifestContent = "";
			if (manifestIndex !== -1) {
				const manifestItem = shareAssets.splice(manifestIndex, 1)[0];
				manifestContent = compilation.assets[manifestItem].source();
				delete compilation.assets[manifestItem];
			}

			// get dll entry
			const dllAssets = assets
				.filter(item => item.name.includes(".dll.js"))
				.map(asset => asset.name);

			const shareScripts = shareAssets.concat(dllAssets);

			const shareStyles = assets
				.filter(asset => asset.name.includes(".css"))
				.map(asset => asset.name);

			const templateContent = await fse.readFile(
				path.resolve(__dirname, "../config/template.html"),
				"utf8"
			);

			const routesMap = await exportPathMap();

			console.log(routesMap);
			
			Object.keys(routesMap).forEach(k => {
				const routeItem = routesMap[k];
				const entryItem = entry[routeItem.page] as string;
				if (entryItem) {
					const Component = require(`${entryItem}/index.tsx`).default;
					const ins = React.createElement(Component, routeItem.query);
					const initContent = ReactDOMServer.renderToString(ins);

					const htmlContent = ejs.render(templateContent, {
						title: this.options.title,
						styles: shareStyles,
						scripts: shareScripts.concat(
							entryAssetMap[routeItem.page]
						),
						manifestContent,
						initContent
					});
					const content = this.options.isProd
						? minify(htmlContent, {
								removeAttributeQuotes: true,
								removeComments: true,
								collapseWhitespace: true
							})
						: htmlContent;
					compilation.assets[`${k}.html`] = {
						source: () => content,
						size: () => content.length
					};
				}
			});

			return cb();
		});
	}
}
