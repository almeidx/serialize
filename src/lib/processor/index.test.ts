import { describe, expect, it } from 'vitest';

import { processInputValue, processParsedData } from './index';

describe('processor', () => {
	it('returns empty result for blank input', () => {
		expect(processInputValue('php', '   ')).toEqual({
			parsedData: undefined,
			phpSerializedValue: '',
			stats: null,
		});
	});

	it('processes php input into json, serialized output, and stats', () => {
		const result = processInputValue('php', 'a:1:{i:0;s:3:"foo";}');

		expect(result.parsedData).toEqual(['foo']);
		expect(result.phpSerializedValue).toBe('a:1:{i:0;s:3:"foo";}');
		expect(result.stats?.nodeCount).toBeGreaterThan(0);
	});

	it('processes json input into php and stats', () => {
		const result = processInputValue('json', '{"count":1}');

		expect(result.parsedData).toEqual({ count: 1 });
		expect(result.phpSerializedValue).toBe('a:1:{s:5:"count";i:1;}');
		expect(result.stats?.types.object ?? 0).toBe(0);
		expect(result.stats?.types.array ?? 0).toBeGreaterThan(0);
	});

	it('recomputes input and stats from parsed data', () => {
		const parsedData = { user: 'alice' };
		const php = processParsedData(parsedData, 'php');
		const json = processParsedData(parsedData, 'json');

		expect(php.inputValue).toBe(php.phpSerializedValue);
		expect(json.inputValue).toBe(JSON.stringify(parsedData, null, 2));
		expect(php.stats.types.array).toBeGreaterThan(0);
	});
});
