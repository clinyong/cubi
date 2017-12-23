import chalk from "chalk";
import * as os from "os";
import * as notifier from "node-notifier";

export const printError = msg => {
	console.log();
	console.log(chalk.red(msg));
};

export const printSuccess = msg => {
	console.log();
	console.log(chalk.green(msg));
};

export const printWarn = msg => {
	console.log();
	console.log(chalk.yellow(msg));
};

function getLocalIP() {
	const ifaces = os.networkInterfaces();
	const ipList: string[] = [];

	Object.keys(ifaces).forEach(ifname => {
		let alias = 0;
		ifaces[ifname].forEach(iface => {
			if (iface.family !== "IPv4" || iface.internal !== false) {
				// skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
				return;
			}

			if (alias >= 1) {
				// this single interface has multiple ipv4 addresses
				console.log(ifname + ":" + alias, iface.address);
			} else {
				// this interface has only one ipv4 adress
				ipList.push(iface.address);
			}

			++alias;
		});
	});

	let ip: string | undefined = "";
	if (ipList.length > 0) {
		ip = ipList.find(item => item.includes("192"));
	}

	if (ip) {
		return ip;
	} else {
		printWarn("Can not get your local ip, using 127.0.0.1");
		return "127.0.0.1";
	}
}

export const localIP = getLocalIP();

export function alertSuccess(message: string) {
	notifier.notify({
		title: "ezpack",
		message
	});
}
