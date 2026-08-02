// =============================================================
// Start Game AI_brain
// -------------------------------------------------------------
// Home for the MONSTER's decision-making. Every place the monster
// "chooses" something — which card to reveal, whether to attack,
// what to do when the player goes idle — lives here instead of
// inside the file that triggers it.
//
// SEPARATE on purpose (same reasoning as Start Game Actions.js) —
// modify freely, or delete the file + its <script> tag if it ever
// breaks. Every call site guards with `window.GameAI && typeof ...`,
// so without this file the monster simply stops acting on its own;
// the rest of the game (hand, field, gamble wheel, play-card
// targeting) keeps working.
//
// Reads from: window.GameActions, window.GamePlay, window.GameTurnTimer,
// window.GameBonusAction, window.GameAIAnimations (visuals for this
// file's moves), window.GameWheelAnimation (the prediction wheel spin,
// reused for the idle-timeout gamble), and the globals getShapeForCard()/
// isSpecialCard()/getPlusCount() from Start Game CardDeck.js. Never
// reaches into another file's private state — only their public bridge
// APIs, so this file can be edited without touching anything else.
//
// Current behavior is intentionally simple (mostly random) — this is
// the file to expand when the monster's behavior gets configured
// in depth.
// =============================================================

(function () {
    "use strict";

    // -------- Gamble response --------
    // Called by Actions.js when the player's high/low call was correct
    // and the monster has 1+ same-suit cards that satisfy it. Decides
    // WHICH of those cards the monster reveals.
    function pickGambleCard(candidates) {
        return candidates[Math.floor(Math.random() * candidates.length)];
    }

    // -------- Play-card battle --------

    // Card IDs the monster has already used as an ATTACKER during the
    // current play-card battle. Reset whenever a battle ends (PlayCard.js
    // calls resetBattleUsage() from its endBattle()).
    const usedThisBattle = new Set();

    function resetBattleUsage() {
        usedThisBattle.clear();
    }

    // One monster turn inside an active play-card battle: scan every
    // (monster-hand card x player-owned field card) pair for a valid
    // attack and execute a random one. Called by PlayCard.js after every
    // successful player attack.
    function runBattleTurn() {
        if (!window.GamePlay || !window.GameActions) return;
        if (typeof GamePlay.isActive !== "function" || !GamePlay.isActive()) return;
        if (typeof getShapeForCard !== "function") return;

        const monsterHand = GameActions.getMonsterHand()
            .filter((id) => !usedThisBattle.has(id));
        const playerFieldCards = Array.from(
            document.querySelectorAll(".monster-field .card[data-owner='player']")
        );

        const pairs = [];
        for (const monCardId of monsterHand) {
            const monShape = getShapeForCard(monCardId);
            for (const playerEl of playerFieldCards) {
                const playerCardId = Number(playerEl.dataset.cardId);
                const playerShape  = playerEl.dataset.shape;
                if (GamePlay.canBeat(monShape, monCardId, playerShape, playerCardId)) {
                    pairs.push({ monCardId, monShape, playerEl, playerCardId, playerShape });
                }
            }
        }

        if (pairs.length === 0) {
            // Monster passes. The player keeps going until they also can't.
            GameActions.showPopup("I can't take any this round.");
            setTimeout(() => {
                if (typeof GamePlay.isActive !== "function" || !GamePlay.isActive()) return;
                if (!GamePlay.playerHasValidPlay()) {
                    GameActions.showPopup("Neither of you can take any more.\nBattle over.");
                    setTimeout(GamePlay.endBattle, 1500);
                    return;
                }
                GamePlay.refreshFieldTargets();
            }, 1200);
            return;
        }

        const choice = pairs[Math.floor(Math.random() * pairs.length)];
        executeBattleAttack(choice);
    }

    function executeBattleAttack({ monCardId, playerEl, playerCardId }) {
        console.log(`[ai-brain] Monster card ${monCardId} took player ${playerCardId} from field`);

        // Mark this monster card as used for the rest of the battle.
        usedThisBattle.add(monCardId);

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
        usedThisBattle.add(playerCardId);

        // Successful monster move — reset speed-up counter so the timer
        // returns to its slow 3s state.
        if (window.GameTurnTimer && typeof GameTurnTimer.resetPlayerCounter === "function") {
            GameTurnTimer.resetPlayerCounter();
        }

        if (window.GameBonusAction && typeof GameBonusAction.update === "function") {
            GameBonusAction.update();
        }

        // "+" bonus for the monster: any card carrying a plus pip (see
        // Start Game CardBoosters.js — no longer just special triangles)
        // lets the monster auto-take one extra higher-suit (circle/square)
        // field card per pip.
        const monPlusPips = (typeof getPlusCount === "function") ? getPlusCount(monCardId) : 0;
        if (monPlusPips > 0) {
            let grabbed = 0;
            for (let i = 0; i < monPlusPips; i++) {
                const bonusTargets = document.querySelectorAll(
                    ".monster-field .card[data-shape='circle'], .monster-field .card[data-shape='square']"
                );
                if (bonusTargets.length === 0) break;
                const pick = bonusTargets[Math.floor(Math.random() * bonusTargets.length)];
                const bonusId = Number(pick.dataset.cardId);
                pick.remove();
                GameActions.addToMonsterHand(bonusId);
                grabbed++;
                console.log(`[ai-brain] Monster bonus take: card ${bonusId}`);
            }
            if (grabbed > 0) {
                GameActions.showPopup(
                    `Bonus take! Monster also grabbed ${grabbed > 1 ? grabbed + " extra cards" : "an extra card"}.`
                );
            }
        }

        setTimeout(() => {
            if (typeof GamePlay.isActive !== "function" || !GamePlay.isActive()) return;
            // After the monster's attack, see if the player still has any
            // valid play. If not, end the battle gracefully.
            if (!GamePlay.playerHasValidPlay()) {
                GameActions.showPopup("You have nothing left to play.\nBattle over.");
                setTimeout(GamePlay.endBattle, 1500);
                return;
            }
            GamePlay.refreshFieldTargets();   // monster's new card is a target now
        }, 700);
    }

    // -------- Player places a card (Play Card, no attack) --------
    // Fires right after the player lays a card onto the field via the
    // "Place Card" button. PlayCard.js passes the ID of the card that
    // was just placed — the monster only ever reacts to THAT card, never
    // to other player-owned cards already sitting on the field from
    // earlier turns (those already had their own chance to be reacted to
    // when they were placed).
    //   - If any monster card can beat it (same suit-hierarchy rule as
    //     GamePlay.canBeat): it stacks that card on top of the target,
    //     then both cards return to the monster's hand. The stack/hold/
    //     fly visuals live in Start Game AI_brain Animations.js.
    //   - If nothing can beat it: the monster gives up one of its own
    //     cards straight into the player's hand (not the field).
    //
    // While the beat is in progress, the target is "contested" (see
    // claimContest/resolveContest below) — Start Game TugOfWar.js lets
    // the player click it to fight for the card instead of losing it
    // automatically once the animation finishes.
    function onPlayerPlacedCard(placedCardId) {
        if (!window.GameActions || !window.GamePlay || typeof getShapeForCard !== "function") return;

        // A previous placement's monster reaction is still unresolved
        // (auto-animating or an active tug-of-war). Starting a second one
        // now would overwrite activeContest and orphan the first — the
        // first card's eventual resolution would then wrongly apply to
        // the second contest's card. Skip reacting to this placement
        // until the first one settles.
        if (activeContest) return;

        const monsterHand = GameActions.getMonsterHand();
        if (monsterHand.length === 0) return;   // nothing to react with

        // The ONLY valid target is the card the player just placed.
        const target = document.querySelector(
            `.monster-field .card[data-owner='player'][data-card-id="${placedCardId}"]`
        );
        if (!target) return;   // couldn't find it — nothing to react to
        const targetShape = target.dataset.shape;

        const beaters = monsterHand.filter((monCardId) =>
            GamePlay.canBeat(getShapeForCard(monCardId), monCardId, targetShape, placedCardId)
        );

        if (beaters.length === 0) {
            giveUpCardToPlayer();
            return;
        }

        const monCardId = beaters[Math.floor(Math.random() * beaters.length)];
        beatFieldCard({ monCardId, target, targetId: placedCardId });
    }

    // Can't beat anything on the field — hand one random monster card
    // straight to the player instead of placing it on the field. Nothing
    // touches the field here, so there's no need to refresh field targets.
    function giveUpCardToPlayer() {
        const monsterHand = GameActions.getMonsterHand();
        if (monsterHand.length === 0) return;

        const cardId = monsterHand[Math.floor(Math.random() * monsterHand.length)];
        GameActions.removeFromMonsterHand(cardId);
        GameActions.dropMonsterSlot(cardId);
        GameActions.addCardToPlayerHand(cardId);
        GameActions.showPopup(`Monster can't beat your card — it gives up card #${cardId} to you.`);
    }

    // The field card currently being contested (at most one at a time —
    // matches the rest of this file's one-thing-happens-at-a-time model).
    // Set in beatFieldCard(), read/cleared by claimContest()/resolveContest().
    let activeContest = null;

    // Beats one of the player's field cards: places the winning monster
    // card on the field, tags the target "contested" (see claimContest()
    // below), then runs the stack/hold/fly animation. If nothing claims
    // it first, autoResolve() runs once the animation finishes and both
    // cards join the monster's hand — the normal, uncontested outcome.
    function beatFieldCard({ monCardId, target, targetId }) {
        // Pull the attacker out of the monster's hand/box — it's about to
        // appear on the field.
        GameActions.removeFromMonsterHand(monCardId);
        GameActions.dropMonsterSlot(monCardId);
        GameActions.placeCardOnField(monCardId, "monster");

        const attackerEl = document.querySelector(
            `.monster-field .card[data-owner='monster'][data-card-id="${monCardId}"]`
        );

        target.classList.add("contested");
        activeContest = { monCardId, attackerEl, target, targetId, resolved: false, anim: null };

        const autoResolve = () => {
            if (!activeContest || activeContest.resolved) return;   // already claimed by a tug-of-war
            activeContest.resolved = true;
            resolveContest("monster");
        };

        if (attackerEl && window.GameAIAnimations && typeof GameAIAnimations.playBeatSequence === "function") {
            activeContest.anim = GameAIAnimations.playBeatSequence(attackerEl, target, autoResolve);
        } else {
            autoResolve();
        }
    }

    // Called by Start Game TugOfWar.js when the player clicks a
    // ".contested" card. Cancels the pending automatic capture and hands
    // the contest's details back so the tug-of-war can run. Returns null
    // if there's nothing to claim (stale click, already resolved, etc.).
    function claimContest(cardEl) {
        if (!activeContest || activeContest.resolved || activeContest.target !== cardEl) return null;
        // Safeguard: the element the player clicked must still carry the
        // exact card ID this contest was created for. Combined with the
        // onPlayerPlacedCard() re-entry guard above, this should never
        // actually fail — it's the last line of defense against ever
        // handing back a different card than the one the player clicked.
        if (Number(cardEl.dataset.cardId) !== activeContest.targetId) return null;
        activeContest.resolved  = true;
        activeContest.wasClaimed = true;   // so resolveContest() knows this went through a tug-of-war
        if (activeContest.anim && typeof activeContest.anim.cancel === "function") {
            activeContest.anim.cancel();
        }
        return {
            monCardId:  activeContest.monCardId,
            attackerEl: activeContest.attackerEl,
            target:     activeContest.target,
            targetId:   activeContest.targetId,
        };
    }

    // Settles the current contest. winner is "player" (the tug-of-war was
    // won, or the card just resolved uncontested — see below) or "monster".
    //   - "player":  the target returns to the player's hand; the
    //                monster's attacking card retreats to its own hand.
    //   - "monster": both cards join the monster's hand (the normal
    //                uncontested outcome, or a tug-of-war the monster won).
    function resolveContest(winner) {
        if (!activeContest) return;
        const { monCardId, attackerEl, target, targetId, wasClaimed } = activeContest;
        activeContest = null;

        if (target && target.isConnected) target.remove();
        if (attackerEl && attackerEl.isConnected) attackerEl.remove();

        if (winner === "player") {
            // Only reachable via a won tug-of-war — the automatic path
            // always resolves "monster".
            GameActions.addCardToPlayerHand(targetId);
            GameActions.addToMonsterHand(monCardId);
            GameActions.showPopup(`You pulled card #${targetId} back into your hand!`);
        } else {
            GameActions.addToMonsterHand(monCardId);
            GameActions.addToMonsterHand(targetId);
            if (window.GameTurnTimer && typeof GameTurnTimer.resetPlayerCounter === "function") {
                GameTurnTimer.resetPlayerCounter();
            }
            GameActions.showPopup(
                wasClaimed
                    ? `Monster won the tug-of-war and took both #${monCardId} and #${targetId}.`
                    : `Monster beat your card #${targetId} with #${monCardId}\nand took both back into its hand.`
            );
        }

        if (window.GameBonusAction && typeof GameBonusAction.update === "function") {
            GameBonusAction.update();
        }
        refreshIfBattleActive();
    }

    function refreshIfBattleActive() {
        if (window.GamePlay && typeof GamePlay.isActive === "function" && GamePlay.isActive()) {
            GamePlay.refreshFieldTargets();
        }
    }

    // -------- Idle-timeout auto actions --------
    // Fired by TurnTimer.js when the player doesn't act before the
    // decision timer fills.

    // Tries a suit-hierarchy attack against any player-owned field card.
    // Returns true if it found and executed one, false otherwise (caller
    // falls back to idleGamble()).
    function tryIdlePlayCard() {
        if (!window.GameActions || !window.GamePlay) return false;
        if (typeof getShapeForCard !== "function") return false;

        const monsterHand = GameActions.getMonsterHand();
        const playerFieldCards = Array.from(
            document.querySelectorAll(".monster-field .card[data-owner='player']")
        );
        if (monsterHand.length === 0 || playerFieldCards.length === 0) return false;

        // Find a valid (monster hand card x player-owned field card) attack pair.
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
                    if (window.GameTurnTimer && typeof GameTurnTimer.resetPlayerCounter === "function") {
                        GameTurnTimer.resetPlayerCounter();
                    }
                    return true;
                }
            }
        }
        return false;     // no valid attack — caller will fall back to gamble
    }

    // When the monster auto-gambles, it "guesses" 50/50. Sequence:
    //   1. Announce: a flashy banner under the monster + the prediction
    //      wheel spins to the guess's color (green = correct, red =
    //      wrong) — same green/right, red/wrong convention the player's
    //      own gambles use. ~1.8s.
    //   2. Resolve, based on the guess:
    //        - Correct: a random player hand card visually zooms up to
    //          the monster sprite, then lands on the field (still
    //          player-owned, so it can be reclaimed later — unchanged
    //          from before, just animated now). ~2s.
    //        - Wrong: the monster's box slot does its usual reveal
    //          "jump" (same animation as a normal gamble reveal), then
    //          that card slips over into the PLAYER's hand outright —
    //          a real cost for the monster guessing wrong, not just a
    //          field placement like before. ~2.6s (jump + slip).
    // onDone (optional) fires once the whole sequence — including the
    // actual state change — has finished; TurnTimer.js uses it to know
    // when it's safe to restart the idle-pressure timer.
    const IDLE_GAMBLE_ANNOUNCE_MS = 1800;   // banner + wheel spin phase
    const IDLE_GAMBLE_FLASH_MS    = 1500;   // banner's own on-screen time
    const IDLE_GAMBLE_FLY_MS      = 2000;   // card-movement flight
    const IDLE_GAMBLE_JUMP_MS     = 600;    // box-slot reveal jump (wrong guess only)

    function idleGamble(onDone) {
        const finish = () => { if (onDone) onDone(); };
        if (!window.GameActions) { finish(); return; }

        const guessedCorrectly = Math.random() < 0.5;

        if (window.GameAIAnimations && typeof GameAIAnimations.showFlashyText === "function") {
            GameAIAnimations.showFlashyText(
                guessedCorrectly ? "Monster is gambling... and reads you right!" : "Monster is gambling... and misreads you!",
                IDLE_GAMBLE_FLASH_MS
            );
        }
        if (window.GameWheelAnimation && typeof GameWheelAnimation.spinToResult === "function") {
            GameWheelAnimation.spinToResult(guessedCorrectly);
        }

        setTimeout(() => {
            if (guessedCorrectly) {
                resolveIdleGambleCorrect(finish);
            } else {
                resolveIdleGambleWrong(finish);
            }
        }, IDLE_GAMBLE_ANNOUNCE_MS);
    }

    // Correct guess: a random player hand card flies up to the monster
    // sprite, then lands on the field as player-owned (so it can still
    // be reclaimed later during a Play Card battle) — same outcome as
    // before, just animated instead of instant.
    function resolveIdleGambleCorrect(onDone) {
        // Exclude special bonus cards (visual trophies, not game cards)
        // and any card mid losing-animation.
        const playerCards = document.querySelectorAll(
            ".hand .card:not(.losing):not(.special-bonus-card)"
        );
        if (playerCards.length === 0) {
            // Nothing to take — fall back to the wrong-guess flow instead.
            resolveIdleGambleWrong(onDone);
            return;
        }

        const target = playerCards[Math.floor(Math.random() * playerCards.length)];
        const cardId = Number(target.dataset.cardId);

        const finish = () => {
            target.remove();
            GameActions.placeCardOnField(cardId, "player");
            GameActions.showPopup(
                `Time's up! Monster gambled correctly\nand took your card #${cardId} onto the field.`
            );
            if (window.GameTurnTimer && typeof GameTurnTimer.resetPlayerCounter === "function") {
                GameTurnTimer.resetPlayerCounter();
            }
            if (onDone) onDone();
        };

        const monster = document.getElementById("monster");
        if (monster && window.GameAIAnimations && typeof GameAIAnimations.flyCardToElement === "function") {
            GameAIAnimations.flyCardToElement(target, monster, IDLE_GAMBLE_FLY_MS, finish);
        } else {
            finish();
        }
    }

    // Wrong guess: the monster's box slot reveals + jumps (same beat as
    // a normal gamble reveal), then that card slips into the PLAYER's
    // hand outright — a real cost for guessing wrong, not just a card
    // placed on the field like before.
    function resolveIdleGambleWrong(onDone) {
        const monsterHand = GameActions.getMonsterHand();
        if (monsterHand.length === 0) {
            GameActions.showPopup("Time's up! Monster has nothing to play.");
            if (onDone) onDone();
            return;
        }

        const cardId = monsterHand[Math.floor(Math.random() * monsterHand.length)];
        GameActions.removeFromMonsterHand(cardId);
        const slot = (typeof GameActions.revealHiddenSlotForCard === "function")
            ? GameActions.revealHiddenSlotForCard(cardId)
            : null;

        const finish = () => {
            if (slot && slot.isConnected) {
                slot.remove();
            } else {
                GameActions.dropMonsterSlot(cardId);
            }
            GameActions.addCardToPlayerHand(cardId);
            GameActions.showPopup(
                `Time's up! Monster gambled wrong\nand card #${cardId} slipped into your hand!`
            );
            if (onDone) onDone();
        };

        const hand = document.getElementById("hand");
        if (slot && hand && window.GameAIAnimations
            && typeof GameAIAnimations.jumpSlot === "function"
            && typeof GameAIAnimations.flyCardToElement === "function") {
            GameAIAnimations.jumpSlot(slot, IDLE_GAMBLE_JUMP_MS, () => {
                GameAIAnimations.flyCardToElement(slot, hand, IDLE_GAMBLE_FLY_MS, finish);
            });
        } else {
            finish();
        }
    }

    // -------- Play-card session: rare opportunistic snatch --------
    // Once per Play Card session (not per click — PlayCard.js calls
    // this exactly once, when the session starts), the monster has a
    // small chance to grab a player-owned field card outright while
    // the player's still deciding what to do. No suit check, and this
    // can't be contested — the tug-of-war mechanic is unrelated and
    // only ever applies to the "beat a placed card" flow above.
    const BATTLE_SNATCH_CHANCE = 0.15;

    function tryBattleSnatch() {
        if (!window.GameActions || !window.GamePlay) return;
        if (Math.random() >= BATTLE_SNATCH_CHANCE) return;   // missed the roll

        // A little thinking time before it happens, so it doesn't feel
        // like an instant jump-scare right as the battle opens.
        setTimeout(() => {
            if (typeof GamePlay.isActive !== "function" || !GamePlay.isActive()) return;
            if (activeContest) return;   // don't interfere with a card mid-contest

            const targets = Array.from(
                document.querySelectorAll(".monster-field .card[data-owner='player']")
            );
            if (targets.length === 0) return;

            const target = targets[Math.floor(Math.random() * targets.length)];
            const cardId = Number(target.dataset.cardId);
            target.remove();
            GameActions.addToMonsterHand(cardId);
            GameActions.showPopup(`Monster snatched card #${cardId} from the field!`);
            console.log(`[ai-brain] Battle snatch: card ${cardId}`);

            refreshIfBattleActive();
        }, 900 + Math.random() * 600);
    }

    // -------- Public API --------
    window.GameAI = {
        pickGambleCard,
        runBattleTurn,
        resetBattleUsage,
        onPlayerPlacedCard,
        tryIdlePlayCard,
        idleGamble,           // idleGamble(onDone?) — onDone fires once fully resolved
        tryBattleSnatch,       // called once per Play Card session by PlayCard.js
        // Used by Start Game TugOfWar.js to hijack a contested card.
        claimContest,
        resolveContest,
    };

})();
