import { ParseError, type PhpValue, type PhpArrayEntry, type PhpObjectProperty } from './types';

export function parse(input: string): PhpValue {
	const parser = new Parser(input);
	const result = parser.parseValue();

	if (parser.position < input.length) {
		throw new ParseError(
			'Unexpected data after end of serialized value',
			parser.position,
			parser.getContext()
		);
	}

	return result;
}

class Parser {
	position = 0;
	private refIndex = 0;

	constructor(private input: string) {}

	parseValue(): PhpValue {
		this.refIndex++;

		const type = this.peek();

		switch (type) {
			case 'N':
				return this.parseNull();
			case 'b':
				return this.parseBool();
			case 'i':
				return this.parseInt();
			case 'd':
				return this.parseFloat();
			case 's':
				return this.parseString();
			case 'a':
				return this.parseArray();
			case 'O':
				return this.parseObject();
			case 'R':
				return this.parseReference(false);
			case 'r':
				return this.parseReference(true);
			default:
				throw new ParseError(`Unknown type identifier '${type}'`, this.position, this.getContext());
		}
	}

	private parseNull(): PhpValue {
		this.expect('N');
		this.expect(';');
		return { type: 'null' };
	}

	private parseBool(): PhpValue {
		this.expect('b');
		this.expect(':');
		const value = this.readChar();
		if (value !== '0' && value !== '1') {
			throw new ParseError(`Expected '0' or '1' for boolean`, this.position - 1, this.getContext());
		}
		this.expect(';');
		return { type: 'bool', value: value === '1' };
	}

	private parseInt(): PhpValue {
		this.expect('i');
		this.expect(':');
		const value = this.readNumber();
		this.expect(';');
		return { type: 'int', value: Math.floor(value) };
	}

	private parseFloat(): PhpValue {
		this.expect('d');
		this.expect(':');
		const valueStr = this.readUntil(';');

		let value: number;
		if (valueStr === 'INF') {
			value = Infinity;
		} else if (valueStr === '-INF') {
			value = -Infinity;
		} else if (valueStr === 'NAN') {
			value = NaN;
		} else {
			value = parseFloat(valueStr);
			if (isNaN(value) && valueStr !== 'NAN') {
				throw new ParseError(`Invalid float value '${valueStr}'`, this.position, this.getContext());
			}
		}

		this.expect(';');
		return { type: 'float', value };
	}

	private parseString(): PhpValue {
		this.expect('s');
		this.expect(':');
		const length = this.readNumber();
		this.expect(':');
		this.expect('"');

		const value = this.readBytes(length);
		this.expect('"');
		this.expect(';');

		const hasBinary = /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(value);

		return { type: 'string', value, binary: hasBinary ? true : undefined };
	}

	private parseArray(): PhpValue {
		this.expect('a');
		this.expect(':');
		const count = this.readNumber();
		this.expect(':');
		this.expect('{');

		const entries: PhpArrayEntry[] = [];

		for (let i = 0; i < count; i++) {
			const keyType = this.peek();
			let key: PhpValue;

			if (keyType === 'i') {
				key = this.parseInt();
			} else if (keyType === 's') {
				key = this.parseString();
			} else {
				throw new ParseError(
					`Array key must be integer or string, got '${keyType}'`,
					this.position,
					this.getContext()
				);
			}

			const value = this.parseValue();
			entries.push({ key: key as PhpArrayEntry['key'], value });
		}

		this.expect('}');
		return { type: 'array', entries };
	}

	private parseObject(): PhpValue {
		this.expect('O');
		this.expect(':');
		const classNameLength = this.readNumber();
		this.expect(':');
		this.expect('"');
		const className = this.readBytes(classNameLength);
		this.expect('"');
		this.expect(':');
		const propertyCount = this.readNumber();
		this.expect(':');
		this.expect('{');

		const properties: PhpObjectProperty[] = [];

		for (let i = 0; i < propertyCount; i++) {
			this.expect('s');
			this.expect(':');
			const nameLength = this.readNumber();
			this.expect(':');
			this.expect('"');
			const rawName = this.readBytes(nameLength);
			this.expect('"');
			this.expect(';');

			const { name, visibility, className: propClassName } = this.parsePropertyName(
				rawName,
				className
			);

			const value = this.parseValue();
			properties.push({ name, visibility, className: propClassName, value });
		}

		this.expect('}');
		return { type: 'object', className, properties };
	}

	private parsePropertyName(
		rawName: string,
		defaultClassName: string
	): { name: string; visibility: 'public' | 'protected' | 'private'; className?: string } {
		if (rawName.startsWith('\0*\0')) {
			return { name: rawName.slice(3), visibility: 'protected' };
		}

		if (rawName.startsWith('\0')) {
			const endNull = rawName.indexOf('\0', 1);
			if (endNull !== -1) {
				const propClassName = rawName.slice(1, endNull);
				const name = rawName.slice(endNull + 1);
				return {
					name,
					visibility: 'private',
					className: propClassName !== defaultClassName ? propClassName : undefined
				};
			}
		}

		return { name: rawName, visibility: 'public' };
	}

	private parseReference(isObject: boolean): PhpValue {
		this.expect(isObject ? 'r' : 'R');
		this.expect(':');
		const index = this.readNumber();
		this.expect(';');
		return { type: 'reference', index, isObject };
	}

	private peek(): string {
		if (this.position >= this.input.length) {
			throw new ParseError('Unexpected end of input', this.position, this.getContext());
		}
		return this.input[this.position];
	}

	private readChar(): string {
		if (this.position >= this.input.length) {
			throw new ParseError('Unexpected end of input', this.position, this.getContext());
		}
		return this.input[this.position++];
	}

	private expect(char: string): void {
		const actual = this.readChar();
		if (actual !== char) {
			throw new ParseError(
				`Expected '${char}', got '${actual}'`,
				this.position - 1,
				this.getContext()
			);
		}
	}

	private readNumber(): number {
		const start = this.position;
		let hasDigits = false;

		if (this.peek() === '-' || this.peek() === '+') {
			this.position++;
		}

		while (this.position < this.input.length && /[0-9]/.test(this.input[this.position])) {
			this.position++;
			hasDigits = true;
		}

		if (!hasDigits) {
			throw new ParseError('Expected number', start, this.getContext());
		}

		return parseInt(this.input.slice(start, this.position), 10);
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
			throw new ParseError('Expected non-negative byte length', this.position, this.getContext());
		}

		const start = this.position;
		let byteCount = 0;

		while (byteCount < length) {
			if (this.position >= this.input.length) {
				throw new ParseError(
					`Expected ${length} bytes, but only ${byteCount} available`,
					this.position,
					this.getContext()
				);
			}

			const { codeUnits, utf8Bytes } = this.readUtf8CodePoint(this.position);
			if (byteCount + utf8Bytes > length) {
				throw new ParseError(
					`Declared string length ${length} bytes does not align with UTF-8 sequence`,
					this.position,
					this.getContext()
				);
			}

			byteCount += utf8Bytes;
			this.position += codeUnits;
		}

		return this.input.slice(start, this.position);
	}

	private readUtf8CodePoint(index: number): { codeUnits: number; utf8Bytes: number } {
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
				throw new ParseError(
					'Invalid UTF-16 string: unmatched high surrogate',
					index,
					this.getContext(index)
				);
			}
			return { codeUnits: 2, utf8Bytes: 4 };
		}
		if (code >= 0xdc00 && code <= 0xdfff) {
			throw new ParseError(
				'Invalid UTF-16 string: unexpected low surrogate',
				index,
				this.getContext(index)
			);
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
