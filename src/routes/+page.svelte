<script lang="ts">
	import { browser } from '$app/environment';
	import { parse, serialize as phpSerialize } from '$lib/parser';
	import { toJson, fromJson, type JsonValue } from '$lib/converter';
	import { computeStats, type Stats } from '$lib/stats';
	import EditableTreeView, { type TreeOperation } from '$lib/components/EditableTreeView.svelte';
	import { addAtPath, deleteAtPath, setValueAtPath } from '$lib/tree/operations';
	import Editor from '$lib/components/Editor.svelte';
	import StatsPanel from '$lib/components/StatsPanel.svelte';
	import ErrorBanner from '$lib/components/ErrorBanner.svelte';
	import CopyMenu from '$lib/components/CopyMenu.svelte';

	type InputMode = 'php' | 'json';
	type OutputView = 'tree' | 'json';

	let inputMode = $state<InputMode>('php');
	let outputView = $state<OutputView>('tree');
	let inputValue = $state('');
	let parsedData = $state<JsonValue | undefined>(undefined);
	let parseError = $state<Error | null>(null);
	let stats = $state<Stats | null>(null);
	let statsCollapsed = $state(false);

	const defaultTreeData: JsonValue = {};
	const treeData = $derived(parsedData !== undefined ? parsedData : defaultTreeData);

	let theme = $state<'light' | 'dark'>(getInitialTheme());
	let splitPosition = $state(50);
	let isDragging = $state(false);

	function getInitialTheme(): 'light' | 'dark' {
		if (!browser) return 'dark';
		const stored = localStorage.getItem('theme');
		if (stored === 'light' || stored === 'dark') return stored;
		return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
	}

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

	function detectFormat(value: string): InputMode | null {
		const trimmed = value.trim();
		if (!trimmed) return null;

		const phpPatterns = /^(N;|b:[01];|i:-?\d+;|d:[^;]+;|s:\d+:|a:\d+:\{|O:\d+:|C:\d+:|R:\d+;|r:\d+;)/;
		if (phpPatterns.test(trimmed)) return 'php';

		if (/^[\[\{"]/.test(trimmed) || /^(true|false|null|-?\d)/.test(trimmed)) {
			try {
				JSON.parse(trimmed);
				return 'json';
			} catch {
				return null;
			}
		}

		return null;
	}

	$effect(() => {
		const currentTheme = theme;
		if (browser) {
			document.documentElement.classList.toggle('dark', currentTheme === 'dark');
			localStorage.setItem('theme', currentTheme);
		}
	});

	function processInput() {
		if (!inputValue.trim()) {
			parsedData = undefined;
			parseError = null;
			stats = null;
			return;
		}

		try {
			if (inputMode === 'php') {
				const trimmed = inputValue.trim();
				const phpValue = parse(trimmed);
				parsedData = toJson(phpValue);
				stats = computeStats(phpValue, trimmed);
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
			parsedData = undefined;
			stats = null;
		}
	}

	let inputChangeTimeout: ReturnType<typeof setTimeout> | null = null;

	function handleInputChange(value: string) {
		if (inputChangeTimeout) clearTimeout(inputChangeTimeout);
		inputChangeTimeout = setTimeout(() => {
			const wasEmpty = !inputValue.trim();
			inputValue = value;

			if (wasEmpty && value.trim()) {
				const detected = detectFormat(value);
				if (detected && detected !== inputMode) {
					inputMode = detected;
				}
			}

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

	function handleTreeChange(op: TreeOperation) {
		const currentData = parsedData !== undefined ? parsedData : {};

		let updated: JsonValue;
		switch (op.type) {
			case 'set':
				updated = setValueAtPath(currentData, op.path, op.value);
				break;
			case 'delete':
				updated = deleteAtPath(currentData, op.path);
				break;
			case 'add':
				updated = addAtPath(currentData, op.path, op.key, op.value);
				break;
		}
		parsedData = updated;
		updateInputFromParsed();
	}

	function updateInputFromParsed() {
		if (parsedData === undefined) return;

		if (inputChangeTimeout) clearTimeout(inputChangeTimeout);

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
		if (inputChangeTimeout) clearTimeout(inputChangeTimeout);
		inputValue = inputMode === 'php' ? phpExample : jsonExample;
		processInput();
	}

	function clearInput() {
		if (inputChangeTimeout) clearTimeout(inputChangeTimeout);
		inputValue = '';
		parsedData = undefined;
		parseError = null;
		stats = null;
	}

	const jsonPretty = $derived(JSON.stringify(treeData, null, 2));
	const jsonMinified = $derived(JSON.stringify(treeData));
	const phpSerialized = $derived.by(() => {
		try {
			return phpSerialize(fromJson(treeData));
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
		class="border-b border-zinc-200 dark:border-zinc-700 px-3 py-2 flex flex-wrap items-center gap-2 md:gap-4 shrink-0"
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
			class="px-2 py-1 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
		>
			Example
		</button>

		<button
			onclick={clearInput}
			class="px-2 py-1 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
		>
			Clear
		</button>

		<div class="flex-1 min-w-0"></div>

		<div class="flex items-center gap-1">
			<a
				href="https://github.com/almeidx/serialize"
				target="_blank"
				rel="noopener noreferrer"
				class="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-600 dark:text-zinc-400"
				title="View on GitHub"
			>
				<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
					<path
						d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
					/>
				</svg>
			</a>

			<a
				href="https://almeidx.dev"
				target="_blank"
				rel="noopener noreferrer"
				class="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-600 dark:text-zinc-400 hidden sm:block"
				title="almeidx.dev"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
					/>
				</svg>
			</a>

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
		</div>
	</header>

	{#if parseError}
		<div class="px-4 py-2 shrink-0">
			<ErrorBanner error={parseError} ondismiss={() => (parseError = null)} />
		</div>
	{/if}

	<main class="flex-1 flex overflow-hidden">
		<div id="split-container" class="flex-1 flex flex-col md:flex-row overflow-hidden relative">
			<!-- Top/Left: Input Editor -->
			<div
				class="h-1/2 w-full md:h-auto md:w-[var(--split-position)] flex flex-col overflow-hidden border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-700"
				style:--split-position="{splitPosition}%"
			>
				<div
					class="h-8 px-3 flex items-center text-xs font-medium text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
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

			<!-- Drag Handle (desktop only) -->
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div
				class="hidden md:block w-1 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-500 transition-colors absolute top-0 bottom-0 z-10"
				style="left: {splitPosition}%"
				onmousedown={handleDragStart}
				role="separator"
				aria-orientation="vertical"
			></div>

			<!-- Bottom/Right: Output (Tree or JSON) -->
			<div class="flex-1 flex flex-col overflow-hidden min-h-0">
				<div
					class="h-8 px-3 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
				>
					<span class="text-xs font-medium text-zinc-500 dark:text-zinc-400">Output</span>
					<div class="flex items-center gap-2">
						<CopyMenu
							{jsonPretty}
							{jsonMinified}
							{phpSerialized}
							disabled={parsedData === undefined &&
								typeof treeData === 'object' &&
								treeData !== null &&
								Object.keys(treeData).length === 0}
						/>
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
				</div>

				<div class="flex-1 overflow-hidden">
					{#if parsedData === undefined}
						<div class="h-full flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400 p-8">
							<svg class="w-12 h-12 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
							</svg>
							<p class="text-sm text-center max-w-xs">
								Paste PHP serialized data or JSON in the input panel to get started
							</p>
							<button
								onclick={loadExample}
								class="mt-4 text-sm text-blue-600 dark:text-blue-400 hover:underline"
							>
								or load an example
							</button>
						</div>
					{:else if outputView === 'tree'}
						<div class="h-full overflow-auto p-4">
							<EditableTreeView data={treeData} onchange={handleTreeChange} />
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
