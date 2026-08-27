// =============================================================
// Player Dictionary — STORAGE ONLY
// -------------------------------------------------------------
// This file has ONE job: remember words the player has typed, and
// save/load that list so it's still there next time they visit.
//
// It does NOT do any "thinking" about the words — no figuring out
// what a word means or what category it belongs to, and no building
// of questions. That work lives in "Dialogue Brain.js" instead. This
// file just keeps the data safe.
//
// How the data is shaped: a simple object where each key is a word
// and the value is how many times the player has typed it, e.g.:
//     { "apple": 2, "run": 1 }
//
// It's saved in the browser's own storage (called "localStorage"),
// under one key, so it survives closing the page and coming back.
// =============================================================

(function () {
    "use strict";

    // The name we save our data under in the browser's storage.
    const STORAGE_KEY = "talkingGameWordLibrary";

    // Our in-memory copy of the dictionary. Filled in once, right
    // when this file first runs (see loadFromBrowser() just below),
    // then kept up to date every time a new word comes in.
    let wordLibrary = loadFromBrowser();

    // ---- Reading the saved dictionary from the browser ----
    // Returns an empty dictionary if nothing has been saved yet, or
    // if something goes wrong while reading (so a corrupted save
    // can never crash the page — we just start fresh instead).
    function loadFromBrowser() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (!saved) return {};
            return JSON.parse(saved);
        } catch (error) {
            console.warn("[player-dictionary] Could not read saved words — starting fresh.", error);
            return {};
        }
    }

    // ---- Writing the current dictionary back to the browser ----
    function saveToBrowser() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(wordLibrary));
    }

    // ---- Adding new words ----
    // Takes a list of words (already cleaned up and lowercased by
    // whoever calls this — see Talking Game.js) and adds them to the
    // dictionary, counting how many times each word has been seen.
    function addWords(words) {
        words.forEach(function (word) {
            if (!word) return;   // skip empty entries, just in case

            if (wordLibrary[word]) {
                wordLibrary[word] = wordLibrary[word] + 1;
            } else {
                wordLibrary[word] = 1;
            }
        });

        saveToBrowser();
    }

    // ---- Reading back what we know ----

    // Returns every unique word the player has ever typed, as a plain
    // list with no counts — this is what Dialogue Brain.js reads from
    // when it wants to pick a word to build a question around.
    function getAllWords() {
        return Object.keys(wordLibrary);
    }

    // Returns the full dictionary: word -> how many times it was used.
    function getWordCounts() {
        return wordLibrary;
    }

    // -------- Make these functions available to other files --------
    // Any other file can now call PlayerDictionary.addWords([...]),
    // PlayerDictionary.getAllWords(), etc.
    window.PlayerDictionary = {
        addWords: addWords,
        getAllWords: getAllWords,
        getWordCounts: getWordCounts,
    };

})();
