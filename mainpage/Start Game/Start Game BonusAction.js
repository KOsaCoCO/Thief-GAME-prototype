// =============================================================
// Start Game BonusAction
// -------------------------------------------------------------
// Manages the "Bonus Action" left-side button AND the bonus battle
// mode visuals.
//
// The button appears when the player has no normal way to interact
// with the monster:
//   - Case 1: monster has 0 cards in hand but cards remain on the
//             playing field. (Stalemate breaker — player is stuck.)
//   - Case 2: both sides have hand cards but no suit overlaps (the
//             original stalemate).
//
// MONSTER auto-uses bonus action in two situations:
//   - Case 1 ALWAYS auto-triggers the monster — it fires immediately
//     when the condition first becomes true, after any action.
//   - Case 2 is one of three random choices the monster picks when
//     the turn timer expires (gamble / play / bonus). The TurnTimer
//     drives this by calling window.GameBonusAction.case2Available()
//     and enterMonster() if it rolls "bonus".
//
// On click (or monster trigger) the page enters BONUS BATTLE MODE:
// the body gets a .bonus-mode class which drives CSS transforms —
// wheel slides to center, monster zooms in & shifts down, hand
// zooms up & cards fan with a pendulum sway, letterbox bars slide
// in. Then a popup "Unfinished coding part." appears with an OK
// button. Clicking OK exits the mode and reverts the visuals.
//
// SAFE TO DELETE: remove the file + its <script> tag, the button
// stays invisible and bonus mode never activates. Nothing else cares.
// =============================================================

(function () {
    "use strict";

    let btn = null;
    let bonusModeActive  = false;
    let case1Latched     = false;   // edge-triggered flag for case-1 monster auto-fire

    document.addEventListener("DOMContentLoaded", () => {
        setTimeout(init, 0);
    });

    function init() {
        btn = document.getElementById("bonus-action-btn");
        if (!btn) return;
        btn.addEventListener("click", onPlayerClick);
    }

    // -------- Visibility / condition checks --------

    function isCase1() {
        if (!window.GameActions) return false;
        const monsterHand = window.GameActions.getMonsterHand();
        const fieldCards  = document.querySelectorAll(".monster-field .card");
        return monsterHand.length === 0 && fieldCards.length > 0;
    }

    function isCase2() {
        if (!window.GameActions) return false;
        if (typeof getShapeForCard !== "function") return false;
        const monsterHand = window.GameActions.getMonsterHand();
        if (monsterHand.length === 0) return false;

        const playerSuits = new Set();
        document.querySelectorAll(".hand .card").forEach((c) => {
            const shape = c.dataset.shape;
            if (shape) playerSuits.add(shape);
        });
        if (playerSuits.size === 0) return false;

        for (const id of monsterHand) {
            if (playerSuits.has(getShapeForCard(id))) return false;
        }
        return true;
    }

    function shouldShowButton() {
        return isCase1() || isCase2();
    }

    // -------- Public update hook --------

    function update() {
        if (!btn) return;

        // Show/hide the button.
        if (shouldShowButton()) {
            btn.classList.add("visible");
            btn.setAttribute("aria-hidden", "false");
        } else {
            btn.classList.remove("visible");
            btn.setAttribute("aria-hidden", "true");
        }

        // Edge-triggered case 1: when case1 becomes true after being
        // false, the monster auto-fires the bonus action. While case 1
        // remains true (or bonus mode is active), don't refire.
        const case1Now = isCase1();
        if (case1Now && !case1Latched && !bonusModeActive) {
            case1Latched = true;
            setTimeout(triggerMonsterBonus, 700);
        } else if (!case1Now) {
            case1Latched = false;
        }
    }

    // -------- Entering / exiting bonus mode --------

    function enterBonusMode() {
        if (bonusModeActive) return;
        bonusModeActive = true;
        document.body.classList.add("bonus-mode");
    }

    function exitBonusMode() {
        if (!bonusModeActive) return;
        bonusModeActive = false;
        document.body.classList.remove("bonus-mode");
        // The exit might change the case-1 condition; reset the latch so
        // a later re-entry into case 1 can fire again.
        case1Latched = isCase1();
        // Hand control back to normal flow: re-check defeat, restart the
        // idle pressure timer, and refresh the bonus button's visibility.
        if (window.GameTurnTimer) {
            if (typeof window.GameTurnTimer.checkDefeat === "function") {
                window.GameTurnTimer.checkDefeat();
            }
            if (typeof window.GameTurnTimer.start === "function") {
                window.GameTurnTimer.start();
            }
        }
        update();
    }

    function showDisclaimer(message) {
        if (window.GameActions && typeof GameActions.showPopup === "function") {
            GameActions.showPopup(message, { needsOk: true, onOk: exitBonusMode });
        } else {
            setTimeout(exitBonusMode, 2500);
        }
    }

    // -------- Trigger entry points --------

    function onPlayerClick() {
        if (bonusModeActive) return;
        enterBonusMode();
        // Hand off to the snatch-and-guess minigame if it's loaded.
        if (window.GameBonusBattle && typeof GameBonusBattle.start === "function") {
            GameBonusBattle.start("player");
        } else {
            showDisclaimer("Unfinished coding part.");
        }
    }

    // Case 1 — monster auto-fires immediately.
    function triggerMonsterBonus() {
        if (bonusModeActive) return;
        enterBonusMode();
        if (window.GameBonusBattle && typeof GameBonusBattle.start === "function") {
            GameBonusBattle.start("monster");
        } else {
            showDisclaimer(
                "Monster used Bonus Action!\n(Unfinished coding part.)"
            );
        }
    }

    // Case 2 — called by TurnTimer when it rolls "bonus" as the monster's
    // free-turn choice. Same behavior as case 1's trigger.
    function enterMonster() {
        triggerMonsterBonus();
    }

    // -------- Public API --------
    window.GameBonusAction = {
        update,
        enterMonster,
        case2Available: isCase2,
        case1Available: isCase1,
        isActive: () => bonusModeActive,
    };

})();
