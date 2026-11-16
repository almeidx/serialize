# Serialize

Parse, edit and convert PHP serialized data and JSON. Everything runs in your browser.

**Live:** [serialize.almeidx.dev](https://serialize.almeidx.dev)

## Usage

1. Paste PHP serialized data or JSON into the input editor. The format is detected when you paste into an empty editor; switch it with **PHP** / **JSON**, which converts the current value.
2. Inspect the result as a tree or as raw JSON. Both views edit the same value: change scalars inline, change a node's type, add or delete entries.
3. Every edit is written back to the input. **Copy** exports pretty JSON, minified JSON or PHP serialized.

PHP-only details survive the JSON round trip through `__php_*` metadata wrappers: object class names and property visibility, non-sequential array keys, references, binary strings, whole-number floats and `INF`/`NAN`, custom objects and enums. Parsing and serializing run in a Web Worker; nothing you enter is uploaded or stored.

## Running Locally

Requires Node.js 24+ and pnpm.

```bash
git clone https://github.com/almeidx/serialize.git
cd serialize
pnpm install --frozen-lockfile
pnpm dev
```

| Command              | Description                                |
| -------------------- | ------------------------------------------ |
| `pnpm dev`           | Start development server                   |
| `pnpm build`         | Build for production (static output)       |
| `pnpm preview`       | Preview the production build locally       |
| `pnpm lint`          | Check formatting and lint rules            |
| `pnpm fmt`           | Format and auto-fix lint issues            |
| `pnpm check`         | Run TypeScript and Svelte checks           |
| `pnpm test`          | Run unit tests (Vitest)                    |
| `pnpm test:coverage` | Run unit tests with coverage thresholds    |
| `pnpm test:smoke`    | Run browser smoke tests (Playwright)       |
| `pnpm run deploy`    | Deploy static assets to Cloudflare Workers |

## Limits

- Maximum nesting depth: 512
- Maximum array or object element count: 1,000,000

## License

[GNU AGPLv3](LICENSE)
