import { ParseError, type PhpValue, type PhpArrayEntry, type PhpObjectProperty } from "./types";

const MAX_DEPTH = 512;
const MAX_ELEMENT_COUNT = 1_000_000;

export function parse(input: string): PhpValue {
	const parser = new Parser(input);
	const result = parser.parseValue(0);

	if (parser.position < input.length) {
		throw new ParseError("Unexpected data after end of serialized value", parser.position, parser.getContext());
	}

	return result;
}

class Parser {
	position = 0;
	private refIndex = 0;
	private readonly parsedValues: PhpValue[] = [];

	constructor(private input: string) {}

	parseValue(depth: number): PhpValue {
		if (depth > MAX_DEPTH) {
			throw new ParseError(`Maximum nesting depth of ${MAX_DEPTH} exceeded`, this.position, this.getContext());
		}

		this.refIndex++;
		const currentIndex = this.refIndex;

		const type = this.peek();
		let parsedValue: PhpValue;

		switch (type) {
			case "N":
				parsedValue = this.parseNull();
				break;
			case "b":
				parsedValue = this.parseBool();
				break;
			case "i":
				parsedValue = this.parseInt();
				break;
			case "d":
				parsedValue = this.parseFloat();
				break;
			case "s":
				parsedValue = this.parseString();
				break;
			case "a":
				parsedValue = this.parseArray(depth);
				break;
			case "O":
				parsedValue = this.parseObject(depth);
				break;
			case "C":
				parsedValue = this.parseCustomObject();
				break;
			case "E":
				parsedValue = this.parseEnum();
				break;
			case "R":
				parsedValue = this.parseReference(false);
				break;
			case "r":
				parsedValue = this.parseReference(true);
				break;
			default:
				throw new ParseError(`Unknown type identifier '${type}'`, this.position, this.getContext());
		}

		this.parsedValues[currentIndex] = parsedValue;
		return parsedValue;
	}

	private parseNull(): PhpValue {
		this.expect("N");
		this.expect(";");
		return { type: "null" };
	}

	private parseBool(): PhpValue {
		this.expect("b");
		this.expect(":");
		const value = this.readChar();
		if (value !== "0" && value !== "1") {
			throw new ParseError(`Expected '0' or '1' for boolean`, this.position - 1, this.getContext());
		}
		this.expect(";");
		return { type: "bool", value: value === "1" };
	}

	private parseInt(): PhpValue {
		this.expect("i");
		this.expect(":");
		const value = this.readNumber();
		this.expect(";");
		return { type: "int", value: Math.floor(value) };
	}

	private parseFloat(): PhpValue {
		this.expect("d");
		this.expect(":");
		const valueStr = this.readUntil(";");

		let value: number;
		if (valueStr === "INF") {
			value = Infinity;
		} else if (valueStr === "-INF") {
			value = -Infinity;
		} else if (valueStr === "NAN") {
			value = NaN;
		} else {
			if (!isValidFloatLiteral(valueStr)) {
				throw new ParseError(`Invalid float value '${valueStr}'`, this.position, this.getContext());
			}

			value = parseFloat(valueStr);
			if (isNaN(value)) {
				throw new ParseError(`Invalid float value '${valueStr}'`, this.position, this.getContext());
			}
		}

		this.expect(";");
		return { type: "float", value };
	}

	private parseString(): PhpValue {
		this.expect("s");
		this.expect(":");
		const length = this.readNumber();
		this.expect(":");
		this.expect('"');

		const value = this.readBytes(length);
		this.expect('"');
		this.expect(";");

		const hasBinary = hasBinaryControlCharacters(value);

		return { type: "string", value, binary: hasBinary ? true : undefined };
	}

	private parseArray(depth: number): PhpValue {
		this.expect("a");
		this.expect(":");
		const count = this.readNonNegativeInteger("array element count");
		this.expect(":");
		this.expect("{");

		const entries: PhpArrayEntry[] = [];

		for (let i = 0; i < count; i++) {
			const keyType = this.peek();
			let key: PhpValue;

			if (keyType === "i") {
				key = this.parseInt();
			} else if (keyType === "s") {
				key = this.parseString();
			} else {
				throw new ParseError(`Array key must be integer or string, got '${keyType}'`, this.position, this.getContext());
			}

			const value = this.parseValue(depth + 1);
			entries.push({ key: key as PhpArrayEntry["key"], value });
		}

		this.expect("}");
		return { type: "array", entries };
	}

