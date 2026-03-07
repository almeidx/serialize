export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type JsonObject = Record<string, JsonValue>;
export type PhpVisibility = "public" | "protected" | "private";

export type PhpArrayKey = { type: "int"; value: number } | { type: "string"; value: string };

export interface PhpPropertyMetaEntry {
	name: string;
	visibility: PhpVisibility;
	className?: string;
}
