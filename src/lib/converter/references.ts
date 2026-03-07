import type { PhpValue } from "../parser/types";

const MAX_DEPTH = 512;

export function validateReferenceGraph(root: PhpValue): void {
	const values: PhpValue[] = [];
	let currentIndex = 0;

	function visit(value: PhpValue, depth: number): void {
		if (depth > MAX_DEPTH) {
			throw new Error(`Maximum nesting depth of ${MAX_DEPTH} exceeded during reference validation`);
		}

		currentIndex++;
		const index = currentIndex;
		values[index] = value;

		if (value.type === "reference") {
			if (value.index < 1 || value.index >= index) {
				throw new Error(`Reference index ${value.index} points to an unresolved value at node ${index}`);
			}

			const target = resolveReferenceTarget(value.index, values);
			if (!target) {
				throw new Error(`Reference index ${value.index} does not exist`);
			}
			if (value.isObject && !isObjectLikeReferenceTarget(target)) {
				throw new Error(`Object reference index ${value.index} must point to an object-like value`);
			}
		}

		switch (value.type) {
			case "array":
				for (const entry of value.entries) {
					visit(entry.value, depth + 1);
				}
				break;
			case "object":
				for (const property of value.properties) {
					visit(property.value, depth + 1);
				}
				break;
		}
	}

	visit(root, 0);
}

function resolveReferenceTarget(index: number, values: PhpValue[]): PhpValue | null {
	let current = values[index];
	if (!current) return null;

	const seen = new Set<number>();
	let currentIndex = index;
	while (current.type === "reference") {
		if (seen.has(currentIndex)) return null;
		seen.add(currentIndex);

		currentIndex = current.index;
		current = values[currentIndex];
		if (!current) return null;
	}

	return current;
}

function isObjectLikeReferenceTarget(value: PhpValue): boolean {
	return value.type === "object" || value.type === "custom_object" || value.type === "enum";
}
