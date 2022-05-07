import init, {
	compiler,
} from "https://deno.land/x/melody@v0.18.0/melody_wasm.js";
import chalkin from "https://deno.land/x/chalkin@v0.1.3/mod.ts";

await init();

export type Script = {
	attributes?: {
		[key: string]: string | boolean | number;
	};
	source: string;
};

export type Fragment = {
	name: string;
	attributes?: {
		[key: string]: string | boolean | number;
	};
	bindings?: {
		[key: string]: string;
	};
	children?: Fragment[];
};

export type Document = {
	scripts: Script[];
	fragments: Fragment[];
};

const whitespace = /\s+/;
const tag = /^<([a-zA-Z0-9-]+)/;

export class Parser {
	private _char: string = "";
	private _cursor = -1;
	private _line = 1;
	private _column = 0;
	private _source: string = "";
	private _filepath: string = "";

	constructor(source: string, filepath?: string) {
		this._source = source;
		this._filepath = filepath || "";
	}

	private getChar(): string {
		return this._char;
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
			source: this._source.slice(from, to),
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

		const middleSource = [
			"> ",
			this._line.toString().padStart(gutterLength, " "),
			" | ",
			middle.source.replaceAll("\n", "").replaceAll("\t", "    "),
			chalkin.dim(
				`\n ${" ".repeat(gutterLength + 1)} ${"|"}${" ".repeat(
					this._column + tabOffset
				)}`
			),
			chalkin.red("^"),
			"\n",
		].join("");

		let topLines = "";
		let lastTopLine = middle.from - 1;
		for (let i = 1; i <= lines && this._line - i > 0; i++) {
			const top = this.getLineAt(lastTopLine);
			topLines =
				chalkin.dim(
					`  ${(this._line - i)
						.toString()
						.padStart(gutterLength, " ")} | ${top.source
						.replaceAll("\n", "")
						.replaceAll("\t", "    ")}\n`
				) + topLines;
			lastTopLine = top.from - 1;
		}

		let bottomLines = "";

		if (this._cursor < this._source.length) {
			let lastBottomLine = middle.to;
			for (let i = 1; i <= lines; i++) {
				const bottom = this.getLineAt(lastBottomLine);
				bottomLines += chalkin.dim(
					`  ${(this._line + i)
						.toString()
						.padStart(gutterLength, " ")} | ${bottom.source
						.replaceAll("\n", "")
						.replaceAll("\t", "    ")}\n`
				);
				lastBottomLine = bottom.to;
				if (bottom.to >= this._source.length - 1) break;
			}
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
				`${this._cursor}\t${this._line}:${this._column}\t${this._char
					.replace("\n", "\\n")
					.replace("\t", "\\t")}`
			);

			this._char = this._source[this._cursor];
		}

