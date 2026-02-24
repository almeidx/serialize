import { describe, expect, it } from 'vitest';

import type { JsonValue } from '../converter/json';
import { addAtPath, deleteAtPath, setValueAtPath } from './operations';

describe('tree operations', () => {
	it('updates keys that include dots without treating them as nested paths', () => {
		const input: JsonValue = {
			'user.name': 'alice',
			nested: {
				'profile.email': 'alice@example.com'
			}
		};

		const updatedRoot = setValueAtPath(input, ['user.name'], 'bob');
		const updatedNested = setValueAtPath(updatedRoot, ['nested', 'profile.email'], 'bob@example.com');

		expect((updatedNested as Record<string, JsonValue>)['user.name']).toBe('bob');
		expect(
			((updatedNested as Record<string, JsonValue>).nested as Record<string, JsonValue>)[
				'profile.email'
			]
		).toBe('bob@example.com');
	});

	it('preserves Infinity and NaN when mutating a tree', () => {
		const input: JsonValue = {
			values: [Infinity, NaN, -Infinity]
		};

		const updated = setValueAtPath(input, ['values', 0], 123);
		const values = (updated as Record<string, JsonValue>).values as JsonValue[];

		expect(values[0]).toBe(123);
		expect(values[1]).toBeNaN();
		expect(values[2]).toBe(-Infinity);
	});

	it('updates PHP array key metadata when adding values', () => {
		const input: JsonValue = {
			__php_type__: 'array',
			__php_original_keys__: [{ type: 'string', value: 'foo' }],
			data: { foo: 'bar' }
		};

		const added = addAtPath(input, [], '42', 'baz') as Record<string, JsonValue>;
		const keys = added.__php_original_keys__ as Array<{ type: 'int' | 'string'; value: number | string }>;

		expect((added.data as Record<string, JsonValue>)['42']).toBe('baz');
		expect(keys).toContainEqual({ type: 'int', value: 42 });
	});

	it('updates PHP array key metadata when deleting values', () => {
		const input: JsonValue = {
			__php_type__: 'array',
			__php_original_keys__: [
				{ type: 'string', value: 'foo' },
				{ type: 'int', value: 1 }
			],
			data: { foo: 'bar', 1: 'baz' }
		};

		const deleted = deleteAtPath(input, ['foo']) as Record<string, JsonValue>;
		const keys = deleted.__php_original_keys__ as Array<{ type: 'int' | 'string'; value: number | string }>;

		expect((deleted.data as Record<string, JsonValue>).foo).toBeUndefined();
		expect(keys).toEqual([{ type: 'int', value: 1 }]);
	});

	it('does not mutate arrays when an invalid insert index is provided', () => {
		const input: JsonValue = ['a', 'b'];
		const updated = addAtPath(input, [], 'not-an-index', 'c');

		expect(updated).toEqual(['a', 'b']);
	});
});
