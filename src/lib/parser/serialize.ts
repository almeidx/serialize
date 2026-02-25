import type { PhpValue, PhpArrayEntry, PhpObjectProperty } from './types';
import { utf8ByteLength } from './utf8';

export function serialize(value: PhpValue): string {
	return serializeValue(value);
}

function serializeValue(value: PhpValue): string {
	switch (value.type) {
		case 'null':
			return 'N;';

		case 'bool':
			return `b:${value.value ? '1' : '0'};`;

		case 'int':
			return `i:${Math.floor(value.value)};`;

		case 'float':
			if (value.value === Infinity) {
				return 'd:INF;';
			} else if (value.value === -Infinity) {
				return 'd:-INF;';
			} else if (Number.isNaN(value.value)) {
				return 'd:NAN;';
			}
			return `d:${value.value};`;

		case 'string':
			return `s:${utf8ByteLength(value.value)}:"${value.value}";`;

		case 'array':
			return serializeArray(value.entries);

		case 'object':
			return serializeObject(value.className, value.properties);

		case 'custom_object':
			return serializeCustomObject(value.className, value.payload);

		case 'enum':
			return serializeEnum(value.className, value.caseName);

		case 'reference':
			return `${value.isObject ? 'r' : 'R'}:${value.index};`;
	}
}

function serializeArray(entries: PhpArrayEntry[]): string {
	const parts = entries.map((entry) => serializeValue(entry.key) + serializeValue(entry.value));
	return `a:${entries.length}:{${parts.join('')}}`;
}

function serializeObject(className: string, properties: PhpObjectProperty[]): string {
	const parts = properties.map((prop) => {
		const name = encodePropertyName(prop.name, prop.visibility, prop.className ?? className);
		return `s:${utf8ByteLength(name)}:"${name}";${serializeValue(prop.value)}`;
	});
	return `O:${utf8ByteLength(className)}:"${className}":${properties.length}:{${parts.join('')}}`;
}

function serializeCustomObject(className: string, payload: string): string {
	return `C:${utf8ByteLength(className)}:"${className}":${utf8ByteLength(payload)}:{${payload}}`;
}

function serializeEnum(className: string, caseName: string): string {
	const enumName = `${className}:${caseName}`;
	return `E:${utf8ByteLength(enumName)}:"${enumName}";`;
}

function encodePropertyName(
	name: string,
	visibility: 'public' | 'protected' | 'private',
	className: string
): string {
	switch (visibility) {
		case 'public':
			return name;
		case 'protected':
			return `\0*\0${name}`;
		case 'private':
			return `\0${className}\0${name}`;
	}
}
