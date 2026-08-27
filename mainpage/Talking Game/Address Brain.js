// =============================================================
// Address Brain — WHO IS THE PLAYER TALKING TO OR ABOUT?
// -------------------------------------------------------------
// Dialogue Brain.js normally invents a brand new question out of
// random words from the player's dictionary. But sometimes the
// player's answer itself deserves a direct reply instead of being
// ignored — for example, if they say something like "you are weird"
// they are talking TO the monster, not just giving it a new word to
// play with later.
//
// This file's ONLY job is spotting that: it looks at the words in
// the player's MOST RECENT answer (not the whole dictionary) for a
// few small "pointing words" (pronouns) and figures out who they
// point at:
//   - "you", "your"            -> the player is talking to the MONSTER
//   - "i", "me", "my"          -> the player is talking about THEMSELVES
//   - "they", "them", "their"  -> the player is talking about SOMEONE
//                                 or SOMETHING ELSE
// If it finds one of these, it hands back a ready-to-show reply.
// If it doesn't find any, it hands back nothing (null), which tells
// Dialogue Brain.js "nothing special here, go ahead and ask your
// usual random question instead."
//
// This is NOT added as just another entry in Dialogue Brain's
// CATEGORY_WORDS list, because it doesn't work the same way — the
// other categories (food, tools, etc.) are topics to build a NEW
// question around, but pronouns are about reacting to what was
// ALREADY said. That's different enough to deserve its own file.
//
// This is a simple word-list lookup, not real language understanding
// — it only looks at individual words, not grammar or sentence
// structure. It's written this way on purpose so it's easy for
// anyone to expand later (e.g. adding "he"/"she"/"him"/"her").
// =============================================================