	private parseObject(depth: number): PhpValue {
		this.expect("O");
		this.expect(":");
		const classNameLength = this.readNumber();
		this.expect(":");
		this.expect('"');
		const className = this.readBytes(classNameLength);
		this.expect('"');
		this.expect(":");
		const propertyCount = this.readNonNegativeInteger("object property count");
		this.expect(":");
		this.expect("{");

		const properties: PhpObjectProperty[] = [];

		for (let i = 0; i < propertyCount; i++) {
			this.expect("s");
			this.expect(":");
			const nameLength = this.readNumber();
			this.expect(":");
			this.expect('"');
			const rawName = this.readBytes(nameLength);
			this.expect('"');
			this.expect(";");

			const { name, visibility, className: propClassName } = this.parsePropertyName(rawName, className);

			const value = this.parseValue(depth + 1);
			properties.push({ name, visibility, className: propClassName, value });
		}

		this.expect("}");
		return { type: "object", className, properties };
	}

	private parseCustomObject(): PhpValue {
		this.expect("C");
		this.expect(":");
		const classNameLength = this.readNumber();
		this.expect(":");
		this.expect('"');
		const className = this.readBytes(classNameLength);
		this.expect('"');
		this.expect(":");
		const payloadLength = this.readNumber();
		this.expect(":");
		this.expect("{");
		const payload = this.readBytes(payloadLength);
		this.expect("}");

		return {
			type: "custom_object",
			className,
			payload,
			binary: hasBinaryControlCharacters(payload) ? true : undefined,
		};
	}

	private parseEnum(): PhpValue {
		this.expect("E");
		this.expect(":");
		const enumNameLength = this.readNumber();
		this.expect(":");
		this.expect('"');
		const enumName = this.readBytes(enumNameLength);
		this.expect('"');
		this.expect(";");

		const separator = enumName.indexOf(":");
		if (separator <= 0 || separator === enumName.length - 1) {
			throw new ParseError(`Invalid enum identifier '${enumName}'`, this.position, this.getContext());
		}

		return {
			type: "enum",
			className: enumName.slice(0, separator),
			caseName: enumName.slice(separator + 1),
		};
	}

	private parsePropertyName(
		rawName: string,
		defaultClassName: string,
	): {
		name: string;
		visibility: "public" | "protected" | "private";
		className?: string;
	} {
		if (rawName.startsWith("\0*\0")) {
			return { name: rawName.slice(3), visibility: "protected" };
		}

		if (rawName.startsWith("\0")) {
			const endNull = rawName.indexOf("\0", 1);
			if (endNull !== -1) {
				const propClassName = rawName.slice(1, endNull);
				const name = rawName.slice(endNull + 1);
				return {
					name,
					visibility: "private",
					className: propClassName !== defaultClassName ? propClassName : undefined,
				};
			}
		}

		return { name: rawName, visibility: "public" };
	}

	private parseReference(isObject: boolean): PhpValue {
		this.expect(isObject ? "r" : "R");
		this.expect(":");
		const index = this.readNumber();
		this.expect(";");

		if (!Number.isSafeInteger(index) || index < 1) {
			throw new ParseError(
				`Reference index must be a positive integer, got '${index}'`,
				this.position,
				this.getContext(),
			);
		}
		if (index >= this.refIndex) {
			throw new ParseError(`Reference index ${index} points to an unresolved value`, this.position, this.getContext());
		}

		const target = this.resolveReferenceTarget(index);
		if (!target) {
			throw new ParseError(`Reference index ${index} does not exist`, this.position, this.getContext());
		}

		if (isObject && !isObjectLike(target)) {
			throw new ParseError(
				`Object reference index ${index} must point to an object-like value`,
				this.position,
				this.getContext(),
			);
		}

		return { type: "reference", index, isObject };
	}

	private resolveReferenceTarget(index: number): PhpValue | null {
		let current = this.parsedValues[index];
		if (!current) return null;

		const visited = new Set<number>();
		let currentIndex = index;

		while (current.type === "reference") {
			if (visited.has(currentIndex)) return null;
			visited.add(currentIndex);

			currentIndex = current.index;
			current = this.parsedValues[currentIndex];
			if (!current) return null;
		}

		return current;
	}

	private peek(): string {
		if (this.position >= this.input.length) {
			throw new ParseError("Unexpected end of input", this.position, this.getContext());
		}
		return this.input[this.position];
	}

