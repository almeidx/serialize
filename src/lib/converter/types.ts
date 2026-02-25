export type JsonValue =
	| null
	| boolean
	| number
	| string
	| JsonValue[]
	| { [key: string]: JsonValue };

export interface JsonWithMeta {
	__php_type__: string;
	__php_class__?: string;
	__php_visibility__?: Record<string, 'public' | 'protected' | 'private'>;
	__php_property_class__?: Record<string, string>;
	__php_property_meta__?: Record<
		string,
		{
			name: string;
			visibility: 'public' | 'protected' | 'private';
			className?: string;
		}
	>;
	__php_property_order__?: string[];
	__php_binary__?: boolean;
	__php_ref_index__?: number;
	__php_ref_object__?: boolean;
	__php_payload_base64__?: string;
	__php_enum_case__?: string;
	__php_original_keys__?: Array<{ type: 'int' | 'string'; value: number | string }>;
	__php_data_keys__?: string[];
	data?: JsonValue;
	value?: JsonValue;
}

export type JsonObject = Record<string, JsonValue>;
export type PhpVisibility = 'public' | 'protected' | 'private';

export interface PhpPropertyMetaEntry {
	name: string;
	visibility: PhpVisibility;
	className?: string;
}
