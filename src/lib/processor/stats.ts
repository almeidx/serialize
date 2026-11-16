import type { PhpValue } from "#lib/parser/types.js";
import { utf8ByteLength } from "#lib/parser/utf8.js";

export interface Stats {
	/** Size of the serialized form. */
	byteSize: number;
	nodeCount: number;
	maxDepth: number;
	types: Record<string, number>;
	classes: string[];
}

export function computeStats(value: PhpValue, serialized: string): Stats {
	const stats: Stats = { byteSize: utf8ByteLength(serialized), nodeCount: 0, maxDepth: 0, types: {}, classes: [] };
	const classes = new Set<string>();

	function visit(v: PhpValue, depth: number): void {
		stats.nodeCount++;
		stats.maxDepth = Math.max(stats.maxDepth, depth);
		stats.types[v.type] = (stats.types[v.type] ?? 0) + 1;

		switch (v.type) {
			case "array":
				for (const entry of v.entries) {
					visit(entry.key, depth + 1);
					visit(entry.value, depth + 1);
				}
				break;
			case "object":
				classes.add(v.className);
				for (const property of v.properties) visit(property.value, depth + 1);
				break;
			case "custom_object":
			case "enum":
				classes.add(v.className);
				break;
		}
	}

	visit(value, 1);
	stats.classes = [...classes].sort();
	return stats;
}
