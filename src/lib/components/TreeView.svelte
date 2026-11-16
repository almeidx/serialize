<script lang="ts">
	import type { JsonValue } from '#lib/converter/types.js';
	import {
		buildTree,
		convert,
		defaultExpanded,
		EDITABLE_KINDS,
		isEditableKind,
		parseEdit,
		type EditableKind,
		type Kind,
		type TreeNode,
	} from '#lib/tree/nodes.js';
	import type { TreeOperation } from '#lib/tree/operations.js';
	import { mergeProps, normalizeProps, useMachine } from '@zag-js/svelte';
	import * as tree from '@zag-js/tree-view';
	import { tick } from 'svelte';

	let { data, onedit }: { data: JsonValue; onedit: (op: TreeOperation) => void } = $props();

	const INDENT_PX = 16;
	const VALUE_CLASS: Record<Kind, string> = {
		string: 'text-string',
		number: 'text-number',
		boolean: 'text-keyword',
		null: 'text-keyword italic',
		array: 'text-muted',
		object: 'text-muted',
		binary: 'text-type italic',
		reference: 'text-type italic',
		custom_object: 'text-type italic',
		enum: 'text-type italic',
	};

	const id = $props.id();
	const root = $derived(buildTree(data));
	const collection = $derived(
		tree.collection<TreeNode>({
			rootNode: root,
			nodeToValue: (node) => node.id,
			nodeToString: keyLabel,
			nodeToChildren: (node) => node.children,
		}),
	);

	const service = useMachine(tree.machine, () => ({
		id,
		collection,
		selectionMode: 'single' as const,
		expandOnClick: true,
		// svelte-ignore state_referenced_locally
		defaultExpandedValue: defaultExpanded(root),
	}));
	const api = $derived(tree.connect(service, normalizeProps));

	let editing = $state<{ node: TreeNode; text: string } | null>(null);
	let adding = $state<{ node: TreeNode; key: string } | null>(null);

	function keyLabel(node: TreeNode): string {
		return node.key === null ? 'root' : String(node.key);
	}

	async function refocus(node: TreeNode) {
		await tick();
		api.focus(node.id);
	}

	function startEdit(node: TreeNode) {
		if (node.editText !== undefined && editing?.node.id !== node.id) editing = { node, text: node.editText };
	}

	function commitEdit() {
		if (!editing) return;
		const { node, text } = editing;
		editing = null;
		const value = parseEdit(node, text);
		if (value !== undefined) onedit({ type: 'set', path: node.path, value });
		void refocus(node);
	}

	function cancelEdit() {
		if (!editing) return;
		const { node } = editing;
		editing = null;
		void refocus(node);
	}

	function startAdd(node: TreeNode) {
		if (node.children.length > 0) api.expand([node.id]);
		adding = { node, key: node.addKey ?? '' };
	}

	function commitAdd() {
		if (!adding) return;
		const { node, key } = adding;
		adding = null;
		if (key.trim()) onedit({ type: 'add', path: node.path, key: key.trim(), value: '' });
	}

	function onEditorKeydown(event: KeyboardEvent, commit: () => void, cancel: () => void) {
		if (event.key === 'Enter') {
			event.preventDefault();
			commit();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			cancel();
		}
	}
</script>

