// =============================================================
// Start Game SpecialBattle
// -------------------------------------------------------------
// Implements the "Special Battle" mode triggered when the player
// plays the red-cross special bonus card that was awarded at the
// end of a Bonus Battle. The card can ONLY be played — it can
// never be gambled, and clicking it does NOT open the regular
// Play Card / Gamble choice modal.
//
// MODE VISUALS:
//   - The special card is lifted out of the player's hand and
//     placed on a centered "stage", where it wiggles continuously.
//   - The scene's playing-field elements (background layers,
//     foreground, field cards, monster-box, prediction wheel,
//     etc.) are dimmed via brightness/saturation filters.
//   - The player's hand row, the monster sprite, and the special
//     card itself stay bright — these are the only "highlighted"
//     elements while the special battle is active.
//   - A 10-second visible timer counts down beneath the card.
//
// BATTLE MECHANICS:
//   - The actual "attack opponent's cards" logic will be added
//     later. For now, the mode just enters the visuals, holds
//     for 10 seconds, then exits cleanly.
//
// ENTRY / EXIT TRIGGERS:
//   - Entry: capture-phase click on a .special-bonus-card in the
//     player's hand. Click is consumed (stopPropagation + preventDefault)
//     so Actions.js never sees it and never opens the choice modal.
//   - Exit: 10-second timer fires, end() is called externally, or
//     the Escape key is pressed. end() is idempotent — calling it
//     twice is harmless.
//   - On exit: the stage + timer + special card are removed from
//     the DOM, body class is stripped, idle-pressure timer is
//     forcibly restarted, and the bonus button visibility is
//     refreshed in case the field state needs it.
//
// SAFE TO DELETE: remove this file + its <script> tag. The
// special bonus card will then just sit in the hand looking
// pretty, and no special battle ever fires.
// =============================================================

