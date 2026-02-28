<script lang="ts">
	import { tick } from 'svelte';
	import * as tree from '@zag-js/tree-view';
	import { mergeProps, normalizeProps, useMachine } from '@zag-js/svelte';
	import type { JsonValue } from '../converter/json';
	import type { TreePath } from '../tree/operations';
	import type { TreeOperation } from './tree-types';
	import TypeMenu from './TypeMenu.svelte';
	import EditableTreeNode from './EditableTreeView.svelte';

	type PhpArrayKey = { type: 'int' | 'string'; value: number | string };
	type ChildEntry = {
		pathKey: string | number;
		displayKey: string | number;
		value: JsonValue;
	};
	type TreeUiNode = {
		value: string;
		label: string;
		path: TreePath;
		pathKey: string | number | null;
		displayKey: string | number | null;
		json: JsonValue;
		children?: TreeUiNode[];
	};

	interface Props {
		data: JsonValue;
		path?: TreePath;
		keyName?: string | number | null;
		depth?: number;
		onchange?: (op: TreeOperation) => void;
		ondelete?: () => void;
		treeApi?: any;
		treeCollection?: any;
		treeNode?: TreeUiNode;
	}

	let {
		data,
		path = [],
		keyName = null,
		depth = 0,
		onchange,
		ondelete,
		treeApi,
		treeCollection,
		treeNode,
	}: Props = $props();

	let editing = $state(false);
	let editValue = $state('');
	let addingKey = $state(false);
	let newKeyName = $state('');

	const typeOptions = ['string', 'number', 'boolean', 'null', 'array', 'object'];

	function nodeIdForPath(targetPath: TreePath): string {
		if (targetPath.length === 0) return 'node-root';
		return 'node-' + targetPath.map((seg) =>
			String(seg).replace(/[^a-zA-Z0-9_-]/g, (ch) => `_${ch.charCodeAt(0).toString(16)}`)
		).join('--');
	}

	function parsePhpArrayKeys(value: JsonValue | undefined): PhpArrayKey[] {
		if (!Array.isArray(value)) return [];
		return value
			.filter(
				(entry): entry is PhpArrayKey =>
					!!entry &&
					typeof entry === 'object' &&
					!Array.isArray(entry) &&
					((entry as PhpArrayKey).type === 'int' ||
						(entry as PhpArrayKey).type === 'string')
			)
			.map((entry) => ({
				type: entry.type,
				value: entry.value,
			}));
	}

	function getChildrenEntries(value: JsonValue): ChildEntry[] {
		if (Array.isArray(value)) {
			return value.map((childValue, index) => ({
				pathKey: index,
				displayKey: index,
				value: childValue,
			}));
		}

		if (!value || typeof value !== 'object') {
			return [];
		}

		const objectValue = value as Record<string, JsonValue>;
		if (objectValue.__php_type__ === 'array') {
			const wrappedData = objectValue.data;
			if (!wrappedData || typeof wrappedData !== 'object' || Array.isArray(wrappedData)) {
				return [];
			}

			const dataRecord = wrappedData as Record<string, JsonValue>;
			const originalKeys = parsePhpArrayKeys(objectValue.__php_original_keys__);
			const explicitDataKeys =
				Array.isArray(objectValue.__php_data_keys__) &&
				objectValue.__php_data_keys__.length === originalKeys.length &&
				objectValue.__php_data_keys__.every((entry) => typeof entry === 'string')
					? (objectValue.__php_data_keys__ as string[])
					: null;

			if (originalKeys.length > 0) {
				const entries: Array<ChildEntry | null> = originalKeys.map((keyInfo, index) => {
						const dataKey = explicitDataKeys?.[index] ?? String(keyInfo.value);
						const childValue = dataRecord[dataKey];
						if (childValue === undefined) return null;
						return {
							pathKey: dataKey,
							displayKey: keyInfo.value,
							value: childValue,
						} satisfies ChildEntry;
					});
				return entries.filter((entry): entry is ChildEntry => entry !== null);
			}

			return Object.entries(dataRecord).map(([dataKey, childValue]) => ({
				pathKey: dataKey,
				displayKey: dataKey,
				value: childValue,
			}));
		}

		if (objectValue.__php_type__ === 'object') {
			const wrappedData = objectValue.data;
			if (!wrappedData || typeof wrappedData !== 'object' || Array.isArray(wrappedData)) {
				return [];
			}

			return Object.entries(wrappedData as Record<string, JsonValue>).map(
				([dataKey, childValue]) => ({
					pathKey: dataKey,
					displayKey: dataKey,
					value: childValue,
				})
			);
		}

		return Object.entries(objectValue)
			.filter(([entryKey]) => !entryKey.startsWith('__php_'))
			.map(([entryKey, childValue]) => ({
				pathKey: entryKey,
				displayKey: entryKey,
				value: childValue,
			}));
	}

	function buildTreeNode(
		nodeValue: JsonValue,
		nodePath: TreePath,
		nodeKey: string | number | null
	): TreeUiNode {
		const childEntries = getChildrenEntries(nodeValue);
		return {
			value: nodeIdForPath(nodePath),
			label: nodeKey === null ? 'root' : String(nodeKey),
			path: nodePath,
			pathKey: nodePath.length > 0 ? nodePath[nodePath.length - 1] : null,
			displayKey: nodeKey,
			json: nodeValue,
			children:
				childEntries.length > 0
					? childEntries.map((entry) =>
							buildTreeNode(entry.value, [...nodePath, entry.pathKey], entry.displayKey)
						)
					: undefined,
		};
	}

	function collectDefaultExpanded(node: TreeUiNode, expanded: string[] = []): string[] {
		if ((node.children?.length ?? 0) > 0 && node.path.length < 2) {
			expanded.push(node.value);
		}
		for (const child of node.children ?? []) {
			collectDefaultExpanded(child, expanded);
		}
		return expanded;
	}

	function getType(value: JsonValue): string {
		if (value === null) return 'null';
		if (Array.isArray(value)) return 'array';
		if (typeof value === 'object') {
			const obj = value as Record<string, JsonValue>;
			if (obj.__php_type__ === 'object') return 'object';
			if (obj.__php_type__ === 'array') return 'array';
			if (obj.__php_type__ === 'string') return 'binary';
			if (obj.__php_type__ === 'reference') return 'reference';
			if (obj.__php_type__ === 'custom_object') return 'custom_object';
			if (obj.__php_type__ === 'enum') return 'enum';
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
		if (type === 'custom_object') {
			const obj = value as Record<string, JsonValue>;
			return `custom(${String(obj.__php_class__)})`;
		}
		if (type === 'enum') {
			const obj = value as Record<string, JsonValue>;
			return `${String(obj.__php_class__)}::${String(obj.__php_enum_case__)}`;
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

	function isExpandable(value: JsonValue): boolean {
		if (Array.isArray(value)) return true;
		if (typeof value === 'object' && value !== null) {
			const obj = value as Record<string, JsonValue>;
			if (
				obj.__php_type__ === 'string' ||
				obj.__php_type__ === 'reference' ||
				obj.__php_type__ === 'custom_object' ||
				obj.__php_type__ === 'enum'
			)
				return false;
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

	function handleEditKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			commitEdit();
		} else if (event.key === 'Escape') {
			cancelEdit();
		}
	}

	function changeType(newType: string) {
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

	async function startAddKey(event?: MouseEvent) {
		event?.preventDefault();
		event?.stopPropagation();

		if (expandable && !nodeState?.expanded) {
			activeTreeApi.expand([activeTreeNode.value]);
			await tick();
		}

		addingKey = true;
		newKeyName = type === 'array' ? String(childNodes.length) : '';
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

	function handleAddKeyKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			commitAddKey();
		} else if (event.key === 'Escape') {
			cancelAddKey();
		}
	}

	const type = $derived(getType(data));
	const displayValue = $derived(getDisplayValue(data, type));
	const preview = $derived(getPreview(data, type));
	const expandable = $derived(isExpandable(data));
	const canAddChildren = $derived(type === 'array' || type === 'object');

	const localRootNode = $derived(buildTreeNode(data, path, keyName));	
	const activeTreeNode = $derived(treeNode ?? localRootNode);
	const childNodes = $derived(activeTreeNode.children ?? []);
	const rootInstance = $derived(depth === 0 && !treeNode && keyName === null);

	const managedTreeCollection = $derived.by(() => {
		if (treeCollection) return treeCollection;
		return tree.collection<TreeUiNode>({
			rootNode: localRootNode,
			nodeToValue: (node) => node.value,
			nodeToString: (node) => node.label,
			nodeToChildren: (node) => node.children ?? [],
			isNodeDisabled: () => false,
		});
	});

	const managedTreeService = useMachine(tree.machine, () => ({
		id: 'editable-tree',
		collection: managedTreeCollection,
		selectionMode: 'single' as const,
		expandOnClick: true,
		typeahead: true,
		defaultExpandedValue: collectDefaultExpanded(localRootNode),
	}));

	const managedTreeApi = $derived(tree.connect(managedTreeService, normalizeProps));
	const activeTreeApi = $derived(treeApi ?? managedTreeApi);
	const activeTreeCollection = $derived(treeCollection ?? managedTreeCollection);

	const nodeProps = $derived.by(() => {
		const indexPath = activeTreeCollection.getIndexPath(activeTreeNode.value);
		if (!indexPath) return null;
		return { node: activeTreeNode, indexPath };
	});
	const nodeState = $derived(nodeProps ? activeTreeApi.getNodeState(nodeProps) : null);

	const rowProps = $derived.by(() => {
		if (!nodeProps || !nodeState) return {};
		return nodeState.isBranch
			? activeTreeApi.getBranchControlProps(nodeProps)
			: activeTreeApi.getItemProps(nodeProps);
	});
	const branchWrapperProps = $derived.by(() => {
		if (!nodeProps || !nodeState?.isBranch) return {};
		return activeTreeApi.getBranchProps(nodeProps);
	});
	const branchContentProps = $derived.by(() => {
		if (!nodeProps || !nodeState?.isBranch) return {};
		return activeTreeApi.getBranchContentProps(nodeProps);
	});
	const branchIndicatorProps = $derived.by(() => {
		if (!nodeProps || !nodeState?.isBranch) return {};
		return activeTreeApi.getBranchIndicatorProps(nodeProps);
	});
	const branchTextProps = $derived.by(() => {
		if (!nodeProps || !nodeState?.isBranch) return {};
		return activeTreeApi.getBranchTextProps(nodeProps);
	});
	const itemTextProps = $derived.by(() => {
		if (!nodeProps || nodeState?.isBranch) return {};
		return activeTreeApi.getItemTextProps(nodeProps);
	});
</script>

{#if rootInstance}
	<div
		{...mergeProps(activeTreeApi.getRootProps(), {
			class: 'font-mono text-sm',
		})}
	>
		<label class="sr-only" {...activeTreeApi.getLabelProps()}>Editable parsed data tree</label>
		<div {...activeTreeApi.getTreeProps()}>
			{#each childNodes as childNode (childNode.value)}
				<EditableTreeNode
					data={childNode.json}
					path={childNode.path}
					keyName={childNode.displayKey}
					depth={depth + 1}
					onchange={onchange}
					ondelete={() => onchange?.({ type: 'delete', path: childNode.path })}
					treeApi={activeTreeApi}
					treeCollection={activeTreeCollection}
					treeNode={childNode}
				/>
			{/each}
		</div>
	</div>
{:else}
	<div
		{...mergeProps(branchWrapperProps, {
			class: 'font-mono text-sm',
			style: `padding-left: ${depth > 0 ? 16 : 0}px`,
		})}
		>
			<div
				class="flex items-start gap-1 py-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded group"
			>
				<div
					{...mergeProps(rowProps, {
						class: 'flex items-start gap-1 flex-1 min-w-0',
					})}
				>
					{#if expandable}
						<span
							{...mergeProps(branchIndicatorProps, {
								class:
									'w-4 h-4 flex items-center justify-center text-zinc-500 shrink-0 mt-0.5',
								'aria-hidden': 'true',
							})}
						>
							<svg
								class="w-3 h-3 transition-transform {nodeState?.expanded ? 'rotate-90' : ''}"
								fill="currentColor"
								viewBox="0 0 20 20"
							>
								<path
									fill-rule="evenodd"
									d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
									clip-rule="evenodd"
								/>
							</svg>
						</span>
					{:else}
						<span class="w-4 shrink-0"></span>
					{/if}

					<span class="flex items-center gap-1 flex-wrap flex-1 min-w-0">
						{#if keyName !== null}
							<span class="text-purple-700 dark:text-purple-300">{keyName}</span>
							<span class="text-zinc-500">:</span>
						{/if}

						{#if editing}
							<!-- svelte-ignore a11y_autofocus -->
							<input
								type="text"
								bind:value={editValue}
								onblur={commitEdit}
								onkeydown={handleEditKeydown}
								class="flex-1 min-w-25 px-1 py-0.5 text-sm font-mono bg-white dark:bg-zinc-900 border border-blue-500 rounded outline-none"
								autofocus
							/>
						{:else if expandable}
							<span {...branchTextProps} class="text-zinc-600 dark:text-zinc-300">{preview}</span>
						{:else if type === 'null'}
							<button
								type="button"
								onclick={startEdit}
								class="text-zinc-600 dark:text-zinc-300 italic hover:bg-zinc-200 dark:hover:bg-zinc-700 px-1 rounded cursor-text"
							>
								null
							</button>
						{:else if type === 'boolean'}
							<button
								type="button"
								onclick={startEdit}
								{...itemTextProps}
								class="text-blue-700 dark:text-blue-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-1 rounded cursor-text"
							>
								{displayValue}
							</button>
						{:else if type === 'number'}
							<button
								type="button"
								onclick={startEdit}
								{...itemTextProps}
								class="text-green-700 dark:text-green-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-1 rounded cursor-text"
							>
								{displayValue}
							</button>
						{:else if type === 'string'}
							<button
								type="button"
								onclick={startEdit}
								{...itemTextProps}
								class="text-orange-700 dark:text-orange-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-1 rounded cursor-text text-left break-all"
							>
								"{displayValue.length > 100 ? displayValue.slice(0, 97) + '...' : displayValue}"
							</button>
						{:else if type === 'binary'}
							<span class="text-red-700 dark:text-red-300 italic">{displayValue}</span>
						{:else if type === 'reference'}
							<span class="text-pink-700 dark:text-pink-300 italic">{displayValue}</span>
						{:else if type === 'custom_object'}
							<span class="text-teal-700 dark:text-teal-300 italic">{displayValue}</span>
						{:else if type === 'enum'}
							<span class="text-violet-700 dark:text-violet-300 italic">{displayValue}</span>
						{/if}

						{#if !expandable}
							<span
								class="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 flex items-center gap-0.5 ml-1"
							>
								<TypeMenu
									id={activeTreeNode.value}
									currentType={type}
									options={typeOptions}
									onselect={changeType}
								/>

								{#if canAddChildren}
									<button
										type="button"
										onclick={startAddKey}
										class="w-5 h-5 flex items-center justify-center text-zinc-500 hover:text-green-700 dark:hover:text-green-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded"
										aria-label="Add item"
									>
										<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
										</svg>
									</button>
								{/if}

								{#if ondelete}
									<button
										type="button"
										onclick={ondelete}
										class="w-5 h-5 flex items-center justify-center text-zinc-500 hover:text-red-700 dark:hover:text-red-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded"
										aria-label="Delete"
									>
										<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
										</svg>
									</button>
								{/if}
							</span>
						{/if}
					</span>
				</div>

				{#if expandable}
					<span
						class="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 flex items-center gap-0.5 ml-1"
					>
						<TypeMenu
							id={activeTreeNode.value}
							currentType={type}
							options={typeOptions}
							onselect={changeType}
						/>

						{#if canAddChildren}
							<button
								type="button"
								onclick={startAddKey}
								class="w-5 h-5 flex items-center justify-center text-zinc-500 hover:text-green-700 dark:hover:text-green-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded"
								aria-label="Add item"
							>
								<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
								</svg>
							</button>
						{/if}

						{#if ondelete}
							<button
								type="button"
								onclick={ondelete}
								class="w-5 h-5 flex items-center justify-center text-zinc-500 hover:text-red-700 dark:hover:text-red-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded"
								aria-label="Delete"
							>
								<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						{/if}
					</span>
				{/if}
			</div>

		{#if expandable && nodeState?.expanded}
			<div {...branchContentProps}>
				{#each childNodes as childNode (childNode.value)}
					<EditableTreeNode
						data={childNode.json}
						path={childNode.path}
						keyName={childNode.displayKey}
						depth={depth + 1}
						onchange={onchange}
						ondelete={() => onchange?.({ type: 'delete', path: childNode.path })}
						treeApi={activeTreeApi}
						treeCollection={activeTreeCollection}
						treeNode={childNode}
					/>
				{/each}

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
						<span class="text-zinc-500">:</span>
						<span class="text-zinc-500 text-xs italic">""</span>
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}
