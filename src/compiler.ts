import { Document, parse } from "./parser.ts";
import CodeBlockWriter from "https://deno.land/x/code_block_writer@11.0.0/mod.ts";

export async function compile(
	source: string,
	filepath?: string
): Promise<string> {
	console.time("compile");

	const parsed = await parse(source, filepath);

	const w = new CodeBlockWriter();

	w.writeLine(`import * as THREE from 'three';`);

	w.writeLine(`const scene = new THREE.Scene();`);

	// parsed.fragments.forEach((fragment) => {
	// 	writer.writeLine(`opal.fragment("${fragment.name}", )`);
	// });

	w.writeLine(`const renderer = new THREE.WebGLRenderer();`);
	w.writeLine(
		`document.getElementById("root").appendChild(renderer.domElement);`
	);

	const compiled = w.toString();

	// await esbuild.build({
	// 	entryPoints
	// })

	console.timeEnd("compile");

	return compiled;
}
