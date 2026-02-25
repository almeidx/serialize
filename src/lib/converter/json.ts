import type { PhpArrayEntry, PhpValue } from '../parser/types';
import { validateReferenceGraph } from './references';
import type { JsonObject, JsonValue } from './types';
import {
	fromArrayWrapper,
	fromBinaryWrapper,
	fromCustomObjectWrapper,
	fromEnumWrapper,
	fromObjectWrapper,
	fromReferenceWrapper,
	toArrayWrapper,
	toBinaryWrapper,
	toCustomObjectWrapper,
	toEnumWrapper,
	toObjectWrapper,
	toReferenceWrapper,
} from './wrappers';

export type { JsonValue, JsonWithMeta } from './types';

export function toJson(php: PhpValue): JsonValue {
	switch (php.type) {
		case 'null':
			return null;

		case 'bool':
			return php.value;

		case 'int':
		case 'float':
			return php.value;

		case 'string':
			return php.binary ? toBinaryWrapper(php.value) : php.value;

		case 'array':
			return isSequentialArray(php.entries)
				? php.entries.map((entry) => toJson(entry.value))
				: toArrayWrapper(php.entries, toJson);

		case 'object':
			return toObjectWrapper(php.className, php.properties, toJson);

		case 'custom_object':
			return toCustomObjectWrapper(php.className, php.payload);

		case 'enum':
			return toEnumWrapper(php.className, php.caseName);

		case 'reference':
			return toReferenceWrapper(php.index, php.isObject);
	}
}

export function fromJson(json: JsonValue): PhpValue {
	const php = fromJsonInternal(json);
	validateReferenceGraph(php);
	return php;
}

function fromJsonInternal(json: JsonValue): PhpValue {
	if (json === null) {
		return { type: 'null' };
	}

	if (typeof json === 'boolean') {
		return { type: 'bool', value: json };
	}

	if (typeof json === 'number') {
		if (Number.isInteger(json)) {
			return { type: 'int', value: json };
		}
		return { type: 'float', value: json };
	}

	if (typeof json === 'string') {
		return { type: 'string', value: json };
	}

	if (Array.isArray(json)) {
		const entries = json.map((item, index) => ({
			key: { type: 'int' as const, value: index },
			value: fromJsonInternal(item),
		}));
		return { type: 'array', entries };
	}

	if (typeof json === 'object') {
		const obj = json as JsonObject;
		const typeTag = obj.__php_type__;

		if (typeTag !== undefined) {
			if (typeof typeTag !== 'string') {
				throw new Error('__php_type__ must be a string when present');
			}

			switch (typeTag) {
				case 'string':
					return fromBinaryWrapper(obj);
				case 'reference':
					return fromReferenceWrapper(obj);
				case 'array':
					return fromArrayWrapper(obj, fromJsonInternal);
				case 'object':
					return fromObjectWrapper(obj, fromJsonInternal);
				case 'custom_object':
					return fromCustomObjectWrapper(obj);
				case 'enum':
					return fromEnumWrapper(obj);
				default:
					throw new Error(`Unsupported __php_type__ value '${typeTag}'`);
			}
		}

		const entries = Object.entries(obj).map(([key, value]) => ({
			key: { type: 'string' as const, value: key },
			value: fromJsonInternal(value),
		}));
		return { type: 'array', entries };
	}

	return { type: 'null' };
}

function isSequentialArray(entries: PhpArrayEntry[]): boolean {
	return entries.every((entry, index) => entry.key.type === 'int' && entry.key.value === index);
}
