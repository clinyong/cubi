import * as webpack from "webpack";
import * as webpackDevMiddleware from "webpack-dev-middleware";
import * as express from "express";
import * as serveStatic from "serve-static";
import { getLocalIP } from "./utils";

const host = "0.0.0.0";

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
	const compiler: any = webpack(config);
	const devMiddleware = webpackDevMiddleware(compiler, {
		logLevel: "error",
		headers: {
			"Access-Control-Allow-Origin": "*"
		}
	});

	const app = express();

	// init express middleware
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
		console.log(`> Listening at http://${getLocalIP()}:${port}`);
	});
	console.log("> Starting dev server...");
	app.listen(port, host);
}
