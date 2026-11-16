import { formatFloat, parseNonFiniteFloat } from "#lib/parser/float.js";
import type {
	PhpArrayKey,
	PhpCustomObject,
	PhpEnum,
	PhpFloat,
	PhpReference,
	PhpString,
	PhpVisibility,
} from "#lib/parser/types.js";
import { isJsonObject, type JsonObject, type JsonValue } from "./types.js";

/** An array element of a wrapper; `dataKey` is its key in the wrapper's `data` object. */
export interface WrappedEntry {
	key: PhpArrayKey;
	dataKey: string;
	value: JsonValue;
}

/** An object property of a wrapper; `dataKey` is its key in the wrapper's `data` object. */
export interface WrappedProperty {
	dataKey: string;
	name: string;
	visibility: PhpVisibility;
	className?: string;
	value: JsonValue;
}

/** A decoded `__php_type__` object. Children of arrays and objects stay JSON. */
export type Wrapper =
	| PhpFloat
	| PhpString
	| PhpReference
	| PhpCustomObject
	| PhpEnum
	| { type: "array"; entries: WrappedEntry[] }
	| { type: "object"; className: string; properties: WrappedProperty[] };

export function isWrapper(object: JsonObject): boolean {
	return Object.hasOwn(object, "__php_type__");
}

/** Throws a descriptive error when `wrapper` is malformed. */
export function decodeWrapper(wrapper: JsonObject): Wrapper {
	const type = wrapper.__php_type__;
	switch (type) {
		case "float": {
			const value =
				typeof wrapper.value === "number"
					? wrapper.value
					: typeof wrapper.value === "string"
						? parseNonFiniteFloat(wrapper.value)
						: undefined;
			if (value === undefined) {
				throw new Error(
					`Float wrapper has invalid value '${JSON.stringify(wrapper.value)}', expected a number, 'NAN', 'INF', or '-INF'`,
				);
			}
			return { type, value };
		}
		case "string":
			if (wrapper.__php_binary__ !== true) throw new Error("Binary string wrapper must include '__php_binary__': true");
			if (typeof wrapper.value !== "string") throw new Error("Binary string wrapper requires a base64 'value' string");
			return { type, value: decodeBase64Utf8(wrapper.value, "Binary string wrapper contains invalid base64 data") };
		case "reference": {
			const index = wrapper.__php_ref_index__;
			if (typeof index !== "number" || !Number.isInteger(index)) {
				throw new Error("Reference wrapper requires integer __php_ref_index__");
			}
			if (index < 1) throw new Error("Reference wrapper __php_ref_index__ must be >= 1");
			if (typeof wrapper.__php_ref_object__ !== "boolean") {
				throw new Error("Reference wrapper requires boolean __php_ref_object__");
			}
			return { type, index, isObject: wrapper.__php_ref_object__ };
		}
		case "array":
			return { type, entries: decodeEntries(wrapper) };
		case "object":
			return {
				type,
				className: requireName(wrapper.__php_class__, "Object wrapper requires non-empty '__php_class__'"),
				properties: decodeProperties(wrapper),
			};
		case "custom_object": {
			const className = requireName(wrapper.__php_class__, "Custom object wrapper requires non-empty '__php_class__'");
			if (typeof wrapper.__php_payload_base64__ !== "string") {
				throw new Error("Custom object wrapper requires '__php_payload_base64__' string");
			}
			const payload = decodeBase64Utf8(
				wrapper.__php_payload_base64__,
				"Custom object wrapper contains invalid base64 payload",
			);
			return { type, className, payload };
		}
		case "enum":
			return {
				type,
				className: requireName(wrapper.__php_class__, "Enum wrapper requires non-empty '__php_class__'"),
				caseName: requireName(wrapper.__php_enum_case__, "Enum wrapper requires non-empty '__php_enum_case__'"),
			};
		default:
			throw new Error(
				typeof type === "string"
					? `Unsupported __php_type__ value '${type}'`
					: "__php_type__ must be a string when present",
			);
	}
}

