import * as webpack from "webpack";
import { EventEmitter } from "events";
import * as webpackDevMiddleware from "webpack-dev-middleware";
import * as express from "express";
import * as serveStatic from "serve-static";
import { addWebpackEntry } from "./utils/webpack";
import { localIP, printWarn } from "./utils";

interface BuiltEntry {
	[index: string]: {
		status: symbol;
	};
}

const host = "0.0.0.0";

const ADDED = Symbol("added");
const BUILDING = Symbol("building");
const BUILT = Symbol("built");

class Invalidator {
	private devMiddleware: any;
	private building: boolean;
	private rebuildAgain: boolean;

	constructor(devMiddleware) {
		this.devMiddleware = devMiddleware;
		this.building = false;
		this.rebuildAgain = false;
	}

	invalidate() {
		if (this.building) {
			this.rebuildAgain = true;
			return;
		}

		this.building = true;
		this.devMiddleware.invalidate();
	}

	startBuilding() {
		this.building = true;
	}

	doneBuilding() {
		this.building = false;
		if (this.rebuildAgain) {
			this.rebuildAgain = false;
			this.invalidate();
		}
	}
}

function getRandomKey(keyList: string[]): string {
	const randomIndex = Math.floor(Math.random() * keyList.length);
	return keyList[randomIndex];
}

export interface ServerStaticPath {
	prefix: string;
	path: string;
}

export interface DevServerOption {
	/**
	 * 开发服务器的端口
	 */
	port: number;
	/**
	 * 开发模式初始化编译的 entry
	 */
	initEntry?: string[];
	/**
	 * 开发服务器的静态文件目录
	 */
	contentBase?: string | string[] | ServerStaticPath | ServerStaticPath[];
	/**
	 * 静态目录相关配置
	 */
	staticOptions?: serveStatic.ServeStaticOptions;
}

export function startServer(
	config: webpack.Configuration,
	serverConfig: DevServerOption
) {
	const originEntries = config.entry as any;
	const initEntry = {};
	const builtEntries: BuiltEntry = {};

	if (serverConfig.initEntry) {
		serverConfig.initEntry.forEach(k => {
			if (originEntries[k]) {
				initEntry[k] = originEntries[k];
				builtEntries[k] = { status: BUILDING };
			}
		});
	}

	if (Object.keys(initEntry).length > 0) {
		config.entry = initEntry;
	} else {
		const k = getRandomKey(Object.keys(originEntries));
		config.entry = {
			[k]: originEntries[k]
		};
		builtEntries[k] = {
			status: BUILDING
		};
	}

	const compiler: any = webpack(config);
	const devMiddleware = webpackDevMiddleware(compiler, {
		logLevel: "silent",
		headers: {
			"Access-Control-Allow-Origin": "*"
		}
	});

	const app = express();
	const doneCallbacks = new EventEmitter();
	const invalidator = new Invalidator(devMiddleware);

	compiler.plugin("make", function addEntry(compilation, done) {
		invalidator.startBuilding();

		const allEntries = Object.keys(builtEntries).map(page => {
			const entry = originEntries[page];
			builtEntries[page].status = BUILDING;
			return addWebpackEntry(compilation, this.context, page, entry);
		});

		Promise.all(allEntries)
			.then(() => done())
			.catch(done);
	});
	compiler.plugin("done", function emitWebpackDone() {
		Object.keys(builtEntries).forEach(page => {
			const entryInfo = builtEntries[page];
			if (entryInfo.status !== BUILDING) return;

			entryInfo.status = BUILT;
			doneCallbacks.emit(page);
			invalidator.doneBuilding();
		});
	});

	// init express middleware
	app.use(function ensurePage(req, res, next) {
		const requestPath = req.path === "/" ? "/index.html" : req.path;
		const url: string[] = requestPath.split(".");
		if (url[1] === "html") {
			const entryName = url[0].substr(1);
			if (!originEntries[entryName]) {
				next();
				return;
			}

			const entryInfo = builtEntries[entryName];
			if (entryInfo) {
				if (entryInfo.status === BUILT) {
					next();
				} else if (entryInfo.status === BUILDING) {
					doneCallbacks.on(entryName, next);
				}
				return;
			}

			printWarn(`> Building page: ${entryName}`);
			builtEntries[entryName] = {
				status: ADDED
			};
			doneCallbacks.on(entryName, next);
			invalidator.invalidate();
		} else {
			next();
		}
	});
	app.use(devMiddleware);
	app.use(
		require("webpack-hot-middleware")(compiler, {
			log: () => {}
		})
	);

	// config static folder
	const { contentBase, staticOptions, port } = serverConfig;
	if (Array.isArray(contentBase)) {
		(contentBase as any[]).forEach(root => {
			if (typeof root === "string") {
				app.use(express.static(root, staticOptions));
			} else {
				app.use(root.prefix, express.static(root.path, staticOptions));
			}
		});
	} else if (contentBase) {
		if (typeof contentBase === "string") {
			app.use(express.static(contentBase, staticOptions));
		} else {
			app.use(
				contentBase.prefix,
				express.static(contentBase.path, staticOptions)
			);
		}
	}

	app.locals.env = process.env.NODE_ENV;
	devMiddleware.waitUntilValid(() => {
		console.log(`> Listening at http://${localIP}:${port}`);
	});
	console.log("> Starting dev server...");
	app.listen(port, host);
}
