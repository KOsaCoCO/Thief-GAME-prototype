// Start Game scene controller
// - Verifies all parallax layers loaded
// - Picks a random monster sprite for the middleground each page load
// - Renders a hand of 5 random cards at the bottom of the screen
//
// Card/suit definitions (TOTAL_CARDS, getShapeForCard, isSpecialCard,
// getPlusCount) live in Start Game CardDeck.js, which loads before this
// file — this file just calls them like any other global. "+" pips
// themselves are tracked live in Start Game CardBoosters.js and are
// only ever earned by gambling correctly (Start Game Actions.js) — no
// card starts a game already marked.

const HAND_SIZE      = 5;
const NUM_BUFF_SLOTS = 6;
const SVG_NS         = "http://www.w3.org/2000/svg";

// Monster sprites — add more filenames here to expand the pool.
const MONSTER_FILES = [
    "images/monster_1.png",
    "images/monster_2.png",
    "images/monster_3.png",
];

// ---- Cards ----

function buildShape(shape) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.classList.add("card-shape");

    let el;
    if (shape === "circle") {
        el = document.createElementNS(SVG_NS, "circle");
        el.setAttribute("cx", "50");
        el.setAttribute("cy", "50");
        el.setAttribute("r", "38");
    } else if (shape === "square") {
        el = document.createElementNS(SVG_NS, "rect");
        el.setAttribute("x", "15");
        el.setAttribute("y", "15");
        el.setAttribute("width", "70");
        el.setAttribute("height", "70");
    } else {
        el = document.createElementNS(SVG_NS, "polygon");
        el.setAttribute("points", "50,12 86,82 14,82");
    }
    svg.appendChild(el);
    return svg;
}

function paintCard(cardEl, cardId, shape) {
    cardEl.innerHTML = "";
    cardEl.appendChild(buildShape(shape));
    const num = document.createElement("span");
    num.className = "card-number";
    num.textContent = cardId;
    cardEl.appendChild(num);

    // "+" pip slots — up to getPlusCeiling() (3) total, drawn left from
    // the original top-right corner spot. Filled count comes from the
    // card's live pip count (Start Game CardBoosters.js); any card can
    // carry one now, not just the starting special triangles. Only
    // shown at all once the card has earned its first pip.
    const pips = (typeof getPlusCount === "function") ? getPlusCount(cardId) : 0;
    cardEl.classList.toggle("special", pips > 0);
    if (pips > 0) {
        const ceiling = (typeof getPlusCeiling === "function") ? getPlusCeiling() : 3;
        const slots = document.createElement("span");
        slots.className = "card-plus-slots";
        for (let i = 0; i < ceiling; i++) {
            const slot = document.createElement("span");
            slot.className = "card-plus-slot" + (i < pips ? "" : " empty");
            slot.textContent = "+";
            slots.appendChild(slot);
        }
        cardEl.appendChild(slots);
    }
}

function pickRandomCards(count) {
    const all = Array.from({ length: TOTAL_CARDS }, (_, i) => i + 1);
    for (let i = all.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [all[i], all[j]] = [all[j], all[i]];
    }
    return all.slice(0, count);
}

function renderHand() {
    const hand = document.getElementById("hand");
    if (!hand) return;

    hand.innerHTML = "";
    const picks = pickRandomCards(HAND_SIZE);

    picks.forEach((cardId) => {
        const shape = getShapeForCard(cardId);
        const card = document.createElement("div");
        card.className = `card shape-${shape}`;
        card.dataset.cardId = cardId;
        card.dataset.shape = shape;
        paintCard(card, cardId, shape);
        hand.appendChild(card);
    });

    console.log("Dealt hand:", picks);
}

// ---- Buff slots (the row of "?" above the monster) ----

function renderBuffSlots() {
    const box = document.getElementById("monster-box");
    if (!box) return;

    box.innerHTML = "";
    for (let i = 1; i <= NUM_BUFF_SLOTS; i++) {
        const slot = document.createElement("span");
        slot.className = "slot";
        slot.dataset.slotId = i;
        slot.textContent = "?";
        box.appendChild(slot);
    }
}

// Future hook — call this from card actions to reveal a slot.
//   revealSlot(3, "★");
// Reveals slot #3 and replaces its "?" with the given content.
function revealSlot(slotId, content) {
    const slot = document.querySelector(`.monster-box .slot[data-slot-id="${slotId}"]`);
    if (!slot) return;
    slot.textContent = content;
    slot.classList.add("revealed");
}

// ---- Monster ----

function pickRandomMonster() {
    const monster = document.getElementById("monster");
    if (!monster) return;

    const idx = Math.floor(Math.random() * MONSTER_FILES.length);
    const file = MONSTER_FILES[idx];
    monster.src = file;
    monster.dataset.monsterId = idx + 1;
    console.log("Spawned monster:", file);
}

// ---- Prediction wheel (roll-in only; interactive logic lives in actions) ----

function rollInPredictionWheel() {
    const wheel = document.getElementById("prediction-wheel");
    if (!wheel) return;

    setTimeout(() => {
        wheel.setAttribute("aria-hidden", "false");
        wheel.classList.add("visible");
        wheel.classList.add("rolling-in");

        // Once the roll-in keyframe animation finishes, transition into a
        // slow idle spin so the wheel feels alive while waiting for input.
        setTimeout(() => {
            wheel.classList.remove("rolling-in");
            wheel.classList.add("idle-spinning");
        }, 1400);
    }, 1000);
}

// ---- Init ----

document.addEventListener("DOMContentLoaded", () => {
    // Layer load/error reporting
    document.querySelectorAll(".layer").forEach((img) => {
        img.addEventListener("load",  () => console.log(`Loaded: ${img.alt}`));
        img.addEventListener("error", () => {
            console.warn(`Missing image: ${img.getAttribute("src")} — check the file exists in its folder.`);
        });
    });

    if (window.GameBoosters && typeof GameBoosters.reset === "function") {
        GameBoosters.reset();   // no card starts with a "+" — wipe any left over from a previous game
    }
    assignCardShapes();       // must run before anything else touches a card's shape
    pickRandomMonster();
    renderBuffSlots();
    renderHand();
    rollInPredictionWheel();
    console.log("Start Game scene initialized.");
});
