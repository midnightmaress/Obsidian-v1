interface ChatMessage {
	role: "user" | "assistant";
	content: string;
}

export {};

const form = document.getElementById("chat-form") as HTMLFormElement;
const prompt = document.getElementById("chat-prompt") as HTMLTextAreaElement;
const messagesElement = document.getElementById("chat-messages") as HTMLDivElement;
const statusElement = document.getElementById("chat-status") as HTMLParagraphElement;
const sendButton = document.getElementById("chat-send") as HTMLButtonElement;
const clearButton = document.getElementById("chat-clear") as HTMLButtonElement;

let messages: ChatMessage[] = [];
let isSending = false;

function renderMessage(role: ChatMessage["role"], content: string): HTMLParagraphElement {
	const element = document.createElement("p");
	element.className = "chat-message";
	element.dataset.role = role;
	element.textContent = content;
	messagesElement.append(element);
	messagesElement.scrollTop = messagesElement.scrollHeight;
	return element;
}

function updateControls(): void {
	sendButton.disabled = isSending || !prompt.value.trim();
	clearButton.disabled = isSending || messages.length === 0;
	prompt.disabled = isSending;
	sendButton.setAttribute("aria-busy", String(isSending));
}

form.addEventListener("submit", async event => {
	event.preventDefault();
	if (isSending) return;
	const content = prompt.value.trim();
	if (!content) return;

	const userMessage: ChatMessage = { role: "user", content };
	const requestMessages: ChatMessage[] = [...messages, userMessage].slice(-20);
	const userElement = renderMessage("user", content);
	const replyElement = renderMessage("assistant", "Thinking...");
	prompt.value = "";
	isSending = true;
	statusElement.textContent = "Thinking...";
	updateControls();

	try {
		const response = await fetch("/api/chat", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ messages: requestMessages }),
		});
		const data = await response.json();
		if (!response.ok) throw new Error(data.error || "Chat request failed.");
		if (typeof data.reply !== "string" || !data.reply.trim()) throw new Error("The chat server returned an empty reply.");
		const assistantMessage: ChatMessage = { role: "assistant", content: data.reply };
		messages = [...requestMessages, assistantMessage].slice(-20);
		replyElement.textContent = data.reply;
		statusElement.textContent = "Ready";
	} catch (error) {
		userElement.remove();
		replyElement.remove();
		prompt.value = content;
		statusElement.textContent = error instanceof Error ? error.message : "Could not reach the chat server.";
	} finally {
		isSending = false;
		updateControls();
		prompt.focus();
	}
});

prompt.addEventListener("input", updateControls);
prompt.addEventListener("keydown", event => {
	if (event.key === "Enter" && !event.shiftKey) {
		event.preventDefault();
		if (!sendButton.disabled) form.requestSubmit();
	}
});

clearButton.addEventListener("click", () => {
	messages = [];
	messagesElement.innerHTML = "";
	const welcome = document.createElement("p");
	welcome.className = "chat-welcome";
	welcome.textContent = "Ask a question to start a conversation.";
	messagesElement.append(welcome);
	statusElement.textContent = "Conversation cleared.";
	updateControls();
});

updateControls();