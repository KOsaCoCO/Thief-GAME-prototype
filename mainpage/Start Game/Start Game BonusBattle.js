// =============================================================
// Start Game BonusBattle
// -------------------------------------------------------------
// Implements the "Snatch and Guess!" mini-battle that runs while
// bonus mode is active.
//
// Entry: window.GameBonusAction calls GameBonusBattle.start() right
// after it adds the .bonus-mode class to <body>.
//
// Phases (each awaits the previous):
//   1. Suspend normal flow — TurnTimer stops, monster auto-actions
//      are paused (TurnTimer.start() no-ops while we own the screen).
//   2. Flip every field card to its sleeve side and shuffle them
//      around with several random transform passes. They settle
//      back into their flex slots when shuffling finishes.
//   3. Big countdown digit pops in/out for 1, then 2, then 3.
//   4. "Snatch and Guess!" banner slides in from the right, holds
//      ~2 seconds in the middle, then slides out to the left.
//   5. Snatch phase: the wheel spins fast and shows a random suit
//      (●, ■, or ▲) that changes every 3 seconds. Clicking a field
//      card whose hidden suit matches the displayed one takes the
//      card to the player's hand. A wrong click triggers a 1-second
//      penalty (no clicks accepted).
//
// End conditions:
//   - All field cards taken -> end()
//   - GameBonusBattle.end() called externally
//
// On end, the .snatching class is removed, the suit cycle is cleared,
// any still-flipped cards are flipped back, and control is handed
// back to BonusAction.exitBonusMode() which restores normal flow.
//
// SAFE TO DELETE: remove this file + its <script> tag and BonusAction
// will fall back to its "Unfinished coding part." disclaimer popup.
// =============================================================

