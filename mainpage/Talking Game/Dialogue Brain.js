// =============================================================
// Dialogue Brain — THE "THINKING"
// -------------------------------------------------------------
// This file decides three things:
//   1. What CATEGORY a word belongs to — food? a tool? a name? an
//      action? an emotion? See CATEGORY_WORDS below.
//   2. What SHAPE a question should take. There are two sources of
//      shapes now:
//        - QUESTION_TEMPLATES: a few shapes specific to each
//          category (a food question sounds a bit different from a
//          tool question).
//        - WH_FRAMES: general-purpose shapes built around the five
//          classic question words — How, Why, What, Where, When —
//          that work with almost any word. These add variety on
//          top of the category-specific ones.
//   3. What TONE the questions are written in. On the surface, every
//      question here should sound like a curious child just wants
//      to know more. Underneath, the wording should feel a little
//      too interested — like it's collecting something, or testing
//      you, without ever saying so outright. Keep this in mind if
//      you add new templates: curious first, unsettling second.
//
// It reads the player's saved words from Player Dictionary.js, but
// never saves anything itself — saving words is that file's job,
// not this one's. Before a finished question is handed back, the
// chosen word also passes through Word Correction.js, which fixes
// its grammar for that one sentence (e.g. "eat" -> "eating") without
// ever changing the word as it's actually saved in the dictionary.
//
// Before inventing a brand new random question, this file first
// checks with Address Brain.js to see if the player's LATEST answer
// was actually talking TO the monster ("you"), ABOUT themselves
// ("I"/"me"), or about SOMEONE/SOMETHING ELSE ("them"). If so, it
// uses that direct reply instead of a random question — see
// Address Brain.js for how that decision gets made.
//
// This is intentionally simple for now: "categorizing" just means
// "is this word in one of the lists below?" — there's no real
// language understanding happening. It's written this way on
// purpose, so it's easy for anyone to make it smarter later just by
// adding more words, templates, or frames.
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

    // ---- Step 2a: question shapes specific to each category ----
    // On purpose, NONE of these can be answered with just "yes",
    // "no", or one word — they all ask the player to explain
    // something, which is exactly what a nosy, too-curious monster
    // would want. The text "{word}" gets swapped for the real word.
    const QUESTION_TEMPLATES = {
        food: [
            "What does {word} taste like right before it's all gone?",
            "Why do you think {word} makes you feel safe?",
        ],
        tools: [
            "How would you use a {word} if it were the only thing left?",
            "What would you do with a {word} if nobody else was watching?",
        ],
        names: [
            "What do you think {word} is doing right now, at this exact moment?",
            "Why does {word} matter so much to you?",
        ],
        actions: [
            "Why do you like to {word} when you think no one can see you?",
            "What happens inside you, right before you {word}?",
        ],
        emotions: [
            "What does it feel like when {word} takes over completely?",
            "Why won't you tell me exactly what makes you {word}?",
        ],
        // Used whenever a word doesn't match any category above.
        uncategorized: [
            "What made you choose the word \"{word}\", out of every word you know?",
            "Why do you think \"{word}\" came to mind just now?",
        ],
    };

    // ---- Step 2b: general-purpose "model frames" ----
    // These are the same open-ended shapes no matter what word gets
    // dropped in — grouped by the classic question word they start
    // with, so it's easy to see (and add to) each one on its own.
    // generateQuestion() below mixes these in with the category
    // templates above for extra variety.
    //
    // Every slot here uses {word:gerund} instead of plain {word}.
    // These frames all treat the word like a TOPIC ("thinking about
    // ___", "dream about ___"), which needs the "-ing" form to sound
    // right — "thinking about eating", not "thinking about eat". See
    // Word Correction.js for how {word:gerund} actually gets turned
    // into the right spelling (and for words that AREN'T verbs, like
    // "apple", it's simply left unchanged — nothing breaks).
    const WH_FRAMES = {
        why: [
            "Why do you think about {word:gerund} so much?",
            "Why does {word:gerund} keep coming back to your mind?",
        ],
        what: [
            "What would happen if {word:gerund} was taken away from you forever?",
            "What's the very worst thing that could happen because of {word:gerund}?",
        ],
        how: [
            "How did you first learn about {word:gerund}?",
            "How would you feel if I knew everything about {word:gerund} too?",
        ],
        where: [
            "Where do you keep {word:gerund} when no one is watching?",
            "Where would you hide {word:gerund}, if you had to hide it from me?",
        ],
        when: [
            "When did you last dream about {word:gerund}?",
            "When was the last time {word:gerund} scared you?",
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

    // Flattens WH_FRAMES (which is grouped by "why"/"what"/"how"/etc.)
    // into one single list of templates, so it can be mixed in with a
    // category's own templates without caring which WH-word each one
    // started as.
    function getAllWhFrames() {
        let allFrames = [];
        Object.keys(WH_FRAMES).forEach(function (whWord) {
            allFrames = allFrames.concat(WH_FRAMES[whWord]);
        });
        return allFrames;
    }

    // ---- Step 3: building a brand new question ----
    // Looks at every word the player has typed so far (from Player
    // Dictionary.js), sorts them into categories, picks one category
    // and one word from inside it, then picks a question shape —
    // either one of that category's own templates, or one of the
    // general WH_FRAMES — and fills in that shape with the word.
    //
    // "lastAnswerWords" is the list of words from the player's answer
    // that was JUST submitted (not their whole dictionary) — it's
    // only used to check with Address Brain.js first. Pass an empty
    // list (or nothing) if there's no previous answer yet, like on
    // the very first question of the game.
    function generateQuestion(lastAnswerWords) {
        // Was the player talking TO the monster, ABOUT themselves, or
        // about someone/something ELSE? If so, reply to that directly
        // instead of asking an unrelated random question.
        if (window.AddressBrain) {
            const addressedReply = window.AddressBrain.analyzeAnswer(lastAnswerWords || []);
            if (addressedReply) return addressedReply;
        }

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

        // Combine that category's own templates with the general
        // WH_FRAMES, then pick one shape at random from the mix —
        // this is what gives the questions their variety.
        const categoryTemplates = QUESTION_TEMPLATES[chosenCategory] || QUESTION_TEMPLATES.uncategorized;
        const allPossibleTemplates = categoryTemplates.concat(getAllWhFrames());
        const chosenTemplate = pickRandom(allPossibleTemplates);

        // Remember this word as "what the monster just asked about",
        // so Address Brain.js can guess what the player means later
        // if they answer with something vague like "them".
        if (window.AddressBrain) {
            window.AddressBrain.rememberTopic(chosenWord);
        }

        // Some templates ask for a specific grammar form, like
        // {word:gerund} — Word Correction.js is the file that knows
        // how to turn "eat" into "eating" for a spot like that. This
        // never changes what's saved in the player's dictionary, only
        // what gets written into THIS one sentence.
        if (window.WordCorrection) {
            return window.WordCorrection.insertWordIntoSentence(chosenTemplate, chosenWord);
        }

        // Word Correction.js isn't loaded for some reason — fall back
        // to just using the word exactly as typed, so a question still
        // comes out instead of the page breaking.
        return chosenTemplate.replace(/\{word(?::\w+)?\}/, chosenWord);
    }

    // -------- Make these functions available to other files --------
    window.DialogueBrain = {
        categorize: categorize,
        generateQuestion: generateQuestion,
    };

})();
