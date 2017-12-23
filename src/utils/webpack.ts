import * as DynamicEntryPlugin from "webpack/lib/DynamicEntryPlugin";

export function addWebpackEntry(
	compilation,
	context,
	name,
	entry
): Promise<never> {
	return new Promise((resolve, reject) => {
		const dep = DynamicEntryPlugin.createDependency(entry, name);
		compilation.addEntry(context, dep, name, err => {
			if (err) return reject(err);
			resolve();
		});
	});
}
