<script lang="ts">
	import { browser } from '$app/environment';
	import { parse, serialize as phpSerialize, ParseError } from '$lib/parser';
	import { toJson, fromJson, type JsonValue } from '$lib/converter';
	import { computeStats, type Stats } from '$lib/stats';
	import TreeView from '$lib/components/TreeView.svelte';
	import Editor from '$lib/components/Editor.svelte';
	import StatsPanel from '$lib/components/StatsPanel.svelte';
	import ErrorBanner from '$lib/components/ErrorBanner.svelte';
	import CopyMenu from '$lib/components/CopyMenu.svelte';

	type InputMode = 'php' | 'json';

	let inputMode = $state<InputMode>('php');
	let inputValue = $state('');
	let parsedData = $state<JsonValue | null>(null);
	let parseError = $state<Error | null>(null);
	let stats = $state<Stats | null>(null);
	let statsCollapsed = $state(false);

	let theme = $state<'light' | 'dark'>('dark');
	let splitPosition = $state(50);
	let isDragging = $state(false);

	const exampleData = `a:4:{s:4:"user";O:4:"User":2:{s:4:"name";s:5:"Alice";s:5:"email";s:17:"alice@example.com";}s:5:"roles";a:2:{i:0;s:5:"admin";i:1;s:4:"user";}s:9:"loginTime";i:1704067200;s:8:"isActive";b:1;}`;

	if (browser) {
		const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
		theme = prefersDark ? 'dark' : 'light';

		window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
			theme = e.matches ? 'dark' : 'light';
		});
	}

	$effect(() => {
		if (browser) {
			document.documentElement.classList.toggle('dark', theme === 'dark');
		}
	});

	function processInput() {
		if (!inputValue.trim()) {
			parsedData = null;
			parseError = null;
			stats = null;
			return;
		}

		try {
			if (inputMode === 'php') {
				const phpValue = parse(inputValue);
				parsedData = toJson(phpValue);
				stats = computeStats(phpValue, inputValue);
			} else {
				const json = JSON.parse(inputValue);
				parsedData = json;
				const phpValue = fromJson(json);
				const serialized = phpSerialize(phpValue);
				stats = computeStats(phpValue, serialized);
			}
			parseError = null;
		} catch (e) {
			parseError = e as Error;
			parsedData = null;
			stats = null;
		}
	}

	$effect(() => {
		inputValue;
		inputMode;
		processInput();
	});

	function handleEditorChange(value: string) {
		if (!parsedData) return;

		try {
			const edited = JSON.parse(value);
			parsedData = edited;
			parseError = null;
		} catch {
			// Ignore JSON parse errors while editing
		}
	}

	function loadExample() {
		inputMode = 'php';
		inputValue = exampleData;
	}

	function clearInput() {
		inputValue = '';
		parsedData = null;
		parseError = null;
		stats = null;
	}

	const jsonPretty = $derived(parsedData ? JSON.stringify(parsedData, null, 2) : '');
	const jsonMinified = $derived(parsedData ? JSON.stringify(parsedData) : '');
	const phpSerialized = $derived(() => {
		if (!parsedData) return '';
		try {
			return phpSerialize(fromJson(parsedData));
		} catch {
			return '';
		}
	});

	function handleDragStart(e: MouseEvent) {
		isDragging = true;
		e.preventDefault();
	}

	function handleDrag(e: MouseEvent) {
		if (!isDragging) return;
		const container = document.getElementById('split-container');
		if (!container) return;
		const rect = container.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const percentage = (x / rect.width) * 100;
		splitPosition = Math.max(20, Math.min(80, percentage));
	}

	function handleDragEnd() {
		isDragging = false;
	}
</script>

<svelte:window onmousemove={handleDrag} onmouseup={handleDragEnd} />

<div class="min-h-screen flex flex-col bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
	<header class="border-b border-zinc-200 dark:border-zinc-700 px-4 py-3 flex items-center gap-4">
		<h1 class="text-lg font-semibold">Serialize</h1>

		<div class="flex-1"></div>

		<button
			onclick={() => (theme = theme === 'dark' ? 'light' : 'dark')}
			class="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
			title="Toggle theme"
		>
			{#if theme === 'dark'}
				<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
					<path
						fill-rule="evenodd"
						d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
						clip-rule="evenodd"
					/>
				</svg>
			{:else}
				<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
					<path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
				</svg>
			{/if}
		</button>
	</header>

	<main class="flex-1 flex flex-col overflow-hidden">
		<div class="p-4 border-b border-zinc-200 dark:border-zinc-700 space-y-3">
			<div class="flex items-center gap-3">
				<div class="flex rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
					<button
						onclick={() => (inputMode = 'php')}
						class="px-3 py-1.5 text-sm font-medium transition-colors {inputMode === 'php'
							? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
							: 'bg-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}"
					>
						PHP Serialized
					</button>
					<button
						onclick={() => (inputMode = 'json')}
						class="px-3 py-1.5 text-sm font-medium transition-colors {inputMode === 'json'
							? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
							: 'bg-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}"
					>
						JSON
					</button>
				</div>

				<button
					onclick={loadExample}
					class="px-3 py-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
				>
					Load Example
				</button>

				<button
					onclick={clearInput}
					class="px-3 py-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
				>
					Clear
				</button>

				<div class="flex-1"></div>

				<CopyMenu
					{jsonPretty}
					{jsonMinified}
					phpSerialized={phpSerialized()}
					disabled={!parsedData}
				/>
			</div>

			<textarea
				bind:value={inputValue}
				placeholder={inputMode === 'php'
					? 'Paste PHP serialized data here...'
					: 'Paste JSON here...'}
				class="w-full h-24 px-3 py-2 text-sm font-mono bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
			></textarea>

			<ErrorBanner error={parseError} ondismiss={() => (parseError = null)} />
		</div>

		{#if parsedData}
			<div class="flex-1 flex overflow-hidden">
				<div
					id="split-container"
					class="flex-1 flex flex-col md:flex-row overflow-hidden relative"
				>
					<div
						class="overflow-auto p-4 md:border-r border-zinc-200 dark:border-zinc-700"
						style="flex: 0 0 {splitPosition}%"
					>
						<TreeView data={parsedData} />
					</div>

					<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
					<div
						class="hidden md:block w-1 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-500 transition-colors absolute top-0 bottom-0 z-10"
						style="left: {splitPosition}%"
						onmousedown={handleDragStart}
						role="separator"
						aria-orientation="vertical"
					></div>

					<div class="flex-1 overflow-hidden min-h-[300px]">
						<Editor value={jsonPretty} {theme} onchange={handleEditorChange} />
					</div>
				</div>

				<StatsPanel
					{stats}
					collapsed={statsCollapsed}
					oncollapse={() => (statsCollapsed = !statsCollapsed)}
				/>
			</div>
		{:else if !parseError}
			<div class="flex-1 flex items-center justify-center text-zinc-400 dark:text-zinc-500">
				<p>Enter PHP serialized data or JSON above to get started</p>
			</div>
		{/if}
	</main>
</div>
