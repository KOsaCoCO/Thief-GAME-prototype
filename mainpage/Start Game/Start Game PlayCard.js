// =============================================================
// Start Game PlayCard
// -------------------------------------------------------------
// Implements the "Play Card Battle" mode.
//
// Triggered by Start Game Actions.js calling window.GamePlay.enterPlayMode(cardEl, onDone).
//
// SAFE TO DELETE: if you remove this file and its <script> tag,
// the "Play Card" button becomes a no-op. The Gamble flow, parallax
// scene, hand, monster, etc. all keep working.
//
// ---- Flow ----
//   Entry condition: the playing field must have at least one
//   monster-owned card. (Those come from earlier Gamble wins.)
//
//   Mode persists across multiple plays until the player ends it
//   (Esc / "End Battle" button), or there is nothing the player can do.
//
//   PLAYER TURN:
//     - Click a hand card to ARM it (it stays in the hand, highlighted).
//     - Click a monster-owned field card to attack with the armed card.
//       Suit hierarchy decides:
//         * Square beats anything (same-suit needs higher number).
//         * Circle beats circle (higher number) and triangle (any).
//         * Triangle only beats triangle (higher number).
//     - On success: target moves to the player's hand, attacker moves
//       to the field as a player-owned card.
//     - On failure: popup explains why; the armed card stays in hand.
//
//   MONSTER TURN (auto, after every successful player attack):
//     - Scans every (monster-hand card × player-owned field card)
//       pair for a valid attack.
//     - If found: executes a random one — the player's field card
//       goes to the monster's hand (a new slot appears in the box),
//       and the monster's hand card lands on the field as monster-owned.
//     - If none: popup "I can't take any this round." Control returns
//       to the player, who can keep trying.
//
//   END BATTLE:
//     - Player clicks "End Battle" or presses Escape.
//     - Cards left on the field stay there for future battles.
// =============================================================

