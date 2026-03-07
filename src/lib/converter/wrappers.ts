import type { PhpArrayEntry, PhpObjectProperty, PhpValue } from "../parser/types";
import type { JsonObject, JsonValue } from "./types";
import {
	hasBinaryControlCharacters,
	makeUniqueArrayDataKey,
	makeUniqueKey,
	parseArrayDataKeys,
	parseArrayKeyMetadataEntry,
	parsePropertyMetaMap,
	parsePropertyOrder,
	parseStringMap,
	parseVisibilityMap,
	requireObject,
} from "./validation";

function bytesToBinary(bytes: Uint8Array): string {
	let binary = "";
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return binary;
}

function binaryToBytes(binary: string): Uint8Array {
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

function encodeBase64Utf8(value: string): string {
	const bytes = new TextEncoder().encode(value);
	if (typeof btoa === "function") {
		return btoa(bytesToBinary(bytes));
	}
	throw new Error("No base64 encoder available in this environment");
}

function decodeBase64Utf8(base64: string, invalidMessage: string): string {
	if (typeof atob !== "function") {
		throw new Error("No base64 decoder available in this environment");
	}
	try {
		const bytes = binaryToBytes(atob(base64));
		return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
	} catch {
		throw new Error(invalidMessage);
	}
}

export function fromFloatWrapper(obj: JsonObject): PhpValue {
	const val = obj.value;
	if (val === "NAN") return { type: "float", value: NaN };
	if (val === "INF") return { type: "float", value: Infinity };
	if (val === "-INF") return { type: "float", value: -Infinity };
	throw new Error(`Float wrapper has invalid value '${String(val)}', expected 'NAN', 'INF', or '-INF'`);
}

export function toBinaryWrapper(value: string): JsonObject {
	return {
		__php_type__: "string",
		__php_binary__: true,
		value: encodeBase64Utf8(value),
	};
}

export function toReferenceWrapper(index: number, isObject: boolean): JsonObject {
	return {
		__php_type__: "reference",
		__php_ref_index__: index,
		__php_ref_object__: isObject,
	};
}

export function toArrayWrapper(entries: PhpArrayEntry[], toJsonValue: (value: PhpValue) => JsonValue): JsonObject {
	const originalKeys = entries.map((entry) => ({
		type: entry.key.type as "int" | "string",
		value: entry.key.value,
	}));

	const usedDataKeys = new Set<string>();
	const dataKeys: string[] = [];
	const data: JsonObject = {};

	for (const [index, entry] of entries.entries()) {
		const canonicalKey = String(originalKeys[index].value);
		const dataKey = makeUniqueArrayDataKey(canonicalKey, usedDataKeys);
		usedDataKeys.add(dataKey);
		dataKeys.push(dataKey);
		data[dataKey] = toJsonValue(entry.value);
	}

	const result: JsonObject = {
		__php_type__: "array",
		__php_original_keys__: originalKeys as JsonValue,
		data,
	};

	const needsDataKeys = dataKeys.some((key, index) => key !== String(originalKeys[index].value));
	if (needsDataKeys) {
		result.__php_data_keys__ = dataKeys as JsonValue;
	}

	return result;
}

export function toObjectWrapper(
	className: string,
	properties: PhpObjectProperty[],
	toJsonValue: (value: PhpValue) => JsonValue,
): JsonObject {
	const result: JsonObject = {
		__php_type__: "object",
		__php_class__: className,
	};

	const data: JsonObject = {};
	const propertyMeta: JsonObject = {};
	const propertyOrder: string[] = [];
	const usedKeys = new Set<string>();

	for (const property of properties) {
		const key = makeUniqueKey(property.name, usedKeys);
		usedKeys.add(key);
		data[key] = toJsonValue(property.value);
		propertyOrder.push(key);

		propertyMeta[key] = {
			name: property.name,
			visibility: property.visibility,
			className: property.className,
		} as JsonValue;
	}

	result.data = data;
	result.__php_property_meta__ = propertyMeta;
	result.__php_property_order__ = propertyOrder as JsonValue;
	return result;
}

export function toCustomObjectWrapper(className: string, payload: string): JsonObject {
	return {
		__php_type__: "custom_object",
		__php_class__: className,
		__php_payload_base64__: encodeBase64Utf8(payload),
	};
}

export function toEnumWrapper(className: string, caseName: string): JsonObject {
	return {
		__php_type__: "enum",
		__php_class__: className,
		__php_enum_case__: caseName,
	};
}

export function fromBinaryWrapper(obj: JsonObject): PhpValue {
	if (obj.__php_binary__ !== true) {
		throw new Error("Binary string wrapper must include '__php_binary__': true");
	}
	if (typeof obj.value !== "string") {
		throw new Error("Binary string wrapper requires a base64 'value' string");
	}

	const decoded = decodeBase64Utf8(obj.value, "Binary string wrapper contains invalid base64 data");

	return {
		type: "string",
		value: decoded,
		binary: true,
	};
}

export function fromReferenceWrapper(obj: JsonObject): PhpValue {
	if (typeof obj.__php_ref_index__ !== "number" || !Number.isInteger(obj.__php_ref_index__)) {
		throw new Error("Reference wrapper requires integer __php_ref_index__");
	}
	if (obj.__php_ref_index__ < 1) {
		throw new Error("Reference wrapper __php_ref_index__ must be >= 1");
	}
	if (typeof obj.__php_ref_object__ !== "boolean") {
		throw new Error("Reference wrapper requires boolean __php_ref_object__");
	}

	return {
		type: "reference",
		index: obj.__php_ref_index__,
		isObject: obj.__php_ref_object__,
	};
}

export function fromArrayWrapper(obj: JsonObject, fromJsonValue: (json: JsonValue) => PhpValue): PhpValue {
	const data = requireObject(obj.data, "Array wrapper 'data'");
	if (!Array.isArray(obj.__php_original_keys__)) {
		throw new Error("Array wrapper requires '__php_original_keys__' array");
	}

	const originalKeys: Array<{ type: "int" | "string"; value: number | string }> = obj.__php_original_keys__.map(
		(entry, index) => parseArrayKeyMetadataEntry(entry, index),
	);
	const dataKeys = parseArrayDataKeys(obj.__php_data_keys__, originalKeys.length);

	if (dataKeys) {
		const entries: PhpArrayEntry[] = originalKeys.map((keyInfo, index) => {
			const dataKey = dataKeys[index];
			if (!Object.prototype.hasOwnProperty.call(data, dataKey)) {
				throw new Error(`Array wrapper data key '${dataKey}' is missing from data`);
			}

			return {
				key:
					keyInfo.type === "int"
						? { type: "int", value: keyInfo.value as number }
						: { type: "string", value: keyInfo.value as string },
				value: fromJsonValue(data[dataKey]),
			};
		});

		return { type: "array", entries };
	}

	const seen = new Set<string>();
	const entries: PhpArrayEntry[] = originalKeys.map((keyInfo) => {
		const keyStr = String(keyInfo.value);
		const dedupeKey = `${keyInfo.type}:${keyStr}`;
		if (seen.has(dedupeKey)) {
			throw new Error(`Array wrapper has duplicate key metadata for '${keyStr}' and requires '__php_data_keys__'`);
		}
		seen.add(dedupeKey);

		if (!Object.prototype.hasOwnProperty.call(data, keyStr)) {
			throw new Error(`Array wrapper key '${keyStr}' is missing from data`);
		}

		return {
			key:
				keyInfo.type === "int"
					? { type: "int", value: keyInfo.value as number }
					: { type: "string", value: keyInfo.value as string },
			value: fromJsonValue(data[keyStr]),
		};
	});

	return { type: "array", entries };
}

export function fromObjectWrapper(obj: JsonObject, fromJsonValue: (json: JsonValue) => PhpValue): PhpValue {
	if (typeof obj.__php_class__ !== "string" || obj.__php_class__.length === 0) {
		throw new Error("Object wrapper requires non-empty '__php_class__'");
	}

	const data = requireObject(obj.data, "Object wrapper 'data'");
	const propertyMeta = parsePropertyMetaMap(obj.__php_property_meta__);
	const propertyOrder = parsePropertyOrder(obj.__php_property_order__, data);
	const visibilities = parseVisibilityMap(obj.__php_visibility__);
	const propertyClasses = parseStringMap(obj.__php_property_class__, "__php_property_class__");

	for (const key of Object.keys(propertyMeta)) {
		if (!Object.prototype.hasOwnProperty.call(data, key)) {
			throw new Error(`Property metadata references missing property key '${key}'`);
		}
	}

	for (const key of Object.keys(visibilities)) {
		if (!Object.prototype.hasOwnProperty.call(data, key)) {
			throw new Error(`Visibility metadata references missing property '${key}'`);
		}
	}

	for (const key of Object.keys(propertyClasses)) {
		if (!Object.prototype.hasOwnProperty.call(data, key)) {
			throw new Error(`Property class metadata references missing property '${key}'`);
		}
	}

	const keyOrder = propertyOrder ?? Object.keys(data);
	const properties: PhpObjectProperty[] = keyOrder.map((key) => {
		const value = data[key];
		if (value === undefined) {
			throw new Error(`Object wrapper order references missing property key '${key}'`);
		}

		const meta = propertyMeta[key];
		return {
			name: meta?.name ?? key,
			visibility: meta?.visibility ?? visibilities[key] ?? "public",
			className: meta?.className ?? propertyClasses[key],
			value: fromJsonValue(value),
		};
	});

	return { type: "object", className: obj.__php_class__, properties };
}

export function fromCustomObjectWrapper(obj: JsonObject): PhpValue {
	if (typeof obj.__php_class__ !== "string" || obj.__php_class__.length === 0) {
		throw new Error("Custom object wrapper requires non-empty '__php_class__'");
	}
	if (typeof obj.__php_payload_base64__ !== "string") {
		throw new Error("Custom object wrapper requires '__php_payload_base64__' string");
	}

	const payload = decodeBase64Utf8(obj.__php_payload_base64__, "Custom object wrapper contains invalid base64 payload");

	return {
		type: "custom_object",
		className: obj.__php_class__,
		payload,
		binary: hasBinaryControlCharacters(payload) ? true : undefined,
	};
}

export function fromEnumWrapper(obj: JsonObject): PhpValue {
	if (typeof obj.__php_class__ !== "string" || obj.__php_class__.length === 0) {
		throw new Error("Enum wrapper requires non-empty '__php_class__'");
	}
	if (typeof obj.__php_enum_case__ !== "string" || obj.__php_enum_case__.length === 0) {
		throw new Error("Enum wrapper requires non-empty '__php_enum_case__'");
	}

	return {
		type: "enum",
		className: obj.__php_class__,
		caseName: obj.__php_enum_case__,
	};
}
