import { randomBytes, randomUUID } from "node:crypto";

const users = new Map();
const sessions = new Map();
const rooms = new Map();
const histories = new Map();
const sockets = new Set();

const lobby = {
	id: "lobby",
	name: "Lobby",
	kind: "room",
	visibility: "public",
	ownerId: null,
	memberIds: new Set(),
	createdAt: Date.now(),
};
rooms.set(lobby.id, lobby);
histories.set(lobby.id, []);

export class ChatRoomError extends Error {
	constructor(statusCode, message) {
		super(message);
		this.statusCode = statusCode;
	}
}

function parseCookies(header = "") {
	return Object.fromEntries(header.split(";").map(part => {
		const separator = part.indexOf("=");
		return separator < 0 ? ["", ""] : [part.slice(0, separator).trim(), decodeURIComponent(part.slice(separator + 1).trim())];
	}));
}

function getUserFromRequest(request) {
	const token = parseCookies(request.headers.cookie).obsidian_chat;
	const userId = token && sessions.get(token);
	return userId ? users.get(userId) : undefined;
}

function requireUser(request) {
	const user = getUserFromRequest(request);
	if (!user) throw new ChatRoomError(401, "Join chat with a username to continue.");
	return user;
}

function publicUser(user) {
	return { id: user.id, username: user.username };
}

function roomAccess(room, userId) {
	return room.visibility === "public" || room.memberIds.has(userId);
}

function roomView(room, userId) {
	let title = room.name;
	if (room.kind === "dm") {
		const peer = [...room.memberIds].find(id => id !== userId);
		title = users.get(peer)?.username || "Direct message";
	}
	return { id: room.id, name: title, kind: room.kind, visibility: room.visibility, ownerId: room.ownerId };
}

async function readJson(request) {
	if (Object.prototype.hasOwnProperty.call(request, "chatBody")) return request.chatBody;
	const chunks = [];
	let size = 0;
	for await (const chunk of request) {
		size += chunk.length;
		if (size > 2 * 1024 * 1024) throw new ChatRoomError(413, "Request is too large.");
		chunks.push(chunk);
	}
	try {
		return JSON.parse(Buffer.concat(chunks).toString("utf8"));
	} catch {
		throw new ChatRoomError(400, "Request body must be valid JSON.");
	}
}

function sendJson(response, status, body, headers = {}) {
	response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers });
	response.end(JSON.stringify(body));
}

function requireRoomAccess(roomId, userId) {
	const room = rooms.get(roomId);
	if (!room || !roomAccess(room, userId)) throw new ChatRoomError(404, "Room not found.");
	return room;
}

async function handleApi(request, response, url) {
	const { pathname } = url;
	if (pathname === "/api/chat/session" && request.method === "POST") {
		const data = await readJson(request);
		const username = typeof data.username === "string" ? data.username.trim() : "";
		if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) throw new ChatRoomError(400, "Username must be 3–20 letters, numbers, or underscores.");
		if ([...users.values()].some(user => user.username.toLowerCase() === username.toLowerCase())) {
			throw new ChatRoomError(409, "That username is already in use.");
		}
		const user = { id: randomUUID(), username, createdAt: Date.now() };
		const token = randomBytes(32).toString("base64url");
		users.set(user.id, user);
		sessions.set(token, user.id);
		const secure = request.socket.encrypted ? "; Secure" : "";
		sendJson(response, 201, { user: publicUser(user) }, {
			"Set-Cookie": `obsidian_chat=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${secure}`,
		});
		return;
	}

	if (pathname === "/api/chat/me" && request.method === "GET") {
		const user = getUserFromRequest(request);
		if (!user) throw new ChatRoomError(401, "Join chat with a username to continue.");
		sendJson(response, 200, { user: publicUser(user) });
		return;
	}

	if (pathname === "/api/chat/rooms" && request.method === "GET") {
		const user = requireUser(request);
		const roomList = [...rooms.values()]
			.filter(room => roomAccess(room, user.id))
			.sort((a, b) => a.createdAt - b.createdAt)
			.map(room => roomView(room, user.id));
		sendJson(response, 200, { rooms: roomList });
		return;
	}

	if (pathname === "/api/chat/rooms" && request.method === "POST") {
		const user = requireUser(request);
		const data = await readJson(request);
		const name = typeof data.name === "string" ? data.name.trim() : "";
		const visibility = data.visibility === "private" ? "private" : "public";
		if (name.length < 2 || name.length > 40) throw new ChatRoomError(400, "Room names must be 2–40 characters.");
		if (rooms.size >= 100) throw new ChatRoomError(409, "This chat server has reached its room limit.");
		const room = {
			id: randomUUID(), name, kind: "room", visibility, ownerId: user.id,
			memberIds: new Set([user.id]), createdAt: Date.now(),
		};
		rooms.set(room.id, room);
		histories.set(room.id, []);
		broadcast({ type: "rooms-updated" });
		sendJson(response, 201, { room: roomView(room, user.id) });
		return;
	}

	if (pathname === "/api/chat/dms" && request.method === "POST") {
		const user = requireUser(request);
		const data = await readJson(request);
		const username = typeof data.username === "string" ? data.username.trim() : "";
		const peer = [...users.values()].find(item => item.username.toLowerCase() === username.toLowerCase());
		if (!peer) throw new ChatRoomError(404, "No chat user has that username.");
		if (peer.id === user.id) throw new ChatRoomError(400, "You cannot send a direct message to yourself.");
		const memberIds = [user.id, peer.id].sort();
		let room = [...rooms.values()].find(item => item.kind === "dm" && memberIds.every(id => item.memberIds.has(id)));
		if (!room) {
			room = {
				id: randomUUID(), name: "Direct message", kind: "dm", visibility: "private",
				ownerId: user.id, memberIds: new Set(memberIds), createdAt: Date.now(),
			};
			rooms.set(room.id, room);
			histories.set(room.id, []);
			broadcast({ type: "rooms-updated" });
		}
		sendJson(response, 200, { room: roomView(room, user.id) });
		return;
	}

	const inviteMatch = pathname.match(/^\/api\/chat\/rooms\/([a-f0-9-]+)\/invite$/);
	if (inviteMatch && request.method === "POST") {
		const user = requireUser(request);
		const room = rooms.get(inviteMatch[1]);
		if (!room || room.kind !== "room" || room.visibility !== "private") throw new ChatRoomError(404, "Private room not found.");
		if (room.ownerId !== user.id) throw new ChatRoomError(403, "Only the room owner can invite people.");
		const data = await readJson(request);
		const username = typeof data.username === "string" ? data.username.trim() : "";
		const invitee = [...users.values()].find(item => item.username.toLowerCase() === username.toLowerCase());
		if (!invitee) throw new ChatRoomError(404, "No chat user has that username.");
		room.memberIds.add(invitee.id);
		broadcast({ type: "rooms-updated" });
		sendJson(response, 200, { room: roomView(room, user.id) });
		return;
	}

	const messagesMatch = pathname.match(/^\/api\/chat\/rooms\/([a-f0-9-]+)\/messages$/);
	if (messagesMatch && request.method === "GET") {
		const user = requireUser(request);
		const room = requireRoomAccess(messagesMatch[1], user.id);
		sendJson(response, 200, { room: roomView(room, user.id), messages: (histories.get(room.id) || []).slice(-100) });
		return;
	}

	throw new ChatRoomError(404, "Chat endpoint not found.");
}

