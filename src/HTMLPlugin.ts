import * as webpack from "webpack";
import * as fse from "fs-extra";
import * as path from "path";
import * as ejs from "ejs";
import { minify } from "html-minifier";

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
}

interface EntryAsset {
	name: string;
	content: string;
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
			const { entry, dllEntry } = this.options;
			const { assets, chunks } = compilation.getStats().toJson();

			const allAssets = chunks
				.filter(chunk => chunk.initial)
				.map(chunk => chunk.files[0]) as string[];
			const entryAssets: EntryAsset[] = [];
			let shareAssets: string[] = [];
			allAssets.forEach(asset => {
				const name = getAssetName(asset);
				if (entry[name]) {
					entryAssets.push({
						name,
						content: asset
					});
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
			const end = Object.keys(dllEntry).length;
			const dllAssets = assets
				.reverse()
				.slice(0, end)
				.map(asset => asset.name);

			const shareScripts = shareAssets.concat(dllAssets);

			const shareStyles = assets
				.filter(asset => asset.name.includes(".css"))
				.map(asset => asset.name);

			const templateContent = await fse.readFile(
				path.resolve(__dirname, "../config/template.html"),
				"utf8"
			);

			const scripts = entryAssets.map(item => {
				let htmlContent = ejs.render(templateContent, {
					title: this.options.title,
					styles: shareStyles,
					scripts: shareScripts.concat(item.content),
					manifestContent,
					initContent: ""
				});

				return {
					name: item.name,
					content: this.options.isProd
						? minify(htmlContent, {
								removeAttributeQuotes: true,
								removeComments: true,
								collapseWhitespace: true
							})
						: htmlContent
				} as EntryAsset;
			});

			scripts.forEach(item => {
				compilation.assets[`${item.name}.html`] = {
					source: () => item.content,
					size: () => item.content.length
				};
			});
			return cb();
		});
	}
}
