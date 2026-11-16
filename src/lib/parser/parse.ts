import { parseNonFiniteFloat } from "./float.js";
import { decodePropertyName } from "./property-name.js";
import { MAX_DEPTH, ReferenceSlots } from "./references.js";
import {
	ParseError,
	type PhpArrayEntry,
	type PhpInt,
	type PhpObjectProperty,
	type PhpString,
	type PhpValue,
} from "./types.js";
import { utf8Width } from "./utf8.js";

const MAX_ELEMENT_COUNT = 1_000_000;

const TYPE_BY_LETTER: Record<string, PhpValue["type"]> = {
	N: "null",
	b: "bool",
	i: "int",
	d: "float",
	s: "string",
	a: "array",
	O: "object",
	C: "custom_object",
	E: "enum",
	R: "reference",
	r: "reference",
};

const VALUE_HEADER = /^(?:N;|b:[01];|i:-?\d+;|d:[^;]+;|s:\d+:|a:\d+:\{|O:\d+:|C:\d+:|E:\d+:|[Rr]:\d+;)/;
const FLOAT_LITERAL = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

/** Whether `text` starts like a serialized value. Only the first header is checked. */
export function looksSerialized(text: string): boolean {
	return VALUE_HEADER.test(text);
}

export function parse(input: string): PhpValue {
	const parser = new Parser(input);
	const value = parser.parseValue(0);
	if (parser.position < input.length) throw parser.error("Unexpected data after end of serialized value");
	return value;
}

class Parser {
	position = 0;
	readonly #references = new ReferenceSlots();

	constructor(private readonly input: string) {}

	error(message: string, at = this.position): ParseError {
		const before = this.input.slice(Math.max(0, at - 10), at);
		const after = this.input.slice(at, at + 10);
		return new ParseError(message, at, `${before}[HERE]${after}`);
	}

	parseValue(depth: number): PhpValue {
		if (depth > MAX_DEPTH) throw this.error(`Maximum nesting depth of ${MAX_DEPTH} exceeded`);

		const letter = this.#peek();
		const type = TYPE_BY_LETTER[letter];
		if (type === undefined) throw this.error(`Unknown type identifier '${letter}'`);

		if (type === "reference") {
			const reference = this.#parseReference(letter === "r");
			const problem = this.#references.add(reference);
			if (problem) throw this.error(problem);
			return reference;
		}

		this.#references.add({ type });
		switch (type) {
			case "null":
				this.#expect("N;");
				return { type: "null" };
			case "bool":
				return this.#parseBool();
			case "int":
				return this.#parseInt();
			case "float":
				return this.#parseFloat();
			case "string":
				return this.#parseString();
			case "array":
				return this.#parseArray(depth);
			case "object":
				return this.#parseObject(depth);
			case "custom_object":
				return this.#parseCustomObject();
			case "enum":
				return this.#parseEnum();
		}
	}

	#parseBool(): PhpValue {
		this.#expect("b:");
		const value = this.#readChar();
		if (value !== "0" && value !== "1") throw this.error("Expected '0' or '1' for boolean", this.position - 1);
		this.#expect(";");
		return { type: "bool", value: value === "1" };
	}

	#parseInt(): PhpInt {
		this.#expect("i:");
		const value = this.#readNumber();
		this.#expect(";");
		return { type: "int", value };
	}

	#parseFloat(): PhpValue {
		this.#expect("d:");
		const text = this.#readUntil(";");
		let value = parseNonFiniteFloat(text);
		if (value === undefined) {
			if (!FLOAT_LITERAL.test(text)) throw this.error(`Invalid float value '${text}'`);
			value = parseFloat(text);
		}
		this.#expect(";");
		return { type: "float", value };
	}

	#parseString(): PhpString {
		this.#expect("s:");
		const value = this.#readQuoted();
		this.#expect(";");
		return { type: "string", value };
	}

	#parseArray(depth: number): PhpValue {
		this.#expect("a:");
		const count = this.#readCount("array element count");
		this.#expect(":{");

		const entries: PhpArrayEntry[] = [];
		for (let i = 0; i < count; i++) {
			const keyType = this.#peek();
			let key: PhpArrayEntry["key"];
			if (keyType === "i") key = this.#parseInt();
			else if (keyType === "s") key = this.#parseString();
			else throw this.error(`Array key must be integer or string, got '${keyType}'`);

			entries.push({ key, value: this.parseValue(depth + 1) });
		}

		this.#expect("}");
		return { type: "array", entries };
	}

	#parseObject(depth: number): PhpValue {
		this.#expect("O:");
		const className = this.#readQuoted();
		this.#expect(":");
		const count = this.#readCount("object property count");
		this.#expect(":{");

		const properties: PhpObjectProperty[] = [];
		for (let i = 0; i < count; i++) {
			const name = decodePropertyName(this.#parseString().value, className);
			properties.push({ ...name, value: this.parseValue(depth + 1) });
		}

		this.#expect("}");
		return { type: "object", className, properties };
	}

	#parseCustomObject(): PhpValue {
		this.#expect("C:");
		const className = this.#readQuoted();
		this.#expect(":");
		const length = this.#readNumber();
		this.#expect(":{");
		const payload = this.#readBytes(length);
		this.#expect("}");
		return { type: "custom_object", className, payload };
	}

	#parseEnum(): PhpValue {
		this.#expect("E:");
		const name = this.#readQuoted();
		this.#expect(";");

		const separator = name.indexOf(":");
		if (separator <= 0 || separator === name.length - 1) throw this.error(`Invalid enum identifier '${name}'`);
		return { type: "enum", className: name.slice(0, separator), caseName: name.slice(separator + 1) };
	}

	#parseReference(isObject: boolean): PhpValue & { type: "reference" } {
		this.#expect(isObject ? "r:" : "R:");
		const index = this.#readNumber();
		this.#expect(";");
		return { type: "reference", index, isObject };
	}

	#peek(): string {
		if (this.position >= this.input.length) throw this.error("Unexpected end of input");
		return this.input[this.position];
	}

	#readChar(): string {
		const char = this.#peek();
		this.position++;
		return char;
	}

	#expect(text: string): void {
		for (const char of text) {
			const actual = this.#readChar();
			if (actual !== char) throw this.error(`Expected '${char}', got '${actual}'`, this.position - 1);
		}
	}

	#readNumber(): number {
		const start = this.position;
		if (this.#peek() === "-") this.position++;
		const digitsStart = this.position;
		while (this.position < this.input.length && this.input[this.position] >= "0" && this.input[this.position] <= "9") {
			this.position++;
		}
		if (this.position === digitsStart) throw this.error("Expected number", start);
		return parseInt(this.input.slice(start, this.position), 10);
	}

	#readCount(what: string): number {
		const value = this.#readNumber();
		if (!Number.isSafeInteger(value) || value < 0) {
			throw this.error(`Expected non-negative integer for ${what}, got '${value}'`);
		}
		if (value > MAX_ELEMENT_COUNT) throw this.error(`${what} of ${value} exceeds maximum of ${MAX_ELEMENT_COUNT}`);
		return value;
	}

	#readUntil(char: string): string {
		const start = this.position;
		while (this.position < this.input.length && this.input[this.position] !== char) this.position++;
		return this.input.slice(start, this.position);
	}

	/** `<byte length>:"<text>"`, as used by strings, class names and enum names. */
	#readQuoted(): string {
		const length = this.#readNumber();
		this.#expect(':"');
		const text = this.#readBytes(length);
		this.#expect('"');
		return text;
	}

	#readBytes(length: number): string {
		if (!Number.isSafeInteger(length) || length < 0) throw this.error("Expected non-negative byte length");

		const start = this.position;
		let bytes = 0;
		while (bytes < length) {
			if (this.position >= this.input.length) throw this.error(`Expected ${length} bytes, but only ${bytes} available`);
			const width = utf8Width(this.input, this.position);
			if (width === 0) throw this.error("Invalid UTF-16 string: unpaired surrogate");
			if (bytes + width > length) {
				throw this.error(`Declared string length ${length} bytes does not align with UTF-8 sequence`);
			}
			bytes += width;
			this.position += width === 4 ? 2 : 1;
		}
		return this.input.slice(start, this.position);
	}
}
