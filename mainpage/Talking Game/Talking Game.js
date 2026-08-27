// =============================================================
// Talking Game — PAGE CONTROLLER
// -------------------------------------------------------------
// This file runs the actual conversation on the page:
//   1. Shows a random monster picture when the page opens.
//   2. Asks two fixed questions first, in this order:
//        "Are you human?"
//        "Do you like hearts or livers?"
//   3. Every time the player types an answer and presses Enter, it
//      splits that answer into separate words and hands them to
//      Player Dictionary.js to remember.
//   4. Once both fixed questions have been asked, it asks
//      Dialogue Brain.js to invent a new question out of the words
//      the player has used so far — and keeps doing that forever.
//
// This file does NOT decide what a word means (that's Dialogue
// Brain.js), does NOT decide if the player was addressing the
// monster or someone else (that's Address Brain.js), and does NOT
// save anything itself (that's Player Dictionary.js) — it just
// connects the page's boxes and buttons to those files.
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

    // The two questions the monster always asks first, in this exact
    // order. Once both have been asked, askNextQuestion() below
    // switches over to Dialogue Brain.js instead.
    const FIXED_QUESTIONS = [
        "Are you human?",
        "Do you like hearts or livers?",
    ];

    // How many of the fixed questions we've already asked.
    let fixedQuestionsAsked = 0;

    // ---- Step 1: show a random monster picture ----
    function showRandomMonster() {
        const monsterImageEl = document.getElementById("monster-image");
        if (!monsterImageEl) return;

        const randomIndex = Math.floor(Math.random() * MONSTER_IMAGES.length);
        monsterImageEl.src = MONSTER_IMAGES[randomIndex];
    }

    // ---- Step 2: turn a typed sentence into a clean list of words ----
    // Example: "I really like Pizza!!" becomes:
    //   ["i", "really", "like", "pizza"]
    function splitIntoWords(sentence) {
        return sentence
            .toLowerCase()
            // Replace anything that ISN'T a letter or a number with a
            // space, so punctuation like "!" or "," never sticks to a word.
            .replace(/[^a-z0-9]+/g, " ")
            .trim()
            .split(" ")
            .filter(function (word) {
                return word.length > 0;   // drop any empty leftovers
            });
    }

    // ---- Step 3: display whatever the current question is ----
    function showQuestion(questionText) {
        const questionEl = document.getElementById("question-text");
        if (questionEl) questionEl.textContent = questionText;
    }

    // ---- Step 4: work out and show the NEXT question ----
    // "lastAnswerWords" is the tokenized version of whatever the
    // player just typed (empty/undefined on the very first question,
    // since there's no previous answer yet). It's passed straight
    // through to Dialogue Brain.js so it can check with Address
    // Brain.js whether this answer deserves a direct reply instead of
    // a random new question.
    function askNextQuestion(lastAnswerWords) {
        // Still have fixed questions left? Ask the next one in order.
        if (fixedQuestionsAsked < FIXED_QUESTIONS.length) {
            showQuestion(FIXED_QUESTIONS[fixedQuestionsAsked]);
            fixedQuestionsAsked = fixedQuestionsAsked + 1;
            return;
        }

        // Out of fixed questions — let the Dialogue Brain make one up
        // from the player's own words.
        if (window.DialogueBrain) {
            showQuestion(window.DialogueBrain.generateQuestion(lastAnswerWords));
        }
    }

    // ---- Step 5: handle the player pressing Enter in the input box ----
    function onAnswerSubmitted() {
        const inputEl = document.getElementById("answer-input");
        if (!inputEl) return;

        const answerText = inputEl.value;
        if (answerText.trim().length === 0) return;   // ignore empty answers

        const words = splitIntoWords(answerText);
        if (window.PlayerDictionary) {
            window.PlayerDictionary.addWords(words);
        }

        inputEl.value = "";   // clear the box, ready for the next answer
        askNextQuestion(words);
    }

    // ---- Set everything up once the page has finished loading ----
    document.addEventListener("DOMContentLoaded", function () {
        showRandomMonster();
        askNextQuestion();   // shows the very first question

        const inputEl = document.getElementById("answer-input");
        if (inputEl) {
            inputEl.addEventListener("keydown", function (event) {
                if (event.key === "Enter") {
                    onAnswerSubmitted();
                }
            });
        }
    });

})();