(function () {
    "use strict";

    // ---- The three groups of "pointing words" this file understands ----
    // Feel free to add more words to any of these lists later.
    const SELF_WORDS = ["i", "me", "my", "mine", "myself"];
    const MONSTER_WORDS = ["you", "your", "yours", "yourself"];
    const THIRD_PARTY_WORDS = ["they", "them", "their", "theirs", "themselves"];

    // Common little words that almost never carry any real meaning by
    // themselves. When we're hunting for what "them" might refer to,
    // we skip over words like these so we don't accidentally point at
    // one of them instead of a real noun.
    const STOPWORDS = [
        "a", "an", "the", "is", "was", "are", "were", "am", "be", "been",
        "do", "does", "did", "to", "of", "in", "on", "at", "for", "with",
        "and", "but", "or", "so", "that", "this", "it", "not", "no", "yes",
        "really", "very", "just", "like", "think", "know", "too", "also",
    ];

    // ---- Remembering what the monster last asked about ----
    // If the player says "them" right after the monster asked a
    // question about, say, "pizza", there's a good chance "them"
    // circles back to that. Dialogue Brain.js calls rememberTopic()
    // every time it asks a fresh topic-based question, so this stays
    // up to date. Starts out empty (null) until the first real
    // question has been asked.
    let lastTopicWord = null;

    function rememberTopic(word) {
        lastTopicWord = word;
    }

    // ---- Small helper: does this list of words contain ANY word ----
    // ---- from that OTHER list? ----
    function containsAny(words, wordsToLookFor) {
        return words.some(function (word) {
            return wordsToLookFor.includes(word);
        });
    }

    // Picks one random item out of a list.
    function pickRandom(list) {
        const randomIndex = Math.floor(Math.random() * list.length);
        return list[randomIndex];
    }

    // ---- Checking whether the sentence ALSO has a "real" topic ----
    // Used only for self-reference ("I"/"me"/"my"). Those words show
    // up in almost every sentence a player types ("I like pizza", "I
    // don't know"), so reacting to them every single time would bury
    // the much richer food/tools/names/etc. questions Dialogue
    // Brain.js can normally ask. So: if the sentence ALSO contains a
    // word that belongs to one of those real categories (like
    // "pizza"), let Dialogue Brain.js use that instead — only react
    // to "I/me/my" when there's nothing more interesting to go on.
    function sentenceHasOtherTopic(words) {
        if (!window.DialogueBrain) return false; // can't check — assume no

        return words.some(function (word) {
            if (SELF_WORDS.includes(word)) return false;
            if (MONSTER_WORDS.includes(word)) return false;
            if (THIRD_PARTY_WORDS.includes(word)) return false;
            if (STOPWORDS.includes(word)) return false;
            return window.DialogueBrain.categorize(word) !== "uncategorized";
        });
    }

    // ---- Figuring out what "them"/"they"/"their" points at ----
    // Looks through the player's sentence for some OTHER word (not a
    // pronoun, not a stopword) to guess as the answer. If Dialogue
    // Brain.js is available, it prefers a word that belongs to one of
    // its real categories (a proper noun-like word) over a random
    // leftover word. If nothing usable is found in the sentence, it
    // falls back to whatever the monster last asked about. If even
    // that doesn't exist yet, it gives up and returns null.
    function findThirdPartyReferent(words) {
        const allPronouns = SELF_WORDS.concat(MONSTER_WORDS, THIRD_PARTY_WORDS);

        const candidates = words.filter(function (word) {
            return !allPronouns.includes(word) && !STOPWORDS.includes(word);
        });

        if (window.DialogueBrain) {
            const categorizedCandidate = candidates.find(function (word) {
                return window.DialogueBrain.categorize(word) !== "uncategorized";
            });
            if (categorizedCandidate) return categorizedCandidate;
        }

        if (candidates.length > 0) return candidates[0];

        return lastTopicWord; // may still be null — that's fine, caller handles it
    }

    // ---- The three kinds of replies this file can build ----

    const MONSTER_REACTIONS = [
        "Me? How curious that you'd bring me into this.",
        "Oh, so you noticed me...",
        "Talking about me now, are we?",
    ];
    const MONSTER_FOLLOWUPS = [
        "Why do you think that about me?",
        "What made you think of me just now?",
        "What else do you want to know about me?",
    ];

    function buildMonsterResponse() {
        return pickRandom(MONSTER_REACTIONS) + " " + pickRandom(MONSTER_FOLLOWUPS);
    }

    const SELF_REACTIONS = [
        "Oh, so this is about you...",
        "Interesting how quickly you talk about yourself.",
    ];
    const SELF_FOLLOWUPS = [
        "Tell me something else about yourself — what do you hide from everyone?",
        "What's something about you that nobody else knows?",
    ];

    function buildSelfResponse() {
        return pickRandom(SELF_REACTIONS) + " " + pickRandom(SELF_FOLLOWUPS);
    }

    // These two use "{word}" as a stand-in for whatever
    // findThirdPartyReferent() guessed.
    const THIRD_PARTY_REACTIONS = [
        "Ahh, {word}... interesting that you'd bring that up.",
        "So it's {word} you're talking about...",
    ];
    const THIRD_PARTY_FOLLOWUPS = [
        "What does that mean to you, really?",
        "Why do you think of it that way?",
    ];
    // Used only when NO referent could be guessed at all.
    const THIRD_PARTY_UNRESOLVED = [
        "Them? I'm not sure who you mean... but I'd love to find out.",
        "Who exactly are you talking about?",
    ];

    function buildThirdPartyResponse(words) {
        const referentWord = findThirdPartyReferent(words);

        if (!referentWord) {
            return pickRandom(THIRD_PARTY_UNRESOLVED);
        }

        const reaction = pickRandom(THIRD_PARTY_REACTIONS).replace("{word}", referentWord);
        const followup = pickRandom(THIRD_PARTY_FOLLOWUPS);
        return reaction + " " + followup;
    }

    // ---- The main entry point Dialogue Brain.js calls ----
    // Give it the list of words from the player's LATEST answer (not
    // their whole dictionary). Returns a ready-to-show reply string,
    // or null if nothing pronoun-related was found — in which case
    // Dialogue Brain.js should go ahead and build its own random
    // question instead.
    //
    // Order matters here: being addressed directly ("you") is checked
    // first since it's the clearest signal, then "them" (also fairly
    // rare and meaningful), and self-reference ("I/me") last, since
    // it's the most common and easiest to accidentally trigger on.
    function analyzeAnswer(words) {
        if (!words || words.length === 0) return null;

        if (containsAny(words, MONSTER_WORDS)) {
            return buildMonsterResponse();
        }

        if (containsAny(words, THIRD_PARTY_WORDS)) {
            return buildThirdPartyResponse(words);
        }

        if (containsAny(words, SELF_WORDS) && !sentenceHasOtherTopic(words)) {
            return buildSelfResponse();
        }

        return null;
    }

    // -------- Make these functions available to other files --------
    window.AddressBrain = {
        analyzeAnswer: analyzeAnswer,
        rememberTopic: rememberTopic,
    };

})();
