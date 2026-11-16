# Agent guidance

Serialize is a SvelteKit application for parsing, editing and converting PHP
serialized values. It is fully static and client-only: prerendered with
`@sveltejs/adapter-static` and hosted as static assets on Cloudflare Workers (no
Worker script, no server code).

Use `README.md` for product behavior and local setup, and `package.json` for the
current command list. Keep this file focused on constraints that are easy to
miss while changing the code.

## Runtime boundaries

- All runtime code is browser client code: use Web APIs only. Build-time
  tooling may use Node.
- Processing is intentionally client-side. Do not add uploads, remote fetching,
  telemetry, or persistence of user input without an explicit product decision.
  `src/lib/settings.svelte.ts` persists viewer preferences only.
- Response headers (including `frame-ancestors`) live in `static/_headers`; the
  CSP is emitted as a `<meta>` tag from `vite.config.ts`. Unknown paths get
  `build/404.html`, which renders `src/routes/+error.svelte`.
- `src/lib/parser/` must not import other app code: it owns the PHP serialized
  format and its `PhpValue` AST. Parser and serializer changes must round-trip
  supported values and preserve PHP string-length (UTF-8 byte) semantics.
- `src/lib/converter/json.ts` owns the JSON representation. Preserve the
  `__php_*` metadata wrappers for PHP-only information; ordinary user keys must
  not be mistaken for metadata.
- The tree and the JSON output are two views of `Session.data`. Every edit goes
  through `Session` (tree edits via `applyOperation`); do not keep independent
  copies of the value in components.
- Follow the Svelte 5 patterns already used by neighboring components instead
  of introducing a second state-management style, including disposing Monaco
  editors and subscriptions.

## Useful areas

- `src/lib/parser/` — tokenizer/parser, serializer, AST types, UTF-8 helpers
- `src/lib/converter/` — AST/JSON conversion and wrapper validation
- `src/lib/processor/` — pure `process.ts`, the Web Worker, its protocol and
  main-thread client, and the reactive `Session` the page renders
- `src/lib/tree/` — `operations.ts` (path-based edits on the JSON value) and
  `nodes.ts` (the tree's view model over the metadata wrappers)
- `src/lib/components/` — `Editor` wraps Monaco, `TreeView` wraps
  `@zag-js/tree-view`
- `src/routes/+page.svelte` — layout and wiring between the session and views

## Validation

Choose checks that cover the change, then expand when shared or runtime code is
affected:

```sh
pnpm lint
pnpm check
pnpm test
pnpm test:smoke   # browser-facing, editing or synchronization changes
pnpm build        # bundling, prerendering or deployment changes
```

Do not run deployment commands unless the user explicitly asks for a deploy.
