import { createPlugin } from "./bundler";
// import { compile } from "./compiler.ts";
// import { parse } from "./parser.ts";
import express from "express";
import http from "http";
import * as esbuild from "esbuild";

function generateIndex(filepath: string): string {
	return `<!DOCTYPE html>
	<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Opal</title>
		</head>
		<body>
			<div id="root"></div>
			<script src="${filepath}"></script>
		</body>
	</html>`;
}

export async function start(): Promise<void> {
	await esbuild
		.serve(
			{
				// servedir: "./dist",
			},
			{
				entryPoints: ["src/index.opal"],
				target: "esnext",
				bundle: true,
				sourcemap: true,
				plugins: [createPlugin()],
			}
		)
		.then((server) => {
			const { host, port } = server;

			// Then start a proxy server on port 3000
			http.createServer((req, res) => {
				const options = {
					hostname: host,
					port: port,
					path: req.url,
					method: req.method,
					headers: req.headers,
				};

				// Forward each incoming request to esbuild
				const proxyReq = http.request(options, (proxyRes) => {
					// generate index.html when requested
					if (req.url === "/" || req.url === "index.html") {
						res.writeHead(200, { "Content-Type": "text/html" });
						res.end(generateIndex("index.js"));
						return;
					}

					// Otherwise, forward the response from esbuild to the client
					res.writeHead(proxyRes.statusCode || 404, proxyRes.headers);
					proxyRes.pipe(res, { end: true });
				});

				// Forward the body of the request to esbuild
				req.pipe(proxyReq, { end: true });
			}).listen(8080);

			console.log(`Server running at http://${host}:${8080}`);
		});

	// const app = express();

	// app.get("/", async (req, res) => {
	// 	console.log(process.cwd());

	// 	// console.time("building " + filepath);

	// 	// const buildResult = await bundle(
	// 	// 	["./examples/basic/src/index.opal"],
	// 	// 	"./examples/basic/dist/index.js"
	// 	// );

	// 	// buildResult.outputFiles;
	// 	// await compile(
	// 	// 	await Deno.readTextFile("." + filepath),
	// 	// 	filepath
	// 	// );
	// 	// const index = await DevServer.generateIndex(
	// 	// 	"/examples/basic/dist/index.js"
	// 	// );
	// 	// console.timeEnd("building " + filepath);
	// 	// await event.respondWith(
	// 	// 	new Response(index, {
	// 	// 		headers: {
	// 	// 			"content-type": "text/html",
	// 	// 		},
	// 	// 	})
	// 	// );

	// 	res.send("hello world");
	// });

	// const server = app.listen(8080, () => {
	// 	console.log("server started on port 8080");
	// });

	// process.on("SIGINT", () => {
	// 	server.close();
	// });

	// const server = Deno.listen({ port: 8080 });
	// for await (const req of server) {
	// 	handleHttp(req).catch(console.error);
	// }
	// async function handleHttp(req: Deno.Conn) {
	// 	const httpReq = Deno.serveHttp(req);
	// 	for await (const event of httpReq) {
	// 		const url = new URL(event.request.url);
	// 		const filepath = decodeURIComponent(url.pathname);
	// 		let file;
	// 		try {
	// 			file = await Deno.open("." + filepath, { read: true });
	// 		} catch {
	// 			await event.respondWith(
	// 				new Response("404 Not Found", {
	// 					status: 404,
	// 				})
	// 			);
	// 			return;
	// 		}
	// 		// todo auto-reload on file change
	// 		if (filepath.endsWith(".opal")) {
	// 			console.time("building " + filepath);
	// 			const buildResult = await bundle(
	// 				["./examples/basic/src/index.opal"],
	// 				"./examples/basic/dist/index.js"
	// 			);
	// 			buildResult.outputFiles;
	// 			await compile(
	// 				await Deno.readTextFile("." + filepath),
	// 				filepath
	// 			);
	// 			const index = await DevServer.generateIndex(
	// 				"/examples/basic/dist/index.js"
	// 			);
	// 			console.timeEnd("building " + filepath);
	// 			await event.respondWith(
	// 				new Response(index, {
	// 					headers: {
	// 						"content-type": "text/html",
	// 					},
	// 				})
	// 			);
	// 		} else {
	// 			const readableStream = file.readable;
	// 			await event.respondWith(new Response(readableStream, {}));
	// 		}
	// 	}
	// }
}
