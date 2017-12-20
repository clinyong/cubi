import * as webpack from "webpack";
import * as FriendlyErrorsPlugin from "friendly-errors-webpack-plugin";
import * as merge from "webpack-merge";
import * as path from "path";
import DllLinkPlugin = require("dll-link-webpack-plugin");
import { HTMLPlugin } from "./HTMLPlugin";
import { localIP } from "./utils";

const MODULE_PATH = path.resolve(__dirname, "../node_modules");

export interface Config {
	rootPath: string;
	entry: { [name: string]: string };
	dllEntry: { [name: string]: string };
	outputPath: string;
	devPort: number;
}

function genDllConfig(options: Config, isProd: boolean): any {
	const env = isProd ? "production" : "development";
	const filename = isProd
		? "js/[name].[chunkhash:8].dll.js"
		: "[name].dll.js";

	const library = "[name]_lib";
	return {
		entry: options.dllEntry,
		output: {
			filename,
			path: options.outputPath,
			library
		},
		plugins: [
			new webpack.DllPlugin({
				path: "[name]-manifest.json",
				name: library,
				context: options.outputPath
			}),
			new webpack.DefinePlugin({
				"process.env.NODE_ENV": JSON.stringify(env)
			})
		].concat(
			isProd
				? [
						new webpack.HashedModuleIdsPlugin(),
						new webpack.optimize.ModuleConcatenationPlugin()
					]
				: []
		)
	};
}

export function genConfig(config: Config, isProd: boolean) {
	const entryList: string[] = Object.keys(config.entry).map(
		k => config.entry[k]
	);
	const babelPresets = [
		"@babel/preset-env",
		"@babel/preset-react",
		"@babel/preset-typescript"
	].map(item => path.join(MODULE_PATH, item));
	const webpackConfig: webpack.Configuration = {
		entry: config.entry,
		output: {
			path: config.outputPath
		},
		resolve: {
			extensions: [".webpack.js", ".js", ".jsx", ".tsx", ".ts"],
			modules: [config.rootPath, "node_modules", MODULE_PATH]
		},
		resolveLoader: {
			modules: ["node_modules", MODULE_PATH]
		},
		module: {
			rules: [
				{
					test: /\.tsx?$/,
					exclude: [/(node_modules|bower_components)/, ...entryList],
					use: [
						{
							loader: "babel-loader",
							options: {
								presets: babelPresets
							}
						}
					]
				},
				{
					test: /\.tsx$/,
					include: entryList,
					use: [
						{
							loader: "babel-loader",
							options: {
								plugins: [
									path.resolve(__dirname, "./ReactHydrate")
								],
								presets: babelPresets
							}
						}
					]
				}
			]
		},
		plugins: [
			new HTMLPlugin({
				entry: config.entry,
				dllEntry: config.dllEntry,
				isProd
			})
		]
	};

	if (config.dllEntry) {
		webpackConfig.plugins!.push(
			new DllLinkPlugin({
				config: genDllConfig(config, false),
				appendVersion: isProd,
				assetsMode: true,
				htmlMode: true
			})
		);
	}
	return webpackConfig;
}

export function genDevConfig(config: Config) {
	const baseConfig = genConfig(config, false);
	return merge(baseConfig, {
		output: {
			publicPath: `http://${localIP}:${config.devPort}/`,
			filename: "[name].js",
			chunkFilename: "[name].chunk.js"
		},
		devtool: "cheap-module-eval-source-map",
		plugins: [
			new webpack.DefinePlugin({
				"process.env.NODE_ENV": JSON.stringify("development")
			}),
			new webpack.NamedModulesPlugin(),
			new webpack.HotModuleReplacementPlugin(),
			new FriendlyErrorsPlugin()
		]
	});
}

export function genProdConfig(config: Config) {
	const baseConfig = genConfig(config, true);
	const plugins = [
		new webpack.DefinePlugin({
			"process.env.NODE_ENV": JSON.stringify("production")
		}),
		new webpack.optimize.UglifyJsPlugin({
			compress: {
				warnings: false
			}
		}),
		new webpack.HashedModuleIdsPlugin(),
		new webpack.optimize.CommonsChunkPlugin({
			name: "common",
			minChunks: 2
		}),
		new webpack.optimize.CommonsChunkPlugin({
			name: "manifest"
		}),
		new webpack.optimize.ModuleConcatenationPlugin()
	];
	const prodConfig: webpack.Configuration = {
		output: {
			filename: `js/[name].[chunkhash:8].js`,
			chunkFilename: `js/[name].[chunkhash:8].chunk.js`
		},
		devtool: false,
		plugins
	};

	return merge(baseConfig, prodConfig);
}