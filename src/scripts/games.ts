interface GameEntry {
	name: string;
	source: "noahs" | "ugs" | "gmshelf";
	url: string;
	image: string;
	description: string;
}

const githubApi = "https://api.github.com/repos";
const noahsBase = "https://cdn.jsdelivr.net/gh/NoahsAmazingTutoringHelp/Noahs-Calculus-Tutor@master";
const noahsPages = "https://noahsamazingtutoringhelp.github.io/Noahs-Calculus-Tutor";
const ugsCdn = "https://cdn.jsdelivr.net/gh/brickyosu/ugs-files-sorted@main";
const gmshelfCdn = "https://cdn.jsdelivr.net/gh/gmshelf/ugs@main";
const gamesGrid = document.getElementById("games-grid") as HTMLDivElement;
const searchInput = document.getElementById("games-search") as HTMLInputElement;
const sourceSelect = document.getElementById("games-source") as HTMLSelectElement;
const gamesStatus = document.getElementById("games-status") as HTMLParagraphElement;

let games: GameEntry[] = [];
let filteredGames: GameEntry[] = [];

function generatedCover(title: string): string {
	const initial = [...title.trim()][0]?.toUpperCase() || "G";
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480"><rect width="640" height="480" fill="#10120e"/><path d="M0 370 250 120l150 150 100-100 140 140v170H0Z" fill="#1c2118"/><circle cx="320" cy="210" r="110" fill="none" stroke="#d3ff72" stroke-opacity=".35" stroke-width="2"/><text x="320" y="260" fill="#f5f6f2" font-family="sans-serif" font-size="112" text-anchor="middle">${initial}</text></svg>`;
	return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function normalizeGameTitle(title: string): string {
	return title.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getCatalogEntries(source: string): { title: string; url: string; image?: string; description?: string }[] {
	const entryPattern = /\{\s*title:\s*("(?:\\.|[^"\\])*"),\s*desc:\s*("(?:\\.|[^"\\])*"),\s*url:\s*("(?:\\.|[^"\\])*")(?:,\s*image:\s*("(?:\\.|[^"\\])*"))?/g;
	const entries = [];
	for (const match of source.matchAll(entryPattern)) {
		try {
			entries.push({
				title: JSON.parse(match[1]),
				description: JSON.parse(match[2]),
				url: JSON.parse(match[3]),
				image: match[4] ? JSON.parse(match[4]) : undefined,
			});
		} catch {
			continue;
		}
	}
	return entries;
}

async function loadNoahsGames(): Promise<GameEntry[]> {
	const treeUrl = `${githubApi}/NoahsAmazingTutoringHelp/Noahs-Calculus-Tutor/git/trees/master?recursive=1`;
	const [treeResponse, catalogResponse] = await Promise.all([
		fetch(treeUrl, { headers: { Accept: "application/vnd.github+json" } }),
		fetch(`${noahsBase}/js/games.js`),
	]);
	if (!treeResponse.ok || !catalogResponse.ok) throw new Error("Noah's game source is unavailable");
	const [tree, catalogSource] = await Promise.all([treeResponse.json(), catalogResponse.text()]);
	const availableFiles = new Set<string>((tree.tree || []).map((file: { path: string }) => file.path));
	const metadataByFile = new Map<string, { title: string; image?: string; description?: string }>();
	const covers = new Set([...availableFiles].filter(path => /^images\/.*\.(?:png|jpe?g|webp|gif)$/i.test(path)));

	for (const entry of getCatalogEntries(catalogSource)) {
		try {
			const url = new URL(entry.url);
			const file = decodeURIComponent(url.pathname.split("/games/")[1] || "");
			if (url.hostname !== "cdn.jsdelivr.net" || !file || !availableFiles.has(`games/${file}`)) continue;
			let image: string | undefined;
			if (entry.image) {
				const imageUrl = new URL(entry.image);
				const imagePath = `images/${decodeURIComponent(imageUrl.pathname.split("/images/")[1] || "")}`;
				if (imageUrl.hostname === "cdn.jsdelivr.net" && covers.has(imagePath)) {
					image = imageUrl.href;
				}
			}
			metadataByFile.set(file, { title: entry.title, image, description: entry.description });
		} catch {
			continue;
		}
	}

	return [...availableFiles]
		.filter(path => /^games\/.*\.html$/i.test(path))
		.map(path => {
			const file = path.slice("games/".length);
			const metadata = metadataByFile.get(file);
			const title = metadata?.title || file.replace(/\.html$/i, "").replace(/[-_]+/g, " ");
			const url = `${noahsPages}/${path.split("/").map(encodeURIComponent).join("/")}`;
			return {
				name: title,
				source: "noahs" as const,
				url,
				image: metadata?.image || generatedCover(title),
				description: metadata?.description || "",
			};
		});
}

async function loadUgsGames(): Promise<GameEntry[]> {
	const response = await fetch(`${githubApi}/brickyosu/ugs-files-sorted/git/trees/main?recursive=1`, {
		headers: { Accept: "application/vnd.github+json" },
	});
	if (!response.ok) throw new Error("UGS game source is unavailable");
	const tree = await response.json();
	return (tree.tree || [])
		.filter((file: any) => file.type === "blob" && /^[^/]+\/.*\.html?$/i.test(file.path))
		.map((file: any) => {
			const filename = file.path.split("/").pop().replace(/\.html?$/i, "").replace(/^cl/i, "");
			const title = filename
				.replace(/([a-z])([A-Z])/g, "$1 $2")
				.replace(/[_-]+/g, " ")
				.replace(/\s+/g, " ")
				.trim();
			const path = file.path.split("/").map(encodeURIComponent).join("/");
			return {
				name: title || file.path,
				source: "ugs" as const,
				url: `${ugsCdn}/${path}`,
				image: generatedCover(title || file.path),
				description: file.path,
			};
		});
}

async function loadGmshelfGames(): Promise<GameEntry[]> {
	const response = await fetch(`${gmshelfCdn}/ugs.json`);
	if (!response.ok) throw new Error("GMShelf game source is unavailable");
	const entries = await response.json() as { name?: string; url?: string }[];
	return entries
		.filter(entry => typeof entry.name === "string" && typeof entry.url === "string" && /^\/ugs\/.*\.html?$/i.test(entry.url))
		.map(entry => ({
			name: entry.name!,
			source: "gmshelf" as const,
			url: `${gmshelfCdn}${entry.url}`,
			image: generatedCover(entry.name!),
			description: "GMShelf",
		}));
}

function renderGames(): void {
	const query = searchInput.value.trim().toLowerCase();
	const source = sourceSelect.value;
	filteredGames = games.filter(game =>
		(source === "all" || game.source === source) &&
		(game.name.toLowerCase().includes(query) || game.description.toLowerCase().includes(query))
	);
	const cards = document.createDocumentFragment();
	for (const game of filteredGames) {
		const button = document.createElement("button");
		button.type = "button";
		button.className = "game-tile";
		button.setAttribute("aria-label", `Play ${game.name}`);
		const image = document.createElement("img");
		image.className = "game-cover";
		image.src = game.image;
		image.alt = `${game.name} cover`;
		image.loading = "lazy";
		image.decoding = "async";
		const title = document.createElement("p");
		title.className = "game-title";
		title.textContent = game.name;
		button.append(image, title);
		button.addEventListener("click", () => void launchGame(game));
		cards.append(button);
	}
	gamesGrid.replaceChildren(cards);
	gamesStatus.textContent = `${filteredGames.length.toLocaleString()} games`;
}

function launchGame(game: GameEntry): void {
	const params = new URLSearchParams({
		url: game.url,
		title: game.name,
		icon: game.image,
	});
	location.href = `/play?${params}`;
}
searchInput.addEventListener("input", renderGames);
sourceSelect.addEventListener("change", renderGames);

async function init(): Promise<void> {
	gamesStatus.textContent = "Loading game catalogs...";
	const results = await Promise.allSettled([loadNoahsGames(), loadUgsGames(), loadGmshelfGames()]);
	const failures: string[] = [];
	results.forEach((result, index) => {
		if (result.status === "fulfilled") games.push(...result.value);
		else failures.push(["Noah's source", "UGS source", "GMShelf"][index]);
	});
	const coversByTitle = new Map(
		games
			.filter(game => game.source === "noahs" && !game.image.startsWith("data:"))
			.map(game => [normalizeGameTitle(game.name), game.image]),
	);
	for (const game of games) {
		if (game.source === "noahs") continue;
		const cover = coversByTitle.get(normalizeGameTitle(game.name));
		if (cover) game.image = cover;
	}
	games.sort((a, b) => a.name.localeCompare(b.name));
	renderGames();
	if (failures.length) {
		gamesStatus.textContent = games.length
			? `${games.length.toLocaleString()} games · Unavailable: ${failures.join(", ")}`
			: `Could not load games. Check your connection and try again. Unavailable: ${failures.join(", ")}`;
	} else if (!games.length) {
		gamesStatus.textContent = "No games were found in the catalogs.";
	}
}

void init();