(function () {
    "use strict";

    let armedCardEl       = null;   // hand card the player has selected to attack with
    let onDoneCallback    = null;
    let battleActive      = false;
    let bonusPickPending  = false;  // waiting for the player to pick a bonus higher-suit card

    // Card IDs the MONSTER has already used as an attacker during the
    // current battle. Reset on endBattle. Used to keep monster turns from
    // reusing the same hand card within one battle (mirroring the .used
    // restriction on player hand cards).
    const monsterUsedThisBattle = new Set();

    // -------- Entry / exit --------

    function enterPlayMode(cardEl, onDone) {
        if (typeof getShapeForCard !== "function" || !window.GameActions) {
            console.warn("[playcard] required globals not available");
            if (onDone) onDone();
            return;
        }

        // There has to be SOMETHING on the field to take — own cards count
        // (free reclaim) and monster cards count (suit-hierarchy attack).
        const fieldCards = document.querySelectorAll(".monster-field .card[data-owner]");
        if (fieldCards.length === 0) {
            GameActions.showPopup(
                "Nothing is on the playing field yet."
            );
            if (onDone) onDone();
            return;
        }

        if (!playerHasValidPlay()) {
            GameActions.showPopup(
                "None of your cards can beat what's on the field.\nTry gambling instead."
            );
            if (onDone) onDone();
            return;
        }

        onDoneCallback = onDone;
        battleActive   = true;

        // HARD-STOP the idle pressure timer for the entire battle. Even
        // though wireCardClicks already stopped it when the player first
        // clicked, some external code path (an old exitBonusMode pause,
        // a SpecialBattle exit, an in-flight gamble's actionEnded) can
        // race and restart it mid-battle. Stopping here, plus the
        // body.playcard-mode CSS guard below, makes sure the slider is
        // off and the monster does not auto-act while we're in here.
        if (window.GameTurnTimer && typeof GameTurnTimer.stop === "function") {
            GameTurnTimer.stop();
        }
        document.body.classList.add("playcard-mode");

        // The card the player clicked from the choice modal is the first armed card.
        armCard(cardEl);

        startBattle();
    }

    function startBattle() {
        // Belt: stop the timer again at battle start. The hard-stop in
        // enterPlayMode already did it, but this protects against any
        // weird re-entry where startBattle is called without going
        // through enterPlayMode's stop path.
        if (window.GameTurnTimer && typeof GameTurnTimer.stop === "function") {
            GameTurnTimer.stop();
        }

        attachFieldTargetListeners();

        // Intercept hand clicks in capture phase so the Actions.js click
        // handler can't fire (and re-open the choice modal).
        const hand = document.getElementById("hand");
        if (hand) hand.addEventListener("click", onHandClickInBattle, true);

        const endBtn = document.getElementById("end-battle-btn");
        if (endBtn) {
            endBtn.classList.add("visible");
            endBtn.addEventListener("click", onEndBattleClick);
        }

        document.addEventListener("keydown", onEscape);
    }

    function endBattle() {
        if (!battleActive) return;
        battleActive = false;

        // Clean up any in-flight bonus-pick state.
        if (bonusPickPending) {
            bonusPickPending = false;
            document
                .querySelectorAll(".monster-field .card.bonus-target")
                .forEach((t) => t.classList.remove("bonus-target"));
        }

        // Reset "used" markings — both sides get all their cards back
        // for the next battle.
        document.querySelectorAll(".hand .card.used").forEach((c) => {
            c.classList.remove("used");
        });
        document.querySelectorAll(".monster-box .slot.used").forEach((s) => {
            s.classList.remove("used");
        });
        monsterUsedThisBattle.clear();

        // Battle is over — strip the body guard, then restart the pressure
        // timer. Order matters: the body class has to be off BEFORE
        // start() so the CSS opacity-0 guard doesn't keep the slider
        // invisible.
        document.body.classList.remove("playcard-mode");
        if (window.GameTurnTimer) window.GameTurnTimer.start();

        detachFieldTargetListeners();

        const hand = document.getElementById("hand");
        if (hand) hand.removeEventListener("click", onHandClickInBattle, true);

        const endBtn = document.getElementById("end-battle-btn");
        if (endBtn) {
            endBtn.classList.remove("visible");
            endBtn.removeEventListener("click", onEndBattleClick);
        }

        document.removeEventListener("keydown", onEscape);

        unarm();

        const cb = onDoneCallback;
        onDoneCallback = null;
        if (cb) cb();
    }

    function onEscape(e)         { if (e.key === "Escape") endBattle(); }
    function onEndBattleClick(e) { e.stopPropagation(); endBattle(); }

    // -------- Hand arming --------

    function armCard(cardEl) {
        unarm();
        armedCardEl = cardEl;
        cardEl.classList.add("selected-for-play");
    }

    function unarm() {
        if (armedCardEl) armedCardEl.classList.remove("selected-for-play");
        armedCardEl = null;
    }

    function onHandClickInBattle(e) {
        const card = e.target.closest(".hand .card");
        if (!card) return;
        e.stopPropagation();           // keep Actions.js out of this
        if (bonusPickPending) return;  // bonus pick: hand cards do nothing
        if (card.classList.contains("used")) {
            GameActions.showPopup("That card was already used in this battle.");
            return;
        }
        if (card === armedCardEl) {
            unarm();
        } else {
            armCard(card);
        }
    }

    // -------- Field targeting (monster cards on field) --------

    function attachFieldTargetListeners() {
        // Targets include BOTH player-owned (free reclaim) and monster-owned
        // (suit-hierarchy attack) cards on the field.
        document
            .querySelectorAll(".monster-field .card[data-owner]")
            .forEach((t) => {
                t.classList.add("targetable");
                t.addEventListener("click", onFieldTargetClick);
            });
    }

    function detachFieldTargetListeners() {
        document
            .querySelectorAll(".monster-field .card")
            .forEach((t) => {
                t.classList.remove("targetable");
                t.removeEventListener("click", onFieldTargetClick);
            });
    }

    function refreshFieldTargets() {
        detachFieldTargetListeners();
        attachFieldTargetListeners();
    }

    function onFieldTargetClick(e) {
        e.stopPropagation();
        if (!armedCardEl) {
            GameActions.showPopup("Click one of your hand cards first to arm it.");
            return;
        }
        const targetEl = e.currentTarget;
        attemptAttack(armedCardEl, targetEl);
    }

    // -------- Suit hierarchy --------

    function canBeat(attShape, attN, defShape, defN) {
        if (attShape === "square") {
            if (defShape === "square") return attN > defN;
            return true;
        }
        if (attShape === "circle") {
            if (defShape === "circle")   return attN > defN;
            if (defShape === "triangle") return true;
            return false;
        }
        if (attShape === "triangle") {
            if (defShape === "triangle") return attN > defN;
            return false;
        }
        return false;
    }

    // Does the player have ANY hand card that can beat ANY monster-owned
    // field card right now? Used to auto-end the battle once neither side
    // can do anything.
    function playerHasValidPlay() {
        // Only un-used hand cards count.
        const handCards = document.querySelectorAll(".hand .card:not(.used)");
        if (handCards.length === 0) return false;

        // EVERY field card — whether the player's own or the monster's —
        // requires a real suit-hierarchy + number win to be takeable.
        const fieldCards = document.querySelectorAll(".monster-field .card[data-owner]");
        if (fieldCards.length === 0) return false;

        for (const handCard of handCards) {
            const handId    = Number(handCard.dataset.cardId);
            const handShape = handCard.dataset.shape;
            for (const target of fieldCards) {
                const targetId    = Number(target.dataset.cardId);
                const targetShape = target.dataset.shape;
                if (canBeat(handShape, handId, targetShape, targetId)) return true;
            }
        }
        return false;
    }

    function whyCantBeat(attShape, attN, defShape, defN) {
        if (attShape === defShape) {
            return `Your ${attShape} ${attN} can't beat ${defShape} ${defN}\n— same suit needs a higher number.`;
        }
        if (attShape === "circle" && defShape === "square") {
            return "Circles can't beat squares.";
        }
        if (attShape === "triangle" && defShape !== "triangle") {
            return "Triangles can only beat other triangles.";
        }
        return "That play isn't valid.";
    }

    // -------- Player attack --------

    function attemptAttack(playerHandEl, targetFieldEl) {
        const playerCardId = Number(playerHandEl.dataset.cardId);
        const playerShape  = playerHandEl.dataset.shape;
        const targetCardId = Number(targetFieldEl.dataset.cardId);
        const targetShape  = targetFieldEl.dataset.shape;
        const targetOwner  = targetFieldEl.dataset.owner;

        // The suit hierarchy + number rule applies to EVERY field card —
        // even cards you originally placed on the field. Your circle 1
        // can't take your own circle 8 back just because it was yours.
        if (!canBeat(playerShape, playerCardId, targetShape, targetCardId)) {
            GameActions.showPopup(
                whyCantBeat(playerShape, playerCardId, targetShape, targetCardId)
            );
            return;
        }

        // No swap: the attacker STAYS in the player's hand. Only the target
        // leaves the field and joins the player's hand.
        targetFieldEl.remove();
        const acquiredCardEl = GameActions.addCardToPlayerHand(targetCardId);

        // Mark the attacker as USED for the rest of this battle — it can't
        // be armed again until endBattle clears the flag. Also unarm it.
        playerHandEl.classList.add("used");

        // The card we just took also goes grey for this battle — it can't
        // be played right away in the same round.
        if (acquiredCardEl) acquiredCardEl.classList.add("used");

        if (window.GameBonusAction && typeof GameBonusAction.update === "function") {
            GameBonusAction.update();
        }

        console.log(
            `[playcard] Player ${playerShape} ${playerCardId} took ${targetShape} ${targetCardId} (${targetOwner})`
        );

        // Taking a monster-owned card could be the killing blow — check now.
        if (targetOwner !== "player"
            && window.GameTurnTimer
            && typeof window.GameTurnTimer.checkDefeat === "function") {
            if (window.GameTurnTimer.checkDefeat()) {
                // Monster wiped out. End the battle cleanly; the popup is
                // already showing courtesy of checkDefeat.
                endBattle();
                return;
            }
        }

        unarm();
        detachFieldTargetListeners();

        // Special-triangle bonus: if the attacker was a special triangle, the
        // player gets to take one extra higher-suit (circle/square) field
        // card before the monster's turn.
        const attackerIsSpecialTriangle =
            (playerShape === "triangle") &&
            (typeof isSpecialCard === "function") &&
            isSpecialCard(playerCardId);

        if (attackerIsSpecialTriangle && hasHigherSuitFieldCards()) {
            enterBonusPick(() => setTimeout(monsterTurn, 500));
        } else {
            setTimeout(monsterTurn, 700);
        }
    }

    function hasHigherSuitFieldCards() {
        return !!document.querySelector(
            ".monster-field .card[data-shape='circle'], .monster-field .card[data-shape='square']"
        );
    }

    // -------- Player bonus pick (special triangle ability) --------

    function enterBonusPick(onFinish) {
        bonusPickPending = true;

        const targets = document.querySelectorAll(
            ".monster-field .card[data-shape='circle'], .monster-field .card[data-shape='square']"
        );
        targets.forEach((t) => {
            t.classList.add("bonus-target");
            t.addEventListener("click", onBonusClick);
        });

        GameActions.showPopup(
            "Bonus take!\nClick a circle or square on the field — or press Esc to skip.",
            3500
        );

        function exit(skipped) {
            bonusPickPending = false;
            document
                .querySelectorAll(".monster-field .card.bonus-target")
                .forEach((t) => {
                    t.classList.remove("bonus-target");
                    t.removeEventListener("click", onBonusClick);
                });
            document.removeEventListener("keydown", onBonusEscape);
            if (onFinish) onFinish(skipped);
        }

        function onBonusClick(e) {
            e.stopPropagation();
            const el = e.currentTarget;
            const id = Number(el.dataset.cardId);
            el.remove();
            GameActions.addCardToPlayerHand(id);
            console.log(`[playcard] Bonus take: card ${id}`);
            exit(false);
        }

        function onBonusEscape(e) {
            if (e.key === "Escape") exit(true);
        }
        document.addEventListener("keydown", onBonusEscape);
    }

    // -------- Monster turn --------

    function monsterTurn() {
        if (!battleActive) return;

        const monsterHand = GameActions.getMonsterHand()
            .filter((id) => !monsterUsedThisBattle.has(id));
        const playerFieldCards = Array.from(
            document.querySelectorAll(".monster-field .card[data-owner='player']")
        );

        // Find every monster-hand × player-field pair that's a valid attack.
        const pairs = [];
        for (const monCardId of monsterHand) {
            const monShape = getShapeForCard(monCardId);
            for (const playerEl of playerFieldCards) {
                const playerCardId = Number(playerEl.dataset.cardId);
                const playerShape  = playerEl.dataset.shape;
                if (canBeat(monShape, monCardId, playerShape, playerCardId)) {
                    pairs.push({ monCardId, monShape, playerEl, playerCardId, playerShape });
                }
            }
        }

        if (pairs.length === 0) {
            // Monster passes. The player keeps going until they also can't.
            GameActions.showPopup("I can't take any this round.");
            setTimeout(() => {
                if (!battleActive) return;
                // Auto-end if the player has nothing left to attempt either —
                // otherwise let them keep trying.
                if (!playerHasValidPlay()) {
                    GameActions.showPopup("Neither of you can take any more.\nBattle over.");
                    setTimeout(endBattle, 1500);
                    return;
                }
                refreshFieldTargets();
            }, 1200);
            return;
        }

        // Pick one at random.
        const choice = pairs[Math.floor(Math.random() * pairs.length)];
        executeMonsterAttack(choice);
    }

    function executeMonsterAttack({ monCardId, playerEl, playerCardId }) {
        console.log(
            `[playcard] Monster card ${monCardId} took player ${playerCardId} from field`
        );

        // Mark this monster card as used for the rest of the battle.
        monsterUsedThisBattle.add(monCardId);

        // Reveal the corresponding slot if it was still hidden, then grey
        // it out so the player can see which monster card was spent.
        let slot = document.querySelector(
            `.monster-box .slot[data-card-id="${monCardId}"]`
        );
        if (!slot && typeof GameActions.revealHiddenSlotForCard === "function") {
            slot = GameActions.revealHiddenSlotForCard(monCardId);
        }
        if (slot) slot.classList.add("used");

        // No swap: the monster's hand card STAYS in the monster's hand. Only
        // the player's field card leaves the field and joins the monster's hand.
        playerEl.remove();
        const newSlot = GameActions.addToMonsterHand(playerCardId);

        // The card the monster just took also goes grey for this battle —
        // it can't be played by the monster in the same round.
        if (newSlot) newSlot.classList.add("used");
        monsterUsedThisBattle.add(playerCardId);

        // Successful monster move — reset speed-up counter so the timer
        // returns to its slow 3s state.
        if (window.GameTurnTimer && typeof window.GameTurnTimer.resetPlayerCounter === "function") {
            window.GameTurnTimer.resetPlayerCounter();
        }

        if (window.GameBonusAction && typeof GameBonusAction.update === "function") {
            GameBonusAction.update();
        }

        // Special-triangle bonus for the monster: if the attacker is a
        // special triangle, the monster auto-takes one higher-suit
        // (circle/square) field card.
        const monShape = getShapeForCard(monCardId);
        if (
            monShape === "triangle" &&
            typeof isSpecialCard === "function" &&
            isSpecialCard(monCardId)
        ) {
            const bonusTargets = document.querySelectorAll(
                ".monster-field .card[data-shape='circle'], .monster-field .card[data-shape='square']"
            );
            if (bonusTargets.length > 0) {
                const pick = bonusTargets[Math.floor(Math.random() * bonusTargets.length)];
                const bonusId = Number(pick.dataset.cardId);
                pick.remove();
                GameActions.addToMonsterHand(bonusId);
                GameActions.showPopup(`Bonus take! Monster also grabbed card #${bonusId}.`);
                console.log(`[playcard] Monster bonus take: card ${bonusId}`);
            }
        }

        setTimeout(() => {
            if (!battleActive) return;
            // After the monster's attack, see if the player still has any
            // valid play. If not, end the battle gracefully.
            if (!playerHasValidPlay()) {
                GameActions.showPopup("You have nothing left to play.\nBattle over.");
                setTimeout(endBattle, 1500);
                return;
            }
            refreshFieldTargets();         // monster's new card is a target now
        }, 700);
    }

    // -------- Public API --------
    window.GamePlay = {
        enterPlayMode,
        endBattle,
        canBeat,
        // BonusAction reads this so its case-1 auto-fire doesn't
        // interrupt an in-flight play-card battle.
        isActive: () => battleActive,
    };

})();
