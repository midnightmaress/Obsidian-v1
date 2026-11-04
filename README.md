# Obsidian

Obsidian is a browser workspace with a proxy browser, a game catalog, and local media players:

- **Browser**: browse or search through the Scramjet proxy, with a Games menu in the header.
- **Games**: browse game files from [Noah's Calculus Tutor](https://github.com/NoahsAmazingTutoringHelp/Noahs-Calculus-Tutor/tree/master/games), [UGS Files Sorted](https://github.com/brickyosu/ugs-files-sorted), and [GMShelf](https://github.com/gmshelf/ugs). The official cloud gaming service opens externally.
- **Movies**: play authorized HTTPS movie or trailer embeds in an iframe.
- **Music**: play audio files selected from your device; files are not uploaded.
- **Chat**: talk to the configured OpenRouter model through the server-side `/api/chat` endpoint.
- **AI**: coming soon.

## Development

Install dependencies and start Astro:

```sh
pnpm install
pnpm dev
```

The development server is available at `http://localhost:3000` by default.

For the Fastify/Wisp server, use:

```sh
pnpm start
```

Proxy routes need a secure context in deployed environments so service workers and WebSockets can run.

Chat requires `OPENROUTER_API_KEY` in the server environment. Optionally set `OPENROUTER_MODEL` (defaults to `openai/gpt-4o-mini`) and `PUBLIC_SITE_URL` for the provider attribution header. Keep the key on the server; do not add it to frontend code.