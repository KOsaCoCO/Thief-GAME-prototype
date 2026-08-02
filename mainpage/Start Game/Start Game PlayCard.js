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
//   Entry condition: none. Play Card always enters battle mode, even
//   if the field is still empty — the player can just place a card.
//
//   Mode persists across multiple plays until the player ends it
//   (Esc / "End Battle" button), or their hand runs out of unused cards.
//
//   PLAYER TURN — click a hand card to ARM it (stays in hand, highlighted),
//   then choose one of two actions:
//     - PLACE: click "Place Card" to lay the armed card onto the field
//       as a player-owned card. Always available, even on an empty field.
//       Hands off to GameAI.onPlayerPlacedCard() (Start Game AI_brain.js),
//       which decides whether the monster can beat it.
//     - ATTACK: click a field card (player's own or the monster's) to
//       attack with the armed card. Suit hierarchy decides:
//         * Square beats anything (same-suit needs higher number).
//         * Circle beats circle (higher number) and triangle (any).
//         * Triangle only beats triangle (higher number).
//     - On attack success: target moves to the player's hand, attacker
//       stays in hand (marked used for the battle).
//     - On attack failure: popup explains why; the armed card stays armed.
//
//   MONSTER TURN (auto, after every successful player attack):
//     - The decision + execution live in Start Game AI_brain.js
//       (GameAI.runBattleTurn) — this file only triggers it and
//       exposes the bits AI_brain needs (refreshFieldTargets,
//       playerHasValidPlay, endBattle, canBeat, isActive) via
//       window.GamePlay.
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

    // -------- Entry / exit --------

    function enterPlayMode(cardEl, onDone) {
        if (typeof getShapeForCard !== "function" || !window.GameActions) {
            console.warn("[playcard] required globals not available");
            if (onDone) onDone();
            return;
        }

        // No entry gate: the field may be empty and the player may have
        // nothing to beat yet — Place Card is always available, so the
        // player can always do something once they're in.
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

        // Once per session (not per click): the monster gets a small
        // chance to snatch a field card while the player's deciding.
        // Decision lives in Start Game AI_brain.js.
        if (window.GameAI && typeof GameAI.tryBattleSnatch === "function") {
            GameAI.tryBattleSnatch();
        }
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

        const placeBtn = document.getElementById("place-card-btn");
        if (placeBtn) placeBtn.addEventListener("click", onPlaceCardClick);
        updatePlaceButton();

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
        if (window.GameAI && typeof GameAI.resetBattleUsage === "function") {
            GameAI.resetBattleUsage();
        }

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

        const placeBtn = document.getElementById("place-card-btn");
        if (placeBtn) placeBtn.removeEventListener("click", onPlaceCardClick);

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
        updatePlaceButton();
    }

    function unarm() {
        if (armedCardEl) armedCardEl.classList.remove("selected-for-play");
        armedCardEl = null;
        updatePlaceButton();
    }

    // Shows/hides the "Place Card" button: only while a card is armed,
    // the battle is active, and we're not mid-way through a bonus pick.
    function updatePlaceButton() {
        const btn = document.getElementById("place-card-btn");
        if (!btn) return;
        btn.classList.toggle("visible", battleActive && !!armedCardEl && !bonusPickPending);
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

    // Does the player have ANY move left? Placing an unused hand card is
    // always a valid move (even on an empty field), so this just checks
    // whether the hand still has unused cards. Used to auto-end the battle
    // once the player has nothing left to play at all.
    function playerHasValidPlay() {
        return document.querySelectorAll(".hand .card:not(.used)").length > 0;
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

        // "+" bonus: any card carrying a plus pip (see Start Game
        // CardBoosters.js — no longer just the starting special triangles)
        // lets the player take one extra higher-suit (circle/square) field
        // card per pip before the monster's turn.
        const plusPips = (typeof getPlusCount === "function") ? getPlusCount(playerCardId) : 0;

        if (plusPips > 0 && hasHigherSuitFieldCards()) {
            enterBonusPickMultiple(plusPips, () => setTimeout(triggerMonsterBattleTurn, 500));
        } else {
            setTimeout(triggerMonsterBattleTurn, 700);
        }
    }

    // The monster's decision + execution for its play-card battle turn
    // lives in Start Game AI_brain.js (GameAI.runBattleTurn) — this is
    // just the guarded call site.
    function triggerMonsterBattleTurn() {
        if (window.GameAI && typeof GameAI.runBattleTurn === "function") {
            GameAI.runBattleTurn();
        }
    }

    function hasHigherSuitFieldCards() {
        return !!document.querySelector(
            ".monster-field .card[data-shape='circle'], .monster-field .card[data-shape='square']"
        );
    }

    // -------- Player places a card --------
    // The other half of "Play Card": lay the armed card straight onto the
    // field as a player-owned card, no target/attack required. Always
    // available — this is what lets the player act on an empty field.

    function onPlaceCardClick(e) {
        e.stopPropagation();
        if (bonusPickPending) return;
        if (!armedCardEl) return;
        placeArmedCard();
    }

    function placeArmedCard() {
        const cardEl = armedCardEl;
        const cardId = Number(cardEl.dataset.cardId);
        const shape  = cardEl.dataset.shape;

        cardEl.remove();
        GameActions.placeCardOnField(cardId, "player");
        console.log(`[playcard] Player placed ${shape} ${cardId} on the field`);

        unarm();
        refreshFieldTargets();   // the new card is targetable like any other

        if (window.GameBonusAction && typeof GameBonusAction.update === "function") {
            GameBonusAction.update();
        }

        // The monster's reaction to the placement lives in Start Game
        // AI_brain.js. Pass the placed card's ID so the monster only ever
        // considers THIS card — not other player-owned cards already
        // sitting on the field from earlier turns.
        if (window.GameAI && typeof GameAI.onPlayerPlacedCard === "function") {
            GameAI.onPlayerPlacedCard(cardId);
        }
    }

    // -------- Player bonus pick ("+" pip ability) --------

    // Runs enterBonusPick() up to `times` times in a row (one per plus
    // pip on the attacking card) — stops early if the player skips
    // (Esc) or the field runs out of circle/square cards to grab.
    function enterBonusPickMultiple(times, onFinish) {
        if (times <= 0 || !hasHigherSuitFieldCards()) {
            if (onFinish) onFinish();
            return;
        }
        enterBonusPick((skipped) => {
            if (skipped) {
                if (onFinish) onFinish();
                return;
            }
            enterBonusPickMultiple(times - 1, onFinish);
        });
    }

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

    // -------- Public API --------
    // Includes a few internals (refreshFieldTargets, playerHasValidPlay)
    // exposed purely so Start Game AI_brain.js can run the monster's turn
    // from outside this file without reaching into private state.
    window.GamePlay = {
        enterPlayMode,
        endBattle,
        canBeat,
        // BonusAction reads this so its case-1 auto-fire doesn't
        // interrupt an in-flight play-card battle.
        isActive: () => battleActive,
        refreshFieldTargets,
        playerHasValidPlay,
    };

})();
