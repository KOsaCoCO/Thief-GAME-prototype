// =============================================================
// Start Game CardDeck
// -------------------------------------------------------------
// Defines the deck: how many cards exist and which suit each number
// belongs to. Suit assignment is RANDOM per game — every number
// 1-60 is shuffled into one of the three suits at a fixed 50% triangle
// / 40% circle / 10% square split, freshly reshuffled each time this
// page loads.
//
// getShapeForCard()/isSpecialCard()/getPlusCount() stay bare globals
// (no window.* wrapper), same as before — every other Start Game file
// keeps calling them exactly as it always has. Only the numbers moved
// here, not the contract, so nothing downstream needed to change.
//
// isSpecialCard()/getPlusCount() are a thin pass-through to Start Game
// CardBoosters.js's live per-card "+" tracking — that file is the
// actual source of truth. No card starts a game with a pip: the ONLY
// way to earn one is a correct gamble call (Start Game Actions.js's
// awardGambleBoosterPip(), which calls GameBoosters.addPlus() itself).
// This file never grants pips — it only ever reads them.
//
// SEPARATE on purpose: delete this file + its <script> tag and only
// the deck definition goes with it — every caller already guards with
// `typeof getShapeForCard === "function"` / `typeof isSpecialCard ===
// "function"`, so the rest of the game degrades instead of crashing.
//
// Load hierarchy: Start Game CardBoosters.js -> Start Game CardDeck.js
// (this file) -> Start Game.js -> Start Game Actions.js. Must load
// BEFORE Start Game.js — its DOMContentLoaded handler calls
// assignCardShapes() from here.
// =============================================================

const TOTAL_CARDS = 60;

// Suit split applied to the 60 numbers, freshly shuffled each game.
const SUIT_SHARE = { triangle: 0.5, circle: 0.4, square: 0.1 };

// Card ID -> shape ("circle" | "square" | "triangle"), filled in by
// assignCardShapes() before anything else (hand render, monster draw)
// touches a card.
const CARD_SHAPES = new Map();

// Shuffles 1..TOTAL_CARDS and hands out shapes by SUIT_SHARE using
// exact counts (not a per-card coin flip), so the split lands on
// 50/40/10 every game instead of drifting with randomness.
function assignCardShapes() {
    CARD_SHAPES.clear();

    const ids = Array.from({ length: TOTAL_CARDS }, (_, i) => i + 1);
    for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
    }

    const triangleCount = Math.round(TOTAL_CARDS * SUIT_SHARE.triangle);
    const circleCount   = Math.round(TOTAL_CARDS * SUIT_SHARE.circle);
    // Square takes whatever's left so rounding can never drop or
    // duplicate a card.
    let idx = 0;
    for (let i = 0; i < triangleCount; i++) CARD_SHAPES.set(ids[idx++], "triangle");
    for (let i = 0; i < circleCount;   i++) CARD_SHAPES.set(ids[idx++], "circle");
    while (idx < ids.length) CARD_SHAPES.set(ids[idx++], "square");

    console.log(
        `[card-deck] ${triangleCount} triangle / ${circleCount} circle / ` +
        `${TOTAL_CARDS - triangleCount - circleCount} square this game.`
    );
}

function getShapeForCard(cardNumber) {
    return CARD_SHAPES.get(cardNumber) || "circle";
}

// How many "+" pips a card currently carries (0 if none). Backed by
// Start Game CardBoosters.js's live tracking.
function getPlusCount(cardId) {
    return (window.GameBoosters && typeof GameBoosters.getPlusCount === "function")
        ? GameBoosters.getPlusCount(cardId)
        : 0;
}

function isSpecialCard(cardId) {
    return getPlusCount(cardId) > 0;
}
