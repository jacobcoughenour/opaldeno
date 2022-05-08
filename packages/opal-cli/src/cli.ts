#!/usr/bin/env node

import { start } from "./dev";
import { program } from "commander";

program.name("Opal CLI").version("0").description("Opal CLI");

program
	.command("build")
	.description("builds your opal project")
	.action(async () => {});

program
	.command("dev")
	.description("Runs a development server")
	.action(async () => {
		await start();
	});

program.parse();
