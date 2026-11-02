import proxy, { swReady } from "./proxy";

const gameFrame = document.getElementById("game-frame") as HTMLIFrameElement;
const gameTitleElement = document.getElementById("game-title") as HTMLHeadingElement;
const gameIconElement = document.getElementById("game-icon") as HTMLImageElement;
const gameContainer = document.getElementById("game-container") as HTMLDivElement;
const fullscreenButton = document.getElementById("fullscreen-btn") as HTMLButtonElement;
const reloadButton = document.getElementById("reload-btnp") as HTMLButtonElement;
const gameStatus = document.getElementById("game-status") as HTMLParagraphElement;

const params = new URLSearchParams(location.search);
const gameUrl = params.get("url");
const gameTitle = params.get("title");
const gameIcon = params.get("icon");

gameTitleElement.textContent = gameTitle || "Game";
gameIconElement.src = gameIcon || "/img/obsidian.svg";
gameIconElement.alt = `${gameTitle || "Game"} icon`;

if (gameUrl) {
	try {
		const destination = new URL(gameUrl);
		if (!["http:", "https:"].includes(destination.protocol)) throw new Error("Unsupported game URL protocol");
		void swReady.then(() => {
			gameFrame.src = proxy.encodeUrl(destination.href);
		}).catch(error => {
			gameTitleElement.textContent = "Proxy failed to initialize";
			gameStatus.textContent = "The proxy could not start. Reload the page and try again.";
			console.error("Proxy initialization failed:", error);
		});
	} catch (error) {
		gameTitleElement.textContent = "Invalid game URL";
		gameStatus.textContent = "Choose a game from the games library.";
		console.error("Invalid game URL:", error);
	}
} else {
	gameTitleElement.textContent = "No game selected";
	gameStatus.textContent = "Choose a game from the games library.";
}

fullscreenButton.addEventListener("click", async () => {
	try {
		if (document.fullscreenElement === gameContainer) {
			await document.exitFullscreen();
		} else {
			await gameContainer.requestFullscreen();
		}
	} catch (error) {
		gameStatus.textContent = "Fullscreen is not available in this browser.";
		console.error("Game fullscreen failed:", error);
	}
});

document.addEventListener("fullscreenchange", () => {
	const isFullscreen = document.fullscreenElement === gameContainer;
	fullscreenButton.title = isFullscreen ? "Exit fullscreen" : "Fullscreen";
	fullscreenButton.setAttribute("aria-label", isFullscreen ? "Exit fullscreen" : "Enter fullscreen");
});

reloadButton.addEventListener("click", () => {
	if (gameFrame.src) gameFrame.src = gameFrame.src;
});

gameFrame.addEventListener("load", () => {
	gameStatus.textContent = "";
});

document.addEventListener("keydown", event => {
	if (event.key === "F11") {
		event.preventDefault();
		fullscreenButton.click();
	}
	if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "r") {
		event.preventDefault();
		reloadButton.click();
	}
});
