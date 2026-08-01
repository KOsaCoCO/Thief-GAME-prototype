// =============================================================
// Start Game TugOfWar
// -------------------------------------------------------------
// A new card action: while the monster is mid-animation of taking a
// field card (its target is tagged ".contested" — see Start Game
// AI_brain.js), the player can click that card to fight for it
// instead of losing it automatically once the animation finishes.
//
// The game logic (key prompts, scoring, the monster's 500ms ticks)
// AND the visuals it drives (the overlay, the card snapping back to
// neutral) are kept together in this ONE file on purpose — unlike
// AI_brain.js / AI_brain Animations.js, which are split for a
// different reason (state vs. pure choreography).
//
// SAFE TO DELETE: without this file, a contested card is never
// clickable for a tug-of-war — it just gets taken automatically by
// AI_brain.js's normal animation. Nothing else breaks.
// =============================================================

(function () {
    "use strict";

    const TUG_KEYS        = ["a", "w", "s", "d"];
    const KEY_LABELS       = { a: "A", w: "W", s: "S", d: "D" };
    const WIN_SCORE         = 25;
    const HALF_SCORE        = WIN_SCORE / 2;   // key switches once, at the halfway point
    const MONSTER_TICK_MS  = 500;

    let active         = false;
    let playerScore    = 0;
    let monsterScore   = 0;
    let currentKey     = null;
    let keySwitched    = false;   // whether this session already swapped its key at the halfway mark
    let monsterInterval = null;
    let overlayEl       = null;

    document.addEventListener("DOMContentLoaded", init);

    function init() {
        // Window-level capture, always on (not added/removed per session) —
        // window is an ancestor of every click/keydown target on the page,
        // so this always runs before ANY other handler in the game
        // (PlayCard.js's field/hand listeners, End Battle, Escape), no
        // matter where they're attached or when they were registered.
        // While a tug-of-war is active this is also the LOCK: every click
        // and every non-matching key gets swallowed here before it can
        // reach anything else.
        window.addEventListener("click", onGlobalClickCapture, true);
        window.addEventListener("keydown", onGlobalKeyDownCapture, true);
    }

    function onGlobalClickCapture(e) {
        if (active) {
            // Locked: nothing on the field/hand/buttons can react to a
            // misclick while the tug-of-war is running.
            e.stopPropagation();
            e.preventDefault();
            return;
        }

        const card = e.target.closest(".card.contested");
        if (!card) return;
        if (!window.GameAI || typeof GameAI.claimContest !== "function") return;

        const contest = GameAI.claimContest(card);
        if (!contest) return;   // nothing to claim — let the click fall through

        e.stopPropagation();
        e.preventDefault();
        startTug(contest);
    }

    function onGlobalKeyDownCapture(e) {
        if (!active) return;

        // Locked: swallow every keydown while running so nothing else in
        // the game (Escape -> End Battle, etc.) can react to it either.
        e.stopPropagation();
        e.preventDefault();

        if (e.key.toLowerCase() !== currentKey) return;   // wrong key — already locked above, just no-op

        playerScore++;
        if (playerScore >= WIN_SCORE) {
            endTug("player");
            return;
        }
        // The prompted key stays fixed until the halfway point of the
        // meter, then swaps to a different key exactly once for the
        // second half — see switchKey().
        if (!keySwitched && playerScore >= HALF_SCORE) {
            switchKey();
            keySwitched = true;
        }
        updateOverlay();
    }

    // -------- Enter / exit --------
    // Mirrors the enter/exit pattern used by playcard-mode, bonus-mode,
    // and special-battle-mode: a body class the idle-pressure timer's
    // start() gate checks (see Start Game TurnTimer.js), stopped on
    // entry and restarted on exit so the monster can't also auto-act
    // from the idle timer while a tug-of-war is running. The input LOCK
    // itself doesn't need its own enter/exit — onGlobalClickCapture and
    // onGlobalKeyDownCapture are always listening and just read `active`.

    function startTug(contest) {
        active       = true;
        playerScore  = 0;
        monsterScore = 0;
        keySwitched  = false;

        // The automatic "beat" animation was already cancelled by
        // claimContest(), but any inline styles it had already applied
        // (mid-stack transform, z-index, etc.) need clearing so the cards
        // sit neutrally while the tug-of-war plays out.
        resetCardVisual(contest.attackerEl);
        resetCardVisual(contest.target);

        document.body.classList.add("tug-mode");
        if (window.GameTurnTimer && typeof GameTurnTimer.stop === "function") {
            GameTurnTimer.stop();
        }

        pickNewKey();
        buildOverlay();
        monsterInterval = setInterval(onMonsterTick, MONSTER_TICK_MS);
    }

    function endTug(winner) {
        active = false;

        clearInterval(monsterInterval);
        monsterInterval = null;
        removeOverlay();

        document.body.classList.remove("tug-mode");
        if (window.GameTurnTimer && typeof GameTurnTimer.start === "function") {
            GameTurnTimer.start();
        }

        if (window.GameAI && typeof GameAI.resolveContest === "function") {
            GameAI.resolveContest(winner);
        }
    }

    function resetCardVisual(el) {
        if (!el) return;
        el.style.animation  = "";
        el.style.transition = "none";
        el.style.transform  = "";
        el.style.opacity    = "";
        el.style.zIndex     = "";
        el.classList.remove("ai-captured");
    }

    // -------- Scoring --------

    function pickNewKey() {
        currentKey = TUG_KEYS[Math.floor(Math.random() * TUG_KEYS.length)];
    }

    // Picks a new key for the second half of the meter — guaranteed
    // different from whatever key was in use for the first half.
    function switchKey() {
        const remaining = TUG_KEYS.filter((k) => k !== currentKey);
        currentKey = remaining[Math.floor(Math.random() * remaining.length)];
    }

    function onMonsterTick() {
        if (!active) return;
        monsterScore++;
        if (monsterScore >= WIN_SCORE) {
            endTug("monster");
            return;
        }
        updateOverlay();
    }

    // -------- Overlay --------
    // Built and torn down entirely here — there's no static markup for
    // this in Start Game.html, keeping the feature fully self-contained.

    function buildOverlay() {
        overlayEl = document.createElement("div");
        overlayEl.id = "tug-overlay";
        overlayEl.className = "tug-overlay";
        overlayEl.innerHTML =
            '<div class="tug-title">Tug of War!</div>' +
            '<div class="tug-prompt">Press <span id="tug-key"></span></div>' +
            '<div class="tug-bar"><div id="tug-fill" class="tug-fill"></div></div>';
        document.body.appendChild(overlayEl);
        updateOverlay();
    }

    function removeOverlay() {
        if (overlayEl) overlayEl.remove();
        overlayEl = null;
    }

    function updateOverlay() {
        if (!overlayEl) return;
        const keyEl  = overlayEl.querySelector("#tug-key");
        const fillEl = overlayEl.querySelector("#tug-fill");
        if (keyEl)  keyEl.textContent = KEY_LABELS[currentKey] || currentKey;
        if (fillEl) {
            // 0% = monster fully winning, 100% = player fully winning.
            const pct = 50 + ((playerScore - monsterScore) / WIN_SCORE) * 50;
            fillEl.style.width = Math.max(0, Math.min(100, pct)) + "%";
        }
    }

    // -------- Public API --------
    window.GameTugOfWar = {
        isActive: () => active,
    };

})();