{#snippet branch(node: TreeNode, indexPath: number[])}
	{@const props = { node, indexPath }}
	{@const state = api.getNodeState(props)}
	{#if state.isBranch}
		<div {...api.getBranchProps(props)}>
			{@render row(node, props, state)}
			{@render addRow(node, indexPath.length)}
			<div {...api.getBranchContentProps(props)}>
				{#if state.expanded}
					{#each node.children as child, index (child.id)}
						{@render branch(child, [...indexPath, index])}
					{/each}
				{/if}
			</div>
		</div>
	{:else}
		{@render row(node, props, state)}
		{@render addRow(node, indexPath.length)}
	{/if}
{/snippet}

{#snippet row(node: TreeNode, props: tree.NodeProps, state: tree.NodeState)}
	<div class="group flex items-center gap-1 rounded-md pr-1 hover:bg-raised" style:padding-left="{(props.indexPath.length - 1) * INDENT_PX}px">
		<div
			class="flex min-w-0 flex-1 items-center gap-1 rounded-md py-0.5"
			{...state.isBranch
				? api.getBranchControlProps(props)
				: mergeProps(api.getItemProps(props), {
						onclick: () => startEdit(node),
						onkeydown: (event: KeyboardEvent) => {
							if (event.key !== 'Enter' || event.target !== event.currentTarget || node.editText === undefined) return;
							event.preventDefault();
							startEdit(node);
						},
					})}
		>
			{#if state.isBranch}
				<svg class="size-4 shrink-0 text-faint transition-transform" class:rotate-90={state.expanded} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
					<path d="M7.2 14.8a.75.75 0 0 1 0-1.1L11.2 10 7.2 6.3a.75.75 0 1 1 1-1.1l4.5 4.3a.75.75 0 0 1 0 1l-4.5 4.3a.75.75 0 0 1-1 0z" />
				</svg>
			{:else}
				<span class="w-4 shrink-0"></span>
			{/if}
			{#if node.key !== null}
				<span class="shrink-0 text-key">{node.key}</span>
				<span class="text-faint">:</span>
			{/if}
			{#if editing?.node.id === node.id}
				<!-- svelte-ignore a11y_autofocus -->
				<input
					class="min-w-24 flex-1 rounded border border-accent bg-bg px-1 font-mono text-sm outline-none"
					aria-label="Value of {keyLabel(node)}"
					autofocus
					bind:value={editing.text}
					onblur={commitEdit}
					onkeydown={(event) => onEditorKeydown(event, commitEdit, cancelEdit)}
				/>
			{:else}
				<span class="min-w-0 break-all {VALUE_CLASS[node.kind]}" class:cursor-text={node.editText !== undefined}>
					{node.summary}
				</span>
			{/if}
		</div>

		<span class="flex shrink-0 items-center gap-0.5 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
			<select
				class="h-5 rounded border border-border bg-bg px-0.5 font-sans text-xs text-muted"
				aria-label="Type of {keyLabel(node)}"
				value={node.kind}
				onchange={(event) => onedit({ type: 'set', path: node.path, value: convert(node, event.currentTarget.value as EditableKind) })}
			>
				{#if !isEditableKind(node.kind)}
					<option value={node.kind} disabled>{node.kind}</option>
				{/if}
				{#each EDITABLE_KINDS as kind (kind)}
					<option value={kind}>{kind}</option>
				{/each}
			</select>
			{#if node.addKey !== undefined}
				<button type="button" class="grid size-5 place-items-center rounded text-muted hover:bg-bg hover:text-success" aria-label="Add item to {keyLabel(node)}" title="Add item" onclick={() => startAdd(node)}>
					<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
				</button>
			{/if}
			{#if node.path.length > 0}
				<button type="button" class="grid size-5 place-items-center rounded text-muted hover:bg-bg hover:text-error" aria-label="Delete {keyLabel(node)}" title="Delete" onclick={() => onedit({ type: 'delete', path: node.path })}>
					<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
				</button>
			{/if}
		</span>
	</div>
{/snippet}

{#snippet addRow(node: TreeNode, depth: number)}
	{#if adding?.node.id === node.id}
		<div class="flex items-center gap-1 py-0.5" style:padding-left="{depth * INDENT_PX + INDENT_PX + 4}px">
			<!-- svelte-ignore a11y_autofocus -->
			<input
				class="w-28 rounded border border-accent bg-bg px-1 font-mono text-sm outline-none"
				aria-label="New {node.kind === 'array' ? 'index' : 'key'} in {keyLabel(node)}"
				placeholder={node.kind === 'array' ? 'index' : 'key'}
				autofocus
				bind:value={adding.key}
				onblur={() => (adding = null)}
				onkeydown={(event) => onEditorKeydown(event, commitAdd, () => (adding = null))}
			/>
			<span class="text-faint">:</span>
			<span class="text-string">""</span>
		</div>
	{/if}
{/snippet}

<div class="font-mono text-sm" {...api.getRootProps()}>
	<span class="sr-only" {...api.getLabelProps()}>Parsed data</span>
	<div {...api.getTreeProps()}>
		{#each root.children as node, index (node.id)}
			{@render branch(node, [index])}
		{/each}
	</div>
</div>
