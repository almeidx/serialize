import { describe, expect, it } from 'vitest';

import { computeStats } from './stats';
import type { PhpValue } from './parser/types';

describe('computeStats', () => {
	it('computes byte size, node count, depth, and types', () => {
		const value: PhpValue = {
			type: 'array',
			entries: [
				{
					key: { type: 'int', value: 0 },
					value: { type: 'string', value: 'foo' },
				},
				{
					key: { type: 'int', value: 1 },
					value: { type: 'object', className: 'User', properties: [] },
				},
			],
		};

		const stats = computeStats(value, 'a:2:{i:0;s:3:"foo";i:1;O:4:"User":0:{}}');

		expect(stats.byteSize).toBeGreaterThan(0);
		expect(stats.nodeCount).toBe(5);
		expect(stats.maxDepth).toBe(2);
		expect(stats.types.array).toBe(1);
		expect(stats.types.int).toBe(2);
		expect(stats.types.string).toBe(1);
		expect(stats.types.object).toBe(1);
		expect(stats.classes).toEqual(['User']);
	});

	it('includes custom objects and enums in class list', () => {
		const value: PhpValue = {
			type: 'array',
			entries: [
				{
					key: { type: 'int', value: 0 },
					value: {
						type: 'custom_object',
						className: 'CustomThing',
						payload: 'abc',
					},
				},
				{
					key: { type: 'int', value: 1 },
					value: {
						type: 'enum',
						className: 'Suit',
						caseName: 'Hearts',
					},
				},
			],
		};

		const stats = computeStats(value, 'dummy');
		expect(stats.classes).toEqual(['CustomThing', 'Suit']);
		expect(stats.types.custom_object).toBe(1);
		expect(stats.types.enum).toBe(1);
	});
});
