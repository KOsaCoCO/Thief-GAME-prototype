// =============================================================
// Start Game CardDeck
// -------------------------------------------------------------
// Defines the deck: how many cards exist and which suit each number
// belongs to. Suit assignment is RANDOM per game — every number
// 1-60 is shuffled into one of the three suits at a fixed 50% triangle
// / 40% circle / 10% square split, freshly reshuffled each time this
// page loads.
//
// getShapeForCard()/isSpecialCard() stay bare globals (no window.*
// wrapper), same as before — every other Start Game file keeps
// calling them exactly as it always has. Only the numbers moved here,
// not the contract, so nothing downstream needed to change.
//
// SEPARATE on purpose: delete this file + its <script> tag and only
// the deck definition goes with it — every caller already guards with
// `typeof getShapeForCard === "function"` / `typeof isSpecialCard ===
// "function"`, so the rest of the game degrades instead of crashing.
//
// Must load BEFORE Start Game.js — its DOMContentLoaded handler calls
// assignCardShapes() and pickSpecialTriangles() from here.
// =============================================================

const TOTAL_CARDS         = 60;
const SPECIAL_TRIANGLES_N = 5;

// Suit split applied to the 60 numbers, freshly shuffled each game.
const SUIT_SHARE = { triangle: 0.5, circle: 0.4, square: 0.1 };

// Card ID -> shape ("circle" | "square" | "triangle"), filled in by
// assignCardShapes() before anything else (hand render, monster draw,
// special-triangle picks) touches a card.
const CARD_SHAPES = new Map();

// Set of card IDs that are "special triangles" this game session.
// A special triangle grants a bonus take after its primary attack:
// the player (or monster) gets to grab one extra circle/square from
// the field. The "+" indicator is drawn via .card.special in CSS.
const SPECIAL_TRIANGLES = new Set();

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

function isSpecialCard(cardId) {
    return SPECIAL_TRIANGLES.has(cardId);
}

// Picks SPECIAL_TRIANGLES_N random triangle card IDs and marks them as
// special for this game session. Must run AFTER assignCardShapes().
function pickSpecialTriangles() {
    SPECIAL_TRIANGLES.clear();
    const triangles = [];
    for (let i = 1; i <= TOTAL_CARDS; i++) {
        if (getShapeForCard(i) === "triangle") triangles.push(i);
    }
    for (let i = triangles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [triangles[i], triangles[j]] = [triangles[j], triangles[i]];
    }
    for (let i = 0; i < Math.min(SPECIAL_TRIANGLES_N, triangles.length); i++) {
        SPECIAL_TRIANGLES.add(triangles[i]);
    }
    console.log("Special triangles this game:", [...SPECIAL_TRIANGLES].sort((a, b) => a - b));
}
