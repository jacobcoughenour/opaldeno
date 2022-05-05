import { Parser } from "../src/parser.ts";
import { assertEquals } from "https://deno.land/std@0.137.0/testing/asserts.ts";

Deno.test("parse", () => {
	const input = `<script lang="ts">
	console.log("hello world");
	let color: string = "red";
</script>

<scene name="demo scene">
	<box color={bind:color} />
</scene>`;

	assertEquals(Parser.parse(input), {});
});
