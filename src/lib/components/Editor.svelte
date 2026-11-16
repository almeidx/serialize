<script lang="ts" module>
	import { settings } from '#lib/settings.svelte.js';
	import type * as Monaco from 'monaco-editor/editor';

	type WorkerFactory = new () => Worker;

	/** Monaco takes literal colors, so its one global theme is rebuilt from app.css whenever the app theme changes. */
	function applyTheme(monaco: typeof Monaco): void {
		const css = getComputedStyle(document.documentElement);
		// Monaco only accepts `#rrggbb`, while the CSS build may shorten hex colors; canvas serializes any opaque color that way.
		const canvas = document.createElement('canvas').getContext('2d')!;
		const color = (name: string) => {
			canvas.fillStyle = css.getPropertyValue(name).trim();
			return canvas.fillStyle;
		};
		monaco.editor.defineTheme('serialize', {
			base: settings.theme === 'light' ? 'vs' : 'vs-dark',
			inherit: true,
			rules: [],
			colors: {
				'editor.background': color('--bg'),
				'editorGutter.background': color('--bg'),
				'editor.lineHighlightBackground': color('--surface'),
				'editor.lineHighlightBorder': color('--surface'),
				'editorLineNumber.foreground': color('--faint'),
			},
		});
		monaco.editor.setTheme('serialize');
	}

	let runtime: Promise<typeof Monaco> | null = null;

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
				applyTheme(monaco);
				$effect.root(() => {
					$effect(() => applyTheme(monaco));
				});
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
					theme: 'serialize',
					fontFamily: getComputedStyle(container!).fontFamily,
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
		const model = editor?.getModel();
		if (model) monaco?.editor.setModelLanguage(model, language);
	});
</script>

{#if failed}
	<div class="grid size-full place-items-center p-6 text-sm text-muted" role="alert">The editor failed to load. Reload the page to try again.</div>
{:else}
	<div bind:this={container} class="size-full min-h-0 font-mono"></div>
{/if}
