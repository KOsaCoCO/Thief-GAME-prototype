// Map each menu action to its target page.
// NOTE: "start"/"rules"/"cards"/"settings" are ARCHIVED — the game is
// being remodeled around the Talking Game, so their buttons were
// removed from mainpage.html for now. Their routes are left here on
// purpose (harmless with no button pointing at them) so the old pages
// are one line away from coming back later.
const PAGES = {
    start: "Start Game/Start Game.html",
    rules: "Game Rules/Game Rules.html",
    cards: "Card Info/Card Info.html",
    settings: "Settings/Settings.html",
    talking: "Talking Game/Talking Game.html"
};

document.addEventListener("DOMContentLoaded", () => {
    const greeting = document.getElementById("greeting");
    if (greeting) {
        console.log("Page loaded — greeting element found.");
    }

    // Hook up menu buttons
    const buttons = document.querySelectorAll(".menu-btn");
    buttons.forEach((btn) => {
        btn.addEventListener("click", () => {
            const action = btn.dataset.action;
            if (action) handleMenuAction(action);
        });
    });

    // Reset Game — clears the Talking Game's saved state so the
    // monster forgets everything and starts as a stranger again. The
    // storage key here MUST match Engine.js's STORAGE_KEY exactly —
    // there's no shared import between the two files to keep them in
    // sync automatically.
    const resetBtn = document.getElementById("reset-game-btn");
    if (resetBtn) {
        resetBtn.addEventListener("click", handleResetGame);
    }
});

function handleResetGame() {
    const confirmed = window.confirm("Reset the Talking Game? This clears everything the monster has learned so far.");
    if (!confirmed) return;
    localStorage.removeItem("talkingGameEngineState");
    window.alert("Talking Game has been reset.");
}

function handleMenuAction(action) {
    const target = PAGES[action];
    if (target) {
        window.location.href = target;
    } else {
        console.log("Unknown menu action:", action);
    }
}
