<script lang="ts">
	import { browser } from '$app/environment';
	import { parse, serialize as phpSerialize } from '$lib/parser';
	import { toJson, fromJson, type JsonValue } from '$lib/converter';
	import { computeStats, type Stats } from '$lib/stats';
	import EditableTreeView from '$lib/components/EditableTreeView.svelte';
	import Editor from '$lib/components/Editor.svelte';
	import StatsPanel from '$lib/components/StatsPanel.svelte';
	import ErrorBanner from '$lib/components/ErrorBanner.svelte';
	import CopyMenu from '$lib/components/CopyMenu.svelte';

	type InputMode = 'php' | 'json';
	type OutputView = 'tree' | 'json';

	let inputMode = $state<InputMode>('php');
	let outputView = $state<OutputView>('tree');
	let inputValue = $state('');
	let parsedData = $state<JsonValue | null>(null);
	let parseError = $state<Error | null>(null);
	let stats = $state<Stats | null>(null);
	let statsCollapsed = $state(false);

	let theme = $state<'light' | 'dark'>('dark');
	let splitPosition = $state(50);
	let isDragging = $state(false);

	const phpExample = `a:4:{s:4:"user";O:4:"User":2:{s:4:"name";s:5:"Alice";s:5:"email";s:17:"alice@example.com";}s:5:"roles";a:2:{i:0;s:5:"admin";i:1;s:4:"user";}s:9:"loginTime";i:1704067200;s:8:"isActive";b:1;}`;

	const jsonExample = JSON.stringify(
		{
			user: {
				name: 'Alice',
				email: 'alice@example.com'
			},
			roles: ['admin', 'user'],
			loginTime: 1704067200,
			isActive: true
		},
		null,
		2
	);

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

	let inputChangeTimeout: ReturnType<typeof setTimeout> | null = null;

	function handleInputChange(value: string) {
		if (inputChangeTimeout) clearTimeout(inputChangeTimeout);
		inputChangeTimeout = setTimeout(() => {
			inputValue = value;
			processInput();
		}, 300);
	}

	function handleOutputJsonChange(value: string) {
		try {
			const json = JSON.parse(value);
			parsedData = json;
			updateInputFromParsed();
		} catch {
			// Ignore parse errors while typing
		}
	}

	function handleTreeChange(path: string, newValue: JsonValue) {
		if (!parsedData) return;

		const updated = setValueAtPath(parsedData, path, newValue);
		parsedData = updated;
		updateInputFromParsed();
	}

	function setValueAtPath(obj: JsonValue, path: string, value: JsonValue): JsonValue {
		if (!path) return value;

		const parts = path.split('.');
		const clone = JSON.parse(JSON.stringify(obj));

		let current: Record<string, JsonValue> = clone;
		for (let i = 0; i < parts.length - 1; i++) {
			const key = parts[i];
			if (Array.isArray(current)) {
				current = current[parseInt(key)] as Record<string, JsonValue>;
			} else if (current.__php_type__ === 'object' || current.__php_type__ === 'array') {
				current = (current.data as Record<string, JsonValue>)[key] as Record<string, JsonValue>;
			} else {
				current = current[key] as Record<string, JsonValue>;
			}
		}

		const lastKey = parts[parts.length - 1];
		if (Array.isArray(current)) {
			current[parseInt(lastKey)] = value;
		} else if (current.__php_type__ === 'object' || current.__php_type__ === 'array') {
			(current.data as Record<string, JsonValue>)[lastKey] = value;
		} else {
			current[lastKey] = value;
		}

		return clone;
	}

	function updateInputFromParsed() {
		if (!parsedData) return;

		try {
			if (inputMode === 'php') {
				const phpValue = fromJson(parsedData);
				inputValue = phpSerialize(phpValue);
			} else {
				inputValue = JSON.stringify(parsedData, null, 2);
			}

			const phpValue = fromJson(parsedData);
			const serialized = phpSerialize(phpValue);
			stats = computeStats(phpValue, serialized);
			parseError = null;
		} catch (e) {
			parseError = e as Error;
		}
	}

	function loadExample() {
		inputValue = inputMode === 'php' ? phpExample : jsonExample;
		processInput();
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

<div class="h-screen flex flex-col bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
	<header
		class="border-b border-zinc-200 dark:border-zinc-700 px-4 py-2 flex items-center gap-4 shrink-0"
	>
		<h1 class="text-lg font-semibold">Serialize</h1>

		<div class="flex rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
			<button
				onclick={() => {
					inputMode = 'php';
					processInput();
				}}
				class="px-3 py-1 text-sm font-medium transition-colors {inputMode === 'php'
					? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
					: 'bg-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}"
			>
				PHP
			</button>
			<button
				onclick={() => {
					inputMode = 'json';
					processInput();
				}}
				class="px-3 py-1 text-sm font-medium transition-colors {inputMode === 'json'
					? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
					: 'bg-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}"
			>
				JSON
			</button>
		</div>

		<button
			onclick={loadExample}
			class="px-3 py-1 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
		>
			Example
		</button>

		<button
			onclick={clearInput}
			class="px-3 py-1 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
		>
			Clear
		</button>

		<div class="flex-1"></div>

		<CopyMenu {jsonPretty} {jsonMinified} phpSerialized={phpSerialized()} disabled={!parsedData} />

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

	{#if parseError}
		<div class="px-4 py-2 shrink-0">
			<ErrorBanner error={parseError} ondismiss={() => (parseError = null)} />
		</div>
	{/if}

	<main class="flex-1 flex overflow-hidden">
		<div id="split-container" class="flex-1 flex overflow-hidden relative">
			<!-- Left: Input Editor -->
			<div
				class="flex flex-col overflow-hidden border-r border-zinc-200 dark:border-zinc-700"
				style="width: {splitPosition}%"
			>
				<div
					class="px-3 py-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
				>
					Input ({inputMode === 'php' ? 'PHP Serialized' : 'JSON'})
				</div>
				<div class="flex-1 overflow-hidden">
					<Editor
						value={inputValue}
						language={inputMode === 'php' ? 'plaintext' : 'json'}
						{theme}
						onchange={handleInputChange}
					/>
				</div>
			</div>

			<!-- Drag Handle -->
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div
				class="w-1 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-500 transition-colors absolute top-0 bottom-0 z-10"
				style="left: {splitPosition}%"
				onmousedown={handleDragStart}
				role="separator"
				aria-orientation="vertical"
			></div>

			<!-- Right: Output (Tree or JSON) -->
			<div class="flex-1 flex flex-col overflow-hidden">
				<div
					class="px-3 py-1.5 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
				>
					<span class="text-xs font-medium text-zinc-500 dark:text-zinc-400">Output</span>
					<div class="flex rounded border border-zinc-200 dark:border-zinc-700 overflow-hidden">
						<button
							onclick={() => (outputView = 'tree')}
							class="px-2 py-0.5 text-xs font-medium transition-colors {outputView === 'tree'
								? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100'
								: 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}"
						>
							Tree
						</button>
						<button
							onclick={() => (outputView = 'json')}
							class="px-2 py-0.5 text-xs font-medium transition-colors {outputView === 'json'
								? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100'
								: 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}"
						>
							JSON
						</button>
					</div>
				</div>

				<div class="flex-1 overflow-hidden">
					{#if !parsedData}
						<div
							class="h-full flex items-center justify-center text-zinc-400 dark:text-zinc-500 text-sm"
						>
							Enter data on the left to see output
						</div>
					{:else if outputView === 'tree'}
						<div class="h-full overflow-auto p-4">
							<EditableTreeView data={parsedData} onchange={handleTreeChange} />
						</div>
					{:else}
						<Editor value={jsonPretty} language="json" {theme} onchange={handleOutputJsonChange} />
					{/if}
				</div>
			</div>
		</div>

		<StatsPanel
			{stats}
			collapsed={statsCollapsed}
			oncollapse={() => (statsCollapsed = !statsCollapsed)}
		/>
	</main>
</div>
