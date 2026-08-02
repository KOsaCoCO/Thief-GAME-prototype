// =============================================================
// Start Game CardBoosters
// -------------------------------------------------------------
// Live per-card booster tracking for the CURRENT game session. The
// only booster right now is the "+" pip (stacks up to PLUS_CEILING,
// currently 3) — this file is deliberately just a small state ledger
// so more booster types can be added later without every caller
// needing to change.
//
// Keyed purely by card ID, independent of who currently holds the
// card — a plus earned by the player stays on that card even if the
// monster later takes it, and vice versa. Only reset() clears the
// board; it's called once per new game from Start Game.js's init.
//
// SEPARATE on purpose — modify freely, or delete the file + its
// <script> tag if it ever breaks. Start Game CardDeck.js's
// getPlusCount()/isSpecialCard() both guard with
// `window.GameBoosters && typeof ... === "function"`, so cards
// simply stop carrying pluses instead of the game crashing.
// =============================================================

(function () {
    "use strict";

    const PLUS_CEILING = 3;

    // Card ID -> current plus count (1-PLUS_CEILING). Absent = 0.
    let plusCounts = new Map();

    // Wipes every card's plus count. Call once at the start of a new game.
    function reset() {
        plusCounts = new Map();
    }

    function getPlusCount(cardId) {
        return plusCounts.get(cardId) || 0;
    }

    function hasPlus(cardId) {
        return getPlusCount(cardId) > 0;
    }

    // Adds one pip to a specific card, capped at PLUS_CEILING. Returns
    // the card's new total.
    function addPlus(cardId) {
        const next = Math.min(PLUS_CEILING, getPlusCount(cardId) + 1);
        plusCounts.set(cardId, next);
        return next;
    }

    // -------- Public API --------
    window.GameBoosters = {
        PLUS_CEILING,
        reset,
        getPlusCount,
        hasPlus,
        addPlus,
    };

})();
