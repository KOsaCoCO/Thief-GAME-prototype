// =============================================================
// Start Game BonusAction
// -------------------------------------------------------------
// Manages the "Bonus Action" left-side button AND the bonus battle
// mode visuals.
//
// PURPOSE: a short, scripted INTERRUPT to the main game. While
// bonus mode is active the idle pressure timer is paused; on exit
// the timer is restarted and normal play resumes. Nothing else in
// the codebase needs to know about bonus mode — enterBonusMode()
// and exitBonusMode() are the single source of truth for the
// timer's stop/start around a bonus session.
//
// SHOWN when the player has no normal way to interact with the
// monster:
//   - Case 1: monster has 0 hand cards but cards remain on the
//             playing field. (Stalemate breaker.)
//   - Case 2: both sides have hand cards but no suit overlaps.
//
// MONSTER auto-uses bonus action:
//   - Case 1 ALWAYS auto-triggers when the condition first becomes
//     true.
//   - Case 2 is one of three random monster picks on timer expiry
//     (gamble / play / bonus).
//
// On click (or monster trigger) the page enters BONUS BATTLE MODE
// and hands off to GameBonusBattle. When that finishes it calls
// exitBonusMode() and we return to the regular idle-pressure loop.
//
// SAFE TO DELETE: remove the file + its <script> tag, the button
// never appears and bonus mode never activates.
// =============================================================

