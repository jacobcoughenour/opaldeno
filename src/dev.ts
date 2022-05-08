import { bundle } from "./bundler.ts";
import { compile } from "./compiler.ts";
import { parse } from "./parser.ts";

export class DevServer {
	static async start(): Promise<void> {
		const server = Deno.listen({ port: 8080 });

		console.log("server started on port 8080");

		for await (const req of server) {
			handleHttp(req).catch(console.error);
		}

		async function handleHttp(req: Deno.Conn) {
			const httpReq = Deno.serveHttp(req);
			for await (const event of httpReq) {
				const url = new URL(event.request.url);
				const filepath = decodeURIComponent(url.pathname);

				let file;
				try {
					file = await Deno.open("." + filepath, { read: true });
				} catch {
					await event.respondWith(
						new Response("404 Not Found", {
							status: 404,
						})
					);
					return;
				}

				// todo auto-reload on file change

				if (filepath.endsWith(".opal")) {
					console.time("building " + filepath);

					const buildResult = await bundle(
						["./examples/basic/src/index.opal"],
						"./examples/basic/dist/index.js"
					);

					buildResult.outputFiles;

					await compile(
						await Deno.readTextFile("." + filepath),
						filepath
					);

					const index = await DevServer.generateIndex(
						"/examples/basic/dist/index.js"
					);
					console.timeEnd("building " + filepath);

					await event.respondWith(
						new Response(index, {
							headers: {
								"content-type": "text/html",
							},
						})
					);
				} else {
					const readableStream = file.readable;
					await event.respondWith(new Response(readableStream, {}));
				}
			}
		}
	}

	static async generateIndex(filepath: string): Promise<string> {
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
}
