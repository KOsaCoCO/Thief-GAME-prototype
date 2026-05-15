// Map each menu action to its target page
const PAGES = {
    start: "Start Game/Start Game.html",
    rules: "Game Rules/Game Rules.html",
    cards: "Card Info/Card Info.html",
    settings: "Settings/Settings.html"
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
            handleMenuAction(action);
        });
    });
});

function handleMenuAction(action) {
    const target = PAGES[action];
    if (target) {
        window.location.href = target;
    } else {
        console.log("Unknown menu action:", action);
    }
}
