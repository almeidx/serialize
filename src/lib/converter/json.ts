import { MAX_DEPTH, ReferenceSlots } from "#lib/parser/references.js";
import { toArrayKey, type PhpBool, type PhpInt, type PhpNull, type PhpValue } from "#lib/parser/types.js";
import type { JsonValue } from "./types.js";
import { dataKeyAllocator, decodeWrapper, encodeWrapper, isWrapper, type Wrapper } from "./wrappers.js";

/** PHP values JSON can hold directly become plain JSON; the rest become `__php_type__` wrappers. */
export function toJson(php: PhpValue): JsonValue {
	switch (php.type) {
		case "null":
			return null;
		case "bool":
		case "int":
			return php.value;
		case "float":
			// A plain integral number would read back as an int.
			return Number.isFinite(php.value) && !Number.isInteger(php.value) ? php.value : encodeWrapper(php);
		case "string":
			return isBinary(php.value) ? encodeWrapper(php) : php.value;
		case "array": {
			if (php.entries.every(({ key }, index) => key.type === "int" && key.value === index)) {
				return php.entries.map(({ value }) => toJson(value));
			}
			const dataKey = dataKeyAllocator();
			return encodeWrapper({
				type: "array",
				entries: php.entries.map(({ key, value }) => ({
					key,
					dataKey: dataKey(String(key.value)),
					value: toJson(value),
				})),
			});
		}
		case "object": {
			const dataKey = dataKeyAllocator();
			return encodeWrapper({
				type: "object",
				className: php.className,
				properties: php.properties.map(({ value, ...property }) => ({
					...property,
					dataKey: dataKey(property.name),
					value: toJson(value),
				})),
			});
		}
		case "custom_object":
		case "enum":
		case "reference":
			return encodeWrapper(php);
	}
}

/** Control characters other than tab, newline and carriage return mark a string as binary. */
function isBinary(text: string): boolean {
	for (let i = 0; i < text.length; i++) {
		const code = text.charCodeAt(i);
		if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) return true;
	}
	return false;
}

/** Throws a descriptive error when `json` is not a valid representation. */
export function fromJson(json: JsonValue): PhpValue {
	const references = new ReferenceSlots();

	function convert(json: JsonValue, depth: number): PhpValue {
		if (depth > MAX_DEPTH) throw new Error(`Maximum nesting depth of ${MAX_DEPTH} exceeded`);

		const node = decode(json);
		if (node.type === "reference") {
			const problem = references.add(node);
			if (problem) throw new Error(problem);
			return node;
		}

		references.add(node);
		switch (node.type) {
			case "array":
				return {
					type: "array",
					entries: node.entries.map(({ key, value }) => ({ key, value: convert(value, depth + 1) })),
				};
			case "object":
				return {
					type: "object",
					className: node.className,
					properties: node.properties.map(({ name, visibility, className, value }) => ({
						name,
						visibility,
						className,
						value: convert(value, depth + 1),
					})),
				};
			default:
				return node;
		}
	}

	return convert(json, 0);
}

/** `json` as a PHP value whose children are still JSON. */
function decode(json: JsonValue): Wrapper | PhpNull | PhpBool | PhpInt {
	if (json === null) return { type: "null" };
	if (typeof json === "boolean") return { type: "bool", value: json };
	if (typeof json === "number")
		return Number.isInteger(json) ? { type: "int", value: json } : { type: "float", value: json };
	if (typeof json === "string") return { type: "string", value: json };
	if (Array.isArray(json)) {
		return {
			type: "array",
			entries: json.map((value, index) => ({ key: { type: "int", value: index }, dataKey: String(index), value })),
		};
	}
	if (isWrapper(json)) return decodeWrapper(json);
	return {
		type: "array",
		entries: Object.entries(json).map(([key, value]) => ({ key: toArrayKey(key), dataKey: key, value })),
	};
}
