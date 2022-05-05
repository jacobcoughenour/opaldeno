import init, {
	compiler,
} from "https://deno.land/x/melody@v0.18.0/melody_wasm.js";
import chalkin from "https://deno.land/x/chalkin@v0.1.3/mod.ts";

await init();

export type Script = {};

export type Fragment = {
	tag: string;
	attributes?: {
		[key: string]: string;
	};
	bindings?: {
		[key: string]: string;
	};
	children?: Fragment[];
};

export type Document = {
	scripts: Script[];
	fragment: Fragment;
};

const whitespace = /\s+/;
const tag = /^<([a-zA-Z0-9-]+)/;

export class Parser {
	private _char = "";
	private _cursor = -1;
	private _line = 1;
	private _column = 0;
	private _source: string = "";
	private _filepath: string = "";

	constructor(source: string, filepath?: string) {
		this._source = source;
		this._filepath = filepath || "";
	}

	private getLineAt(cursor: number): {
		source: string;
		from: number;
		to: number;
	} {
		let from = cursor;
		let to = cursor + 1;
		while (from > 0 && this._source[from] !== "\n") from--;
		while (to < this._source.length && this._source[to] !== "\n") to++;
		return {
			source: this._source
				.slice(from, to)
				.replaceAll("\n", "")
				.replaceAll("\t", "    "),
			from,
			to,
		};
	}

	private createSyntaxError(error: string) {
		// how many extra lines to show around the current line
		const lines = 3;

		const middle = this.getLineAt(this._cursor);

		const gutterLength = (this._line + lines).toString().length;

		// the cursor thinks that tabs are 1 space long so we need to offset that
		const tabOffset =
			(this._source.slice(middle.from, this._cursor).match(/\t/g) || [])
				.length * 3;

		const middleSource = `> ${this._line
			.toString()
			.padStart(gutterLength, " ")} | ${middle.source}\n ${" ".repeat(
			gutterLength + 1
		)} |${" ".repeat(this._column + tabOffset)}^\n`;

		let topLines = "";
		let lastTopLine = middle.from - 1;
		for (let i = 1; i <= lines && this._line - i > 0; i++) {
			const top = this.getLineAt(lastTopLine);
			topLines =
				chalkin.dim(
					`  ${(this._line - i)
						.toString()
						.padStart(gutterLength, " ")} | ${top.source}\n`
				) + topLines;
			lastTopLine = top.from - 1;
		}

		let bottomLines = "";
		let lastBottomLine = middle.to;
		for (let i = 1; i <= lines; i++) {
			const bottom = this.getLineAt(lastBottomLine);
			bottomLines += chalkin.dim(
				`  ${(this._line + i)
					.toString()
					.padStart(gutterLength, " ")} | ${bottom.source}\n`
			);
			lastBottomLine = bottom.to;
			if (bottom.to === this._source.length) break;
		}

		return new SyntaxError(
			[
				`\n\n${chalkin.bgRed.black.bold(" ERROR ")} ${error}\n\n`,
				chalkin.cyan(this._filepath),
				":",
				chalkin.yellow(this._line),
				":",
				chalkin.yellow(this._column),

				`\n${topLines}${middleSource}${bottomLines}`,
			].join("")
		);
	}

	/**
	 * @returns true if next() can be called
	 */
	private hasNext = () => this._cursor < this._source.length;

	/**
	 * gets next character and advances cursor
	 * @returns next char
	 */
	private next = (skip: number = 1) => {
		while (skip > 0 && this.hasNext()) {
			if (this._char === "\n") {
				this._line++;
				this._column = 1;
			} else {
				this._column++;
			}

			skip--;
			this._cursor++;

			console.log(
				"cursor",
				`${this._cursor} ${this._line}:${this._column}`,
				this._char.replace("\n", "\\n").replace("\t", "\\t")
			);

			this._char = this._source[this._cursor];
		}

		return this._char;
	};

	/**
	 * returns first match from the regex starting at the current cursor
	 * position then advances the cursor to the end of that match.
	 * don't forget to use ^ at the start of the regex.
	 * @param regex
	 * @returns
	 */
	private capture = (regex: RegExp) => {
		const match = this._source.slice(this._cursor).match(regex);
		if (!match) throw this.createSyntaxError(`Failed to capture ${regex}`);
		this.next(match[0].length);
		return match[0];
	};

	private unexpected = () => {
		throw this.createSyntaxError(`Unexpected character`);
	};

	// go until next non whitespace char
	private skipWhitespace = () => {
		this.capture(/^[\s\t\n]*/);
	};

	parse(): Document {
		const scripts: Script[] = [];
		const fragments: Fragment[] = [];

		const fragmentStack: Fragment[] = [];

		// sets the cursor to the first character
		this.next();

		while (this.hasNext()) {
			this.skipWhitespace();

			// console.log(cursor, char);

			if (this._char !== "<") this.unexpected();

			if (!this.hasNext()) this.unexpected();
			this.next();

			// console.log(char);

			// if comment
			if (this._char === "!") {
				// capture until end of comment
				this.capture(/^!--[\s\S]*?-->/);
				// go to next tag
				continue;
			}

			// parse tag name

			this.skipWhitespace();
			const tagName = this.capture(/^[a-zA-Z]+/);

			this.skipWhitespace();

			// collect attributes until closing >
			while (this.hasNext()) {
				if (this._char === "/") {
					// no children
					// make sure next is >
				} else if (this._char === ">") {
					// has children
				}
			}

			console.log(tagName);

			// let name = "";
			// while (hasNext()) {}

			// if (name.length === 0) unexpected();

			// parse attributes

			// push to stack
		}

		// find <

		// is script or fragment?

		// find

		return {
			scripts: [],
			fragment: {
				tag: "",
			},
		};
	}
}
