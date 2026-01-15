<script lang="ts">
	import type { JsonValue } from '../converter/json';
	import TreeNode from './TreeView.svelte';

	interface Props {
		data: JsonValue;
		key?: string | number | null;
		depth?: number;
	}

	let { data, key = null, depth = 0 }: Props = $props();

	let expanded = $state(depth < 1);

	function getType(value: JsonValue): string {
		if (value === null) return 'null';
		if (Array.isArray(value)) return 'array';
		if (typeof value === 'object') {
			const obj = value as Record<string, JsonValue>;
			if (obj.__php_type__ === 'object') return 'object';
			if (obj.__php_type__ === 'array') return 'array';
			if (obj.__php_type__ === 'string') return 'binary';
			if (obj.__php_type__ === 'reference') return 'reference';
			return 'object';
		}
		return typeof value;
	}

	function getPreview(value: JsonValue, type: string): string {
		if (type === 'null') return 'null';
		if (type === 'boolean') return String(value);
		if (type === 'number') return String(value);
		if (type === 'string') {
			const str = value as string;
			if (str.length > 50) return `"${str.slice(0, 47)}..."`;
			return `"${str}"`;
		}
		if (type === 'binary') {
			return '[binary data]';
		}
		if (type === 'reference') {
			const obj = value as Record<string, JsonValue>;
			return `ref(${obj.__php_ref_index__})`;
		}
		if (type === 'array') {
			if (Array.isArray(value)) return `Array(${value.length})`;
			const obj = value as Record<string, JsonValue>;
			if (obj.__php_original_keys__) {
				const keys = obj.__php_original_keys__ as unknown[];
				return `Array(${keys.length})`;
			}
			return 'Array';
		}
		if (type === 'object') {
			const obj = value as Record<string, JsonValue>;
			if (obj.__php_class__) return `${obj.__php_class__}`;
			const keys = Object.keys(obj).filter((k) => !k.startsWith('__php_'));
			return `Object(${keys.length})`;
		}
		return '';
	}

	function getChildren(value: JsonValue): Array<{ key: string | number; value: JsonValue }> {
		if (Array.isArray(value)) {
			return value.map((v, i) => ({ key: i, value: v }));
		}
		if (typeof value === 'object' && value !== null) {
			const obj = value as Record<string, JsonValue>;

			if (obj.__php_type__ === 'object' || obj.__php_type__ === 'array') {
				const data = obj.data as Record<string, JsonValue>;
				if (data) {
					return Object.entries(data).map(([k, v]) => ({ key: k, value: v }));
				}
			}

			return Object.entries(obj)
				.filter(([k]) => !k.startsWith('__php_'))
				.map(([k, v]) => ({ key: k, value: v }));
		}
		return [];
	}

	function isExpandable(value: JsonValue): boolean {
		if (Array.isArray(value)) return value.length > 0;
		if (typeof value === 'object' && value !== null) {
			const obj = value as Record<string, JsonValue>;
			if (obj.__php_type__ === 'string' || obj.__php_type__ === 'reference') return false;
			return true;
		}
		return false;
	}

	function getClassName(value: JsonValue): string | null {
		if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
			const obj = value as Record<string, JsonValue>;
			if (obj.__php_class__) return obj.__php_class__ as string;
		}
		return null;
	}

	const type = $derived(getType(data));
	const preview = $derived(getPreview(data, type));
	const children = $derived(getChildren(data));
	const expandable = $derived(isExpandable(data));
	const className = $derived(getClassName(data));
</script>

<div class="font-mono text-sm" style="padding-left: {depth > 0 ? 16 : 0}px">
	<div class="flex items-start gap-1 py-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
		{#if expandable}
			<button
				onclick={() => (expanded = !expanded)}
				class="w-4 h-4 flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 shrink-0 mt-0.5"
				aria-label={expanded ? 'Collapse' : 'Expand'}
			>
				<svg
					class="w-3 h-3 transition-transform {expanded ? 'rotate-90' : ''}"
					fill="currentColor"
					viewBox="0 0 20 20"
				>
					<path
						fill-rule="evenodd"
						d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
						clip-rule="evenodd"
					/>
				</svg>
			</button>
		{:else}
			<span class="w-4 shrink-0"></span>
		{/if}

		<span class="flex items-center gap-1 flex-wrap">
			{#if key !== null}
				<span class="text-purple-600 dark:text-purple-400">{key}</span>
				<span class="text-zinc-400">:</span>
			{/if}

			{#if type === 'null'}
				<span class="text-zinc-500 italic">null</span>
			{:else if type === 'boolean'}
				<span class="text-blue-600 dark:text-blue-400">{preview}</span>
			{:else if type === 'number'}
				<span class="text-green-600 dark:text-green-400">{preview}</span>
			{:else if type === 'string'}
				<span class="text-orange-600 dark:text-orange-400">{preview}</span>
			{:else if type === 'binary'}
				<span class="text-red-500 dark:text-red-400 italic">{preview}</span>
			{:else if type === 'reference'}
				<span class="text-pink-600 dark:text-pink-400 italic">{preview}</span>
			{:else if type === 'array'}
				<span class="text-zinc-500">{preview}</span>
			{:else if type === 'object'}
				{#if className}
					<span class="text-cyan-600 dark:text-cyan-400 font-medium">{className}</span>
				{:else}
					<span class="text-zinc-500">{preview}</span>
				{/if}
			{/if}
		</span>
	</div>

	{#if expandable && expanded}
		<div>
			{#each children as child}
				<TreeNode data={child.value} key={child.key} depth={depth + 1} />
			{/each}
		</div>
	{/if}
</div>