(function () {
    "use strict";

    // 1-second cooldown after bonus mode exits before the idle-pressure
    // timer is re-armed. Gives the bonus battle's outro visuals (banner
    // slide-out, popup OK, special card shimmer) a moment to settle
    // before the monster's turn timer starts ticking again.
    const POST_BONUS_PAUSE_MS = 1000;

    let btn = null;
    let bonusModeActive  = false;
    let case1Latched     = false;   // edge-triggered flag for case-1 monster auto-fire
    let exitTimeoutHandle = null;   // pending post-bonus timer restart

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

    // The button only shows when (a) bonus mode is NOT active, (b) a
    // play-card battle is NOT active (bonus would otherwise stomp the
    // battle's state), and (c) one of the stalemate conditions is true.
    function shouldShowButton() {
        if (bonusModeActive) return false;
        if (window.GamePlay && typeof GamePlay.isActive === "function" && GamePlay.isActive()) {
            return false;
        }
        return isCase1() || isCase2();
    }

    function setButtonVisible(visible) {
        if (!btn) return;
        if (visible) {
            btn.classList.add("visible");
            btn.style.pointerEvents = "auto";
            btn.setAttribute("aria-hidden", "false");
            btn.disabled = false;
        } else {
            btn.classList.remove("visible");
            btn.style.pointerEvents = "none";
            btn.setAttribute("aria-hidden", "true");
        }
    }

    // -------- Public update hook --------

    function update() {
        if (!btn) return;
        setButtonVisible(shouldShowButton());

        // Edge-triggered case 1: when case1 becomes true after being
        // false, the monster auto-fires the bonus action. Suppressed if:
        //   - bonus mode is already active (it'd re-enter)
        //   - the player is mid-action (choice modal open, gamble in
        //     flight) — would orphan their UI
        //   - a play-card battle is in flight
        // When the suppressing condition clears, actionEnded / endBattle
        // call update() again and the latch finally fires.
        const case1Now = isCase1();
        const playerActing = window.GameActions
            && typeof GameActions.isActing === "function"
            && GameActions.isActing();
        const playInPlay = window.GamePlay
            && typeof GamePlay.isActive === "function"
            && GamePlay.isActive();
        if (case1Now && !case1Latched && !bonusModeActive && !playerActing && !playInPlay) {
            case1Latched = true;
            setTimeout(() => {
                // Re-check at fire time — the player or a play-card
                // battle may have started in the 700ms window.
                if (bonusModeActive) return;
                if (window.GameActions && typeof GameActions.isActing === "function" && GameActions.isActing()) {
                    case1Latched = false;
                    return;
                }
                if (window.GamePlay && typeof GamePlay.isActive === "function" && GamePlay.isActive()) {
                    case1Latched = false;
                    return;
                }
                triggerMonsterBonus();
            }, 700);
        } else if (!case1Now) {
            case1Latched = false;
        }
    }

    // -------- Entering / exiting bonus mode --------
    //
    // These are THE gates. enterBonusMode is the ONLY place that
    // stops the main-game timer for bonus reasons, and exitBonusMode
    // is the ONLY place that restarts it after a bonus session.

    function enterBonusMode() {
        if (bonusModeActive) return;
        // If a prior exit was mid post-bonus pause, cancel its pending
        // timer restart — we're re-entering bonus before the pause
        // finished, so the monster's timer should stay paused.
        if (exitTimeoutHandle) {
            clearTimeout(exitTimeoutHandle);
            exitTimeoutHandle = null;
        }
        bonusModeActive = true;
        document.body.classList.add("bonus-mode");
        // Hide the button immediately — no chance of a stray re-click
        // while we're inside.
        setButtonVisible(false);
        // Pause the idle-pressure timer for the duration of bonus mode.
        // The monster cannot auto-act during bonus mode because the
        // timer is stopped here and the only thing that restarts it
        // is exitBonusMode (after the post-bonus pause).
        if (window.GameTurnTimer && typeof GameTurnTimer.stop === "function") {
            GameTurnTimer.stop();
        }

        // Bonus mode is a HARD INTERRUPT. Wipe any in-flight player
        // action state so a stuck predictionInProgress lock can't
        // silently block hand clicks after we exit. Without this scrub,
        // chained bonus actions over an interrupted choice modal leave
        // the prediction lock stuck true and the post-bonus choice
        // modal never opens again.
        if (window.GameActions && typeof GameActions.releaseLock === "function") {
            GameActions.releaseLock();
        }
        const modal = document.getElementById("play-choice-modal");
        if (modal) {
            modal.classList.remove("visible");
            modal.setAttribute("aria-hidden", "true");
        }
        const arrows = document.getElementById("wheel-arrows");
        if (arrows) arrows.classList.remove("visible");
        document.querySelectorAll(".hand .card.gamble-selected").forEach((c) => {
            c.classList.remove("gamble-selected");
        });
    }

    // Idempotent: safe to call multiple times. Strips the body class
    // and clears the active flag IMMEDIATELY, then queues a 1-second
    // delayed restart of the idle pressure timer so the bonus battle's
    // outro visuals can finish cleanly before the monster's turn timer
    // is back on.
    function exitBonusMode() {
        // Always scrub the body class — covers the case where a stray
        // earlier path left it set.
        document.body.classList.remove("bonus-mode");

        const wasActive = bonusModeActive;
        bonusModeActive = false;

        // The exit might change the case-1 condition; reset the latch so
        // a later re-entry into case 1 can fire again.
        case1Latched = isCase1();

        // Cancel any prior pending restart and queue a fresh one. Multiple
        // exitBonusMode calls collapse into a single delayed restart.
        if (exitTimeoutHandle) clearTimeout(exitTimeoutHandle);
        exitTimeoutHandle = setTimeout(() => {
            exitTimeoutHandle = null;

            if (window.GameTurnTimer) {
                if (typeof GameTurnTimer.checkDefeat === "function") {
                    GameTurnTimer.checkDefeat();
                }
                // If the player jumped in during the pause and is mid-
                // decision, skip the restart — their actionEnded will
                // start the timer when they finish. Otherwise re-arm
                // the idle pressure timer so monster auto-actions resume.
                const playerActing = window.GameActions
                    && typeof GameActions.isActing === "function"
                    && GameActions.isActing();
                if (!playerActing && typeof GameTurnTimer.start === "function") {
                    GameTurnTimer.start();
                }
            }
            update();
        }, POST_BONUS_PAUSE_MS);

        if (wasActive) {
            console.log("[bonusaction] exited bonus mode, " + POST_BONUS_PAUSE_MS + "ms pause -> timer back on");
        }
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
            showDisclaimer("Monster used Bonus Action!\n(Unfinished coding part.)");
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
        // Exposed so BonusBattle (and future modes) can route through
        // the canonical exit path.
        exitBonusMode,
    };

})();
