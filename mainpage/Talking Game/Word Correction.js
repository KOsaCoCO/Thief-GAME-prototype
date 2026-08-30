// =============================================================
// Word Correction — FIXES GRAMMAR, DOESN'T TOUCH STORAGE
// -------------------------------------------------------------
// Dialogue Brain.js picks a raw word out of the player's dictionary
// (Player Dictionary.js) and drops it into a sentence template. Most
// of the time that's fine — but if the word is a verb like "eat" and
// the sentence needed a noun-like word instead, the result sounds
// broken: "Why do you think about eat so much?" instead of
// "Why do you think about eating so much?"
//
// This file's ONLY job is fixing that: given a word and the
// grammatical FORM a sentence needs at that spot (its base form,
// past tense, past participle, or "-ing" form), it returns the
// correctly-formed word to actually put into the sentence.
//
// IMPORTANT: this never changes anything in Player Dictionary.js.
// The word stays saved exactly as the player typed it — "eat" stays
// "eat" forever in storage. This file only hands back a DIFFERENT,
// temporary spelling to use in one sentence, one time.
//
// This is a simple lookup table, not a real grammar engine — it only
// knows how to conjugate a handful of common verbs. Any word not in
// the table below (nouns, names, emotions, or any verb we've simply
// never added yet) is returned completely unchanged — safe, no
// guessing.
// =============================================================

(function () {
    "use strict";

    // ---- The conjugation table ----
    // One entry per action word we know about. Each entry lists the
    // three forms this file can hand back besides the word's own
    // base/dictionary spelling:
    //   past       -> "I {word} yesterday."      e.g. "ate"
    //   participle -> "I have {word}."           e.g. "eaten"
    //   gerund     -> "I like {word}."           e.g. "eating"
    // Add a new row here any time a new action word is added to
    // Dialogue Brain.js's actions list.
    const VERB_FORMS = {
        run:    { past: "ran",     participle: "run",     gerund: "running" },
        jump:   { past: "jumped",  participle: "jumped",  gerund: "jumping" },
        eat:    { past: "ate",     participle: "eaten",   gerund: "eating" },
        sleep:  { past: "slept",   participle: "slept",   gerund: "sleeping" },
        walk:   { past: "walked",  participle: "walked",  gerund: "walking" },
        talk:   { past: "talked",  participle: "talked",  gerund: "talking" },
        sing:   { past: "sang",    participle: "sung",    gerund: "singing" },
        dance:  { past: "danced",  participle: "danced",  gerund: "dancing" },
        read:   { past: "read",    participle: "read",    gerund: "reading" },
        write:  { past: "wrote",   participle: "written", gerund: "writing" },
        play:   { past: "played",  participle: "played",  gerund: "playing" },
        laugh:  { past: "laughed", participle: "laughed", gerund: "laughing" },
        cry:    { past: "cried",   participle: "cried",   gerund: "crying" },
        fight:  { past: "fought",  participle: "fought",  gerund: "fighting" },
        hide:   { past: "hid",     participle: "hidden",  gerund: "hiding" },
    };

    // ---- Step 1: get one word in one specific grammatical form ----
    // "base" (or leaving form blank) always means "don't change
    // anything — use the word exactly as it was typed."
    function getWordForm(word, form) {
        if (!form || form === "base") return word;

        const knownForms = VERB_FORMS[word];
        if (!knownForms) return word;   // we don't know this word — leave it alone

        return knownForms[form] || word;
    }

    // ---- Step 2: drop a correctly-formed word into a sentence ----
    // Templates (written in Dialogue Brain.js) mark where a word goes
    // using curly braces, in one of two ways:
    //   {word}          -> use the word's base form, unchanged
    //   {word:gerund}   -> use the "-ing" form (also works for
    //                      {word:past} and {word:participle})
    // This function finds that marker in the template, works out
    // which form it's asking for, and swaps in the corrected word.
    function insertWordIntoSentence(template, word) {
        return template.replace(/\{word(?::(\w+))?\}/g, function (fullMatch, requestedForm) {
            return getWordForm(word, requestedForm);
        });
    }

    // -------- Make these functions available to other files --------
    window.WordCorrection = {
        getWordForm: getWordForm,
        insertWordIntoSentence: insertWordIntoSentence,
    };

})();
