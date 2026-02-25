import type { PhpValue } from './parser/types';

export interface Stats {
	byteSize: number;
	nodeCount: number;
	maxDepth: number;
	types: Record<string, number>;
	classes: string[];
}

export function computeStats(value: PhpValue, originalInput: string): Stats {
	const stats: Stats = {
		byteSize: new TextEncoder().encode(originalInput).length,
		nodeCount: 0,
		maxDepth: 0,
		types: {},
		classes: []
	};

	const classSet = new Set<string>();

	function visit(v: PhpValue, depth: number): void {
		stats.nodeCount++;
		stats.maxDepth = Math.max(stats.maxDepth, depth);
		stats.types[v.type] = (stats.types[v.type] || 0) + 1;

			switch (v.type) {
				case 'array':
					for (const entry of v.entries) {
						visit(entry.key, depth + 1);
						visit(entry.value, depth + 1);
					}
					break;

				case 'object':
					classSet.add(v.className);
					for (const prop of v.properties) {
						visit(prop.value, depth + 1);
					}
					break;

				case 'custom_object':
				case 'enum':
					classSet.add(v.className);
					break;
			}
		}

	visit(value, 1);
	stats.classes = Array.from(classSet).sort();

	return stats;
}
