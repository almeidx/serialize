export type PhpValue =
	| PhpNull
	| PhpBool
	| PhpInt
	| PhpFloat
	| PhpString
	| PhpArray
	| PhpObject
	| PhpCustomObject
	| PhpEnum
	| PhpReference;

export interface PhpNull {
	type: "null";
}

export interface PhpBool {
	type: "bool";
	value: boolean;
}

export interface PhpInt {
	type: "int";
	value: number;
}

export interface PhpFloat {
	type: "float";
	value: number;
}

export interface PhpString {
	type: "string";
	value: string;
}

export type PhpArrayKey = PhpInt | PhpString;

/** The key PHP stores for `$array[text]`: decimal integer strings (no leading zeros, no `-0`) become int keys. */
export function toArrayKey(text: string): PhpArrayKey {
	if (/^(?:0|-?[1-9]\d*)$/.test(text)) {
		const value = Number(text);
		if (Number.isSafeInteger(value)) return { type: "int", value };
	}
	return { type: "string", value: text };
}

export interface PhpArrayEntry {
	key: PhpArrayKey;
	value: PhpValue;
}

export interface PhpArray {
	type: "array";
	entries: PhpArrayEntry[];
}

export type PhpVisibility = "public" | "protected" | "private";

export interface PhpObjectProperty {
	name: string;
	visibility: PhpVisibility;
	/** Declaring class of a private property, when it is not the object's own class. */
	className?: string;
	value: PhpValue;
}

export interface PhpObject {
	type: "object";
	className: string;
	properties: PhpObjectProperty[];
}

export interface PhpCustomObject {
	type: "custom_object";
	className: string;
	payload: string;
}

export interface PhpEnum {
	type: "enum";
	className: string;
	caseName: string;
}

export interface PhpReference {
	type: "reference";
	index: number;
	isObject: boolean;
}

export class ParseError extends Error {
	constructor(
		message: string,
		public position: number,
		public context: string,
	) {
		super(`${message} at position ${position}: "${context}"`);
		this.name = "ParseError";
	}
}
