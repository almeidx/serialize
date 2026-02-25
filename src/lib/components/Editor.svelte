<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import type * as Monaco from 'monaco-editor';

	interface Props {
		value: string;
		language?: string;
		readonly?: boolean;
		onchange?: (value: string) => void;
		theme?: 'light' | 'dark';
	}

	let {
		value,
		language = 'json',
		readonly = false,
		onchange,
		theme = 'dark',
	}: Props = $props();

	type WorkerFactory = new () => Worker;
	type MonacoRuntime = {
		monaco: typeof Monaco;
		EditorWorker: WorkerFactory;
		JsonWorker: WorkerFactory;
	};

	let monacoRuntimePromise: Promise<MonacoRuntime> | null = null;

	function loadMonacoRuntime(): Promise<MonacoRuntime> {
		if (monacoRuntimePromise) return monacoRuntimePromise;

		monacoRuntimePromise = Promise.all([
			import('monaco-editor/esm/vs/editor/editor.worker?worker'),
			import('monaco-editor/esm/vs/language/json/json.worker?worker'),
			import('monaco-editor/esm/vs/language/json/monaco.contribution'),
			import('monaco-editor/esm/vs/editor/editor.api'),
		]).then(
			([editorWorkerModule, jsonWorkerModule, _jsonContribution, monacoModule]) => ({
			monaco: monacoModule,
			EditorWorker: editorWorkerModule.default as WorkerFactory,
			JsonWorker: jsonWorkerModule.default as WorkerFactory,
			}),
		);

		return monacoRuntimePromise;
	}

	type MonacoEnvironmentHost = typeof globalThis & {
		MonacoEnvironment?: {
			getWorker: (_workerId: string, label: string) => Worker;
		};
	};

	let container: HTMLDivElement;
	let editor = $state<Monaco.editor.IStandaloneCodeEditor | null>(null);
	let monaco = $state<typeof Monaco | null>(null);

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let suppressNextChange = false;

	onMount(async () => {
		const runtime = await loadMonacoRuntime();
		const m = runtime.monaco;

		const monacoHost = globalThis as MonacoEnvironmentHost;
		monacoHost.MonacoEnvironment = {
			getWorker: (_workerId, label) => {
				if (label === 'json') {
					return new runtime.JsonWorker();
				}
				return new runtime.EditorWorker();
			},
		};

		monaco = m;

		const ed = m.editor.create(container, {
			value,
			language,
			theme: theme === 'dark' ? 'vs-dark' : 'vs',
			readOnly: readonly,
			minimap: { enabled: false },
			fontSize: 13,
			lineNumbers: 'on',
			scrollBeyondLastLine: false,
			automaticLayout: true,
			tabSize: 2,
			wordWrap: 'on',
			padding: { top: 8, bottom: 8 },
		});
		editor = ed;

		ed.onDidChangeModelContent(() => {
			if (suppressNextChange) {
				suppressNextChange = false;
				return;
			}

			if (onchange) {
				if (debounceTimer) clearTimeout(debounceTimer);
				debounceTimer = setTimeout(() => {
					onchange(ed.getValue());
				}, 300);
			}
		});

		ed.onDidBlurEditorWidget(() => {
			if (onchange) {
				if (debounceTimer) clearTimeout(debounceTimer);
				onchange(ed.getValue());
			}
		});
	});

	onDestroy(() => {
		if (debounceTimer) clearTimeout(debounceTimer);
		if (editor) editor.dispose();
	});

	$effect(() => {
		const newValue = value;
		const ed = editor;
		if (ed && monaco && newValue !== ed.getValue()) {
			suppressNextChange = true;
			ed.setValue(newValue);
		}
	});

	$effect(() => {
		if (editor && monaco) {
			monaco.editor.setTheme(theme === 'dark' ? 'vs-dark' : 'vs');
		}
	});

	$effect(() => {
		const lang = language;
		if (editor && monaco) {
			const model = editor.getModel();
			if (model) {
				monaco.editor.setModelLanguage(model, lang);
			}
		}
	});
</script>

<div bind:this={container} class="w-full h-full min-h-50"></div>
