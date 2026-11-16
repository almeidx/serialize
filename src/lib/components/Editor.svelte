<script lang="ts" module>
	import type * as Monaco from 'monaco-editor/editor';

	type WorkerFactory = new () => Worker;

	// Mirror --bg/--surface/--faint in app.css.
	const THEMES = {
		light: { base: 'vs', bg: '#ffffff', line: '#f5f5f5', gutter: '#a3a3a3' },
		dark: { base: 'vs-dark', bg: '#0a0a0a', line: '#141414', gutter: '#525252' },
	} as const;

	let runtime: Promise<typeof Monaco> | null = null;

	/** Loads Monaco once, bundled (no CDN), with its own workers and themes matching the app. */
	function loadMonaco(): Promise<typeof Monaco> {
		runtime ??= Promise.all([
			import('monaco-editor/features/register.all'),
			import('monaco-editor/editor/editor.worker?worker'),
			import('monaco-editor/languages/features/json/json.worker?worker'),
			import('monaco-editor/languages/features/json/register'),
			import('monaco-editor/editor'),
		]).then(
			([, editorWorker, jsonWorker, , monaco]) => {
				const EditorWorker = editorWorker.default as WorkerFactory;
				const JsonWorker = jsonWorker.default as WorkerFactory;
				(globalThis as { MonacoEnvironment?: Monaco.Environment }).MonacoEnvironment = {
					getWorker: (_id, label) => (label === 'json' ? new JsonWorker() : new EditorWorker()),
				};
				for (const [name, theme] of Object.entries(THEMES)) {
					monaco.editor.defineTheme(`serialize-${name}`, {
						base: theme.base,
						inherit: true,
						rules: [],
						colors: {
							'editor.background': theme.bg,
							'editorGutter.background': theme.bg,
							'editor.lineHighlightBackground': theme.line,
							'editor.lineHighlightBorder': theme.line,
							'editorLineNumber.foreground': theme.gutter,
						},
					});
				}
				return monaco;
			},
			(error: unknown) => {
				runtime = null;
				throw error;
			},
		);
		return runtime;
	}
</script>

<script lang="ts">
	import { settings } from '#lib/settings.svelte.js';
	import { onMount } from 'svelte';

	interface Props {
		value: string;
		language: 'json' | 'plaintext';
		/** Accessible name of the editing area. */
		label: string;
		/** Debounced while typing, flushed on blur. */
		onchange: (value: string) => void;
	}

	let { value, language, label, onchange }: Props = $props();

	const CHANGE_DEBOUNCE_MS = 300;

	let container = $state<HTMLDivElement>();
	let monaco = $state.raw<typeof Monaco | null>(null);
	let editor = $state.raw<Monaco.editor.IStandaloneCodeEditor | null>(null);
	let failed = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;
	/** Set while `value` is written into the model, so that write is not echoed back. */
	let applying = false;

	function flush() {
		if (timer === undefined || !editor) return;
		clearTimeout(timer);
		timer = undefined;
		onchange(editor.getValue());
	}

	onMount(() => {
		let destroyed = false;
		loadMonaco().then(
			(loaded) => {
				if (destroyed) return;
				const created = loaded.editor.create(container!, {
					value,
					language,
					ariaLabel: label,
					theme: `serialize-${settings.theme}`,
					fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
					fontSize: 13,
					minimap: { enabled: false },
					scrollBeyondLastLine: false,
					overviewRulerBorder: false,
					hideCursorInOverviewRuler: true,
					automaticLayout: true,
					tabSize: 2,
					wordWrap: 'on',
					padding: { top: 8, bottom: 8 },
				});
				// Disposed together with the editor.
				created.onDidChangeModelContent(() => {
					if (applying) return;
					clearTimeout(timer);
					timer = setTimeout(flush, CHANGE_DEBOUNCE_MS);
				});
				created.onDidBlurEditorText(flush);
				monaco = loaded;
				editor = created;
			},
			() => (failed = true),
		);
		return () => {
			destroyed = true;
			flush();
			editor?.dispose();
		};
	});

	// External updates; a pending local edit wins and is flushed first.
	$effect(() => {
		const next = value;
		const model = editor?.getModel();
		if (!editor || !model || timer !== undefined || model.getValue() === next) return;
		applying = true;
		try {
			editor.executeEdits('external', [{ range: model.getFullModelRange(), text: next }]);
		} finally {
			applying = false;
		}
	});

	$effect(() => {
		monaco?.editor.setTheme(`serialize-${settings.theme}`);
	});

	$effect(() => {
		const model = editor?.getModel();
		if (model) monaco?.editor.setModelLanguage(model, language);
	});
</script>

{#if failed}
	<div class="grid size-full place-items-center p-6 text-sm text-muted" role="alert">The editor failed to load. Reload the page to try again.</div>
{:else}
	<div bind:this={container} class="size-full min-h-0"></div>
{/if}