	private readChar(): string {
		if (this.position >= this.input.length) {
			throw new ParseError("Unexpected end of input", this.position, this.getContext());
		}
		return this.input[this.position++];
	}

	private expect(char: string): void {
		const actual = this.readChar();
		if (actual !== char) {
			throw new ParseError(`Expected '${char}', got '${actual}'`, this.position - 1, this.getContext());
		}
	}

	private readNumber(): number {
		const start = this.position;
		let hasDigits = false;

		if (this.peek() === "-" || this.peek() === "+") {
			this.position++;
		}

		while (this.position < this.input.length && /[0-9]/.test(this.input[this.position])) {
			this.position++;
			hasDigits = true;
		}

		if (!hasDigits) {
			throw new ParseError("Expected number", start, this.getContext());
		}

		return parseInt(this.input.slice(start, this.position), 10);
	}

	private readNonNegativeInteger(context: string): number {
		const value = this.readNumber();
		if (!Number.isSafeInteger(value) || value < 0) {
			throw new ParseError(
				`Expected non-negative integer for ${context}, got '${value}'`,
				this.position,
				this.getContext(),
			);
		}
		if (value > MAX_ELEMENT_COUNT) {
			throw new ParseError(
				`${context} of ${value} exceeds maximum of ${MAX_ELEMENT_COUNT}`,
				this.position,
				this.getContext(),
			);
		}
		return value;
	}

	private readUntil(char: string): string {
		const start = this.position;
		while (this.position < this.input.length && this.input[this.position] !== char) {
			this.position++;
		}
		return this.input.slice(start, this.position);
	}

	private readBytes(length: number): string {
		if (!Number.isSafeInteger(length) || length < 0) {
			throw new ParseError("Expected non-negative byte length", this.position, this.getContext());
		}

		const start = this.position;
		let byteCount = 0;

		while (byteCount < length) {
			if (this.position >= this.input.length) {
				throw new ParseError(
					`Expected ${length} bytes, but only ${byteCount} available`,
					this.position,
					this.getContext(),
				);
			}

			const { codeUnits, utf8Bytes } = this.readUtf8CodePoint(this.position);
			if (byteCount + utf8Bytes > length) {
				throw new ParseError(
					`Declared string length ${length} bytes does not align with UTF-8 sequence`,
					this.position,
					this.getContext(),
				);
			}

			byteCount += utf8Bytes;
			this.position += codeUnits;
		}

		return this.input.slice(start, this.position);
	}

	private readUtf8CodePoint(index: number): {
		codeUnits: number;
		utf8Bytes: number;
	} {
		const code = this.input.charCodeAt(index);

		if (code <= 0x7f) {
			return { codeUnits: 1, utf8Bytes: 1 };
		}
		if (code <= 0x7ff) {
			return { codeUnits: 1, utf8Bytes: 2 };
		}
		if (code >= 0xd800 && code <= 0xdbff) {
			const next = this.input.charCodeAt(index + 1);
			if (Number.isNaN(next) || next < 0xdc00 || next > 0xdfff) {
				throw new ParseError("Invalid UTF-16 string: unmatched high surrogate", index, this.getContext(index));
			}
			return { codeUnits: 2, utf8Bytes: 4 };
		}
		if (code >= 0xdc00 && code <= 0xdfff) {
			throw new ParseError("Invalid UTF-16 string: unexpected low surrogate", index, this.getContext(index));
		}

		return { codeUnits: 1, utf8Bytes: 3 };
	}

	getContext(atPosition: number = this.position): string {
		const start = Math.max(0, atPosition - 10);
		const end = Math.min(this.input.length, atPosition + 10);
		const before = this.input.slice(start, atPosition);
		const after = this.input.slice(atPosition, end);
		return `${before}[HERE]${after}`;
	}
}

function hasBinaryControlCharacters(value: string): boolean {
	for (let i = 0; i < value.length; i++) {
		const code = value.charCodeAt(i);
		if ((code >= 0 && code <= 8) || code === 11 || code === 12 || (code >= 14 && code <= 31)) {
			return true;
		}
	}
	return false;
}

function isValidFloatLiteral(value: string): boolean {
	return /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(value);
}

function isObjectLike(value: PhpValue): boolean {
	return value.type === "object" || value.type === "custom_object" || value.type === "enum";
}