(function () {
    "use strict";

    // Single source of truth for the placeholder battle duration.
    // When the real "attack opponent's cards" mechanic is wired in,
    // this can either be reused as a per-turn timer or replaced.
    const TIMER_MS = 10000;
    const TICK_MS  = 100;

    let active = false;
    let timerTimeout = null;
    let tickInterval = null;
    let specialCardEl = null;
    let stageEl = null;
    let timerWrapEl = null;
    let escapeHandler = null;

    document.addEventListener("DOMContentLoaded", () => {
        // Defer one tick so the rest of the page's DOMContentLoaded
        // handlers have wired up first (matches the pattern used by
        // the other Start Game modules).
        setTimeout(init, 0);
    });

    function init() {
        const hand = document.getElementById("hand");
        if (!hand) {
            console.warn("[specialbattle] #hand not found");
            return;
        }
        // Capture phase — runs BEFORE Actions.js's bubble-phase listener
        // so we can stopPropagation and block the choice modal entirely.
        hand.addEventListener("click", onHandClickCapture, true);
    }

    // -------- Entry trigger --------

    function onHandClickCapture(e) {
        const card = e.target.closest(".card");
        if (!card) return;
        if (!card.classList.contains("special-bonus-card")) return;

        // Always swallow clicks on the special card: it must never reach
        // the gamble/play handler (Actions.js bubble phase) NOR PlayCard.js's
        // capture-phase battle handler. stopImmediatePropagation halts every
        // other listener for this event, capture and bubble alike.
        e.stopImmediatePropagation();
        e.stopPropagation();
        e.preventDefault();

        if (active) return;

        // Refuse if a competing mode is mid-flight. Special battle owns
        // the screen exclusively and shouldn't fight with bonus mode or
        // an already-running special battle.
        if (window.GameBonusAction
            && typeof GameBonusAction.isActive === "function"
            && GameBonusAction.isActive()) return;
        if (window.GameBonusBattle
            && typeof GameBonusBattle.isActive === "function"
            && GameBonusBattle.isActive()) return;

        start(card);
    }

    // -------- Entering the mode --------

    function start(cardEl) {
        if (active) return;
        active = true;

        specialCardEl = cardEl;

        // Stop the idle pressure timer for the duration of special battle.
        // It'll be restarted cleanly on exit.
        if (window.GameTurnTimer && typeof GameTurnTimer.stop === "function") {
            GameTurnTimer.stop();
        }

        // Body class triggers the CSS dim/highlight rules.
        document.body.classList.add("special-battle-mode");

        // Lift the card out of .hand and onto a centered stage so it can
        // wiggle freely without being constrained by the flex row.
        buildStage();
        moveSpecialCardToStage();
        buildTimer();

        // Escape exits early — safety net so a stuck mode can be aborted.
        escapeHandler = (e) => {
            if (e.key === "Escape") end("escape");
        };
        document.addEventListener("keydown", escapeHandler);

        if (window.GameActions && typeof GameActions.showPopup === "function") {
            GameActions.showPopup(
                "Special card played!\nAttack mode — coming soon."
            );
        }
    }

    function buildStage() {
        stageEl = document.createElement("div");
        stageEl.className = "special-battle-stage";
        stageEl.id = "special-battle-stage";
        stageEl.setAttribute("aria-hidden", "false");
        document.body.appendChild(stageEl);
    }

    function moveSpecialCardToStage() {
        if (!specialCardEl || !stageEl) return;
        // The card carries .special-bonus-card already. Add the stage
        // variant class so CSS can re-style it for its larger, centered,
        // wiggling form. The original hand layout no longer applies once
        // it's parented to the stage.
        specialCardEl.classList.add("special-battle-card");
        stageEl.appendChild(specialCardEl);
    }

    function buildTimer() {
        if (!stageEl) return;

        timerWrapEl = document.createElement("div");
        timerWrapEl.className = "special-battle-timer";

        const label = document.createElement("div");
        label.className = "special-battle-timer-label";
        label.textContent = String(Math.ceil(TIMER_MS / 1000));

        const barTrack = document.createElement("div");
        barTrack.className = "special-battle-timer-bar";

        const barFill = document.createElement("div");
        barFill.className = "special-battle-timer-fill";
        barFill.style.animationDuration = TIMER_MS + "ms";
        barTrack.appendChild(barFill);

        timerWrapEl.appendChild(label);
        timerWrapEl.appendChild(barTrack);
        stageEl.appendChild(timerWrapEl);

        // Per-tick label update so the player sees a live "10, 9, 8..."
        // countdown alongside the bar drain.
        let remaining = TIMER_MS;
        tickInterval = setInterval(() => {
            remaining -= TICK_MS;
            if (remaining < 0) remaining = 0;
            label.textContent = String(Math.max(0, Math.ceil(remaining / 1000)));
            if (remaining <= 0) {
                clearInterval(tickInterval);
                tickInterval = null;
            }
        }, TICK_MS);

        // Hard expiry — independent of the tick interval, so a missed
        // tick can never delay the actual mode exit.
        timerTimeout = setTimeout(() => end("expired"), TIMER_MS);
    }

    // -------- Safe landing / exit --------

    // Idempotent: callable any time, runs full cleanup whether the mode
    // was active or not. This is the single exit path — timer expiry,
    // Escape, and external GameSpecialBattle.end() all funnel through it.
    function end(reason) {
        if (!active) {
            // Even if we're not active, scrub any stale visuals just in
            // case a previous abort left things half-torn-down.
            document.body.classList.remove("special-battle-mode");
            const stale = document.getElementById("special-battle-stage");
            if (stale) stale.remove();
            return;
        }
        active = false;

        if (timerTimeout) { clearTimeout(timerTimeout); timerTimeout = null; }
        if (tickInterval) { clearInterval(tickInterval); tickInterval = null; }

        if (escapeHandler) {
            document.removeEventListener("keydown", escapeHandler);
            escapeHandler = null;
        }

        // The special card is a one-shot reward — consume it on exit
        // regardless of how the mode ended.
        if (specialCardEl && specialCardEl.parentNode) {
            specialCardEl.parentNode.removeChild(specialCardEl);
        }
        specialCardEl = null;

        if (stageEl && stageEl.parentNode) {
            stageEl.parentNode.removeChild(stageEl);
        }
        stageEl = null;
        timerWrapEl = null;

        document.body.classList.remove("special-battle-mode");

        // Hand control back to the normal-game idle loop. checkDefeat
        // makes sure the win popup still fires if the monster was killed
        // (e.g. by some future special-battle attack). start() has no
        // gates any more, so this single call resumes normal play.
        if (window.GameActions && typeof GameActions.releaseLock === "function") {
            GameActions.releaseLock();
        }
        if (window.GameTurnTimer) {
            if (typeof GameTurnTimer.checkDefeat === "function") {
                GameTurnTimer.checkDefeat();
            }
            if (typeof GameTurnTimer.start === "function") {
                GameTurnTimer.start();
            }
        }
        if (window.GameBonusAction && typeof GameBonusAction.update === "function") {
            GameBonusAction.update();
        }
    }

    // -------- Public API --------
    window.GameSpecialBattle = {
        start,                  // start(cardEl) — normally driven internally
        end,                    // end(reasonString?) — idempotent safe-landing
        isActive: () => active,
    };

})();
