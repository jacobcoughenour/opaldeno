import * as esbuild from "https://deno.land/x/esbuild@v0.14.38/mod.js";
import { compile } from "./compiler.ts";
import { relative } from "https://deno.land/std/path/mod.ts";

export async function bundle(entryPoints: string[], outfile: string) {
	const plugin: esbuild.Plugin = {
		name: "opal",
		setup(build) {
			build.onLoad(
				{
					filter: /\.opal$/,
				},
				async (args) => {
					// Load the file from the file system
					let source = await Deno.readTextFile(args.path);
					let filename = relative(Deno.cwd(), args.path);

					// Convert Svelte syntax to JavaScript
					try {
						let js = await compile(source, filename);
						// let contents = js + `//# sourceMappingURL=` + js.map.toUrl();
						return {
							contents: js,
							warnings: [],
						};
					} catch (e) {
						console.log(e);
						return { errors: [e] };
					}
				}
			);
		},
	};

	return await esbuild.build({
		entryPoints,
		outfile,
		target: "esnext",
		bundle: true,
		plugins: [plugin],
	});
}