export async function handleChatApi(request, response) {
	const url = new URL(request.url, "http://localhost");
	if (!url.pathname.startsWith("/api/chat")) return false;
	try {
		await handleApi(request, response, url);
	} catch (error) {
		sendJson(response, error instanceof ChatRoomError ? error.statusCode : 500, {
			error: error instanceof Error ? error.message : "Chat request failed.",
		});
	}
	return true;
}

function broadcast(payload, roomId) {
	const data = JSON.stringify(payload);
	for (const connection of sockets) {
		if (roomId && !roomAccess(rooms.get(roomId), connection.user.id)) continue;
		if (connection.socket.readyState === 1) connection.socket.send(data);
	}
}

export function attachChatSocket(socket, request) {
	const user = getUserFromRequest(request);
	if (!user) {
		socket.close(1008, "Join chat before connecting.");
		return;
	}
	const connection = { socket, user };
	sockets.add(connection);
	socket.send(JSON.stringify({ type: "connected", user: publicUser(user) }));
	socket.on("message", async raw => {
		try {
			const data = JSON.parse(raw.toString());
			if (data.type !== "message") throw new ChatRoomError(400, "Unknown chat action.");
			const room = requireRoomAccess(data.roomId, user.id);
			const content = typeof data.content === "string" ? data.content.trim() : "";
			const image = typeof data.image === "string" ? data.image : "";
			if (!content && !image) throw new ChatRoomError(400, "Write a message or attach a photo.");
			if (content.length > 2000) throw new ChatRoomError(400, "Messages are limited to 2,000 characters.");
			if (image) {
				const imageMatch = image.match(/^data:image\/(jpeg|png|webp|gif);base64,([A-Za-z0-9+/=]+)$/);
				if (!imageMatch || Buffer.from(imageMatch[2], "base64").length > 1024 * 1024) {
					throw new ChatRoomError(400, "Use a JPEG, PNG, GIF, or WebP photo under 1 MB.");
				}
			}
			const message = {
				id: randomUUID(), roomId: room.id, user: publicUser(user), content, image,
				createdAt: new Date().toISOString(),
			};
			const history = histories.get(room.id) || [];
			history.push(message);
			if (history.length > 100) history.splice(0, history.length - 100);
			histories.set(room.id, history);
			broadcast({ type: "message", message }, room.id);
		} catch (error) {
			if (socket.readyState === 1) socket.send(JSON.stringify({
				type: "error",
				error: error instanceof Error ? error.message : "Message failed.",
			}));
		}
	});
	socket.on("close", () => sockets.delete(connection));
	socket.on("error", () => sockets.delete(connection));
}