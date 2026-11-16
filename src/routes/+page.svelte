<script lang="ts">
	import CopyMenu from '#lib/components/CopyMenu.svelte';
	import Editor from '#lib/components/Editor.svelte';
	import Segmented from '#lib/components/Segmented.svelte';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import StatsPanel from '#lib/components/StatsPanel.svelte';
	import TreeView from '#lib/components/TreeView.svelte';
	import { formatBytes } from '#lib/format.js';
	import { Session } from '#lib/processor/session.svelte.js';
	import { settings } from '#lib/settings.svelte.js';

	const SPLIT_MIN = 20;
	const SPLIT_MAX = 80;
	const SPLIT_KEY_STEP = 2;

	const session = new Session();
	let split = $state(50);
	let panes: HTMLDivElement;

	const outputJson = $derived(settings.view === 'json' && session.data !== undefined ? JSON.stringify(session.data, null, 2) : '');

	function resize(percent: number) {
		split = Math.round(Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, percent)));
	}

	function resizeFromPointer(event: PointerEvent) {
		const rect = panes.getBoundingClientRect();
		resize(((event.clientX - rect.left) / rect.width) * 100);
	}

	function resizeFromKey(event: KeyboardEvent) {
		const next = { ArrowLeft: split - SPLIT_KEY_STEP, ArrowRight: split + SPLIT_KEY_STEP, Home: SPLIT_MIN, End: SPLIT_MAX }[event.key];
		if (next === undefined) return;
		event.preventDefault();
		resize(next);
	}
</script>

<svelte:head>
	<title>serialize · Edit PHP serialized data</title>
	<meta name="description" content="Parse, edit and convert PHP serialized data and JSON. Everything runs in your browser." />
</svelte:head>

<div class="flex h-dvh flex-col">
	<h1 class="sr-only">PHP serialized data editor</h1>
	<SiteHeader>
		<Segmented
			label="Input format"
			options={[
				['php', 'PHP'],
				['json', 'JSON'],
			]}
			value={session.mode}
			onchange={(mode) => session.setMode(mode)}
		/>
		<button type="button" class="rounded-md px-2.5 py-1 text-xs font-medium text-muted hover:bg-raised hover:text-fg" onclick={() => session.loadExample()}>
			Example
		</button>
		<button type="button" class="rounded-md px-2.5 py-1 text-xs font-medium text-muted hover:bg-raised hover:text-fg" onclick={() => session.clear()}>
			Clear
		</button>

		{#snippet actions()}
			<button
				type="button"
				aria-pressed={settings.stats}
				class="rounded-md px-2.5 py-1 text-xs font-medium text-muted hover:bg-raised hover:text-fg aria-pressed:bg-raised aria-pressed:text-fg max-md:hidden"
				title="Show statistics"
				onclick={() => (settings.stats = !settings.stats)}
			>
				Stats
			</button>
		{/snippet}
	</SiteHeader>

	{#if session.error}
		<p class="shrink-0 border-b border-error/30 bg-error/10 px-4 py-2 font-mono text-xs break-all text-error" role="alert">{session.error}</p>
	{/if}

	<div bind:this={panes} class="flex min-h-0 flex-1 max-md:flex-col">
		<section class="flex min-h-0 min-w-0 flex-col max-md:h-1/2 max-md:border-b max-md:border-border md:w-(--split)" style:--split="{split}%" aria-label="Input">
			<div class="flex h-9 shrink-0 items-center border-b border-border bg-surface px-3">
				<h2 class="text-xs font-medium text-muted">{session.mode === 'php' ? 'PHP serialized' : 'JSON'}</h2>
			</div>
			<div class="min-h-0 flex-1">
				<Editor value={session.input} language={session.mode === 'json' ? 'json' : 'plaintext'} label="Input" onchange={(text) => session.setInput(text)} />
			</div>
		</section>

		<div class="relative w-px shrink-0 bg-border max-md:hidden">
			<!-- A focusable separator is a widget (WAI-ARIA window splitter); Svelte treats every separator as static. -->
			<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
			<div
				role="separator"
				tabindex="0"
				aria-label="Resize panels"
				aria-orientation="vertical"
				aria-valuemin={SPLIT_MIN}
				aria-valuemax={SPLIT_MAX}
				aria-valuenow={split}
				class="absolute inset-y-0 -left-1 z-10 w-2 cursor-col-resize transition-colors outline-none hover:bg-accent/40 focus-visible:bg-accent active:bg-accent"
				onpointerdown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
				onpointermove={(event) => event.currentTarget.hasPointerCapture(event.pointerId) && resizeFromPointer(event)}
				onkeydown={resizeFromKey}
			></div>
		</div>

		<section class="flex min-h-0 min-w-0 flex-1 flex-col" aria-label="Output">
			<div class="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-surface px-3">
				<h2 class="text-xs font-medium text-muted">Output</h2>
				{#if session.stats}
					<p class="truncate font-mono text-xs text-muted tabular-nums" aria-live="polite">
						{formatBytes(session.stats.byteSize)} · {session.stats.nodeCount.toLocaleString()} nodes · depth {session.stats.maxDepth}
					</p>
				{/if}
				<div class="ml-auto flex items-center gap-1.5">
					<CopyMenu data={session.data} serialized={session.serialized} />
					<Segmented
						label="Output view"
						options={[
							['tree', 'Tree'],
							['json', 'JSON'],
						]}
						value={settings.view}
						onchange={(view) => (settings.view = view)}
					/>
				</div>
			</div>

			<div class="min-h-0 flex-1">
				{#if session.data === undefined}
					<div class="grid h-full place-items-center p-6 text-center">
						<div>
							<p class="text-muted">Paste PHP serialized data or JSON to get started.</p>
							<button type="button" class="mt-4 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-raised" onclick={() => session.loadExample()}>
								Load an example
							</button>
						</div>
					</div>
				{:else if settings.view === 'tree'}
					<div class="h-full overflow-auto p-3">
						<TreeView data={session.data} onedit={(op) => session.edit(op)} />
					</div>
				{:else}
					<Editor value={outputJson} language="json" label="Output JSON" onchange={(text) => session.setJson(text)} />
				{/if}
			</div>
		</section>

		{#if settings.stats && session.stats}
			<StatsPanel stats={session.stats} />
		{/if}
	</div>
</div>
