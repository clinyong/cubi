import { DevServerOption } from "./startServer";

export interface Route {
	page: string;
	query: any;
	title: string;
}

export interface Config {
	rootPath: string;
	entry: { [name: string]: string };
	dllEntry: { [name: string]: string };
	outputPath: string;
	devPort: number;
	devServer: DevServerOption;
	exportPathMap: () => Promise<{ [index: string]: Route }>;
	htmlTemplate?: string;
}
