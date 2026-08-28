// =============================================================
// Talking Game — PAGE CONTROLLER
// -------------------------------------------------------------
// This file is deliberately thin. It does three things:
//   1. Shows a random monster picture and the very first line
//      (Engine.greet()) when the page loads.
//   2. Sends whatever the player types to Engine.respond() when they
//      press Enter, and shows whatever line comes back.
//   3. Keeps the debug panel in sync with the engine's state after
//      every turn.
//
// It does NOT decide what anything MEANS or SAYS — that's Engine.js
// (the pipeline) and Monster Content.js (the persona/rules) doing
// all of the real work. This file just connects the page's boxes and
// buttons to Engine.respond()/Engine.greet().
// =============================================================

(function () {
    "use strict";

    // Reuses the monster pictures already made for the card game —
    // no new art needed. The "../" goes up one folder (out of
    // "Talking Game") before going into "Start Game/images".
    const MONSTER_IMAGES = [
        "../Start Game/images/monster_1.png",
        "../Start Game/images/monster_2.png",
        "../Start Game/images/monster_3.png",
    ];

    // The engine's own state for this player — loaded once, then
    // carried through every turn. See Engine.js for its shape and
    // Engine.saveState()/loadState() for how it survives a refresh.
    let state = null;

    // ---- Show a random monster picture ----
    function showRandomMonster() {
        const monsterImageEl = document.getElementById("monster-image");
        if (!monsterImageEl) return;
        const randomIndex = Math.floor(Math.random() * MONSTER_IMAGES.length);
        monsterImageEl.src = MONSTER_IMAGES[randomIndex];
    }

    // ---- Display whatever the monster just said ----
    function showQuestion(text) {
        const questionEl = document.getElementById("question-text");
        if (questionEl) questionEl.textContent = text;
    }

    // ---- Debug panel: a plain, read-only view of the engine state ----
    // Shows the current turn/trust/mood, the topic stack, the fact
    // table, and any open debts — see Engine.js's buildDebugSnapshot().
    function renderDebugPanel(debug) {
        const panelEl = document.getElementById("debug-panel");
        if (!panelEl || !debug) return;

        const topicsText = debug.topics.length
            ? debug.topics.map(function (t) { return t.id + " (" + t.type + ", " + t.weight + ")"; }).join(", ")
            : "—";

        const factKeys = Object.keys(debug.facts);
        const factsText = factKeys.length
            ? factKeys.map(function (key) { return key + ": " + debug.facts[key]; }).join(", ")
            : "—";

        const debtsText = debug.debts.length
            ? debug.debts.map(function (d) { return "\"" + d.text + "\" [" + d.status + "]"; }).join(", ")
            : "—";

        document.getElementById("debug-turn").textContent = debug.turn;
        document.getElementById("debug-trust").textContent = debug.trust;
        document.getElementById("debug-mood").textContent = debug.mood;
        document.getElementById("debug-topics").textContent = topicsText;
        document.getElementById("debug-facts").textContent = factsText;
        document.getElementById("debug-debts").textContent = debtsText;
    }

    // ---- Handle the player pressing Enter in the input box ----
    function onAnswerSubmitted() {
        const inputEl = document.getElementById("answer-input");
        if (!inputEl || !window.Engine) return;

        const answerText = inputEl.value;
        if (answerText.trim().length === 0) return; // ignore empty answers

        const result = window.Engine.respond(answerText, state, window.MonsterContent);
        showQuestion(result.text);
        renderDebugPanel(result.debug);

        inputEl.value = "";
    }

    // ---- Set everything up once the page has finished loading ----
    document.addEventListener("DOMContentLoaded", function () {
        showRandomMonster();

        if (window.Engine && window.MonsterContent) {
            state = window.Engine.loadState();
            const greeting = window.Engine.greet(state, window.MonsterContent);
            showQuestion(greeting.text);
            renderDebugPanel(greeting.debug);
        }

        const inputEl = document.getElementById("answer-input");
        if (inputEl) {
            inputEl.addEventListener("keydown", function (event) {
                if (event.key === "Enter") onAnswerSubmitted();
            });
        }
    });

})();
