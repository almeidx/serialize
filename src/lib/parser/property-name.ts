import type { PhpObjectProperty } from "./types.js";

type PropertyName = Pick<PhpObjectProperty, "name" | "visibility" | "className">;

/** PHP's mangled property name: `\0*\0name` when protected, `\0Class\0name` when private. */
export function encodePropertyName({ name, visibility, className }: PropertyName, objectClass: string): string {
	switch (visibility) {
		case "public":
			return name;
		case "protected":
			return `\0*\0${name}`;
		case "private":
			return `\0${className ?? objectClass}\0${name}`;
	}
}

/** Omits `className` when a private property is declared by the object's own class. */
export function decodePropertyName(raw: string, objectClass: string): PropertyName {
	if (raw.startsWith("\0*\0")) return { name: raw.slice(3), visibility: "protected" };

	const classEnd = raw.startsWith("\0") ? raw.indexOf("\0", 1) : -1;
	if (classEnd === -1) return { name: raw, visibility: "public" };

	const className = raw.slice(1, classEnd);
	return {
		name: raw.slice(classEnd + 1),
		visibility: "private",
		className: className === objectClass ? undefined : className,
	};
}
