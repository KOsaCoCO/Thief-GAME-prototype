// =============================================================
// Start Game Setup
// -------------------------------------------------------------
// Runs ONCE at the start of the game:
//   1. Shows the "Choose your 2 challenge cards" modal (with a brief
//      rules reminder).
//   2. Blocks the normal hand-click handler (capture phase) while
//      the player picks 2 hand cards. Each click toggles a selection;
//      the Confirm button enables once exactly 2 are selected.
//   3. On Confirm: the 2 selected hand cards move to the playing field
//      as player-owned. The monster then picks 2 random cards from its
//      own hand, removes their slots from the box, and places them on
//      the field as monster-owned.
//   4. A follow-up popup tells the player to take their cards back
//      (and the monster's too), suggesting Gamble for unknowns.
//
// SAFE TO DELETE: remove this file and its <script> tag from the HTML
// and the game just starts with an empty field — Gamble and Play Card
// (when the field has cards) keep working.
// =============================================================

(function () {
    "use strict";

    const REQUIRED_PICKS   = 2;
    const MONSTER_PICKS    = 2;
    const SECOND_POPUP_MS  = 5000;   // longer than the default so the player can read it

    let selected   = new Set();      // selected hand card elements
    let active     = false;          // setup-mode active flag
    let handEl     = null;
    let modalEl    = null;
    let countEl    = null;
    let confirmEl  = null;

    document.addEventListener("DOMContentLoaded", () => {
        // Defer one tick so Start Game.js / Actions.js have already rendered the hand.
        setTimeout(startSetup, 0);
    });

    function startSetup() {
        handEl    = document.getElementById("hand");
        modalEl   = document.getElementById("setup-modal");
        countEl   = document.getElementById("setup-count");
        confirmEl = document.getElementById("setup-confirm");
        if (!handEl || !modalEl || !confirmEl) {
            console.warn("[setup] required elements missing — skipping setup");
            return;
        }

        active = true;

        // Show the modal
        modalEl.classList.add("visible");
        modalEl.setAttribute("aria-hidden", "false");

        // Intercept hand clicks in capture phase so the choice modal
        // (Actions.js) doesn't open during setup.
        handEl.addEventListener("click", onHandClickSetup, true);

        // Confirm
        confirmEl.addEventListener("click", onConfirm);
    }

    function onHandClickSetup(e) {
        const card = e.target.closest(".hand .card");
        if (!card) return;
        // ALWAYS block propagation while the setup handler is attached, so
        // Actions.js can't open the choice modal during the pick phase OR
        // during the post-confirm animations.
        e.stopPropagation();
        if (!active) return;

        if (selected.has(card)) {
            selected.delete(card);
            card.classList.remove("setup-selected");
        } else if (selected.size < REQUIRED_PICKS) {
            selected.add(card);
            card.classList.add("setup-selected");
        } else {
            if (window.GameActions) {
                GameActions.showPopup(`You can only pick ${REQUIRED_PICKS} cards.`);
            }
        }

        updateCounter();
    }

    function updateCounter() {
        if (countEl) countEl.textContent = String(selected.size);
        if (confirmEl) confirmEl.disabled = (selected.size !== REQUIRED_PICKS);
    }

    function onConfirm() {
        if (!active || selected.size !== REQUIRED_PICKS) return;
        if (!window.GameActions) {
            console.warn("[setup] window.GameActions not available");
            cleanup();
            return;
        }

        // From here on the capture handler still swallows hand clicks, but
        // active=false so they won't toggle any selection.
        active = false;
        confirmEl.disabled = true;

        // Hide the modal first
        modalEl.classList.remove("visible");
        modalEl.setAttribute("aria-hidden", "true");

        // Place the player's picks on the field (player-owned).
        // Iterating selected (a Set) is insertion-order so picks land in the same order.
        for (const card of selected) {
            const cardId = Number(card.dataset.cardId);
            card.classList.add("losing");
            setTimeout(() => card.remove(), 300);
            GameActions.placeCardOnField(cardId, "player");
        }

        // Brief beat, then the monster places its 2 picks.
        setTimeout(placeMonsterPicks, 700);
    }

    function placeMonsterPicks() {
        const monsterHand = GameActions.getMonsterHand();
        const picks = pickRandomSubset(monsterHand, MONSTER_PICKS);

        picks.forEach((cardId, i) => {
            setTimeout(() => {
                // Take the card out of the monster's hand AND drop one
                // hidden "?" slot from the box.
                GameActions.removeFromMonsterHand(cardId);
                GameActions.removeOneHiddenSlot();
                GameActions.placeCardOnField(cardId, "monster");
            }, i * 350);
        });

        // After both monsters' cards are placed, show the second popup.
        setTimeout(() => {
            if (window.GameActions) {
                // Stays open until the player clicks OK — no auto-dismiss.
                // When OK is clicked, the idle-pressure timer starts running.
                GameActions.showPopup(
                    "Now take your cards back — and the monster's too!\n" +
                    "Use Play Card to attack what's on the field.\n" +
                    "Use Gamble if you're unsure of a monster card's value.\n\n" +
                    "Heads up: a 3-second timer runs above the monster's box.\n" +
                    "If you don't move first, the monster takes its own turn.",
                    {
                        needsOk: true,
                        onOk: () => {
                            if (window.GameTurnTimer) window.GameTurnTimer.start();
                            if (window.GameBonusAction
                                && typeof GameBonusAction.update === "function") {
                                GameBonusAction.update();
                            }
                        },
                    }
                );
            }
            cleanup();
        }, MONSTER_PICKS * 350 + 600);
    }

    function pickRandomSubset(arr, n) {
        const copy = arr.slice();
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy.slice(0, Math.min(n, copy.length));
    }

    function cleanup() {
        active = false;
        if (handEl) handEl.removeEventListener("click", onHandClickSetup, true);
        if (confirmEl) confirmEl.removeEventListener("click", onConfirm);
        // Remove any lingering setup-selected classes (cards still in hand)
        document.querySelectorAll(".hand .card.setup-selected").forEach((c) => {
            c.classList.remove("setup-selected");
        });
        selected.clear();
    }

    // -------- Public API (for console testing / restart) --------
    window.GameSetup = {
        startSetup,
        isActive: () => active,
    };
})();
