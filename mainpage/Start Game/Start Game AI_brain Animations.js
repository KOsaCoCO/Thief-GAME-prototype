// =============================================================
// Start Game AI_brain Animations
// -------------------------------------------------------------
// Pure DOM/CSS choreography for the AI brain's moves — no game
// state, no decisions, just moving elements around. AI_brain.js
// calls in with the elements involved and a callback; this file
// never touches monsterHand, the box, or any bridge API itself.
//
// Two families of visuals live here:
//   - playBeatSequence(): the "monster beats a placed card" stack/
//     hold/fly sequence (contested by Start Game TugOfWar.js).
//   - showFlashyText()/flyCardToElement()/jumpSlot(): smaller pieces
//     used by AI_brain.js's idleGamble() to show what the monster's
//     free idle-timeout gamble is doing.
//
// SAFE TO DELETE: without this file, AI_brain.js's beat sequence and
// idle-gamble both just resolve instantly (no visuals) — the game
// logic is unaffected either way.
// =============================================================

(function () {
    "use strict";

    // Runs the "monster beats a field card" sequence: the attacker card
    // slides up onto the target (stack), the attacker glows briefly (hold —
    // the target's own "contested" wiggle/glow is Start Game.css's
    // .contested class, toggled by AI_brain.js), then both fly off to the
    // monster box (fly). ~2 seconds total. Calls onComplete afterward —
    // AI_brain.js does the actual state changes (removing the elements,
    // returning both cards to hand) there.
    //
    // Returns a handle with cancel() — Start Game TugOfWar.js calls it when
    // the player contests the target mid-sequence, so the stack/hold/fly
    // steps don't keep firing (and calling onComplete) underneath the
    // tug-of-war UI once the outcome is being decided some other way.
    const STACK_MS = 350;
    const HOLD_MS  = 650;
    const FLY_MS   = 1000;
    const STACK_LIFT_PX = 18;   // how far "above" the target the attacker sits

    function playBeatSequence(attackerEl, targetEl, onComplete) {
        if (!attackerEl || !targetEl) {
            if (onComplete) onComplete();
            return { cancel() {} };
        }

        let cancelled = false;
        const timers = [];
        const schedule = (fn, ms) => {
            timers.push(setTimeout(() => { if (!cancelled) fn(); }, ms));
        };

        stackOnTarget(attackerEl, targetEl);

        schedule(() => {
            attackerEl.classList.add("ai-captured");

            schedule(() => {
                const box = document.getElementById("monster-box");
                if (box) {
                    flyToBox(attackerEl, box, FLY_MS);
                    flyToBox(targetEl, box, FLY_MS);
                }
                schedule(() => {
                    if (onComplete) onComplete();
                }, FLY_MS);
            }, HOLD_MS);
        }, STACK_MS);

        return {
            cancel() {
                cancelled = true;
                timers.forEach(clearTimeout);
            },
        };
    }

    // Slides the attacker from its natural field position onto the
    // target's position, lifted slightly so it visibly sits "above" it.
    function stackOnTarget(attackerEl, targetEl) {
        const attackerRect = attackerEl.getBoundingClientRect();
        const targetRect   = targetEl.getBoundingClientRect();

        const dx = (targetRect.left + targetRect.width  / 2) -
                   (attackerRect.left + attackerRect.width  / 2);
        const dy = (targetRect.top  + targetRect.height / 2) -
                   (attackerRect.top  + attackerRect.height / 2) - STACK_LIFT_PX;

        // Cancel the default cardReveal keyframe animation first — while it's
        // still running it would silently win over our inline transform.
        attackerEl.style.animation = "none";
        void attackerEl.offsetWidth;   // force reflow

        attackerEl.style.zIndex = "40";
        attackerEl.style.transition = `transform ${STACK_MS}ms ease-out`;
        void attackerEl.offsetWidth;   // force reflow so the transition applies
        attackerEl.style.transform = `translate(${dx}px, ${dy}px) scale(1.05)`;
    }

    // Shared with the general "fly a card into the monster box" motion
    // used elsewhere (see Start Game BonusBattle.js's monsterSnatchCard).
    function flyToBox(cardEl, box, durationMs) {
        const cardRect = cardEl.getBoundingClientRect();
        const boxRect  = box.getBoundingClientRect();
        const dx = (boxRect.left + boxRect.width  / 2) - (cardRect.left + cardRect.width  / 2);
        const dy = (boxRect.top  + boxRect.height / 2) - (cardRect.top  + cardRect.height / 2);

        cardEl.style.zIndex     = "300";
        cardEl.style.transition = `transform ${durationMs}ms cubic-bezier(0.45, 0, 0.55, 1), opacity ${durationMs}ms ease`;
        cardEl.style.transform  = `translate(${dx}px, ${dy}px) scale(0.2)`;
        cardEl.style.opacity    = "0.35";
    }

    // -------- Idle-timeout gamble visuals --------
    // Used by AI_brain.js's idleGamble() — the flashy "monster is
    // gambling" banner, and the two card-movement flights (player's
    // card zooming toward the monster on a correct guess; the monster's
    // revealed card slipping into the player's hand on a wrong one).

    // A short pulsing banner below the monster sprite, 10px under its
    // bottom edge. Purely decorative — caller owns removing it (also
    // auto-removes itself after durationMs as a safety net).
    function showFlashyText(message, durationMs) {
        const monster = document.getElementById("monster");
        if (!monster) return;

        const rect = monster.getBoundingClientRect();
        const el = document.createElement("div");
        el.className = "ai-flashy-text";
        el.textContent = message;
        el.style.top  = (rect.bottom + 10) + "px";
        el.style.left = (rect.left + rect.width / 2) + "px";
        document.body.appendChild(el);

        setTimeout(() => el.remove(), durationMs);
    }

    // Flies any element toward the center of another element, shrinking
    // and fading as it goes — the same "fly and shrink" motion as
    // flyToBox() above, just aimed at an arbitrary target instead of
    // always the monster box. Calls onComplete when the flight ends;
    // the element itself is left in place (faded out) for the caller to
    // remove or repurpose.
    function flyCardToElement(el, targetEl, durationMs, onComplete) {
        if (!el || !targetEl) {
            if (onComplete) onComplete();
            return;
        }

        const elRect     = el.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();
        const dx = (targetRect.left + targetRect.width  / 2) - (elRect.left + elRect.width  / 2);
        const dy = (targetRect.top  + targetRect.height / 2) - (elRect.top  + elRect.height / 2);

        el.style.position   = el.style.position || "relative";
        el.style.zIndex     = "300";
        el.style.transition = `transform ${durationMs}ms cubic-bezier(0.45, 0, 0.55, 1), opacity ${durationMs}ms ease`;
        void el.offsetWidth;   // force reflow so the transition applies
        el.style.transform  = `translate(${dx}px, ${dy}px) scale(0.25)`;
        el.style.opacity    = "0.2";

        setTimeout(() => { if (onComplete) onComplete(); }, durationMs);
    }

    // The same "reveal + jump" beat a monster-box slot does when a card
    // is played during the player's own gamble (see Start Game
    // Actions.js's monsterPlaysCard/animateJump) — reimplemented here so
    // this file doesn't reach into Actions.js's private internals. Reuses
    // the existing .jumping CSS animation (Start Game.css).
    function jumpSlot(slotEl, durationMs, onComplete) {
        if (!slotEl) {
            if (onComplete) onComplete();
            return;
        }
        slotEl.classList.add("jumping");
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            slotEl.classList.remove("jumping");
            if (onComplete) onComplete();
        };
        slotEl.addEventListener("animationend", finish, { once: true });
        setTimeout(finish, durationMs);
    }

    // -------- Public API --------
    window.GameAIAnimations = {
        playBeatSequence,
        showFlashyText,
        flyCardToElement,
        jumpSlot,
    };

})();
