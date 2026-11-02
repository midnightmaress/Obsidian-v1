# Obsidian

Obsidian is a black-and-white browser workspace with six focused apps:

- **Browser**: browse or search through the Scramjet proxy.
- **Games**: browse game files from [Noah's Calculus Tutor](https://github.com/NoahsAmazingTutoringHelp/Noahs-Calculus-Tutor/tree/master/games) and [UGS Files Sorted](https://github.com/brickyosu/ugs-files-sorted). Game files load when selected.
- **Chat**: a local conversation UI backed by the OpenRouter chat endpoint.
- **Settings**: select the proxy and search engines and reduce particle motion.
- **Apps**: launch built-in apps or save custom proxied links locally.
- **Music**: import and play audio files stored in the browser's IndexedDB.

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

The chat API requires `OPENROUTER_API_KEY` in the server environment. Proxy routes need a secure context in deployed environments so service workers and WebSockets can run.