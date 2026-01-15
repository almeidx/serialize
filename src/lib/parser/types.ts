export type PhpValue =
	| PhpNull
	| PhpBool
	| PhpInt
	| PhpFloat
	| PhpString
	| PhpArray
	| PhpObject
	| PhpReference;

export interface PhpNull {
	type: 'null';
}

export interface PhpBool {
	type: 'bool';
	value: boolean;
}

export interface PhpInt {
	type: 'int';
	value: number;
}

export interface PhpFloat {
	type: 'float';
	value: number;
}

export interface PhpString {
	type: 'string';
	value: string;
	binary?: boolean;
}

export interface PhpArrayEntry {
	key: PhpInt | PhpString;
	value: PhpValue;
}

export interface PhpArray {
	type: 'array';
	entries: PhpArrayEntry[];
}

export interface PhpObjectProperty {
	name: string;
	visibility: 'public' | 'protected' | 'private';
	className?: string;
	value: PhpValue;
}

export interface PhpObject {
	type: 'object';
	className: string;
	properties: PhpObjectProperty[];
}

export interface PhpReference {
	type: 'reference';
	index: number;
	isObject: boolean;
}

export class ParseError extends Error {
	constructor(
		message: string,
		public position: number,
		public context: string
	) {
		super(`${message} at position ${position}: "${context}"`);
		this.name = 'ParseError';
	}
}
