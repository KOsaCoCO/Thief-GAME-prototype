// =============================================================
// Dialogue Brain — THE "THINKING"
// -------------------------------------------------------------
// This file decides two things:
//   1. What CATEGORY a word belongs to — food? a tool? a name? an
//      action? an emotion? See CATEGORY_WORDS below.
//   2. How to turn a category + a word into a brand NEW QUESTION to
//      ask the player. See QUESTION_TEMPLATES below.
//
// It reads the player's saved words from Player Dictionary.js, but
// never saves anything itself — saving words is that file's job,
// not this one's.
//
// This is intentionally simple for now: "categorizing" just means
// "is this word in one of the lists below?" — there's no real
// language understanding happening. It's written this way on
// purpose, so it's easy for anyone to make it smarter later just by
// adding more words to the lists.
// =============================================================

(function () {
    "use strict";

    // ---- Step 1: which words belong to which category ----
    // Add more words to these lists any time you like — the more
    // words we recognize, the better the questions can get.
    const CATEGORY_WORDS = {
        food: [
            "apple", "bread", "cheese", "pizza", "chicken", "rice",
            "banana", "cookie", "soup", "cake", "heart", "liver",
            "meat", "fish", "chocolate",
        ],
        tools: [
            "hammer", "knife", "screwdriver", "wrench", "scissors",
            "ladder", "drill", "saw", "needle", "rope",
        ],
        names: [
            "john", "mary", "alex", "sarah", "mike", "anna", "tom",
            "emma", "james", "lisa",
        ],
        actions: [
            "run", "jump", "eat", "sleep", "walk", "talk", "sing",
            "dance", "read", "write", "play", "laugh", "cry", "fight",
            "hide",
        ],
        emotions: [
            "happy", "sad", "angry", "scared", "excited", "nervous",
            "calm", "bored", "curious", "confused", "proud", "lonely",
        ],
    };

    // ---- Step 2: how to turn a category + word into a question ----
    // Each category has a couple of different question shapes, so it
    // doesn't ask the exact same sentence every single time. The text
    // "{word}" gets swapped out for the real word we picked.
    const QUESTION_TEMPLATES = {
        food: [
            "Do you like eating {word}?",
            "Have you tried {word} recently?",
        ],
        tools: [
            "Have you ever used a {word}?",
            "Do you own a {word}?",
        ],
        names: [
            "Do you know anyone named {word}?",
            "Have you met someone called {word}?",
        ],
        actions: [
            "Do you like to {word}?",
            "When was the last time you {word}?",
        ],
        emotions: [
            "What makes you feel {word}?",
            "Do you feel {word} right now?",
        ],
        // Used whenever a word doesn't match any category above.
        uncategorized: [
            "What does \"{word}\" mean to you?",
            "Why did you say \"{word}\"?",
        ],
    };

    // ---- Finding a word's category ----
    // Looks through every category's word list in CATEGORY_WORDS and
    // returns the name of the first one that contains this word.
    // Returns "uncategorized" if no list contains it.
    function categorize(word) {
        const categoryNames = Object.keys(CATEGORY_WORDS);

        for (let i = 0; i < categoryNames.length; i++) {
            const categoryName = categoryNames[i];
            const wordsInThisCategory = CATEGORY_WORDS[categoryName];

            if (wordsInThisCategory.includes(word)) {
                return categoryName;
            }
        }

        return "uncategorized";
    }

    // Picks one random item out of a list. Small helper used a couple
    // of times below.
    function pickRandom(list) {
        const randomIndex = Math.floor(Math.random() * list.length);
        return list[randomIndex];
    }

    // ---- Step 3: building a brand new question ----
    // Looks at every word the player has typed so far (from Player
    // Dictionary.js), sorts them into categories, picks one category
    // and one word from inside it, then fills in a template with
    // that word to make a full question.
    function generateQuestion() {
        // Safety check: if Player Dictionary.js isn't loaded for some
        // reason, fall back to a generic question instead of breaking.
        if (!window.PlayerDictionary) {
            return "Tell me something about yourself.";
        }

        const playerWords = window.PlayerDictionary.getAllWords();
        if (playerWords.length === 0) {
            return "Tell me something about yourself.";
        }

        // Group the player's words by category. For example, this
        // might end up looking like:
        //   { food: ["apple"], uncategorized: ["hello", "yes"] }
        const wordsByCategory = {};
        playerWords.forEach(function (word) {
            const category = categorize(word);
            if (!wordsByCategory[category]) {
                wordsByCategory[category] = [];
            }
            wordsByCategory[category].push(word);
        });

        // Pick one category at random out of the ones we actually
        // have player words for, then pick one word from inside it.
        const availableCategories = Object.keys(wordsByCategory);
        const chosenCategory = pickRandom(availableCategories);
        const chosenWord = pickRandom(wordsByCategory[chosenCategory]);

        // Pick a question shape for that category, and swap in the word.
        const templatesForCategory = QUESTION_TEMPLATES[chosenCategory] || QUESTION_TEMPLATES.uncategorized;
        const chosenTemplate = pickRandom(templatesForCategory);
        return chosenTemplate.replace("{word}", chosenWord);
    }

    // -------- Make these functions available to other files --------
    window.DialogueBrain = {
        categorize: categorize,
        generateQuestion: generateQuestion,
    };

})();
