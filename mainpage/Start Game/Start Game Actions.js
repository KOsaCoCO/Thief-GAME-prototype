// =============================================================
// Start Game Actions
// -------------------------------------------------------------
// Game logic / card actions for the Start Game page.
//
// SEPARATE from "Start Game.js" on purpose — modify freely, or
// delete the file + its <script> tag if it ever breaks. The
// scene rendering, parallax, monster image, buff-slot box, and
// random hand draw will all keep working without this file.
//
// Requires globals from Start Game.js: getShapeForCard(), paintCard().
//
// Turn flow per player click on a card in their hand:
//   1. The player's card has a suit S and number N. The arrow buttons
//      on the wheel ask the player to call "high" or "low" — predicting
//      whether the monster has a same-suit card with a HIGHER or LOWER
//      number than N.
//   2. The check evaluates both SUIT and DIRECTION against the monster's
//      current hand:
//        - CORRECT (suit + direction): the monster has at least one
//          card of suit S whose number satisfies the call. The wheel
//          spins to the call's color (green = HIGH, red = LOW), the
//          slot for that monster card does the anticipation "jump"
//          animation, and the card lands on the playing field.
//        - WRONG DIRECTION (suit matches but every same-suit monster
//          card goes the opposite way): the wheel spins to the
//          OPPOSITE color so the player can see they guessed wrong,
//          and the monster takes the player's clicked card.
//        - NO SUIT MATCH (the monster has no cards of suit S at all):
//          a popup explains it, no wheel spin, then the monster takes
//          the player's clicked card.
//        - MONSTER HAND EMPTY: a popup says so and the play is aborted.
//
// The box auto-expands when the monster wins a card off the player,
// and shrinks when the monster plays a card to the field.
// =============================================================

