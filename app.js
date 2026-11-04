import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { libcurlPath } from "@mercuryworkshop/libcurl-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";
import { join } from "node:path";
import { hostname } from "node:os";
import { server as wisp } from "@mercuryworkshop/wisp-js/server";
import { WebSocketServer } from "ws";
import { attachChatSocket, handleChatApi } from "./src/server/chat-room.js";



try { process.loadEnvFile(); } catch { /* .env not present or Node is too old */ }

const __dirname = process.cwd();
const publicPath = join(__dirname, "dist");

const fastify = Fastify({
    logger: true,
});
const chatSockets = new WebSocketServer({ noServer: true, maxPayload: 2 * 1024 * 1024 });

fastify.addHook("onSend", async (request, reply, payload) => {
    reply.header("Cross-Origin-Opener-Policy", "same-origin");
    reply.header("Cross-Origin-Embedder-Policy-Report-Only", "require-corp");
    return payload;
});
fastify.server.on("upgrade", (req, socket, head) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    if (pathname === "/chat-ws") {
        try {
            if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return socket.destroy();
        } catch {
            return socket.destroy();
        }
        chatSockets.handleUpgrade(req, socket, head, client => attachChatSocket(client, req));
        return;
    }
    if (pathname.startsWith("/wisp/")) wisp.routeRequest(req, socket, head);
});


await fastify.register(fastifyStatic, {
    root: publicPath,
    prefix: "/"
});


fastify.addContentTypeParser('application/javascript', { parseAs: 'string' }, (req, body, done) => {
    done(null, body);
});

await fastify.register(fastifyStatic, {
    root: libcurlPath,
    prefix: "/libcurl/",
    decorateReply: false,
    setHeaders: (res, path, stat) => {
        if (path.endsWith('.mjs')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
});

await fastify.register(fastifyStatic, {
    root: baremuxPath,
    prefix: "/baremux/",
    decorateReply: false
});


fastify.get("/", (request, reply) => {
    return reply.sendFile("index.html");
});

const chatApiHandler = async (request, reply) => {
    reply.hijack();
    request.raw.chatBody = request.body;
    await handleChatApi(request.raw, reply.raw);
};
fastify.all("/api/chat", chatApiHandler);
fastify.all("/api/chat/*", chatApiHandler);


fastify.post("/api/deepreset", async (request, reply) => {
    const cookieNames = ["session", "auth-token", "refresh-token"];

    for (const name of cookieNames) {
        reply.header(
            "Set-Cookie",
            `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 UTC; HttpOnly; SameSite=Lax`
        );
    }

    reply.header("Clear-Site-Data", '"cache", "cookies", "storage"');

    return reply.status(200).send({ ok: true });
});


fastify.setNotFoundHandler((request, reply) => {
    return reply.send("404 Not Found");
});


function shutdown() {
    console.log("SIGTERM signal received: closing HTTP server");
    fastify.close();
    process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);


let port = parseInt(process.env.PORT || "8080");
if (isNaN(port)) port = 8080;

try {
    const address = await fastify.listen({ port, host: "0.0.0.0" });
    console.log("Listening on:");
    console.log(`\thttp://localhost:${port}`);
    console.log(`\thttp://${hostname()}:${port}`);

    const serverAddress = fastify.server.address();
    console.log(
        `\thttp://${serverAddress.family === "IPv6" ? `[${serverAddress.address}]` : serverAddress.address}:${serverAddress.port}`
    );
} catch (err) {
    fastify.log.error(err);
    process.exit(1);
}