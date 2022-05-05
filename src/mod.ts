import { Command } from "./deps.ts";
import { Parser } from "./parser.ts";

new Command()
	.name("Opal")
	.version("0")
	.description(
		"Opal is a simple command line tool for managing your Deno project"
	)
	// .command("build", "build your opal project.")
	.action(async (args) => {
		console.log("building...");

		const filepath = "./tests/examples/basic.opal";
		const input = await Deno.readTextFile(filepath);
		new Parser(input, filepath).parse();
	})
	.parse(Deno.args);