(function () {
    "use strict";

    const TOTAL_CARDS    = 36;
    const INITIAL_HAND   = 6;

    // Timings (ms) — tune freely
    const REVEAL_HOLD_MS   = 400;   // pause showing the sign before the jump
    const JUMP_DURATION_MS = 600;   // must match the slotJump CSS animation
    const LOSE_DURATION_MS = 350;   // must match the cardLose CSS animation
    const APPEAR_DURATION_MS = 300; // must match the slotAppear CSS animation
    const POPUP_DURATION_MS  = 2400;
    const POPUP_LOSE_DELAY   = 1300; // how long to wait inside popup before the card-loss kicks in
    const POST_SPIN_HOLD_MS  = 600;  // pause between wheel landing and the actual outcome

    // The monster's CURRENT hand of card IDs.
    // Starts with INITIAL_HAND random cards; grows when the monster
    // wins one off the player, shrinks when the monster plays one.
    let monsterHand = [];

    document.addEventListener("DOMContentLoaded", init);

    function init() {
        monsterHand = pickInitialMonsterHand();
        wireCardClicks();

        // Sanity check — log both hands and verify they're disjoint.
        const playerIds = getPlayerCardIds();
        const overlap = monsterHand.filter((id) => playerIds.has(id));
        console.log("[actions] Player hand:",  [...playerIds].sort((a, b) => a - b));
        console.log("[actions] Monster hand:", [...monsterHand].sort((a, b) => a - b));
        if (overlap.length > 0) {
            console.warn("[actions] Duplicate cards across hands:", overlap);
        }
    }

    // -------- Setup --------

    // The 36 cards are a shared pool — the monster must draw from
    // the cards NOT already in the player's hand. Reads the player's
    // hand from the DOM (rendered by Start Game.js a moment earlier).
    function pickInitialMonsterHand() {
        const taken = getPlayerCardIds();

        const available = [];
        for (let i = 1; i <= TOTAL_CARDS; i++) {
            if (!taken.has(i)) available.push(i);
        }

        // Safety: with a 5-card player hand we have 31 cards left,
        // plenty for the monster's 6. But guard against future tweaks.
        if (available.length < INITIAL_HAND) {
            console.warn(
                `[actions] Only ${available.length} cards left after the player draw — ` +
                `not enough for a monster hand of ${INITIAL_HAND}.`
            );
        }

        // Fisher–Yates shuffle, then take the first INITIAL_HAND.
        for (let i = available.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [available[i], available[j]] = [available[j], available[i]];
        }
        return available.slice(0, INITIAL_HAND);
    }

    // The player's currently-dealt card IDs, read from the rendered hand.
    function getPlayerCardIds() {
        const ids = new Set();
        document.querySelectorAll(".hand .card").forEach((card) => {
            const id = Number(card.dataset.cardId);
            if (!Number.isNaN(id)) ids.add(id);
        });
        return ids;
    }

    // Prevent overlapping clicks while a prediction sequence is mid-flight
    let predictionInProgress = false;

    function wireCardClicks() {
        const hand = document.getElementById("hand");
        if (!hand) return;
        hand.addEventListener("click", (e) => {
            const card = e.target.closest(".card");
            if (!card) return;
            if (card.classList.contains("losing")) return;
            if (predictionInProgress) return;
            // Player has begun acting — stop the idle pressure timer.
            if (window.GameTurnTimer) window.GameTurnTimer.stop();
            onCardClicked(card);
        });
    }

    // Called whenever a player-initiated action finishes. Releases the
    // prediction lock, clears any gamble-highlighted card, checks for
    // monster defeat, and restarts the idle pressure timer (which will
    // no-op if the monster has been defeated).
    function actionEnded() {
        document.querySelectorAll(".hand .card.gamble-selected").forEach((c) => {
            c.classList.remove("gamble-selected");
        });
        predictionInProgress = false;
        if (window.GameTurnTimer) {
            if (typeof window.GameTurnTimer.checkDefeat === "function") {
                window.GameTurnTimer.checkDefeat();
            }
            window.GameTurnTimer.start();
        }
    }

    // -------- Prediction-wheel flow --------
    // Player clicks a card -> arrows appear -> player picks high/low ->
    // wheel stops on the truth color -> existing playCard() runs.

    function onCardClicked(cardEl) {
        predictionInProgress = true;
        showChoiceModal((choice) => {
            if (choice === "gamble") {
                // Jut the chosen card out so the player sees which one is at stake.
                cardEl.classList.add("gamble-selected");
                showPredictionArrows((playerCall) => resolvePlay(cardEl, playerCall));
            } else if (choice === "play") {
                if (window.GamePlay && typeof window.GamePlay.enterPlayMode === "function") {
                    window.GamePlay.enterPlayMode(cardEl, actionEnded);
                } else {
                    showPopup("Play-Card mode is unavailable.");
                    setTimeout(actionEnded, POPUP_DURATION_MS);
                }
            } else {
                // Cancel — back to idle, restart the timer.
                actionEnded();
            }
        });
    }

    // -------- Choice modal: Play Card vs Gamble --------
    function showChoiceModal(onChoice) {
        const modal     = document.getElementById("play-choice-modal");
        const playBtn   = document.getElementById("choice-play");
        const gambleBtn = document.getElementById("choice-gamble");
        const cancelBtn = document.getElementById("choice-cancel");
        if (!modal || !playBtn || !gambleBtn || !cancelBtn) {
            // Fallback: skip modal and gamble directly so nothing breaks
            onChoice("gamble");
            return;
        }

        modal.classList.add("visible");
        modal.setAttribute("aria-hidden", "false");

        const close = (choice) => {
            modal.classList.remove("visible");
            modal.setAttribute("aria-hidden", "true");
            playBtn.removeEventListener("click", onPlay);
            gambleBtn.removeEventListener("click", onGamble);
            cancelBtn.removeEventListener("click", onCancel);
            document.removeEventListener("keydown", onKey);
            modal.removeEventListener("click", onBackdrop);
            onChoice(choice);
        };
        const onPlay    = () => close("play");
        const onGamble  = () => close("gamble");
        const onCancel  = () => close("cancel");
        const onKey     = (e) => { if (e.key === "Escape") close("cancel"); };
        const onBackdrop = (e) => { if (e.target === modal) close("cancel"); };

        playBtn.addEventListener("click", onPlay);
        gambleBtn.addEventListener("click", onGamble);
        cancelBtn.addEventListener("click", onCancel);
        document.addEventListener("keydown", onKey);
        modal.addEventListener("click", onBackdrop);
    }

    // -------- Game outcome resolution --------
    //
    // Rules:
    //   - Player's card has suit S and number N, and they call "high" or "low".
    //   - We look at the monster's CURRENT hand for cards with suit S.
    //   - If at least one of those matches the call direction
    //         (high => monster's number > N, low => monster's number < N)
    //     the call is CORRECT: the monster plays one of those cards.
    //   - If the monster has same-suit cards but NONE in the correct direction
    //     (e.g. you called "low" but every same-suit monster card is higher),
    //     the call is WRONG: the monster takes the player's clicked card.
    //   - If the monster has NO same-suit cards at all, show a popup explaining
    //     it, then the monster still takes the player's card.
    //   - If the monster has no cards at all, show a popup and abort the play.

    function resolvePlay(cardEl, playerCall) {
        const cardId = Number(cardEl.dataset.cardId);
        const shape  = cardEl.dataset.shape;
        console.log(`[actions] Player clicked ${cardId} (${shape}), called ${playerCall.toUpperCase()}`);

        // Edge case: monster has nothing left.
        if (monsterHand.length === 0) {
            showPopup("The monster has no cards left.");
            setTimeout(actionEnded, POPUP_DURATION_MS);
            return;
        }

        const sameSuit = monsterHand.filter((id) => getShapeForCard(id) === shape);

        // No same-suit monster card at all → popup, then player still loses.
        if (sameSuit.length === 0) {
            const word = suitWord(shape);
            showPopup(`The monster has no ${word} cards.\nYou lose this card.`);
            setTimeout(() => {
                playerLosesCard(cardEl, cardId, shape);
            }, POPUP_LOSE_DELAY);
            setTimeout(actionEnded, POPUP_DURATION_MS);
            return;
        }

        // Cards that satisfy BOTH the suit AND the call direction.
        const correctMatches = (playerCall === "high")
            ? sameSuit.filter((id) => id > cardId)
            : sameSuit.filter((id) => id < cardId);

        // Wheel direction reflects the TRUTH about the monster's same-suit card
        // relative to the player's card:
        //   - If the call lined up, the truth matches the call.
        //   - If the call was wrong (all same-suit monster cards go the other
        //     way), the truth is the opposite of the call.
        const wheelDirection = (correctMatches.length > 0)
            ? playerCall
            : (playerCall === "high" ? "low" : "high");

        const isHigher = (wheelDirection === "high");

        spinWheelToResult(isHigher).then(() => {
            setTimeout(() => {
                if (correctMatches.length > 0) {
                    const monsterCardId = correctMatches[
                        Math.floor(Math.random() * correctMatches.length)
                    ];
                    console.log(`[actions] Correct ${playerCall} call -> monster plays ${monsterCardId}`);
                    monsterPlaysCard(monsterCardId);
                } else {
                    console.log(`[actions] Wrong ${playerCall} call (suit matched, direction off) -> player loses card`);
                    playerLosesCard(cardEl, cardId, shape);
                }
                actionEnded();
            }, POST_SPIN_HOLD_MS);
        });
    }

    function suitWord(shape) {
        if (shape === "circle")   return "circle";
        if (shape === "square")   return "square";
        if (shape === "triangle") return "triangle";
        return shape;
    }

    // -------- Status popup --------

    let popupTimer = null;
    // showPopup(message)                       -> default duration auto-dismiss
    // showPopup(message, 5000)                 -> custom duration auto-dismiss
    // showPopup(message, { needsOk: true })    -> stays open until the OK button is clicked
    function showPopup(message, options) {
        const popup  = document.getElementById("game-popup");
        const textEl = document.getElementById("popup-text");
        const okBtn  = document.getElementById("popup-ok");
        if (!popup || !textEl) return;

        // Resolve the call form
        const opts = (typeof options === "number")
            ? { durationMs: options }
            : (options || {});
        const needsOk = opts.needsOk === true;
        const ms = (typeof opts.durationMs === "number" && opts.durationMs > 0)
            ? opts.durationMs
            : POPUP_DURATION_MS;

        textEl.textContent = message;
        popup.classList.add("visible");
        if (popupTimer) { clearTimeout(popupTimer); popupTimer = null; }

        if (okBtn) {
            okBtn.onclick = null;
            okBtn.hidden  = !needsOk;
            if (needsOk) {
                const userOk = (typeof opts.onOk === "function") ? opts.onOk : null;
                okBtn.onclick = () => {
                    popup.classList.remove("visible");
                    okBtn.hidden = true;
                    okBtn.onclick = null;
                    if (userOk) userOk();
                };
            }
        }

        if (!needsOk) {
            popupTimer = setTimeout(() => {
                popup.classList.remove("visible");
                popupTimer = null;
            }, ms);
        }
    }

    function showPredictionArrows(onChoice) {
        const arrows = document.getElementById("wheel-arrows");
        if (!arrows) return;
        arrows.classList.add("visible");

        const handler = (e) => {
            const btn = e.target.closest(".wheel-arrow");
            if (!btn) return;
            arrows.classList.remove("visible");
            arrows.removeEventListener("click", handler);
            onChoice(btn.dataset.call);     // "high" or "low"
        };
        arrows.addEventListener("click", handler);
    }

    // Reads the disc's current rotation (set by the CSS idle-spin animation),
    // freezes it, then animates from there to the target angle so the spin
    // looks continuous instead of snapping back to 0.
    function spinWheelToResult(isHigher) {
        const wheel = document.getElementById("prediction-wheel");
        const disc  = document.getElementById("wheel-disc");
        if (!wheel || !disc) return Promise.resolve();

        const currentDeg = readRotationDeg(disc);

        // Stop the CSS-driven idle spin and pin the disc to its current angle
        wheel.classList.remove("idle-spinning");
        disc.style.transform = `rotate(${currentDeg}deg)`;
        void disc.offsetWidth;              // force layout flush

        // Target: 0° = green visible (HIGH truth), 180° = red visible (LOW truth).
        const targetFinalAngle = isHigher ? 0 : 180;
        const FULL_TURNS = 360 * 3;
        const norm = ((currentDeg % 360) + 360) % 360;
        const delta = ((targetFinalAngle - norm) + 360) % 360;
        const target = currentDeg + FULL_TURNS + delta;

        return new Promise((resolve) => {
            const anim = disc.animate(
                [
                    { transform: `rotate(${currentDeg}deg)` },
                    { transform: `rotate(${target}deg)`     },
                ],
                {
                    duration: 1800,
                    easing:   "cubic-bezier(0.18, 0.85, 0.3, 1)",
                    fill:     "forwards",
                }
            );
            const finish = () => {
                disc.style.transform = `rotate(${target}deg)`;   // persist final angle
                resolve();
            };
            anim.onfinish = finish;
            // Fallback in case onfinish doesn't fire
            setTimeout(finish, 1900);
        });
    }

    // Pull a numeric rotation in degrees out of an element's current matrix transform.
    function readRotationDeg(el) {
        const t = getComputedStyle(el).transform;
        if (!t || t === "none") return 0;
        const m = t.match(/matrix\(([^)]+)\)/);
        if (!m) return 0;
        const parts = m[1].split(",").map(Number);
        const a = parts[0], b = parts[1];
        return Math.atan2(b, a) * 180 / Math.PI;
    }

    // -------- Monster plays a card --------

    function monsterPlaysCard(cardId) {
        // If this card already has a revealed slot, reuse it.
        let slot = findSlotByCardId(cardId);

        // Otherwise the card was hidden — turn one "?" slot into its sign.
        if (!slot) slot = assignHiddenSlotToCard(cardId);

        if (!slot) {
            console.warn("[actions] No slot available for monster card", cardId);
            return;
        }

        // Brief pause so the player registers the sign, then jump, then play.
        setTimeout(() => {
            animateJump(slot, () => {
                // Remove from monster hand
                const idx = monsterHand.indexOf(cardId);
                if (idx >= 0) monsterHand.splice(idx, 1);
                // Slot disappears
                slot.remove();
                // Card lands on the playing field
                placeMonsterCard(cardId);
            });
        }, REVEAL_HOLD_MS);
    }

    function findSlotByCardId(cardId) {
        return document.querySelector(
            `.monster-box .slot[data-card-id="${cardId}"]`
        );
    }

    // Pick a still-"?" slot and assign this card's sign to it.
    function assignHiddenSlotToCard(cardId) {
        const unknown = document.querySelectorAll(
            ".monster-box .slot:not([data-card-id])"
        );
        if (unknown.length === 0) return null;

        const slot  = unknown[Math.floor(Math.random() * unknown.length)];
        const shape = getShapeForCard(cardId);
        slot.textContent     = shapeSymbol(shape);
        slot.dataset.cardId  = cardId;
        slot.classList.add("revealed");
        if (typeof isSpecialCard === "function" && isSpecialCard(cardId)) {
            slot.classList.add("special");
        }
        return slot;
    }

    function shapeSymbol(shape) {
        if (shape === "circle")   return "●";
        if (shape === "square")   return "■";
        if (shape === "triangle") return "▲";
        return "?";
    }

    function animateJump(slot, onComplete) {
        slot.classList.add("jumping");
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            slot.classList.remove("jumping");
            if (onComplete) onComplete();
        };
        slot.addEventListener("animationend", finish, { once: true });
        setTimeout(finish, JUMP_DURATION_MS + 60);   // fallback
    }

    // -------- Player loses a card --------

    function playerLosesCard(cardEl, cardId, shape) {
        // Animate the player's card disappearing from the hand
        cardEl.classList.add("losing");
        setTimeout(() => cardEl.remove(), LOSE_DURATION_MS);

        // The monster gains the card: add a new (already-revealed) slot
        // to its box. Both sides know what the card was, so we show
        // its sign immediately instead of a "?".
        monsterHand.push(cardId);
        addRevealedSlot(cardId, shape);
    }

    function addRevealedSlot(cardId, shape) {
        const box = document.getElementById("monster-box");
        if (!box) return;

        const slot = document.createElement("span");
        slot.className = "slot revealed new-slot";
        slot.dataset.cardId = cardId;
        slot.textContent = shapeSymbol(shape);
        if (typeof isSpecialCard === "function" && isSpecialCard(cardId)) {
            slot.classList.add("special");
        }
        box.appendChild(slot);

        // Strip the entrance-animation class once it's finished
        setTimeout(() => slot.classList.remove("new-slot"), APPEAR_DURATION_MS + 40);
    }

    // -------- Playing field --------

    // Field cards are tagged with data-owner ("monster" by default) so the
    // play-card battle can tell whose card is whose for the suit-hierarchy
    // targeting.
    function placeMonsterCard(cardId, owner) {
        const field = document.getElementById("monster-field");
        if (!field) return;
        if (typeof getShapeForCard !== "function" || typeof paintCard !== "function") {
            console.warn("[actions] Missing helpers from Start Game.js");
            return;
        }

        const shape = getShapeForCard(cardId);
        const card = document.createElement("div");
        card.className = `card shape-${shape}`;
        card.dataset.cardId = cardId;
        card.dataset.shape  = shape;
        card.dataset.owner  = (owner === "player") ? "player" : "monster";
        paintCard(card, cardId, shape);
        field.appendChild(card);
    }

    // -------- Public API --------
    // Used both for console debugging AND as the bridge that Start Game
    // PlayCard.js calls into (it needs to mutate the same monsterHand and
    // reuse the same field/box rendering).
    window.GameActions = {
        resolvePlay,                // resolvePlay(cardEl, "high"|"low")
        showPopup,
        getMonsterHand: () => [...monsterHand],
        getRevealedIds: () =>
            Array.from(document.querySelectorAll(".monster-box .slot[data-card-id]"))
                .map((s) => Number(s.dataset.cardId)),

        // For PlayCard.js — keep these as tiny adapters so the bigger
        // file doesn't have to know how state is stored here.
        removeFromMonsterHand: (cardId) => {
            const idx = monsterHand.indexOf(cardId);
            if (idx >= 0) monsterHand.splice(idx, 1);
        },
        removeMonsterSlotByCardId: (cardId) => {
            const slot = document.querySelector(
                `.monster-box .slot[data-card-id="${cardId}"]`
            );
            if (slot) slot.remove();
        },
        // Drops one still-"?" slot from the box. Used when a monster card
        // leaves the hand to the field while still hidden to the player
        // (e.g. during the initial setup).
        removeOneHiddenSlot: () => {
            const slot = document.querySelector(
                ".monster-box .slot:not([data-card-id])"
            );
            if (slot) slot.remove();
        },
        // Removes one slot representing the given card — either its
        // revealed (data-card-id) slot, OR if the card was still hidden,
        // any "?" slot. Used by the turn timer's auto-actions.
        dropMonsterSlot: (cardId) => {
            let slot = document.querySelector(
                `.monster-box .slot[data-card-id="${cardId}"]`
            );
            if (!slot) {
                slot = document.querySelector(".monster-box .slot:not([data-card-id])");
            }
            if (slot) slot.remove();
        },
        // Force-release the prediction lock. Used by the turn timer when
        // it auto-closes the choice modal so subsequent hand clicks work.
        releaseLock: () => { predictionInProgress = false; },
        // Promote one of the "?" slots to a revealed sign for the given
        // card. Returns the slot element so the caller can mark it (e.g.
        // grey it out as "used" during a play-card battle).
        revealHiddenSlotForCard: assignHiddenSlotToCard,
        placeCardOnField: placeMonsterCard,   // signature: placeCardOnField(cardId, owner?)
        addToMonsterHand: (cardId) => {
            // Monster gains a card (e.g. won off the player). Adds to the
            // hand state AND to the box as a revealed slot showing its sign.
            monsterHand.push(cardId);
            if (typeof getShapeForCard === "function") {
                const shape = getShapeForCard(cardId);
                addRevealedSlot(cardId, shape);
            }
        },
        addCardToPlayerHand: (cardId) => {
            const hand = document.getElementById("hand");
            if (!hand) return;
            if (typeof getShapeForCard !== "function" || typeof paintCard !== "function") return;
            const shape = getShapeForCard(cardId);
            const card = document.createElement("div");
            card.className = `card shape-${shape} arriving`;
            card.dataset.cardId = cardId;
            card.dataset.shape  = shape;
            paintCard(card, cardId, shape);
            hand.appendChild(card);
            setTimeout(() => card.classList.remove("arriving"), 450);
        },
    };

})();