export function encodeWrapper(wrapper: Wrapper): JsonObject {
	switch (wrapper.type) {
		case "float":
			return {
				__php_type__: "float",
				value: Number.isFinite(wrapper.value) ? wrapper.value : formatFloat(wrapper.value),
			};
		case "string":
			return { __php_type__: "string", __php_binary__: true, value: encodeBase64Utf8(wrapper.value) };
		case "reference":
			return { __php_type__: "reference", __php_ref_index__: wrapper.index, __php_ref_object__: wrapper.isObject };
		case "array": {
			const { entries } = wrapper;
			const result: JsonObject = {
				__php_type__: "array",
				__php_original_keys__: entries.map(({ key }) => ({ type: key.type, value: key.value })),
				data: Object.fromEntries(entries.map(({ dataKey, value }) => [dataKey, value])),
			};
			if (entries.some(({ key, dataKey }) => dataKey !== String(key.value))) {
				result.__php_data_keys__ = entries.map(({ dataKey }) => dataKey);
			}
			return result;
		}
		case "object":
			return {
				__php_type__: "object",
				__php_class__: wrapper.className,
				data: Object.fromEntries(wrapper.properties.map(({ dataKey, value }) => [dataKey, value])),
				__php_property_meta__: Object.fromEntries(
					wrapper.properties.map(({ dataKey, name, visibility, className }): [string, JsonObject] => [
						dataKey,
						className === undefined ? { name, visibility } : { name, visibility, className },
					]),
				),
				__php_property_order__: wrapper.properties.map(({ dataKey }) => dataKey),
			};
		case "custom_object":
			return {
				__php_type__: "custom_object",
				__php_class__: wrapper.className,
				__php_payload_base64__: encodeBase64Utf8(wrapper.payload),
			};
		case "enum":
			return { __php_type__: "enum", __php_class__: wrapper.className, __php_enum_case__: wrapper.caseName };
	}
}

/** Hands out `data` keys, disambiguating repeats (`key`, `key#2`, …) so they fit in one object. */
export function dataKeyAllocator(taken: Iterable<string> = []): (baseKey: string) => string {
	const used = new Set(taken);
	return (baseKey) => {
		let candidate = baseKey;
		for (let counter = 2; used.has(candidate); counter++) candidate = `${baseKey}#${counter}`;
		used.add(candidate);
		return candidate;
	};
}

export function encodeBase64Utf8(value: string): string {
	let binary = "";
	for (const byte of new TextEncoder().encode(value)) binary += String.fromCharCode(byte);
	return btoa(binary);
}

function decodeBase64Utf8(base64: string, invalidMessage: string): string {
	try {
		const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
		return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
	} catch {
		throw new Error(invalidMessage);
	}
}

function decodeEntries(wrapper: JsonObject): WrappedEntry[] {
	const data = requireObject(wrapper.data, "Array wrapper 'data'");
	if (!Array.isArray(wrapper.__php_original_keys__))
		throw new Error("Array wrapper requires '__php_original_keys__' array");

	const keys = wrapper.__php_original_keys__.map(decodeArrayKey);
	const dataKeys =
		wrapper.__php_data_keys__ === undefined
			? keys.map(({ value }) => String(value))
			: requireKeyList(wrapper.__php_data_keys__, "__php_data_keys__");
	if (dataKeys.length !== keys.length) {
		throw new Error(
			`__php_data_keys__ length ${dataKeys.length} does not match __php_original_keys__ length ${keys.length}`,
		);
	}

	const seen = new Set<string>();
	return keys.map((key, index) => {
		const dataKey = dataKeys[index];
		if (seen.has(dataKey)) {
			throw new Error(`Array wrapper has duplicate key '${dataKey}' and requires '__php_data_keys__'`);
		}
		seen.add(dataKey);
		if (!Object.hasOwn(data, dataKey)) throw new Error(`Array wrapper data key '${dataKey}' is missing from data`);
		return { key, dataKey, value: data[dataKey] };
	});
}

function decodeArrayKey(entry: JsonValue, index: number): PhpArrayKey {
	if (!isJsonObject(entry)) throw new Error(`Array wrapper key metadata at index ${index} must be an object`);
	if (entry.type === "int") {
		if (typeof entry.value !== "number" || !Number.isInteger(entry.value)) {
			throw new Error(`Array wrapper int key metadata at index ${index} must include integer value`);
		}
		return { type: "int", value: entry.value };
	}
	if (entry.type === "string") {
		if (typeof entry.value !== "string") {
			throw new Error(`Array wrapper string key metadata at index ${index} must include string value`);
		}
		return { type: "string", value: entry.value };
	}
	throw new Error(`Array wrapper key metadata at index ${index} must include type 'int' or 'string'`);
}

