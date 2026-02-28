(function () {
	var theme = null;

	try {
		theme = localStorage.getItem("theme");
	} catch {
		theme = null;
	}

	var prefersDark = false;
	try {
		prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
	} catch {
		prefersDark = false;
	}

	if (theme === "dark" || (theme !== "light" && prefersDark)) {
		document.documentElement.classList.add("dark");
	}
})();
