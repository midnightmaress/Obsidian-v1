const movieForm = document.getElementById("movie-form") as HTMLFormElement;
const movieUrlInput = document.getElementById("movie-url") as HTMLInputElement;
const movieFrame = document.getElementById("movie-frame") as HTMLIFrameElement;
const movieStage = document.getElementById("movie-stage") as HTMLDivElement;
const movieStatus = document.getElementById("movie-status") as HTMLParagraphElement;

function resolveEmbedUrl(value: string): URL {
	const url = new URL(value);
	if (url.protocol !== "https:") throw new Error("Use an HTTPS embed link.");

	const hostname = url.hostname.replace(/^www\./, "");
	let videoId = "";
	if (hostname === "youtu.be") videoId = url.pathname.slice(1).split("/")[0];
	if (hostname === "youtube.com" || hostname === "m.youtube.com") {
		if (url.pathname === "/watch") videoId = url.searchParams.get("v") || "";
		else if (/^\/(?:embed|shorts)\//.test(url.pathname)) videoId = url.pathname.split("/")[2] || "";
	}
	if (videoId) return new URL(`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`);
	if (hostname === "youtube-nocookie.com" && url.pathname.startsWith("/embed/")) return url;
	return url;
}

movieForm.addEventListener("submit", event => {
	event.preventDefault();
	try {
		const embedUrl = resolveEmbedUrl(movieUrlInput.value.trim());
		movieFrame.src = embedUrl.href;
		movieStage.hidden = false;
		movieStatus.textContent = `Opened embed from ${embedUrl.hostname}.`;
	} catch (error) {
		movieStatus.textContent = error instanceof Error ? error.message : "That embed URL could not be opened.";
	}
});