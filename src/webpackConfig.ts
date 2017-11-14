import * as webpack from "webpack";
import * as FriendlyErrorsPlugin from "friendly-errors-webpack-plugin";
import * as merge from "webpack-merge";
import * as path from "path";
import { HTMLPlugin } from "./HTMLPlugin";
import { localIP } from "./utils";

export interface Config {
	entry: { [name: string]: string };
	dllEntry: { [name: string]: string };
	dist: string;
	devPort: number;
}

export function genConfig(config: Config, isProd: boolean) {
	const entryList: string[] = Object.keys(config.entry).map(
		k => config.entry[k]
	);
	const webpackConfig: webpack.Configuration = {
		entry: config.entry,
		output: {
			path: config.dist
		},
		resolve: {
			extensions: [".tsx", ".ts"]
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
								presets: ["react", "@babel/preset-env"]
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
								presets: ["react", "@babel/preset-env"]
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
