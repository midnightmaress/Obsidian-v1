import proxy, { swReady } from "./proxy";

const browserForm = document.getElementById("browser-nav") as HTMLFormElement;
const browserAddress = document.getElementById("browser-address") as HTMLInputElement;
const browserFrame = document.getElementById("browser-frame") as HTMLIFrameElement;
const browserApp = document.getElementById("browser-app") as HTMLElement;
const browserStatus = document.getElementById("browser-status") as HTMLParagraphElement;
const backButton = document.getElementById("browser-back") as HTMLButtonElement;
const forwardButton = document.getElementById("browser-forward") as HTMLButtonElement;
const reloadButton = document.getElementById("browser-reload") as HTMLButtonElement;
const fullscreenButton = document.getElementById("browser-fullscreen") as HTMLButtonElement;
const newTabButton = document.getElementById("browser-new-tab") as HTMLButtonElement;

function getSearchUrl(query: string): string {
	return `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
}

function resolveAddress(value: string): string {
	const input = value.trim();
	if (!input) throw new Error("Enter a web address or search phrase.");
	try {
		const url = new URL(input.includes("://") ? input : `https://${input}`);
		if (["http:", "https:"].includes(url.protocol)) return url.href;
	} catch {
		return getSearchUrl(input);
	}
	return getSearchUrl(input);
}

async function navigate(value: string): Promise<void> {
	try {
		const destination = resolveAddress(value);
		browserStatus.textContent = "Connecting...";
		await swReady;
		browserFrame.src = proxy.encodeUrl(destination);
		browserAddress.value = destination;
	} catch (error) {
		browserStatus.textContent = error instanceof Error ? error.message : "Could not open that address.";
	}
}

browserForm.addEventListener("submit", event => {
	event.preventDefault();
	void navigate(browserAddress.value);
});

backButton.addEventListener("click", () => browserFrame.contentWindow?.history.back());
forwardButton.addEventListener("click", () => browserFrame.contentWindow?.history.forward());
reloadButton.addEventListener("click", () => {
	if (browserFrame.src) browserFrame.src = browserFrame.src;
});
fullscreenButton.addEventListener("click", async () => {
	try {
		if (document.fullscreenElement === browserApp) await document.exitFullscreen();
		else await browserApp.requestFullscreen();
	} catch (error) {
		browserStatus.textContent = "Fullscreen is unavailable in this browser.";
		console.error("Browser fullscreen failed:", error);
	}
});
document.addEventListener("fullscreenchange", () => {
	const isFullscreen = document.fullscreenElement === browserApp;
	fullscreenButton.title = isFullscreen ? "Exit fullscreen" : "Fullscreen";
	fullscreenButton.setAttribute("aria-label", isFullscreen ? "Exit fullscreen" : "Enter fullscreen");
	fullscreenButton.setAttribute("aria-pressed", String(isFullscreen));
});
newTabButton.addEventListener("click", () => {
	browserAddress.value = "";
	browserFrame.removeAttribute("src");
	browserStatus.textContent = "";
	browserAddress.focus();
});
browserFrame.addEventListener("load", () => {
	if (browserFrame.src) browserStatus.textContent = "";
});

const initialUrl = new URLSearchParams(location.search).get("url");
if (initialUrl) {
	browserAddress.value = initialUrl;
	void navigate(initialUrl);
}