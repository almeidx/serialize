<script lang="ts">
	import type { JsonValue } from '../converter/json';
	import EditableTreeNode from './EditableTreeView.svelte';

	interface Props {
		data: JsonValue;
		path?: string;
		keyName?: string | number | null;
		depth?: number;
		onchange?: (path: string, value: JsonValue) => void;
	}

	let { data, path = '', keyName = null, depth = 0, onchange }: Props = $props();

	let expanded = $state(depth < 2);
	let editing = $state(false);
	let editValue = $state('');

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

	function getDisplayValue(value: JsonValue, type: string): string {
		if (type === 'null') return 'null';
		if (type === 'boolean') return String(value);
		if (type === 'number') return String(value);
		if (type === 'string') return value as string;
		if (type === 'binary') {
			const obj = value as Record<string, JsonValue>;
			return `[binary: ${obj.value}]`;
		}
		if (type === 'reference') {
			const obj = value as Record<string, JsonValue>;
			return `ref(${obj.__php_ref_index__})`;
		}
		return '';
	}

	function getPreview(value: JsonValue, type: string): string {
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
			if (obj.__php_class__) return String(obj.__php_class__);
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
				const d = obj.data as Record<string, JsonValue>;
				if (d) return Object.entries(d).map(([k, v]) => ({ key: k, value: v }));
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

	function isEditable(type: string): boolean {
		return ['string', 'number', 'boolean', 'null'].includes(type);
	}

	function startEdit() {
		if (!isEditable(type)) return;
		editing = true;
		editValue = type === 'string' ? (data as string) : JSON.stringify(data);
	}

	function commitEdit() {
		editing = false;
		if (!onchange) return;

		let newValue: JsonValue;
		if (type === 'string') {
			newValue = editValue;
		} else {
			try {
				newValue = JSON.parse(editValue);
			} catch {
				return;
			}
		}
		onchange(path, newValue);
	}

	function cancelEdit() {
		editing = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			commitEdit();
		} else if (e.key === 'Escape') {
			cancelEdit();
		}
	}

	function handleChildChange(childPath: string, value: JsonValue) {
		onchange?.(childPath, value);
	}

	const type = $derived(getType(data));
	const displayValue = $derived(getDisplayValue(data, type));
	const preview = $derived(getPreview(data, type));
	const children = $derived(getChildren(data));
	const expandable = $derived(isExpandable(data));
	const editable = $derived(isEditable(type));
</script>

<div class="font-mono text-sm" style="padding-left: {depth > 0 ? 16 : 0}px">
	<div class="flex items-start gap-1 py-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded group">
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

		<span class="flex items-center gap-1 flex-wrap flex-1 min-w-0">
			{#if keyName !== null}
				<span class="text-purple-600 dark:text-purple-400">{keyName}</span>
				<span class="text-zinc-400">:</span>
			{/if}

			{#if editing}
				<input
					type="text"
					bind:value={editValue}
					onblur={commitEdit}
					onkeydown={handleKeydown}
					class="flex-1 min-w-[100px] px-1 py-0.5 text-sm font-mono bg-white dark:bg-zinc-900 border border-blue-500 rounded outline-none"
					autofocus
				/>
			{:else if expandable}
				<span class="text-zinc-500">{preview}</span>
			{:else if type === 'null'}
				<button
					onclick={startEdit}
					class="text-zinc-500 italic hover:bg-zinc-200 dark:hover:bg-zinc-700 px-1 rounded cursor-text"
				>
					null
				</button>
			{:else if type === 'boolean'}
				<button
					onclick={startEdit}
					class="text-blue-600 dark:text-blue-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-1 rounded cursor-text"
				>
					{displayValue}
				</button>
			{:else if type === 'number'}
				<button
					onclick={startEdit}
					class="text-green-600 dark:text-green-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-1 rounded cursor-text"
				>
					{displayValue}
				</button>
			{:else if type === 'string'}
				<button
					onclick={startEdit}
					class="text-orange-600 dark:text-orange-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-1 rounded cursor-text text-left break-all"
				>
					"{displayValue.length > 100 ? displayValue.slice(0, 97) + '...' : displayValue}"
				</button>
			{:else if type === 'binary'}
				<span class="text-red-500 dark:text-red-400 italic">{displayValue}</span>
			{:else if type === 'reference'}
				<span class="text-pink-600 dark:text-pink-400 italic">{displayValue}</span>
			{/if}
		</span>
	</div>

	{#if expandable && expanded}
		<div>
			{#each children as child}
				<EditableTreeNode
					data={child.value}
					keyName={child.key}
					path={path ? `${path}.${child.key}` : String(child.key)}
					depth={depth + 1}
					onchange={handleChildChange}
				/>
			{/each}
		</div>
	{/if}
</div>
