import type { JsonObject, JsonValue, PhpPropertyMetaEntry, PhpVisibility } from "./types";

export function requireObject(value: JsonValue | undefined, context: string): JsonObject {
	if (!value || Array.isArray(value) || typeof value !== "object") {
		throw new Error(`${context} must be an object`);
	}
	return value as JsonObject;
}

export function parseArrayKeyMetadataEntry(
	entry: JsonValue,
	index: number,
): { type: "int" | "string"; value: number | string } {
	if (!entry || Array.isArray(entry) || typeof entry !== "object") {
		throw new Error(`Array wrapper key metadata at index ${index} must be an object`);
	}

	const keyInfo = entry as Record<string, JsonValue>;
	if (keyInfo.type !== "int" && keyInfo.type !== "string") {
		throw new Error(`Array wrapper key metadata at index ${index} must include type 'int' or 'string'`);
	}

	if (keyInfo.type === "int") {
		if (typeof keyInfo.value !== "number" || !Number.isInteger(keyInfo.value)) {
			throw new Error(`Array wrapper int key metadata at index ${index} must include integer value`);
		}
		return { type: "int", value: keyInfo.value };
	}

	if (typeof keyInfo.value !== "string") {
		throw new Error(`Array wrapper string key metadata at index ${index} must include string value`);
	}
	return { type: "string", value: keyInfo.value };
}

export function parseArrayDataKeys(value: JsonValue | undefined, expectedLength: number): string[] | null {
	if (value === undefined) return null;
	if (!Array.isArray(value)) {
		throw new Error("__php_data_keys__ must be an array when present");
	}
	if (value.length !== expectedLength) {
		throw new Error(
			`__php_data_keys__ length ${value.length} does not match __php_original_keys__ length ${expectedLength}`,
		);
	}

	const seen = new Set<string>();
	return value.map((entry, index) => {
		if (typeof entry !== "string") {
			throw new Error(`__php_data_keys__ entry at index ${index} must be a string`);
		}
		if (seen.has(entry)) {
			throw new Error(`__php_data_keys__ contains duplicate key '${entry}'`);
		}
		seen.add(entry);
		return entry;
	});
}

export function parseVisibilityMap(value: JsonValue | undefined): Record<string, PhpVisibility> {
	if (value === undefined) return {};

	const obj = requireObject(value, "__php_visibility__");
	const visibilityMap: Record<string, PhpVisibility> = Object.create(null);

	for (const [key, visibility] of Object.entries(obj)) {
		if (visibility !== "public" && visibility !== "protected" && visibility !== "private") {
			throw new Error(`Invalid visibility '${String(visibility)}' for property '${key}'`);
		}
		visibilityMap[key] = visibility;
	}

	return visibilityMap;
}

export function parseStringMap(value: JsonValue | undefined, fieldName: string): Record<string, string> {
	if (value === undefined) return {};

	const obj = requireObject(value, fieldName);
	const result: Record<string, string> = Object.create(null);

	for (const [key, mapValue] of Object.entries(obj)) {
		if (typeof mapValue !== "string") {
			throw new Error(`${fieldName} values must be strings (invalid entry '${key}')`);
		}
		result[key] = mapValue;
	}

	return result;
}

export function parsePropertyMetaMap(value: JsonValue | undefined): Record<string, PhpPropertyMetaEntry> {
	if (value === undefined) return {};

	const obj = requireObject(value, "__php_property_meta__");
	const result: Record<string, PhpPropertyMetaEntry> = Object.create(null);

	for (const [key, metaValue] of Object.entries(obj)) {
		if (!metaValue || Array.isArray(metaValue) || typeof metaValue !== "object") {
			throw new Error(`__php_property_meta__ entry '${key}' must be an object`);
		}

		const meta = metaValue as Record<string, JsonValue>;
		if (typeof meta.name !== "string") {
			throw new Error(`__php_property_meta__ entry '${key}' must include string 'name'`);
		}
		if (meta.visibility !== "public" && meta.visibility !== "protected" && meta.visibility !== "private") {
			throw new Error(`__php_property_meta__ entry '${key}' must include valid 'visibility'`);
		}
		if (meta.className !== undefined && typeof meta.className !== "string") {
			throw new Error(`__php_property_meta__ entry '${key}' has invalid 'className'`);
		}

		result[key] = {
			name: meta.name,
			visibility: meta.visibility,
			className: meta.className,
		};
	}

	return result;
}

export function parsePropertyOrder(value: JsonValue | undefined, data: JsonObject): string[] | undefined {
	if (value === undefined) return undefined;
	if (!Array.isArray(value)) {
		throw new Error("__php_property_order__ must be an array when present");
	}

	const seen = new Set<string>();
	const order = value.map((entry, index) => {
		if (typeof entry !== "string") {
			throw new Error(`__php_property_order__ entry at index ${index} must be a string`);
		}
		if (seen.has(entry)) {
			throw new Error(`__php_property_order__ contains duplicate key '${entry}'`);
		}
		seen.add(entry);
		return entry;
	});

	for (const key of order) {
		if (!Object.prototype.hasOwnProperty.call(data, key)) {
			throw new Error(`__php_property_order__ references missing property key '${key}'`);
		}
	}

	for (const key of Object.keys(data)) {
		if (!seen.has(key)) {
			throw new Error(`__php_property_order__ is missing property key '${key}'`);
		}
	}

	return order;
}

export function makeUniqueArrayDataKey(baseKey: string, usedKeys: Set<string>): string {
	if (!usedKeys.has(baseKey)) return baseKey;

	let counter = 2;
	let candidate = `${baseKey}#${counter}`;
	while (usedKeys.has(candidate)) {
		counter++;
		candidate = `${baseKey}#${counter}`;
	}

	return candidate;
}

export function makeUniqueKey(baseKey: string, usedKeys: Set<string>): string {
	if (!usedKeys.has(baseKey)) return baseKey;

	let counter = 2;
	let candidate = `${baseKey}#${counter}`;
	while (usedKeys.has(candidate)) {
		counter++;
		candidate = `${baseKey}#${counter}`;
	}

	return candidate;
}

export function hasBinaryControlCharacters(value: string): boolean {
	for (let i = 0; i < value.length; i++) {
		const code = value.charCodeAt(i);
		if ((code >= 0 && code <= 8) || code === 11 || code === 12 || (code >= 14 && code <= 31)) {
			return true;
		}
	}
	return false;
}