		return this._char;
	};

	private tryCapture = (regex: RegExp): string | false => {
		const match = this._source.slice(this._cursor).match(regex);
		if (!match) return false;
		this.next(match[0].length);
		return match[0];
	};

	/**
	 * returns first match from the regex starting at the current cursor
	 * position then advances the cursor to the end of that match.
	 * don't forget to use ^ at the start of the regex.
	 * @param regex
	 * @returns
	 */
	private capture = (regex: RegExp, name: string): string => {
		const ret = this.tryCapture(regex);
		if (ret === false)
			throw this.createSyntaxError(
				`Failed to capture ${name} with regex: ${regex}`
			);
		return ret;
	};

	private unexpected = () => {
		throw this.createSyntaxError(`Unexpected character`);
	};

	// go until next non whitespace char
	private skipWhitespace = () => {
		this.capture(/^[\s\t\n]*/, "whitespace");
	};

	public static load(source: string, filepath?: string) {
		return new Parser(source, filepath).parse();
	}

	public parse(): Document {
		const scripts: Script[] = [];
		const fragments: Fragment[] = [];

		const fragmentStack: Fragment[] = [];

		const getCurrentFragment = () => {
			const len = fragmentStack.length;
			return len === 0 ? null : fragmentStack[fragmentStack.length - 1];
		};

		const pushFragment = (fragment: Fragment) => {
			const parent = getCurrentFragment();
			if (parent) {
				if (!parent.children) parent.children = [];
				parent.children.push(fragment);
			} else fragments.push(fragment);
		};

		const setAttribute = (
			frag: Fragment,
			name: string,
			value: string | boolean | number
		) => {
			if (!frag) throw new Error("No fragment to set attribute on");
			if (!frag.attributes) frag.attributes = {};
			if (frag.attributes[name] !== undefined)
				throw new Error(`Attribute ${name} already set`);
			frag.attributes[name] = value;
		};

		const setBinding = (frag: Fragment, name: string, value: string) => {
			if (!frag) throw new Error("No fragment to set binding on");
			if (!frag.bindings) frag.bindings = {};
			if (frag.bindings[name] !== undefined)
				throw new Error(`Binding ${name} already set`);
			frag.bindings[name] = value;
		};

		// sets the cursor to the first character
		this.next();

		while (this.hasNext()) {
			this.skipWhitespace();

			// console.log(
			// 	"stack",
			// 	chalkin.bgCyan(fragmentStack.map((x) => x.name).join(" > "))
			// );

			console.log("frags", JSON.stringify(fragments, undefined, 2));

			if (this._char !== "<") this.unexpected();

			if (!this.hasNext()) this.unexpected();
			this.next();

			// if comment
			if (this._char === "!") {
				// capture until end of comment
				this.capture(/^!--[\s\S]*?-->/, "comment");
				// go to next tag
				continue;
			}

			// if closing tag
			if (this._char === "/") {
				if (!this.hasNext())
					throw this.createSyntaxError("Expected tag name");
				this.next();

				// capture until end of tag
				const tagName = this.capture(/^[a-zA-Z]+/, "tag name");

				const cur = getCurrentFragment();
				if (!cur)
					throw this.createSyntaxError(
						"Closing tag before and tag as been opened"
					);
				if (cur.name !== tagName)
					throw this.createSyntaxError(
						`Closing ${tagName} tag before ${cur.name} tag`
					);

				if (this.getChar() !== ">")
					throw this.createSyntaxError("Expected >");

				fragmentStack.pop();
				pushFragment(cur);

				this.next();
				continue;
			}

			// parse tag name

			this.skipWhitespace();
			const tagName = this.capture(/^[a-zA-Z]+/, "tag name");

			let currentFragment: Fragment = {
				name: tagName,
			};

			this.skipWhitespace();

			// collect attributes until closing > or />
			while (this.hasNext()) {
				// if closing element with />
				if (this._char === "/") {
					// make sure next is >
					if (!this.hasNext() || this.next() !== ">")
						throw this.createSyntaxError("Expected >");

					// end of tag
					pushFragment(currentFragment);

					this.next();
					break;
				}
				// if ending opening tag with >
				else if (this._char === ">") {
					// if this is a script tag, we want to capture the body of it
					// as a raw string.
					if (currentFragment.name === "script") {
						let scriptSource = "";
						let lastQuote: string | null = null;
						let escaped = false;

						// capture until end of script
						while (this.hasNext()) {
							const char = this.next();

							// if we are not in a string and we see a <
							if (lastQuote === null && char === "<") {
								// end of file check
								if (!this.hasNext()) {
									throw this.createSyntaxError(
										"Expected </script>"
									);
								}

								if (!!this.tryCapture(/^<\/script>/)) {
									// we have reached the end of the script.
									// add it to the list of scripts.

									scripts.push({
										attributes: currentFragment.attributes,
										source: scriptSource,
									});
									break;
								}
							}
							// handle strings in the script body
							else if (/['"]/.test(char)) {
								// if the last character is not a backslash
								if (!escaped) {
									if (lastQuote === char) {
										lastQuote = null;
									} else {
										lastQuote = char;
									}
								}
							}

							scriptSource += char;

							escaped = char === "\\";
						}
					} else {
						// parse any children between the opening and closing tag

						// push into stack
						fragmentStack.push(currentFragment);

						if (!this.hasNext())
							throw this.createSyntaxError(
								`Missing closing tag for ${tagName}. Did you mean to use />?`
							);
					}

					// move to next fragment
					this.next();
					break;
				}
				// shorthand binding
				else if (this._char === "{") {
					if (!this.hasNext())
						throw this.createSyntaxError(
							"Expected binding value after {"
						);
					this.next();
					this.skipWhitespace();

					const attributeName = this.capture(
						/^(([\w]+)((.([\w])+)*))+/,
						"shorthand binding attribute name"
					);

					this.skipWhitespace();

					if (this.getChar() !== "}")
						throw this.createSyntaxError(
							"Expected } to complete shorthand binding"
						);

					setBinding(currentFragment, attributeName, attributeName);

					if (!this.hasNext())
						throw this.createSyntaxError(
							"Incomplete tag after shorthand binding"
						);

					this.next();
					this.skipWhitespace();
				}
				// attribute
				else {
					// parse attribute name

					const attributeName = this.capture(
						/^(([\w]+)((.([\w])+)*))+/,
						"attribute name"
					);

					if (this.getChar() === "=") {
						if (!this.hasNext())
							throw this.createSyntaxError(
								"Expected value after ="
							);
						this.next();

						// handle string
						if (/^[\'\"]/.test(this._char)) {
							const quote = this._char;
							this.next();

							const value = this.capture(
								new RegExp(`^[^${quote}]*${quote}`),
								"attribute value"
							).slice(0, -1);

							setAttribute(currentFragment, attributeName, value);
						} else if (this._char === "`") {
							// todo handle template strings

							throw this.createSyntaxError(
								"Template strings not supported yet"
							);
						} else if (this._char === "{") {
							if (!this.hasNext())
								throw this.createSyntaxError(
									"Expected binding value after {"
								);

							let bindingSource = "";
							let lastQuote: string | null = null;
							let escaped = false;
							let bracketStack = 0;

							// capture until end of binding source
							while (this.hasNext()) {
								const char = this.next();

								if (char === "{") {
									bracketStack++;
								}
								// if we are not in a string and we see a }
								else if (lastQuote === null && char === "}") {
									if (bracketStack === 0) {
										// end of file check
										if (!this.hasNext()) {
											throw this.createSyntaxError(
												"Expected }"
											);
										}

										// we have reached the end of the binding.
										// add it to the list of bindings.

										setBinding(
											currentFragment,
											attributeName,
											bindingSource
										);

										break;
									} else {
										bracketStack--;
									}
								}
								// handle strings in the script body
								else if (/['"]/.test(char)) {
									// if the last character is not a backslash
									if (!escaped) {
										lastQuote =
											lastQuote === char ? null : char;
									}
								}

								bindingSource += char;

								escaped = char === "\\";
							}

							if (!this.hasNext())
								throw this.createSyntaxError(
									"Incomplete tag after binding"
								);

							this.next();
						} else {
							throw this.createSyntaxError(
								"Expected value after ="
							);
						}
					} else {
						// attributes without = are shorthand for =true
						setAttribute(currentFragment, attributeName, true);
					}

					this.skipWhitespace();
				}
			}
		}

		if (fragmentStack.length > 0) {
			throw this.createSyntaxError(
				`Unclosed tag ${getCurrentFragment()?.name}`
			);
		}

		return {
			scripts,
			fragments,
		};
	}
}
