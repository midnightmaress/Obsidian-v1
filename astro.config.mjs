import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

import { server as wisp } from "@mercuryworkshop/wisp-js/server";
import { libcurlPath } from "@mercuryworkshop/libcurl-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";
import sirv from "sirv";
import { WebSocketServer } from "ws";
import { attachChatSocket, handleChatApi } from "./src/server/chat-room.js";

function customDevServer() {
    const chatSockets = new WebSocketServer({ noServer: true, maxPayload: 2 * 1024 * 1024 });
    return {
        name: 'custom-dev-server',
        hooks: {
            'astro:server:setup': ({ server }) => {
                server.middlewares.use('/api/chat', (req, res, next) => {
                    if (!req.url.startsWith('/api/chat')) return next();
                    void handleChatApi(req, res);
                });

                server.httpServer.on('upgrade', (req, socket, head) => {
                    const pathname = new URL(req.url, 'http://localhost').pathname;
                    if (pathname === '/chat-ws') {
                        try {
                            if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return socket.destroy();
                        } catch {
                            return socket.destroy();
                        }
                        chatSockets.handleUpgrade(req, socket, head, client => attachChatSocket(client, req));
                        return;
                    }
                    if (pathname.startsWith('/wisp/')) wisp.routeRequest(req, socket, head);
                });

                server.middlewares.use((req, res, next) => {
                    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
                    res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
                    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
                    next();
                });



                server.middlewares.use('/baremux/', sirv(baremuxPath, { dev: true, etag: true }));

                const serveLibcurl = sirv(libcurlPath, { dev: true, etag: true });
                server.middlewares.use('/libcurl/', (req, res, next) => {

                    if (req.originalUrl.endsWith('.mjs')) {
                        res.setHeader('Content-Type', 'application/javascript');
                    }
                    serveLibcurl(req, res, next);
                });
            },
        },
    };
}

export default defineConfig({
    root: "./",
    outDir: "./dist",
    publicDir: "./public",
    srcDir: "./src",
    vite: {
        plugins: [tailwindcss()]
    },
    build: {
        concurrency: 1
    },
    integrations: [
        customDevServer()
    ]
});