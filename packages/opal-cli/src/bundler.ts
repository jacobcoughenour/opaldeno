import { compiler } from "@opal/compiler";
import * as esbuild from "esbuild";
import path from "path";
import fs from "fs";

export function createPlugin(): esbuild.Plugin {
	return {
		name: "opal",
		setup(build) {
			build.onLoad(
				{
					filter: /\.opal$/,
				},
				async (args) => {
					// Load the file from the file system
					let source = await fs.promises.readFile(args.path, "utf8");

					let filename = path.relative(process.cwd(), args.path);

					// Convert Svelte syntax to JavaScript
					try {
						let js = await compiler.compile(source, filename);
						// let contents = js + `//# sourceMappingURL=` + js.map.toUrl();
						return {
							contents: js,
							warnings: [],
						};
					} catch (e) {
						return { errors: [] };
					}
				}
			);
		},
	};
}
