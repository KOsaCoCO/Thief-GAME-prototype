// =============================================================
// Start Game Wheel Animation
// -------------------------------------------------------------
// Pure visual spin for the prediction wheel — no gamble math, no game
// state, no card logic. Start Game Actions.js decides WHETHER the
// player's high/low call was correct; this file only knows how to
// spin the disc to green (correct) or red (wrong) and report back
// when the spin finishes.
//
// Color meaning: GREEN = you guessed right, RED = you guessed wrong —
// always, regardless of whether the call itself was "high" or "low".
//
// SAFE TO DELETE: without this file, Actions.js's gamble resolves
// instantly with no spin animation — the win/lose logic is unaffected
// either way (it never looks at the wheel to decide anything).
// =============================================================

(function () {
    "use strict";

    // Spins the wheel disc to GREEN if guessedCorrectly is true, or RED
    // if it's false. Reads the disc's current CSS-driven idle-spin angle
    // and animates smoothly onward from there so it never snaps back to
    // 0 first. Resolves once the spin finishes.
    function spinToResult(guessedCorrectly) {
        const wheel = document.getElementById("prediction-wheel");
        const disc  = document.getElementById("wheel-disc");
        if (!wheel || !disc) return Promise.resolve();

        const currentDeg = readRotationDeg(disc);

        // Stop the CSS-driven idle spin and pin the disc to its current angle
        wheel.classList.remove("idle-spinning");
        disc.style.transform = `rotate(${currentDeg}deg)`;
        void disc.offsetWidth;              // force layout flush

        // Target: 0° = green visible (correct guess), 180° = red visible (wrong guess).
        const targetFinalAngle = guessedCorrectly ? 0 : 180;
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

    // -------- Public API --------
    window.GameWheelAnimation = {
        spinToResult,
    };

})();
