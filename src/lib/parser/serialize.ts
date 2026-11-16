import { formatFloat } from "./float.js";
import { encodePropertyName } from "./property-name.js";
import type { PhpValue } from "./types.js";
import { utf8ByteLength } from "./utf8.js";

export function serialize(value: PhpValue): string {
	switch (value.type) {
		case "null":
			return "N;";
		case "bool":
			return `b:${value.value ? 1 : 0};`;
		case "int":
			if (!Number.isFinite(value.value)) throw new Error(`Cannot serialize non-finite integer value: ${value.value}`);
			return `i:${value.value};`;
		case "float":
			return `d:${formatFloat(value.value)};`;
		case "string":
			return `s:${quoted(value.value)};`;
		case "array":
			return `a:${value.entries.length}:{${value.entries.map(({ key, value }) => serialize(key) + serialize(value)).join("")}}`;
		case "object": {
			const properties = value.properties.map(
				(property) => `s:${quoted(encodePropertyName(property, value.className))};${serialize(property.value)}`,
			);
			return `O:${quoted(value.className)}:${properties.length}:{${properties.join("")}}`;
		}
		case "custom_object":
			return `C:${quoted(value.className)}:${utf8ByteLength(value.payload)}:{${value.payload}}`;
		case "enum":
			return `E:${quoted(`${value.className}:${value.caseName}`)};`;
		case "reference":
			return `${value.isObject ? "r" : "R"}:${value.index};`;
	}
}

function quoted(text: string): string {
	return `${utf8ByteLength(text)}:"${text}"`;
}
