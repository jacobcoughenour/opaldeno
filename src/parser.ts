import chalkin from "https://deno.land/x/chalkin@v0.1.3/mod.ts";

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

let _char: string = "";
let _cursor = -1;
let _line = 1;
let _column = 0;
let _source: string = "";
let _filepath: string = "";

const getChar = (): string => _char;

const getLineAt = (
	cursor: number
): {
	source: string;
	from: number;
	to: number;
} => {
	let from = cursor;
	let to = cursor + 1;
	while (from > 0 && _source[from] !== "\n") from--;
	while (to < _source.length && _source[to] !== "\n") to++;
	return {
		source: _source.slice(from, to),
		from,
		to,
	};
};

const createSyntaxError = (error: string) => {
	// how many extra lines to show around the current line
	const lines = 3;

	const middle = getLineAt(_cursor);

	const gutterLength = (_line + lines).toString().length;

	// the cursor thinks that tabs are 1 space long so we need to offset that
	const tabOffset =
		(_source.slice(middle.from, _cursor).match(/\t/g) || []).length * 3;

	const middleSource = [
		"> ",
		_line.toString().padStart(gutterLength, " "),
		" | ",
		middle.source.replaceAll("\n", "").replaceAll("\t", "    "),
		chalkin.dim(
			`\n ${" ".repeat(gutterLength + 1)} ${"|"}${" ".repeat(
				_column + tabOffset
			)}`
		),
		chalkin.red("^"),
		"\n",
	].join("");

	let topLines = "";
	let lastTopLine = middle.from - 1;
	for (let i = 1; i <= lines && _line - i > 0; i++) {
		const top = getLineAt(lastTopLine);
		topLines =
			chalkin.dim(
				`  ${(_line - i)
					.toString()
					.padStart(gutterLength, " ")} | ${top.source
					.replaceAll("\n", "")
					.replaceAll("\t", "    ")}\n`
			) + topLines;
		lastTopLine = top.from - 1;
	}

	let bottomLines = "";

	if (_cursor < _source.length) {
		let lastBottomLine = middle.to;
		for (let i = 1; i <= lines; i++) {
			const bottom = getLineAt(lastBottomLine);
			bottomLines += chalkin.dim(
				`  ${(_line + i)
					.toString()
					.padStart(gutterLength, " ")} | ${bottom.source
					.replaceAll("\n", "")
					.replaceAll("\t", "    ")}\n`
			);
			lastBottomLine = bottom.to;
			if (bottom.to >= _source.length - 1) break;
		}
	}

	return new SyntaxError(
		[
			`\n\n${chalkin.bgRed.black.bold(" ERROR ")} ${error}\n\n`,
			chalkin.cyan(_filepath),
			":",
			chalkin.yellow(_line),
			":",
			chalkin.yellow(_column),

			`\n${topLines}${middleSource}${bottomLines}`,
		].join("")
	);
};

/**
 * @returns true if next() can be called
 */
const hasNext = () => _cursor < _source.length;

/**
 * gets next character and advances cursor
 * @returns next char
 */
const next = (skip: number = 1) => {
	while (skip > 0 && hasNext()) {
		if (_char === "\n") {
			_line++;
			_column = 1;
		} else {
			_column++;
		}

		skip--;
		_cursor++;

		// console.log(
		// 	`${_cursor}\t${_line}:${_column}\t${_char
		// 		.replace("\n", "\\n")
		// 		.replace("\t", "\\t")}`
		// );

		_char = _source[_cursor];
	}

	return _char;
};

const tryCapture = (regex: RegExp): string | false => {
	const match = _source.slice(_cursor).match(regex);
	if (!match) return false;
	next(match[0].length);
	return match[0];
};

/**
 * returns first match from the regex starting at the current cursor
 * position then advances the cursor to the end of that match.
 * don't forget to use ^ at the start of the regex.
 * @param regex
 * @returns
 */
const capture = (regex: RegExp, name: string): string => {
	const ret = tryCapture(regex);
	if (ret === false)
		throw createSyntaxError(
			`Failed to capture ${name} with regex: ${regex}`
		);
	return ret;
};

const unexpected = () => {
	throw createSyntaxError(`Unexpected character`);
};

// go until next non whitespace char
const skipWhitespace = () => {
	capture(/^[\s\t\n]*/, "whitespace");
};