(function () {
    "use strict";

    const SUIT_INTERVAL_MS     = 3000;
    const PENALTY_MS           = 1000;
    const COUNTDOWN_STEP_MS    = 900;
    const BANNER_DURATION_MS   = 4000;
    const SHUFFLE_PASSES       = 4;
    const SHUFFLE_STEP_MS      = 360;
    const MONSTER_DECISION_MS  = 500;   // monster snatch tick interval
    const MONSTER_HIT_CHANCE   = 0.5;   // 50/50 per tick to grab a card
    const MONSTER_FLY_MS       = 480;   // card-to-bracket flight duration

    const SUITS   = ["circle", "square", "triangle"];
    const SYMBOLS = { circle: "●", square: "■", triangle: "▲" };

    let active = false;
    let currentSuit  = null;
    let suitIntervalId = null;
    let monsterIntervalId = null;
    let penaltyActive = false;
    let fieldClickHandler = null;

    // -------- Entry --------

    // who = "player" | "monster" — drives the intro popup text.
    async function start(who) {
        if (active) return;
        active = true;

        // 1) Brief intro popup naming who triggered the bonus battle.
        if (window.GameActions && typeof GameActions.showPopup === "function") {
            const callerText = (who === "monster")
                ? "Monster called the Bonus!"
                : "You called Bonus!";
            GameActions.showPopup(callerText);
        }

        // Make sure the timer is stopped for the duration of the battle.
        if (window.GameTurnTimer && typeof GameTurnTimer.stop === "function") {
            GameTurnTimer.stop();
        }

        // 2) Let the intro popup fade, then show the rules popup that
        //    requires an explicit OK click before the battle starts.
        await wait(2700);
        await waitForPopupOk(
            "In this mode, cards are shuffled randomly.\n" +
            "You need to guess the suit shown on the spinning wheel —\n" +
            "it changes every 3 seconds, cycling between circle, square,\n" +
            "and triangle at random.\n" +
            "Whoever ends up with more cards receives a special card."
        );

        const field = document.getElementById("monster-field");
        const fieldCards = field
            ? Array.from(field.querySelectorAll(".card"))
            : [];

        // Nothing to snatch — bail straight away.
        if (fieldCards.length === 0) {
            await showBanner("No cards on the field!");
            end(true);                  // skip the "Game's Over!" finale
            return;
        }

        // Flip + shuffle + countdown + banner -> snatch phase.
        flipCards(fieldCards);
        await shuffleCards(fieldCards);
        await runCountdown();
        await showBanner("Snatch and Guess!");
        beginSnatchPhase(field);
    }

    // -------- Small promise helpers --------

    function wait(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    function waitForPopupOk(message) {
        return new Promise((resolve) => {
            if (window.GameActions && typeof GameActions.showPopup === "function") {
                GameActions.showPopup(message, {
                    needsOk: true,
                    onOk: resolve,
                });
            } else {
                resolve();
            }
        });
    }

    // -------- End-of-battle check --------

    // Returns the count of field cards that haven't been removed AND aren't
    // currently being animated into a hand.
    function fieldCardsRemaining() {
        return document.querySelectorAll(
            ".monster-field .card:not(.losing):not(.monster-snatching)"
        ).length;
    }

    // Single source of truth for "all cards have been re-distributed".
    // Wired into the player click, the monster snatch path, the suit
    // cycle, and the monster tick — so any path leaves no stragglers.
    function checkEndCondition() {
        if (!active) return;
        if (fieldCardsRemaining() === 0) end();
    }

    async function end(skipFinale) {
        if (!active) return;
        active = false;

        stopSuitCycle();
        if (monsterIntervalId) {
            clearInterval(monsterIntervalId);
            monsterIntervalId = null;
        }
        penaltyActive = false;
        document.body.classList.remove("snatching");
        document.body.classList.remove("snatch-penalty");

        // Stop the fast-spin animation
        const wheel = document.getElementById("prediction-wheel");
        if (wheel) wheel.classList.remove("snatch-spinning");

        // Clear the suit display
        const suitEl = document.getElementById("bonus-snatch-suit");
        if (suitEl) suitEl.textContent = "";

        // Un-flip any remaining cards and clear their shuffle transforms.
        document.querySelectorAll(".monster-field .card.flipped").forEach((c) => {
            c.classList.remove("flipped");
            c.style.transform = "";
            c.style.transition = "";
        });

        // Detach the field click handler.
        const field = document.getElementById("monster-field");
        if (field && fieldClickHandler) {
            field.removeEventListener("click", fieldClickHandler);
        }
        fieldClickHandler = null;

        // Cinematic outro: first award the special card to whichever side
        // ended with more hand cards (so the player can see it appear),
        // then slide the "Game's Over!" banner. Skip both when there was
        // nothing to play with in the first place.
        if (!skipFinale) {
            try {
                awardSpecialCard();
                await wait(800);          // beat so the new card is noticeable
                await showBanner("Game's Over!");
            } catch (err) {
                console.warn("[bonus] finale error:", err);
            }
        }

        // Hand control back to BonusAction (which restores body class,
        // restarts timer, re-checks defeat). Regular play continues from
        // here until either side runs out of cards.
        if (window.GameBonusAction && typeof GameBonusAction.exitBonusMode === "function") {
            GameBonusAction.exitBonusMode();
        }
        // Defensive: ensure the bonus-mode visuals are torn down even if
        // BonusAction's exitBonusMode failed for any reason.
        document.body.classList.remove("bonus-mode");
        document.body.classList.remove("snatching");
        document.body.classList.remove("snatch-penalty");

        // BELT-AND-SUSPENDERS: re-arm the idle-pressure timer so the
        // normal-game loop resumes (player <-> monster) until either side
        // runs out of cards. Reset the speed-up counter so the next turn
        // starts at the slow 3s duration.
        if (window.GameTurnTimer) {
            if (typeof GameTurnTimer.resetPlayerCounter === "function") {
                GameTurnTimer.resetPlayerCounter();
            }
            if (typeof GameTurnTimer.checkDefeat === "function") {
                // If the bonus battle wiped out the monster, the win popup
                // appears here and start() will no-op via the defeat guard.
                GameTurnTimer.checkDefeat();
            }
            if (typeof GameTurnTimer.start === "function") {
                GameTurnTimer.start();
            }
        }
    }

    // -------- Special-card award --------
    //
    // Whichever side has more cards in hand at the end of a bonus round
    // is granted a "special" card — a face-down card with a cross on the
    // sleeve, no number, that shimmers dark red. For the player it goes
    // into the hand row; for the monster it goes into the buff-slot box
    // (slot version with a dark-red sleeve). Ties give nothing.
    function awardSpecialCard() {
        const playerHandCount = document.querySelectorAll(
            ".hand .card:not(.special-bonus-card)"
        ).length;
        const monsterHandCount = (window.GameActions && typeof GameActions.getMonsterHand === "function")
            ? GameActions.getMonsterHand().length
            : 0;

        if (monsterHandCount > playerHandCount) {
            grantSpecialToMonster();
        } else if (playerHandCount > monsterHandCount) {
            grantSpecialToPlayer();
        }
    }

    function grantSpecialToPlayer() {
        const hand = document.getElementById("hand");
        if (!hand) return;
        const card = document.createElement("div");
        card.className = "card special-bonus-card";
        const cross = document.createElement("span");
        cross.className = "special-cross";
        cross.textContent = "✕";
        card.appendChild(cross);
        hand.appendChild(card);
    }

    function grantSpecialToMonster() {
        const box = document.getElementById("monster-box");
        if (!box) return;
        const slot = document.createElement("span");
        slot.className = "slot special-bonus-slot";
        const cross = document.createElement("span");
        cross.className = "special-cross";
        cross.textContent = "✕";
        slot.appendChild(cross);
        box.appendChild(slot);
    }

    // -------- Phase 2: flip + shuffle --------

    function flipCards(cards) {
        cards.forEach((c) => c.classList.add("flipped"));
    }

    function shuffleCards(cards) {
        return new Promise((resolve) => {
            let pass = 0;
            function tick() {
                cards.forEach((card) => {
                    const x = (Math.random() - 0.5) * 220;
                    const y = (Math.random() - 0.5) * 90;
                    const r = (Math.random() - 0.5) * 32;
                    card.style.transition = `transform ${SHUFFLE_STEP_MS - 20}ms ease`;
                    card.style.transform  = `translate(${x}px, ${y}px) rotate(${r}deg)`;
                });
                pass++;
                if (pass < SHUFFLE_PASSES) {
                    setTimeout(tick, SHUFFLE_STEP_MS);
                } else {
                    // Settle: animate back to flex-default positions
                    cards.forEach((c) => { c.style.transform = ""; });
                    setTimeout(resolve, SHUFFLE_STEP_MS + 80);
                }
            }
            tick();
        });
    }

    // -------- Phase 3: countdown --------

    function runCountdown() {
        return new Promise((resolve) => {
            const el = document.getElementById("bonus-countdown");
            if (!el) { resolve(); return; }
            el.setAttribute("aria-hidden", "false");

            const numbers = [1, 2, 3];
            let i = 0;
            function step() {
                if (i >= numbers.length) {
                    el.textContent = "";
                    el.classList.remove("show");
                    el.setAttribute("aria-hidden", "true");
                    resolve();
                    return;
                }
                el.textContent = String(numbers[i]);
                // Re-trigger the keyframe animation on each digit
                el.classList.remove("show");
                void el.offsetWidth;
                el.classList.add("show");
                i++;
                setTimeout(step, COUNTDOWN_STEP_MS);
            }
            step();
        });
    }

    // -------- Phase 4: banner --------

    function showBanner(text) {
        return new Promise((resolve) => {
            const banner = document.getElementById("bonus-banner");
            if (!banner) { resolve(); return; }
            banner.textContent = text;
            banner.setAttribute("aria-hidden", "false");
            banner.classList.remove("slide-in");
            void banner.offsetWidth;
            banner.classList.add("slide-in");
            setTimeout(() => {
                banner.classList.remove("slide-in");
                banner.setAttribute("aria-hidden", "true");
                resolve();
            }, BANNER_DURATION_MS);
        });
    }

    // -------- Phase 5: snatch --------

    function beginSnatchPhase(field) {
        document.body.classList.add("snatching");

        const wheel = document.getElementById("prediction-wheel");
        if (wheel) wheel.classList.add("snatch-spinning");

        // Display first suit immediately, then cycle.
        cycleSuit();
        suitIntervalId = setInterval(cycleSuit, SUIT_INTERVAL_MS);

        fieldClickHandler = onSnatchClick;
        if (field) field.addEventListener("click", fieldClickHandler);

        // Monster also tries to snatch — every 500 ms, 50/50 to grab one
        // field card whose hidden suit matches the currently-shown suit.
        monsterIntervalId = setInterval(monsterSnatchTick, MONSTER_DECISION_MS);
    }

    // -------- Monster snatch loop --------

    function monsterSnatchTick() {
        if (!active) return;
        // Safety net: end the battle if the field is empty.
        if (fieldCardsRemaining() === 0) {
            end();
            return;
        }
        if (!currentSuit) return;
        // The monster's decision is independent of any player penalty.
        if (Math.random() >= MONSTER_HIT_CHANCE) return;

        // Find any field card matching the currently-displayed suit that
        // isn't already being snatched / removed.
        const matches = document.querySelectorAll(
            `.monster-field .card[data-shape="${currentSuit}"]:not(.losing):not(.monster-snatching)`
        );
        if (matches.length === 0) return;

        const card = matches[Math.floor(Math.random() * matches.length)];
        monsterSnatchCard(card);
    }

    // Animates a single card flying from its place on the field into the
    // monster's buff-slot box, then adds it to the monster's hand.
    function monsterSnatchCard(card) {
        const cardId = Number(card.dataset.cardId);
        const box    = document.getElementById("monster-box");
        if (!box) return;

        // Mark so the same card can't be re-targeted by the next tick
        // and so the player can't grab it mid-flight.
        card.classList.add("monster-snatching");

        const cardRect = card.getBoundingClientRect();
        const boxRect  = box.getBoundingClientRect();
        const dx = (boxRect.left + boxRect.width  / 2) -
                   (cardRect.left + cardRect.width / 2);
        const dy = (boxRect.top  + boxRect.height / 2) -
                   (cardRect.top  + cardRect.height / 2);

        // Quick reveal of the face so the player sees what got grabbed,
        // then jump-fly into the bracket.
        card.classList.remove("flipped");
        card.style.zIndex    = "300";
        card.style.transition = `transform ${MONSTER_FLY_MS}ms cubic-bezier(0.45, 0, 0.55, 1), opacity ${MONSTER_FLY_MS}ms ease`;
        card.style.transform  = `translate(${dx}px, ${dy}px) scale(0.18) rotate(360deg)`;
        card.style.opacity    = "0.55";

        setTimeout(() => {
            card.remove();
            if (window.GameActions && typeof GameActions.addToMonsterHand === "function") {
                GameActions.addToMonsterHand(cardId);
            }
            // The monster just made a successful move — reset the turn-timer
            // speed-up counter so post-bonus play resumes at 3s.
            if (window.GameTurnTimer && typeof GameTurnTimer.resetPlayerCounter === "function") {
                GameTurnTimer.resetPlayerCounter();
            }
            // If every field card has been re-distributed, end the battle.
            checkEndCondition();
        }, MONSTER_FLY_MS);
    }

    function cycleSuit() {
        currentSuit = SUITS[Math.floor(Math.random() * SUITS.length)];
        const el = document.getElementById("bonus-snatch-suit");
        if (el) el.textContent = SYMBOLS[currentSuit];
        // Safety net: if the field is empty by now, end the battle.
        checkEndCondition();
    }

    function stopSuitCycle() {
        if (suitIntervalId) {
            clearInterval(suitIntervalId);
            suitIntervalId = null;
        }
        currentSuit = null;
    }

    function onSnatchClick(e) {
        if (!active) return;
        if (penaltyActive) return;
        const card = e.target.closest(".monster-field .card");
        if (!card) return;
        if (card.classList.contains("losing")) return;
        if (card.classList.contains("monster-snatching")) return;   // monster claimed it

        const cardShape = card.dataset.shape;
        const cardId    = Number(card.dataset.cardId);

        if (cardShape === currentSuit) {
            // Correct snatch — unflip briefly (so the player sees what
            // they grabbed) and remove. Then add to the player's hand.
            card.classList.remove("flipped");
            card.classList.add("losing");
            setTimeout(() => card.remove(), 350);
            if (window.GameActions && typeof GameActions.addCardToPlayerHand === "function") {
                GameActions.addCardToPlayerHand(cardId);
            }
            // If every field card has been re-distributed, end the battle.
            setTimeout(checkEndCondition, 400);
        } else {
            // Wrong snatch — 1-second penalty.
            penaltyActive = true;
            document.body.classList.add("snatch-penalty");
            setTimeout(() => {
                penaltyActive = false;
                document.body.classList.remove("snatch-penalty");
            }, PENALTY_MS);
        }
    }

    // -------- Public API --------
    window.GameBonusBattle = {
        start,
        end,
        isActive: () => active,
    };

})();
