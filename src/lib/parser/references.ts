import type { PhpReference, PhpValue } from "./types.js";

/** Values nest at most this deep, in serialized input and in the JSON representation alike. */
export const MAX_DEPTH = 512;

const OBJECT_LIKE: Partial<Record<PhpValue["type"], true>> = { object: true, custom_object: true, enum: true };

/**
 * The numbering `R:`/`r:` references point at, as PHP counts it: every value takes the next slot (from 1)
 * as it starts, in document order, before its children. Array keys and `R:` references take none.
 */
export class ReferenceSlots {
	/** A value's type, or for an `r:` reference the slot it points at. */
	#slots: Array<PhpValue["type"] | number> = [];

	/** Records a value. For an invalid reference, returns why instead. */
	add(value: { type: Exclude<PhpValue["type"], "reference"> } | PhpReference): string | undefined {
		if (value.type !== "reference") {
			this.#slots.push(value.type);
			return undefined;
		}

		const { index, isObject } = value;
		if (!Number.isSafeInteger(index) || index < 1) return `Reference index must be a positive integer, got '${index}'`;
		if (index > this.#slots.length) return `Reference index ${index} points to an unresolved value`;

		let target = this.#slots[index - 1];
		while (typeof target === "number") target = this.#slots[target - 1];
		if (isObject && !OBJECT_LIKE[target]) return `Object reference index ${index} must point to an object-like value`;

		if (isObject) this.#slots.push(index);
		return undefined;
	}
}
