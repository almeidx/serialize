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

	it('updates PHP object property metadata when adding values', () => {
		const input: JsonValue = {
			__php_type__: 'object',
			data: { existing: 'ok' },
			__php_property_meta__: {
				existing: { name: 'existing', visibility: 'public' }
			},
			__php_property_order__: ['existing']
		};

		const added = addAtPath(input, [], 'newKey', 'newValue') as Record<string, JsonValue>;
		const meta = added.__php_property_meta__ as Record<string, Record<string, JsonValue>>;
		const order = added.__php_property_order__ as string[];

		expect((added.data as Record<string, JsonValue>).newKey).toBe('newValue');
		expect(meta.newKey).toEqual({ name: 'newKey', visibility: 'public' });
		expect(order).toEqual(['existing', 'newKey']);
	});

	it('updates PHP object property metadata when deleting values', () => {
		const input: JsonValue = {
			__php_type__: 'object',
			data: { keep: 1, drop: 2 },
			__php_property_meta__: {
				keep: { name: 'keep', visibility: 'public' },
				drop: { name: 'drop', visibility: 'private', className: 'Foo' }
			},
			__php_property_order__: ['keep', 'drop']
		};

		const deleted = deleteAtPath(input, ['drop']) as Record<string, JsonValue>;
		const meta = deleted.__php_property_meta__ as Record<string, Record<string, JsonValue>>;
		const order = deleted.__php_property_order__ as string[];

		expect((deleted.data as Record<string, JsonValue>).drop).toBeUndefined();
		expect(meta.drop).toBeUndefined();
		expect(order).toEqual(['keep']);
	});

	it('does not mutate arrays when an invalid insert index is provided', () => {
		const input: JsonValue = ['a', 'b'];
		const updated = addAtPath(input, [], 'not-an-index', 'c');

		expect(updated).toEqual(['a', 'b']);
	});

	it('returns the same root reference for invalid update paths', () => {
		const input: JsonValue = { nested: { value: 1 } };
		const updated = setValueAtPath(input, ['missing', 'path'], 2);

		expect(updated).toBe(input);
	});

	it('preserves untouched branch references when updating nested data', () => {
		const input: JsonValue = {
			left: { value: 1 },
			right: { value: 2 }
		};

		const updated = setValueAtPath(input, ['left', 'value'], 9) as Record<string, JsonValue>;
		const original = input as Record<string, JsonValue>;

		expect(updated.left).not.toBe(original.left);
		expect(updated.right).toBe(original.right);
	});

	it('updates nested values inside wrapped containers', () => {
		const input: JsonValue = {
			__php_type__: 'object',
			data: {
				nested: {
					__php_type__: 'array',
					data: { '0': { value: 1 } },
					__php_original_keys__: [{ type: 'int', value: 0 }]
				}
			}
		};

		const updated = setValueAtPath(input, ['nested', '0', 'value'], 2) as Record<
			string,
			JsonValue
		>;
		const nested = (updated.data as Record<string, JsonValue>).nested as Record<
			string,
			JsonValue
		>;
		const nestedData = nested.data as Record<string, JsonValue>;

		expect((nestedData['0'] as Record<string, JsonValue>).value).toBe(2);
	});

	it('deletes nested values from plain objects', () => {
		const input: JsonValue = {
			a: { b: { c: 1, keep: 2 } }
		};

		const updated = deleteAtPath(input, ['a', 'b', 'c']) as Record<string, JsonValue>;
		expect((((updated.a as Record<string, JsonValue>).b as Record<string, JsonValue>).c)).toBeUndefined();
		expect((((updated.a as Record<string, JsonValue>).b as Record<string, JsonValue>).keep)).toBe(2);
	});

	it('returns the same value for invalid operations on wrapped containers', () => {
		const wrappedWithoutData: JsonValue = { __php_type__: 'object' };

		expect(setValueAtPath(wrappedWithoutData, ['x'], 1)).toBe(wrappedWithoutData);
		expect(deleteAtPath(wrappedWithoutData, ['x'])).toBe(wrappedWithoutData);
		expect(addAtPath(wrappedWithoutData, [], 'x', 1)).toBe(wrappedWithoutData);
	});

	it('adds values to plain objects and nested objects', () => {
		const input: JsonValue = { root: {} };
		const rootAdded = addAtPath(input, [], 'top', 1) as Record<string, JsonValue>;
		const nestedAdded = addAtPath(rootAdded, ['root'], 'nested', 2) as Record<
			string,
			JsonValue
		>;

		expect(rootAdded.top).toBe(1);
		expect((nestedAdded.root as Record<string, JsonValue>).nested).toBe(2);
	});

	it('inserts into arrays at index and appends beyond array length', () => {
		const input: JsonValue = ['a', 'c'];
		const inserted = addAtPath(input, [], '1', 'b') as JsonValue[];
		const appended = addAtPath(inserted, [], '10', 'd') as JsonValue[];

		expect(inserted).toEqual(['a', 'b', 'c']);
		expect(appended).toEqual(['a', 'b', 'c', 'd']);
	});

	it('does not duplicate object metadata when adding an existing wrapped key', () => {
		const input: JsonValue = {
			__php_type__: 'object',
			data: { key: 'value' },
			__php_property_meta__: {
				key: { name: 'key', visibility: 'public' }
			},
			__php_property_order__: ['key']
		};

		const updated = addAtPath(input, [], 'key', 'updated') as Record<string, JsonValue>;
		expect((updated.__php_property_order__ as string[])).toEqual(['key']);
		expect(
			updated.__php_property_meta__ as Record<string, Record<string, JsonValue>>
		).toEqual({
			key: { name: 'key', visibility: 'public' }
		});
	});

	it('returns unchanged value when nested add path does not exist', () => {
		const input: JsonValue = { existing: {} };
		const updated = addAtPath(input, ['missing'], 'k', 1);
		expect(updated).toBe(input);
	});
});