export function parse(source: string, filepath?: string): Document {
	_source = source;
	_filepath = filepath || "";
	_char = "";
	_cursor = -1;
	_line = 1;
	_column = 0;

	console.time("parse");

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
	next();

	while (hasNext()) {
		skipWhitespace();

		if (_char !== "<") unexpected();

		if (!hasNext()) unexpected();
		next();

		// if comment
		if (_char === "!") {
			// capture until end of comment
			capture(/^!--[\s\S]*?-->/, "comment");
			// go to next tag
			continue;
		}

		// if closing tag
		if (_char === "/") {
			if (!hasNext()) throw createSyntaxError("Expected tag name");
			next();

			// capture until end of tag
			const tagName = capture(/^[a-zA-Z]+/, "tag name");

			const cur = getCurrentFragment();
			if (!cur)
				throw createSyntaxError(
					"Closing tag before and tag as been opened"
				);
			if (cur.name !== tagName)
				throw createSyntaxError(
					`Closing ${tagName} tag before ${cur.name} tag`
				);

			if (getChar() !== ">") throw createSyntaxError("Expected >");

			fragmentStack.pop();
			pushFragment(cur);

			next();
			continue;
		}

		// parse tag name

		skipWhitespace();
		const tagName = capture(/^[a-zA-Z]+/, "tag name");

		let currentFragment: Fragment = {
			name: tagName,
		};

		skipWhitespace();

		// collect attributes until closing > or />
		while (hasNext()) {
			// if closing element with />
			if (_char === "/") {
				// make sure next is >
				if (!hasNext() || next() !== ">")
					throw createSyntaxError("Expected >");

				// end of tag
				pushFragment(currentFragment);

				next();
				break;
			}
			// if ending opening tag with >
			else if (_char === ">") {
				// if this is a script tag, we want to capture the body of it
				// as a raw string.
				if (currentFragment.name === "script") {
					let scriptSource = "";
					let lastQuote: string | null = null;
					let escaped = false;

					// capture until end of script
					while (hasNext()) {
						const char = next();

						// if we are not in a string and we see a <
						if (lastQuote === null && char === "<") {
							// end of file check
							if (!hasNext()) {
								throw createSyntaxError("Expected </script>");
							}

							if (!!tryCapture(/^<\/script>/)) {
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

					if (!hasNext())
						throw createSyntaxError(
							`Missing closing tag for ${tagName}. Did you mean to use />?`
						);
				}

				// move to next fragment
				next();
				break;
			}
			// shorthand binding
			else if (_char === "{") {
				if (!hasNext())
					throw createSyntaxError("Expected binding value after {");
				next();
				skipWhitespace();

				const attributeName = capture(
					/^(([\w]+)((.([\w])+)*))+/,
					"shorthand binding attribute name"
				);

				skipWhitespace();

				if (getChar() !== "}")
					throw createSyntaxError(
						"Expected } to complete shorthand binding"
					);

				setBinding(currentFragment, attributeName, attributeName);

				if (!hasNext())
					throw createSyntaxError(
						"Incomplete tag after shorthand binding"
					);

				next();
				skipWhitespace();
			}
			// attribute
			else {
				// parse attribute name

				const attributeName = capture(
					/^(([\w]+)((.([\w])+)*))+/,
					"attribute name"
				);

				if (getChar() === "=") {
					if (!hasNext())
						throw createSyntaxError("Expected value after =");
					next();

					// handle string
					if (/^[\'\"]/.test(_char)) {
						const quote = _char;
						next();

						const value = capture(
							new RegExp(`^[^${quote}]*${quote}`),
							"attribute value"
						).slice(0, -1);

						setAttribute(currentFragment, attributeName, value);
					} else if (_char === "`") {
						// todo handle template strings

						throw createSyntaxError(
							"Template strings not supported yet"
						);
					} else if (_char === "{") {
						if (!hasNext())
							throw createSyntaxError(
								"Expected binding value after {"
							);

						let bindingSource = "";
						let lastQuote: string | null = null;
						let escaped = false;
						let bracketStack = 0;

						// capture until end of binding source
						while (hasNext()) {
							const char = next();

							if (char === "{") {
								bracketStack++;
							}
							// if we are not in a string and we see a }
							else if (lastQuote === null && char === "}") {
								if (bracketStack === 0) {
									// end of file check
									if (!hasNext()) {
										throw createSyntaxError("Expected }");
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

						if (!hasNext())
							throw createSyntaxError(
								"Incomplete tag after binding"
							);

						next();
					} else {
						throw createSyntaxError("Expected value after =");
					}
				} else {
					// attributes without = are shorthand for =true
					setAttribute(currentFragment, attributeName, true);
				}

				skipWhitespace();
			}
		}
	}

	if (fragmentStack.length > 0) {
		throw createSyntaxError(`Unclosed tag ${getCurrentFragment()?.name}`);
	}

	console.timeEnd("parse");

	return {
		scripts,
		fragments,
	};
}
