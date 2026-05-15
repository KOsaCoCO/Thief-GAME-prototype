// =============================================================
// Start Game TurnTimer
// -------------------------------------------------------------
// Drives the small red slider above the monster's buff box.
//
// IDLE-PRESSURE timer: it runs whenever the player is idle (no
// choice modal open, no gamble in progress, no play-card battle
// in progress) — pushing them to click a hand card and act.
//
//   - When the player clicks a hand card -> timer stops.
//   - When an action finishes (battle ends, gamble resolves,
//     choice modal cancelled) -> timer restarts.
//
// If the slider fills before the player clicks anything, the
// monster takes one of two free actions, picked at random:
//
//   - "GAMBLE"     -> the monster plays a random card from its
//                     hand to the playing field as monster-owned;
//                     its slot disappears from the box.
//   - "PLAY CARD"  -> the monster tries to take a player-owned
//                     field card using the suit hierarchy. If no
//                     valid attack exists, it falls back to GAMBLE.
//
// SAFE TO DELETE: removing this file and its <script> tag just
// disables the timer — every other feature keeps working.
// =============================================================

(function () {
    "use strict";

    const TIMER_MS = 3000;          // must match the CSS @keyframes duration

    let timerEl  = null;
    let fillEl   = null;
    let pendingTimeout = null;
    let running  = false;
    let monsterDefeated = false;    // permanently true once the monster has 0 cards total

    document.addEventListener("DOMContentLoaded", () => {
        // Defer one tick so other scripts' DOMContentLoaded handlers run first.
        setTimeout(init, 0);
    });

    function init() {
        timerEl = document.getElementById("turn-timer");
        fillEl  = document.getElementById("turn-timer-fill");
        if (!timerEl || !fillEl) {
            console.warn("[turn-timer] elements not found");
            return;
        }
    }

    // -------- Public start/stop --------

    function start() {
        if (!timerEl || !fillEl) return;
        if (monsterDefeated) return;      // game's over, no more pressure
        if (checkMonsterDefeat()) return; // just check now in case we missed it
        if (running) stop();              // restart cleanly if already running

        running = true;
        timerEl.classList.add("visible");
        // Force a reflow so the animation restarts from 0 even on rapid re-opens.
        timerEl.classList.remove("running");
        fillEl.style.animation = "none";
        void fillEl.offsetWidth;
        fillEl.style.animation = "";
        timerEl.classList.add("running");

        if (pendingTimeout) clearTimeout(pendingTimeout);
        pendingTimeout = setTimeout(onExpire, TIMER_MS);
    }

    function stop() {
        running = false;
        if (pendingTimeout) {
            clearTimeout(pendingTimeout);
            pendingTimeout = null;
        }
        if (!timerEl || !fillEl) return;
        timerEl.classList.remove("running");
        timerEl.classList.remove("visible");
        // Reset fill width
        fillEl.style.animation = "none";
        fillEl.style.width = "0%";
        void fillEl.offsetWidth;
        fillEl.style.animation = "";
        fillEl.style.width = "";
    }

    // -------- Expiry --------

    function onExpire() {
        pendingTimeout = null;
        running = false;

        // Hide the slider
        if (timerEl) {
            timerEl.classList.remove("running");
            timerEl.classList.remove("visible");
        }
        if (fillEl) {
            fillEl.style.animation = "none";
            fillEl.style.width = "0%";
        }

        // Auto-close the choice modal if it's still visible
        const modal = document.getElementById("play-choice-modal");
        if (modal) {
            modal.classList.remove("visible");
            modal.setAttribute("aria-hidden", "true");
        }

        // Release the prediction lock so the player can act again afterwards
        if (window.GameActions && typeof GameActions.releaseLock === "function") {
            GameActions.releaseLock();
        }

        // If the monster is already wiped out, just show the win popup
        // (idempotently) and don't bother with an action.
        if (checkMonsterDefeat()) return;

        // Monster decides: PLAY CARD (50%) or GAMBLE (50%)
        const wantsPlay = Math.random() < 0.5;
        if (!(wantsPlay && tryMonsterPlayCard())) {
            monsterGamble();
        }

        // After the monster's free action, give the player a brief beat
        // to see what happened, check for defeat, then restart pressure.
        setTimeout(() => {
            if (window.GameActions && typeof GameActions.releaseLock === "function") {
                GameActions.releaseLock();
            }
            if (!checkMonsterDefeat()) start();
        }, 1400);
    }

    // -------- Monster auto-actions --------

    function tryMonsterPlayCard() {
        if (!window.GameActions || !window.GamePlay) return false;
        if (typeof getShapeForCard !== "function") return false;

        const monsterHand = GameActions.getMonsterHand();
        const playerFieldCards = Array.from(
            document.querySelectorAll(".monster-field .card[data-owner='player']")
        );
        if (monsterHand.length === 0 || playerFieldCards.length === 0) return false;

        // Find a valid (monster hand card × player-owned field card) attack pair.
        for (const monCardId of monsterHand) {
            const monShape = getShapeForCard(monCardId);
            for (const playerEl of playerFieldCards) {
                const playerCardId = Number(playerEl.dataset.cardId);
                const playerShape  = playerEl.dataset.shape;
                if (GamePlay.canBeat(monShape, monCardId, playerShape, playerCardId)) {
                    // Execute the take. No swap — the monster's hand card
                    // stays in its hand; only the player's field card moves.
                    playerEl.remove();
                    GameActions.addToMonsterHand(playerCardId);
                    GameActions.showPopup(
                        `Time's up! Monster played a card\nand took your #${playerCardId} from the field.`
                    );
                    return true;
                }
            }
        }
        return false;     // no valid attack — caller will fall back to gamble
    }

    // When the monster auto-gambles, it "guesses" 50/50:
    //   - Correct guess  -> takes a random card from the player's hand onto
    //                       the playing field (added as player-owned so the
    //                       player can later try to reclaim it).
    //   - Wrong guess    -> plays one of the monster's own cards to the
    //                       playing field as monster-owned (the old fallback).
    function monsterGamble() {
        if (!window.GameActions) return;

        const guessedCorrectly = Math.random() < 0.5;

        if (guessedCorrectly) {
            // Try to take a player hand card to the field.
            const playerCards = document.querySelectorAll(".hand .card:not(.losing)");
            if (playerCards.length > 0) {
                const target = playerCards[Math.floor(Math.random() * playerCards.length)];
                const cardId = Number(target.dataset.cardId);
                target.classList.add("losing");
                setTimeout(() => target.remove(), 350);
                // Card lands on field shortly after, owned by the player (so
                // they can still reclaim it during a Play Card battle).
                setTimeout(() => GameActions.placeCardOnField(cardId, "player"), 250);
                GameActions.showPopup(
                    `Time's up! Monster gambled correctly\nand took your card #${cardId} onto the field.`
                );
                return;
            }
            // No player hand cards left — fall through to placing own card.
        }

        // Wrong guess (or no player hand cards): place a monster card on field.
        const monsterHand = GameActions.getMonsterHand();
        if (monsterHand.length === 0) {
            GameActions.showPopup("Time's up! Monster has nothing to play.");
            return;
        }
        const cardId = monsterHand[Math.floor(Math.random() * monsterHand.length)];
        GameActions.removeFromMonsterHand(cardId);
        GameActions.dropMonsterSlot(cardId);
        GameActions.placeCardOnField(cardId, "monster");
        GameActions.showPopup(
            `Time's up! Monster gambled and played card #${cardId} onto the field.`
        );
    }

    // -------- Monster defeat --------

    function countMonsterCards() {
        if (!window.GameActions) return 0;
        const handCount = GameActions.getMonsterHand().length;
        const fieldCount = document.querySelectorAll(
            ".monster-field .card[data-owner='monster']"
        ).length;
        return handCount + fieldCount;
    }

    // Returns true if the monster has lost (no cards anywhere). The first
    // time this evaluates true, the "you won" popup is shown and the timer
    // is stopped permanently.
    function checkMonsterDefeat() {
        if (monsterDefeated) return true;
        if (countMonsterCards() > 0) return false;

        monsterDefeated = true;
        stop();
        if (window.GameActions) {
            GameActions.showPopup(
                "Monster lost the round — they ran out of cards!",
                { needsOk: true }
            );
        }
        return true;
    }

    // -------- Public API --------
    window.GameTurnTimer = { start, stop, checkDefeat: checkMonsterDefeat };

})();
