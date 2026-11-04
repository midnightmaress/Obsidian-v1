const availableThemes = ["midnight", "frost", "ocean", "sunset"] as const;
type ThemeName = typeof availableThemes[number];

const themeInputs = document.querySelectorAll<HTMLInputElement>('input[name="theme"]');
const themeStatus = document.getElementById("theme-status") as HTMLParagraphElement;
const themeLabels: Record<ThemeName, string> = {
	midnight: "Midnight",
	frost: "Frost",
	ocean: "Ocean",
	sunset: "Sunset",
};

function readTheme(): ThemeName {
	try {
		const theme = localStorage.getItem("obsidian-theme");
		if (availableThemes.includes(theme as ThemeName)) return theme as ThemeName;
	} catch {
		// Keep the default theme when browser storage is unavailable.
	}
	return "midnight";
}

function applyTheme(theme: ThemeName): void {
	document.documentElement.dataset.theme = theme;
	for (const input of themeInputs) input.checked = input.value === theme;
}

applyTheme(readTheme());

themeInputs.forEach(input => {
	input.addEventListener("change", () => {
		if (!availableThemes.includes(input.value as ThemeName)) return;
		const theme = input.value as ThemeName;
		applyTheme(theme);
		try {
			localStorage.setItem("obsidian-theme", theme);
			themeStatus.textContent = `${themeLabels[theme]} theme applied.`;
		} catch {
			themeStatus.textContent = `${themeLabels[theme]} theme applied for this visit.`;
		}
	});
});