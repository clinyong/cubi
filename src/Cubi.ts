import { genProdConfig, genDevConfig } from "./webpackConfig";
import * as webpack from "webpack";
import * as ora from "ora";
import chalk from "chalk";
import { alertSuccess } from "./utils";
import { startServer } from "./startServer";
import { Config } from "./config";

export function validateConfig(config: Config) {
	return config;
}

export class Cubi {
	options: Config;
	constructor(options) {
		this.options = options;
	}

	start() {
		const config = genDevConfig(this.options);
		startServer(config, this.options.devServer);
	}

	build() {
		const config = genProdConfig(this.options);
		const spinner = ora("webpack building...");
		spinner.start();
		return new Promise((resolve, reject) => {
			webpack(config, (err, stats) => {
				spinner.stop();
				if (err) reject(err);
				process.stdout.write(
					stats.toString({
						colors: true,
						modules: false,
						children: false,
						chunks: false,
						chunkModules: false
					}) + "\n\n"
				);
				console.log(chalk.cyan("  Build complete.\n"));
				// if (entryLen > 1) {
				// 	// only update auto-entry when having multiple entries
				// 	updateAutoEntry();
				// }
				alertSuccess("Build successfully.");
				resolve();
			});
		});
	}
}
