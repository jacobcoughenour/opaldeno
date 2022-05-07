import { Document, Parser } from "../src/parser.ts";
import { assertEquals } from "https://deno.land/std@0.137.0/testing/asserts.ts";

Deno.test("parse", () => {
	assertEquals<Document>(
		Parser.load(`
<script lang="ts">
	console.log("hello world");
	let color: string = "red";
</script>

<scene name="demo scene">
	<box {color} />
</scene>`),
		{
			scripts: [
				{
					attributes: {
						lang: "ts",
					},
					source: '\n\tconsole.log("hello world");\n\tlet color: string = "red";\n',
				},
			],
			fragments: [
				{
					name: "scene",
					attributes: {
						name: "demo scene",
					},
					children: [
						{
							name: "box",
							bindings: {
								color: "color",
							},
						},
					],
				},
			],
		}
	);
});
