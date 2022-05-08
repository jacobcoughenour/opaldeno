import { compile } from "./compiler.ts";
import { Command } from "./deps.ts";
import { DevServer } from "./dev.ts";
import { parse } from "./parser.ts";

new Command()
	.name("Opal")
	.version("0")
	.description(
		"Opal is a simple command line tool for managing your Deno project"
	)
	.command("build", "build your opal project.")
	.action(async (args) => {
		console.log("building...");

		const filepath = "./tests/examples/basic.opal";
		const input = await Deno.readTextFile(filepath);

		const output = await compile(input, filepath);

		Deno.writeFileSync(
			"./tests/examples/basic.ts",
			new TextEncoder().encode(output)
		);
	})
	.command("dev", "run your opal project.")
	.action(async (args) => {
		await DevServer.start();
	})
	.parse(Deno.args);