function decodeProperties(wrapper: JsonObject): WrappedProperty[] {
	const data = requireObject(wrapper.data, "Object wrapper 'data'");
	const meta = decodeMap(wrapper.__php_property_meta__, "__php_property_meta__", decodePropertyMeta);
	// Exports made before 2026-02-25 carry visibility and declaring class in these two maps instead.
	const visibilities = decodeMap(wrapper.__php_visibility__, "__php_visibility__", (value, key) => {
		if (!isVisibility(value)) throw new Error(`Invalid visibility '${JSON.stringify(value)}' for property '${key}'`);
		return value;
	});
	const classes = decodeMap(wrapper.__php_property_class__, "__php_property_class__", (value, key) => {
		if (typeof value !== "string")
			throw new Error(`__php_property_class__ values must be strings (invalid entry '${key}')`);
		return value;
	});

	for (const [field, map] of [
		["Property", meta],
		["Visibility", visibilities],
		["Property class", classes],
	] as const) {
		for (const key of map.keys()) {
			if (!Object.hasOwn(data, key)) throw new Error(`${field} metadata references missing property '${key}'`);
		}
	}

	let order = Object.keys(data);
	if (wrapper.__php_property_order__ !== undefined) {
		order = requireKeyList(wrapper.__php_property_order__, "__php_property_order__");
		for (const key of order) {
			if (!Object.hasOwn(data, key)) {
				throw new Error(`__php_property_order__ references missing property key '${key}'`);
			}
		}
		if (order.length !== Object.keys(data).length) {
			const missing = Object.keys(data).find((key) => !order.includes(key));
			throw new Error(`__php_property_order__ is missing property key '${missing}'`);
		}
	}

	return order.map((dataKey) => {
		const entry = meta.get(dataKey);
		return {
			dataKey,
			name: entry?.name ?? dataKey,
			visibility: entry?.visibility ?? visibilities.get(dataKey) ?? "public",
			className: entry?.className ?? classes.get(dataKey),
			value: data[dataKey],
		};
	});
}

function decodePropertyMeta(value: JsonValue, key: string): Omit<WrappedProperty, "dataKey" | "value"> {
	if (!isJsonObject(value)) throw new Error(`__php_property_meta__ entry '${key}' must be an object`);
	if (typeof value.name !== "string")
		throw new Error(`__php_property_meta__ entry '${key}' must include string 'name'`);
	if (!isVisibility(value.visibility)) {
		throw new Error(`__php_property_meta__ entry '${key}' must include valid 'visibility'`);
	}
	if (value.className !== undefined && typeof value.className !== "string") {
		throw new Error(`__php_property_meta__ entry '${key}' has invalid 'className'`);
	}
	return { name: value.name, visibility: value.visibility, className: value.className };
}

function decodeMap<T>(
	value: JsonValue | undefined,
	field: string,
	decodeEntry: (value: JsonValue, key: string) => T,
): Map<string, T> {
	if (value === undefined) return new Map();
	const object = requireObject(value, field);
	return new Map(Object.entries(object).map(([key, entry]) => [key, decodeEntry(entry, key)]));
}

function requireKeyList(value: JsonValue, field: string): string[] {
	if (!Array.isArray(value)) throw new Error(`${field} must be an array when present`);
	const seen = new Set<string>();
	return value.map((entry, index) => {
		if (typeof entry !== "string") throw new Error(`${field} entry at index ${index} must be a string`);
		if (seen.has(entry)) throw new Error(`${field} contains duplicate key '${entry}'`);
		seen.add(entry);
		return entry;
	});
}

function requireObject(value: JsonValue | undefined, what: string): JsonObject {
	if (!isJsonObject(value)) throw new Error(`${what} must be an object`);
	return value;
}

function requireName(value: JsonValue | undefined, message: string): string {
	if (typeof value !== "string" || value.length === 0) throw new Error(message);
	return value;
}

function isVisibility(value: JsonValue | undefined): value is PhpVisibility {
	return value === "public" || value === "protected" || value === "private";
}
