interface LocalTrack {
	file: File;
	url: string;
}

const fileInput = document.getElementById("music-files") as HTMLInputElement;
const addButton = document.getElementById("music-add") as HTMLButtonElement;
const clearButton = document.getElementById("music-clear") as HTMLButtonElement;
const queueElement = document.getElementById("music-queue") as HTMLOListElement;
const countElement = document.getElementById("music-count") as HTMLSpanElement;
const titleElement = document.getElementById("music-title") as HTMLHeadingElement;
const statusElement = document.getElementById("music-status") as HTMLParagraphElement;
const audio = document.getElementById("music-audio") as HTMLAudioElement;
const playButton = document.getElementById("music-play") as HTMLButtonElement;
const previousButton = document.getElementById("music-previous") as HTMLButtonElement;
const nextButton = document.getElementById("music-next") as HTMLButtonElement;
const seekInput = document.getElementById("music-seek") as HTMLInputElement;
const currentTimeElement = document.getElementById("music-current-time") as HTMLSpanElement;
const durationElement = document.getElementById("music-duration") as HTMLSpanElement;

let tracks: LocalTrack[] = [];
let activeIndex = -1;

function formatTime(seconds: number): string {
	if (!Number.isFinite(seconds)) return "0:00";
	const minutes = Math.floor(seconds / 60);
	const remainder = Math.floor(seconds % 60).toString().padStart(2, "0");
	return `${minutes}:${remainder}`;
}

function updateControls(): void {
	const hasTracks = tracks.length > 0;
	const hasTrack = activeIndex >= 0;
	clearButton.disabled = !hasTracks;
	previousButton.disabled = !hasTracks;
	nextButton.disabled = !hasTracks;
	playButton.disabled = !hasTrack;
	seekInput.disabled = !hasTrack || !Number.isFinite(audio.duration);
	playButton.textContent = audio.paused ? "Play" : "Pause";
	playButton.setAttribute("aria-label", audio.paused ? "Play" : "Pause");
	countElement.textContent = `${tracks.length} ${tracks.length === 1 ? "track" : "tracks"}`;
}

function renderQueue(): void {
	const fragment = document.createDocumentFragment();
	if (!tracks.length) {
		const empty = document.createElement("li");
		empty.className = "queue-empty";
		empty.textContent = "Your selected audio files will appear here.";
		fragment.append(empty);
	} else {
		tracks.forEach((track, index) => {
			const item = document.createElement("li");
			const button = document.createElement("button");
			button.type = "button";
			button.className = "queue-track";
			button.dataset.active = String(index === activeIndex);
			button.textContent = track.file.name.replace(/\.[^.]+$/, "");
			button.title = track.file.name;
			button.addEventListener("click", () => void selectTrack(index, true));
			item.append(button);
			fragment.append(item);
		});
	}
	queueElement.replaceChildren(fragment);
	updateControls();
}

async function selectTrack(index: number, autoplay: boolean): Promise<void> {
	if (index < 0 || index >= tracks.length) return;
	activeIndex = index;
	audio.pause();
	audio.src = tracks[index].url;
	audio.load();
	titleElement.textContent = tracks[index].file.name.replace(/\.[^.]+$/, "");
	statusElement.textContent = "Ready to play from this device.";
	currentTimeElement.textContent = "0:00";
	durationElement.textContent = "0:00";
	seekInput.value = "0";
	renderQueue();
	if (autoplay) {
		try {
			await audio.play();
		} catch {
			statusElement.textContent = "Playback was blocked. Press Play to start this track.";
		}
	}
	updateControls();
}

function stepTrack(direction: number): void {
	if (!tracks.length) return;
	const startIndex = activeIndex < 0 ? 0 : activeIndex;
	const nextIndex = (startIndex + direction + tracks.length) % tracks.length;
	void selectTrack(nextIndex, true);
}

addButton.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
	for (const track of tracks) URL.revokeObjectURL(track.url);
	tracks = [...(fileInput.files || [])].map(file => ({ file, url: URL.createObjectURL(file) }));
	activeIndex = -1;
	audio.pause();
	audio.removeAttribute("src");
	titleElement.textContent = "Choose a track";
	statusElement.textContent = tracks.length ? "Playlist ready." : "Audio stays on this device.";
	renderQueue();
	if (tracks.length) void selectTrack(0, false);
	fileInput.value = "";
});

clearButton.addEventListener("click", () => {
	audio.pause();
	audio.removeAttribute("src");
	for (const track of tracks) URL.revokeObjectURL(track.url);
	tracks = [];
	activeIndex = -1;
	titleElement.textContent = "Choose a track";
	statusElement.textContent = "Audio stays on this device.";
	renderQueue();
});

playButton.addEventListener("click", () => {
	if (audio.paused) void audio.play().catch(() => {
		statusElement.textContent = "Playback could not start for this file.";
	});
	else audio.pause();
});
previousButton.addEventListener("click", () => stepTrack(-1));
nextButton.addEventListener("click", () => stepTrack(1));
audio.addEventListener("play", updateControls);
audio.addEventListener("pause", updateControls);
audio.addEventListener("loadedmetadata", () => {
	durationElement.textContent = formatTime(audio.duration);
	seekInput.disabled = !Number.isFinite(audio.duration);
});
audio.addEventListener("timeupdate", () => {
	currentTimeElement.textContent = formatTime(audio.currentTime);
	if (Number.isFinite(audio.duration) && audio.duration > 0) {
		seekInput.value = String(Math.round(audio.currentTime / audio.duration * 1000));
	}
});
audio.addEventListener("ended", () => stepTrack(1));
seekInput.addEventListener("input", () => {
	if (Number.isFinite(audio.duration)) audio.currentTime = Number(seekInput.value) / 1000 * audio.duration;
});
window.addEventListener("pagehide", () => {
	for (const track of tracks) URL.revokeObjectURL(track.url);
});

renderQueue();