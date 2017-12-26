import { DevServerOption } from "./startServer";

export interface Route {
	page: string;
	query: any;
}

export interface Config {
	rootPath: string;
	entry: { [name: string]: string };
	dllEntry: { [name: string]: string };
	outputPath: string;
	devPort: number;
	devServer: DevServerOption;
	exportPathMap: () => Promise<{ [index: string]: Route }>;
}
