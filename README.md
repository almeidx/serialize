# Serialize

A client-side tool for parsing, editing, and converting PHP serialized data.

**Live:** https://serialize.almeidx.dev

## Features

- **Bidirectional conversion** between PHP serialized format and JSON
- **Editable tree view** with inline value editing
- **Monaco editor** with syntax highlighting
- **PHP metadata preservation** (class names, visibility, references)
- **Dark/light theme** with system preference detection
- **Copy menu** (pretty JSON, minified JSON, PHP serialized)
- **Stats panel** showing size, node count, depth, and types

## Development

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Type check
pnpm check

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Tech Stack

- [SvelteKit](https://svelte.dev/) - Framework
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) - Code editor
- [Cloudflare Workers](https://workers.cloudflare.com/) - Deployment

## License

[MIT](./LICENSE.md)
