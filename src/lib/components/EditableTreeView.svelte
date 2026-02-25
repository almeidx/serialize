<script lang="ts">
	import { tick } from 'svelte';
	import type { JsonValue } from '../converter/json';
	import type { TreePath } from '../tree/operations';
	import EditableTreeNode from './EditableTreeView.svelte';

	export type TreeOperation =
		| { type: 'set'; path: TreePath; value: JsonValue }
		| { type: 'delete'; path: TreePath }
		| { type: 'add'; path: TreePath; key: string; value: JsonValue };

	interface Props {
		data: JsonValue;
		path?: TreePath;
		keyName?: string | number | null;
		depth?: number;
		onchange?: (op: TreeOperation) => void;
		ondelete?: () => void;
	}

	let { data, path = [], keyName = null, depth = 0, onchange, ondelete }: Props = $props();

	// svelte-ignore state_referenced_locally - depth is fixed per tree node instance
	let expanded = $state(depth < 2);
	let editing = $state(false);
	let editValue = $state('');
	let showTypeMenu = $state(false);
	let addingKey = $state(false);
	let newKeyName = $state('');
	let typeMenuContainer = $state<HTMLDivElement | null>(null);
	let typeMenuList = $state<HTMLDivElement | null>(null);
	const typeOptions = ['string', 'number', 'boolean', 'null', 'array', 'object'];

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
		if (Array.isArray(value)) return true;
		if (typeof value === 'object' && value !== null) {
			const obj = value as Record<string, JsonValue>;
			if (obj.__php_type__ === 'string' || obj.__php_type__ === 'reference') return false;
			return true;
		}
		return false;
	}

	function isScalar(type: string): boolean {
		return ['string', 'number', 'boolean', 'null'].includes(type);
	}

	function startEdit() {
		if (!isScalar(type)) return;
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
		onchange({ type: 'set', path, value: newValue });
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

	function changeType(newType: string) {
		showTypeMenu = false;
		if (!onchange) return;

		let newValue: JsonValue;
		switch (newType) {
			case 'string':
				newValue = type === 'number' ? String(data) : '';
				break;
			case 'number':
				newValue = type === 'string' ? Number(data) || 0 : 0;
				break;
			case 'boolean':
				newValue = Boolean(data);
				break;
			case 'null':
				newValue = null;
				break;
			case 'array':
				newValue = [];
				break;
			case 'object':
				newValue = {};
				break;
			default:
				return;
		}
		onchange({ type: 'set', path, value: newValue });
	}

	async function toggleTypeMenu(event: MouseEvent) {
		event.stopPropagation();
		showTypeMenu = !showTypeMenu;
		if (showTypeMenu) {
			await tick();
			typeMenuList?.focus();
		}
	}

	function handleDelete() {
		ondelete?.();
	}

	function startAddKey() {
		addingKey = true;
		newKeyName = type === 'array' ? String(children.length) : '';
		expanded = true;
	}

	function commitAddKey() {
		addingKey = false;
		if (!onchange || !newKeyName.trim()) return;
		onchange({ type: 'add', path, key: newKeyName.trim(), value: '' });
		newKeyName = '';
	}

	function cancelAddKey() {
		addingKey = false;
		newKeyName = '';
	}

	function handleAddKeyKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			commitAddKey();
		} else if (e.key === 'Escape') {
			cancelAddKey();
		}
	}

	function handleChildChange(op: TreeOperation) {
		onchange?.(op);
	}

	function handleChildDelete(childKey: string | number) {
		if (!onchange) return;
		const childPath = [...path, childKey];
		onchange({ type: 'delete', path: childPath });
	}

	function handleTypeMenuFocusOut(event: FocusEvent) {
		const next = event.relatedTarget;
		if (next instanceof Node && typeMenuContainer?.contains(next)) return;
		showTypeMenu = false;
	}

	function handleTypeMenuKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			showTypeMenu = false;
		}
	}

	const type = $derived(getType(data));
	const displayValue = $derived(getDisplayValue(data, type));
	const preview = $derived(getPreview(data, type));
	const children = $derived(getChildren(data));
	const expandable = $derived(isExpandable(data));
	const canAddChildren = $derived(type === 'array' || type === 'object');
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
				<!-- svelte-ignore a11y_autofocus -->
				<input
					type="text"
					bind:value={editValue}
					onblur={commitEdit}
					onkeydown={handleKeydown}
					class="flex-1 min-w-25 px-1 py-0.5 text-sm font-mono bg-white dark:bg-zinc-900 border border-blue-500 rounded outline-none"
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

			<!-- Action buttons -->
			<span class="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 flex items-center gap-0.5 ml-1">
				<!-- Type change button -->
					<div class="relative" bind:this={typeMenuContainer} onfocusout={handleTypeMenuFocusOut}>
						<button
							onclick={toggleTypeMenu}
							class="w-5 h-5 flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded"
							title="Change type"
							aria-haspopup="menu"
							aria-expanded={showTypeMenu}
						>
						<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
							/>
						</svg>
						</button>
						{#if showTypeMenu}
							<div
								bind:this={typeMenuList}
								role="menu"
								tabindex="-1"
								class="absolute left-0 top-6 z-50 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded shadow-lg py-1 min-w-25"
								onclick={(e) => e.stopPropagation()}
								onkeydown={handleTypeMenuKeydown}
							>
								{#each typeOptions as t}
									<button
										role="menuitem"
										onclick={() => changeType(t)}
										class="w-full text-left px-3 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-700 {type ===
										t
										? 'text-blue-600 dark:text-blue-400 font-medium'
										: 'text-zinc-700 dark:text-zinc-300'}"
								>
									{t}
								</button>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Add child button (for arrays/objects) -->
				{#if canAddChildren}
					<button
						onclick={(e) => {
							e.stopPropagation();
							startAddKey();
						}}
						class="w-5 h-5 flex items-center justify-center text-zinc-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded"
						title="Add item"
					>
						<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 4v16m8-8H4"
							/>
						</svg>
					</button>
				{/if}

				<!-- Delete button -->
				{#if ondelete}
					<button
						onclick={(e) => {
							e.stopPropagation();
							handleDelete();
						}}
						class="w-5 h-5 flex items-center justify-center text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded"
						title="Delete"
					>
						<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				{/if}
			</span>
		</span>
	</div>

	{#if expandable && expanded}
		<div>
			{#each children as child}
				<EditableTreeNode
					data={child.value}
					keyName={child.key}
					path={[...path, child.key]}
					depth={depth + 1}
					onchange={handleChildChange}
					ondelete={() => handleChildDelete(child.key)}
				/>
			{/each}

			<!-- Add key input -->
			{#if addingKey}
				<div class="flex items-center gap-1 py-0.5" style="padding-left: 16px">
					<span class="w-4 shrink-0"></span>
					<!-- svelte-ignore a11y_autofocus -->
					<input
						type="text"
						bind:value={newKeyName}
						onblur={cancelAddKey}
						onkeydown={handleAddKeyKeydown}
						placeholder={type === 'array' ? 'index' : 'key'}
						class="w-24 px-1 py-0.5 text-xs font-mono bg-white dark:bg-zinc-900 border border-blue-500 rounded outline-none"
						autofocus
					/>
					<span class="text-zinc-400">:</span>
					<span class="text-zinc-400 text-xs italic">""</span>
				</div>
			{/if}
		</div>
	{/if}
</div>
