#!/usr/bin/env node
const path = require("path");
const fs = require("fs");
const utils = require("../dist/utils");

const yargs = require("yargs").option("config", {
	alias: "c",
	describe: "Path to the config file",
	type: "string",
	default: "cubi.config.js"
});

const argv = yargs.argv;
const configPath = path.resolve(argv.config);

/**
 * 判断配置文件是否存在
 */
if (!fs.existsSync(configPath)) {
	utils.printError(`config path: ${configPath} not find.`);
	console.log();
	yargs.showHelp();
	return;
}

const cmd = argv._[0];
const config = require(configPath);
const { Cubi } = require("../dist/Cubi");

const cubi = new Cubi(config);
switch (cmd) {
	case "start":
		cubi.start();
		break;
	case "build":
		cubi.build();
		break;
	default:
		yargs.showHelp();
}

process.on("unhandledRejection", (reason, p) => {
	console.log("Unhandled Rejection at: Promise", p, "reason:", reason);
	// application specific logging, throwing an error, or other logic here
});
