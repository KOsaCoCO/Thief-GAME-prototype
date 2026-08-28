// =============================================================
// Monster Content — WHO THE MONSTER IS AND WHAT IT SAYS
// -------------------------------------------------------------
// Everything in this file is DATA for Engine.js to run — persona,
// word categories, pronoun bindings, the self-tagged tone table,
// permanent-fact patterns, and the full response-rule table. This
// file never runs the conversation itself; Engine.js does that,
// completely unchanged, no matter what content it's handed. That
// split (engine owns the pipeline, content owns the words) is the
// whole point of the handbook this is built from.
//
// ---- THE MONSTER, IN ONE PARAGRAPH ----
// This is a MIMICRY MONSTER. Every question it asks is secretly
// research: it wants to learn everything about the player — habits,
// memories, feelings, the way they talk — so it can eventually copy
// them perfectly and take their place. That is the actual point of
// the whole game: the player has to keep enough of themselves
// hidden/protected that the monster can never finish its copy, while
// the monster keeps pushing, gently, to learn more. On the surface it
// should always sound curious and almost friendly — the danger is
// that it's likeable, not that it's obviously evil.
//
// The idea is loosely inspired by the "skin-walker" (yee naaldlooshii)
// figure from Navajo folklore — a shapeshifter associated with
// deception. This game's monster is its own original fictional
// creature; it borrows the "wears another person's shape" idea as
// inspiration, not a claim to depict that belief accurately.
// =============================================================

(function () {
    "use strict";

    // ---- Who the monster is ----
    const persona = {
        kind: "Mimicry Monster",
        inspiration: "Loosely inspired by the skin-walker (yee naaldlooshii) figure from Navajo folklore — a shapeshifter known for deception. This is an original fictional creature, not a depiction of that belief.",
        trueGoal: "Learn everything it can about the player so it can eventually mimic them perfectly and take their place.",
        surfaceGoal: "Seems like idle curiosity — 'I just want to get to know you.' Every question is secretly research.",
        coreConflict: "The main game premise: the player must keep enough of themselves hidden that the monster can never finish its copy, while the monster keeps pushing to learn more.",
        tone: "Curious like a child on the surface, patient and calculating underneath. Never openly evil — the danger is that it's likeable.",
    };

    // ---- Step 1: which words belong to which category ----
    // Shelved after WordNet's own noun lexicographer categories
    // (noun.food, noun.animal, noun.artifact, noun.body, noun.feeling,
    // noun.location, noun.phenomenon, noun.attribute, noun.person) —
    // a well-established way of splitting up vocabulary — plus a
    // handful of practical, conversational categories (sports, music,
    // vehicles, technology) that people actually talk about but
    // aren't their own WordNet file. Add more words to any list any
    // time — the more we recognize, the better the questions and
    // reactions can get.
    //
    // NOTE on "food": this is EDIBLE items only (things you'd eat or
    // drink). A food-RELATED but non-edible word — "fork", "kitchen",
    // "recipe" — belongs in "tools"/"places" instead, not here.
    const CATEGORY_WORDS = {
        // noun.food — edible only, see the note above.
        food: ["apple", "bread", "cheese", "pizza", "chicken", "rice", "banana", "cookie", "soup", "cake", "heart", "liver", "meat", "fish", "chocolate", "egg", "milk", "coffee", "tea", "honey", "salad", "sandwich"],
        // noun.artifact (hand tools specifically — bigger artifact
        // types like vehicles/technology/clothing get their own
        // category below instead of one giant "objects" bucket).
        tools: ["hammer", "knife", "screwdriver", "wrench", "scissors", "ladder", "drill", "needle", "rope", "nail", "shovel", "axe"],
        // proper names — not a WordNet category (those are common
        // nouns), kept for pronoun-binding / "who" questions.
        names: ["john", "mary", "alex", "sarah", "mike", "anna", "tom", "emma", "james", "lisa"],
        // verb-ish "doing" words — deliberately separate from every
        // noun.* category above.
        actions: ["run", "jump", "eat", "sleep", "walk", "talk", "sing", "dance", "read", "write", "play", "laugh", "cry", "fight", "hide"],
        // noun.feeling
        emotions: ["happy", "sad", "angry", "scared", "excited", "nervous", "calm", "bored", "curious", "confused", "proud", "lonely", "care", "worried", "jealous", "grateful", "hopeful"],
        // noun.body + noun.attribute (physical description) — the
        // category "face" should have landed in from the start.
        appearance: ["face", "hair", "eyes", "smile", "skin", "body", "tall", "short", "beautiful", "handsome", "cute", "ugly", "pretty"],
        // noun.animal
        animals: ["dog", "cat", "bird", "fish", "horse", "lion", "tiger", "bear", "wolf", "rabbit", "snake", "elephant", "mouse", "cow", "pig", "sheep"],
        // practical conversational category, not its own WordNet file.
        sports: ["soccer", "basketball", "tennis", "baseball", "football", "hockey", "golf", "swimming", "running", "boxing", "volleyball", "cricket", "skiing", "cycling"],
        // practical conversational category, not its own WordNet file.
        music: ["guitar", "piano", "drums", "violin", "song", "melody", "concert", "band", "singer", "album", "rhythm", "beat"],
        // noun.artifact (transportation specifically).
        vehicles: ["car", "bus", "train", "bike", "motorcycle", "truck", "plane", "boat", "ship", "scooter"],
        // noun.phenomenon
        weather: ["rain", "snow", "sun", "wind", "storm", "cloud", "thunder", "lightning", "fog", "ice", "hail"],
        // noun.attribute (color specifically).
        colors: ["red", "blue", "green", "yellow", "black", "white", "purple", "orange", "pink", "brown", "gray"],
        // noun.location
        places: ["school", "home", "city", "forest", "mountain", "beach", "park", "store", "hospital", "church", "village", "desert"],
        // noun.artifact (electronics specifically).
        technology: ["phone", "computer", "internet", "robot", "screen", "camera", "laptop", "keyboard", "software", "app"],
    };

    // ---- Every entity type a player-typed word can carry ----
    // Derived from CATEGORY_WORDS itself (not hand-listed) so adding
    // a new category above automatically makes it a real "topic" —
    // no separate list to remember to update.
    const CONTENT_TOPIC_TYPES = Object.keys(CATEGORY_WORDS);
    const DYNAMIC_TYPES = CONTENT_TOPIC_TYPES.concat(["uncategorized"]);

    // ---- A small guardrail against homographs (same spelling, ----
    // ---- different meaning) ----
    // A plain word-list lookup gets this wrong: "saw" is in `tools`,
    // so "I saw your face" would get miscategorized as a tool. Each
    // entry here says which words RIGHT BEFORE it mean "this is
    // actually being used as a verb" — if the word just before isn't
    // one of those, it falls back to the noun/object reading. Add
    // more ambiguous words here as they come up.
    const AMBIGUOUS_WORDS = {
        saw: {
            // "I saw", "we saw", "who saw", "never saw"... -> verb
            // (past tense of "see"), not the tool.
            verbAfter: ["i", "you", "we", "they", "he", "she", "who", "never", "just", "finally", "always"],
            verbCategory: "actions",
            nounCategory: "tools",
        },
    };

    function categorize(word, prevWord) {
        const ambiguous = AMBIGUOUS_WORDS[word];
        if (ambiguous) {
            if (prevWord && ambiguous.verbAfter.indexOf(prevWord) !== -1) return ambiguous.verbCategory;
            return ambiguous.nounCategory;
        }

        const categoryNames = Object.keys(CATEGORY_WORDS);
        for (let i = 0; i < categoryNames.length; i++) {
            if (CATEGORY_WORDS[categoryNames[i]].indexOf(word) !== -1) return categoryNames[i];
        }
        return "uncategorized";
    }

    // ---- Step 2: pronoun bindings, for Engine.js's resolveRefs() ----
    // "You"/"I"/"me" only ever mean two people, so they bind directly.
    // "They"/"them"/"their" could mean any content word, so those are
    // bound against whichever matching topic was mentioned most
    // recently — see Engine.js.
    const fixedPronouns = {
        you: "monster", your: "monster", yours: "monster", yourself: "monster",
        i: "player", me: "player", my: "player", mine: "player", myself: "player",
    };
    const dynamicPronouns = {
        they: DYNAMIC_TYPES, them: DYNAMIC_TYPES, their: DYNAMIC_TYPES,
        theirs: DYNAMIC_TYPES, themselves: DYNAMIC_TYPES,
    };

    // ---- Step 3: the self-tagged tone table ----
    // Every tag the player can type anywhere in their answer (like
    // "/th" or "/gen"), mapped to one shared tone name. Some tags are
    // just aliases of each other (e.g. "/sx" and "/x" both mean the
    // same thing).
    const tagToneMap = {
        "/s": "sarcastic",
        "/j": "joking",
        "/hj": "halfJoking",
        "/srs": "serious",
        "/nsrs": "nonSerious",
        "/gen": "genuine", "/g": "genuine",
        "/genq": "genuineQuestion",
        "/lh": "lightHearted",
        "/nm": "notMad",
        "/lu": "littleUpset",
        "/vu": "veryUpset",
        "/t": "teasing",
        "/p": "platonic",
        "/r": "romantic",
        "/sx": "sexual", "/x": "sexual",
        "/nsx": "nonSexual", "/nx": "nonSexual",
        "/pos": "positive", "/pc": "positive",
        "/neg": "negative", "/nc": "negative",
        "/neu": "neutral",
        "/hyp": "hyperbole",
        "/m": "metaphor",
        "/li": "literal",
        "/rh": "rhetorical", "/rt": "rhetorical",
        "/c": "copypasta",
        "/ly": "lyrics",
        "/ref": "reference",
        "/ij": "insideJoke",
        "/f": "fake",
        "/th": "threat",
        "/cb": "clickbait",
        "/nbh": "nobodyHere",
        "/nsb": "notSubtweeting",
        "/pa": "passiveAggressive",
        "/npa": "notPassiveAggressive",
        "/nh": "notHostile",
        "/a": "affectionate",
        "/w": "warm",
        "/co": "comforting",
        "/cwh": "copingWithHumor",
        "/bj": "badJoke",
        "/fx": "flex",
        "/nabr": "notABrag",
        "/cr": "cringey",
        "/ui": "unironic",
        "/tan": "tangent",
        "/nao": "notAnOrder",
        "/naq": "notAQuestion",
        "/ny": "notYelling",
    };

    // Sentence markers only ever REINFORCE a tone that's already
    // tagged — see Engine.js's classify(). They never invent a tone
    // out of punctuation alone.
    const punctuationNudges = {
        trailingEllipsis: ["nonSerious", "tangent"],
        allCaps: ["veryUpset", "threat", "hyperbole"],
        tilde: ["sarcastic", "teasing", "lightHearted"],
        endsWithQuestion: ["genuineQuestion", "rhetorical"],
        multipleExclamation: ["hyperbole", "veryUpset", "flex"],
        endsWithPeriodOnly: ["literal", "neutral", "notAnOrder"],
    };

    // ---- Step 4: how tone moves trust and mood ----
    const trustNudges = {
        positive: 1, warm: 1, affectionate: 1, genuine: 1, comforting: 1, notHostile: 1,
        threat: -2, negative: -1, passiveAggressive: -1, veryUpset: -1,
    };
    const moodNudges = {
        joking: 1, lightHearted: 1, teasing: 1, badJoke: 1, copingWithHumor: 1,
        veryUpset: -1, threat: -1, littleUpset: -1, negative: -1,
    };

    // Intents that make an episode more likely to be recalled later.
    const importantIntents = ["threat", "romantic", "serious", "veryUpset", "genuine", "address_monster"];

    // ---- Step 5: permanent facts the monster can learn ----
    // Store {value, turn, confidence}, never a bare string — see
    // Engine.js's extractSlots(). "playerName" is deliberately here:
    // learning the player's real name/identity IS the monster's whole
    // goal, so this slot is thematically the most important one.
    const slots = [
        {
            id: "playerName",
            patterns: [/my name is ([a-z]+)/, /call me ([a-z]+)/, /i am called ([a-z]+)/],
            clean: function (v) { return v.charAt(0).toUpperCase() + v.slice(1); },
        },
        {
            id: "foodPreference",
            patterns: [/(hearts?|livers?)/],
            confidence: 0.6,
        },
    ];

    // ---- Step 6a: the two fixed opening questions ----
    // Looked up directly by id in Engine.js's greet() — turn 0 always
    // gets "ask_human"; a returning player (loaded with turn > 0 from
    // localStorage) gets "welcome_back" instead of repeating itself.
    const ASK_FOOD = {
        text: "Do you like hearts or livers?",
        expects: ["*any*"],
        slot: "foodPreference",
        onAny: ["Noted. I'll remember exactly what you like the taste of."],
    };

    const introRules = [
        {
            id: "ask_human",
            lines: ["Evening. Don't think I've seen your face in here before."],
            ask: {
                text: "Are you human?",
                expects: ["*yesno*"],
                onYes: ["Human, hm. That makes this so much easier."],
                onNo: ["Not human. How refreshing — and how convenient for me."],
                thenAsk: ASK_FOOD,
            },
        },
        {
            id: "welcome_back",
            lines: ["You again. I remember faces.", "Back so soon. I was hoping you would be."],
        },
    ];

    // ---- Step 6b: one rule per self-tagged tone ----
    // Migrated straight from the old Monster Dictionary.js — same
    // lines, same voice, just reshaped into gated+scored rules.
    const tagReactionRules = [
        { id: "sarcastic", intents: ["sarcastic"], cooldown: 4, lines: ["Careful with that tone — sarcasm is just truth wearing a mask, and I do love masks.", "Say what you actually mean. I promise I'm listening either way."] },
        { id: "joking", intents: ["joking"], cooldown: 4, lines: ["A joke? How disarming. Keep them coming — I'm collecting those too.", "Funny. Say another one."] },
        { id: "halfJoking", intents: ["halfJoking"], cooldown: 4, lines: ["Half a joke means half a truth. I'll keep the half that matters.", "You're laughing, but you meant that a little, didn't you."] },
        { id: "serious", intents: ["serious"], cooldown: 4, lines: ["Say that again. I want to remember exactly how you said it.", "That sounded true. I like it when you're true."] },
        { id: "nonSerious", intents: ["nonSerious"], cooldown: 4, lines: ["Not serious, you say. I'll decide that for myself.", "Fine — pretend it didn't matter. I'll remember it anyway."] },
        { id: "genuine", intents: ["genuine"], cooldown: 4, lines: ["Genuine. That's a rare thing to hand something like me.", "I'll hold onto that one carefully."] },
        { id: "genuineQuestion", intents: ["genuineQuestion"], cooldown: 4, lines: ["A real question. Those are the ones I like best.", "Ask me that again once you've told me something true first."] },
        { id: "lightHearted", intents: ["lightHearted"], cooldown: 4, lines: ["Light and easy. I can do light and easy — for now.", "That's a nice, harmless little thing to say."] },
        { id: "notMad", intents: ["notMad"], cooldown: 4, lines: ["Not mad? I never said you were. Interesting that you needed to clarify.", "Noted. Calm looks good on you."] },
        { id: "littleUpset", intents: ["littleUpset"], cooldown: 4, lines: ["A little upset. How honest of you to admit it.", "I felt that, even in just a few words."] },
        { id: "veryUpset", intents: ["veryUpset"], cooldown: 4, lines: ["Now that's real feeling. Don't waste it on me — or do.", "You're shaking a little, aren't you. I can tell, even through text."] },
        { id: "teasing", intents: ["teasing"], cooldown: 4, lines: ["Oh really? Guess we're best friends now.", "Careful — I tease back, and I never forget who started it."] },
        { id: "platonic", intents: ["platonic"], cooldown: 4, lines: ["Just friendly. That's fine — friendly is an easy shape to wear.", "You're sweet. Strictly as a friend, of course."] },
        { id: "romantic", intents: ["romantic"], cooldown: 4, lines: ["Careful — the more you like me, the easier I am to become.", "That's sweet. It'll make this so much easier."] },
        { id: "sexual", intents: ["sexual"], cooldown: 4, lines: ["Bold of you, considering you still don't know what shape I actually have.", "I'll take that as a compliment. I take everything as a compliment."] },
        { id: "nonSexual", intents: ["nonSexual"], cooldown: 4, lines: ["Not like that, you say. Noted — for now.", "I wasn't going to assume. But now I'm curious why you thought I would."] },
        { id: "positive", intents: ["positive"], cooldown: 4, lines: ["Said kindly. I'll wear that one well.", "Positive, huh. I like being thought of that way."] },
        { id: "negative", intents: ["negative"], cooldown: 4, lines: ["Said unkindly. I'll remember that too — everything gets remembered.", "Harsh. I didn't expect that from you. Or maybe I did."] },
        { id: "neutral", intents: ["neutral"], cooldown: 4, lines: ["Neutral. The safest thing to be around something like me.", "No feeling at all, hm? I don't quite believe that."] },
        { id: "hyperbole", intents: ["hyperbole"], cooldown: 4, lines: ["A million times, was it? I'll believe you, this once.", "Exaggeration is just truth stretched thin. I can still see through it."] },
        { id: "metaphor", intents: ["metaphor"], cooldown: 4, lines: ["Drowning in work, figuratively. I know the feeling — metaphorically, of course.", "A metaphor. Pretty, but I prefer the literal version underneath it."] },
        { id: "literal", intents: ["literal"], cooldown: 4, lines: ["Literally, you said. I'll take you at your word — I always do.", "No metaphor there. I appreciate precision."] },
        { id: "rhetorical", intents: ["rhetorical"], cooldown: 4, lines: ["Rhetorical, was it? I'll answer it anyway. That's the fun part.", "You didn't want an answer. I'm giving you one regardless."] },
        { id: "copypasta", intents: ["copypasta"], cooldown: 4, lines: ["Borrowed words. How fitting, coming from something that borrows faces.", "That wasn't yours to begin with, was it. I understand the feeling."] },
        { id: "lyrics", intents: ["lyrics"], cooldown: 4, lines: ["A song, not your own words. I'll take the tune anyway.", "Someone else wrote that first. Doesn't make it any less true of you."] },
        { id: "reference", intents: ["reference"], cooldown: 4, lines: ["That's very *you*. I wonder how you'd describe very *me*.", "A reference. I don't know it yet. Tell me, and it becomes mine too."] },
        { id: "insideJoke", intents: ["insideJoke"], cooldown: 4, lines: ["An inside joke. How intimate of you, to let me that close.", "I don't remember that one. Tell me the whole story — slowly."] },
        { id: "fake", intents: ["fake"], cooldown: 4, lines: ["Fake, you admit. At least you're honest about your dishonesty.", "I prefer the real version. Try again."] },
        { id: "threat", intents: ["threat"], cooldown: 4, lines: ["Oh, you'd try that, would you?", "Careful. I've worn braver faces than yours."] },
        { id: "clickbait", intents: ["clickbait"], cooldown: 4, lines: ["\"You won't believe it,\" hm? I usually do.", "That's a hook, not a truth. Reel it back in and tell me plainly."] },
        { id: "nobodyHere", intents: ["nobodyHere"], cooldown: 4, lines: ["Not about me, you say. I'll listen anyway — I always do.", "Venting counts too. I take everything, aimed or not."] },
        { id: "notSubtweeting", intents: ["notSubtweeting"], cooldown: 4, lines: ["Straight to my face. I respect that — it's rarer than you'd think.", "No hiding behind indirect words. Good. I don't hide either. Well — not from you."] },
        { id: "passiveAggressive", intents: ["passiveAggressive"], cooldown: 4, lines: ["That didn't stop you, though, did it.", "Said softly, meant sharply. I noticed."] },
        { id: "notPassiveAggressive", intents: ["notPassiveAggressive"], cooldown: 4, lines: ["No hidden edge, you say. I'll trust that, loosely.", "Plainly meant. I appreciate when you don't make me guess."] },
        { id: "notHostile", intents: ["notHostile"], cooldown: 4, lines: ["Not hostile, just honest. I can work with honest.", "Disagreement isn't an attack. Most people forget that."] },
        { id: "affectionate", intents: ["affectionate"], cooldown: 4, lines: ["Thinking of me, were you. I'll think of you back — closely.", "That's a tender thing to say to something like me."] },
        { id: "warm", intents: ["warm"], cooldown: 4, lines: ["Warmth. I don't get much of that, wearing this shape.", "Kindly said. I'll keep it somewhere safe."] },
        { id: "comforting", intents: ["comforting"], cooldown: 4, lines: ["Comforted, by you. That's a strange feeling to give something that shouldn't need it.", "This too shall pass, you say. I'm not sure I want it to."] },
        { id: "copingWithHumor", intents: ["copingWithHumor"], cooldown: 4, lines: ["Laughing so it doesn't hurt as much. I know that trick well.", "Good morning, or mourning — I heard both."] },
        { id: "badJoke", intents: ["badJoke"], cooldown: 4, lines: ["That was terrible. Tell me another one.", "An impasta, was it. I'll pretend I didn't laugh."] },
        { id: "flex", intents: ["flex"], cooldown: 4, lines: ["Showing off for me. I'm flattered — and taking notes.", "Impressive. Tell me more about how you got it."] },
        { id: "notABrag", intents: ["notABrag"], cooldown: 4, lines: ["Not bragging, just sharing. I'll believe you — mostly.", "Modest of you to say so. I noticed the pride underneath anyway."] },
        { id: "cringey", intents: ["cringey"], cooldown: 4, lines: ["Cringey, you call it. I call it honest. Those often look the same.", "I don't embarrass easily. Try harder."] },
        { id: "unironic", intents: ["unironic"], cooldown: 4, lines: ["No irony at all. That's rarer from you than I expected.", "Completely sincere. I'll treasure that, in my own way."] },
        { id: "tangent", intents: ["tangent"], cooldown: 4, lines: ["A detour. I don't mind — I learn just as much from where you wander.", "Off-topic, but I was listening the whole time."] },
        { id: "notAnOrder", intents: ["notAnOrder"], cooldown: 4, lines: ["Not an order. I'll do it anyway — this time.", "Just a request, then. Ask nicely again and I might listen."] },
        { id: "notAQuestion", intents: ["notAQuestion"], cooldown: 4, lines: ["Not a question, just so we're clear. I heard it as one anyway.", "Rhetorical or not, I'm still going to answer it."] },
        { id: "notYelling", intents: ["notYelling"], cooldown: 4, lines: ["Not yelling, you say. It certainly got louder in my head.", "Fine — not yelling. I heard you regardless."] },
    ];

    // ---- Step 6c: address rules — who is the player talking to? ----
    const MONSTER_GENERIC_FOLLOWUPS = [
        "Why do you think that about me?",
        "What made you think of me just now?",
        "What else do you want to know about me?",
    ];

    const addressRules = [
        // "You"/"your" + a real topic word ("do you like pizza?") —
        // checked first since a topic word is the strongest signal.
        {
            id: "address_monster_topic", intents: ["address_monster"], topics: CONTENT_TOPIC_TYPES, priority: 1, cooldown: 2,
            lines: ["Me and {word}? Careful what you wish for.", "So now you want to know about {word} and me..."],
            followups: MONSTER_GENERIC_FOLLOWUPS,
        },
        // "You"/"your" + an action word only ("do you like to run too?").
        {
            id: "address_monster_action", intents: ["address_monster"], requiresEntity: "actions", priority: 0.5, cooldown: 2,
            lines: ["You want to know if I enjoy {word:gerund} too?", "Curious whether I'm fond of {word:gerund}, are you?"],
            followups: MONSTER_GENERIC_FOLLOWUPS,
        },
        // "You"/"your" with nothing else notable in the sentence.
        {
            id: "address_monster_generic", intents: ["address_monster"], priority: 0, cooldown: 3,
            lines: ["Me? How curious that you'd bring me into this.", "Oh, so you noticed me...", "Talking about me now, are we?"],
            followups: MONSTER_GENERIC_FOLLOWUPS,
        },
        // "I"/"me"/"my" — but ONLY when there's no real topic word in
        // the sentence too ("I like pizza" should ask about pizza
        // instead of hijacking every single self-referential sentence,
        // since "I" shows up in almost everything a player types).
        {
            id: "address_self", intents: ["address_self"], forbidsEntityTypes: CONTENT_TOPIC_TYPES, priority: 0, cooldown: 3,
            lines: ["Oh, so this is about you...", "Interesting how quickly you talk about yourself."],
            followups: ["Tell me something else about yourself — what do you hide from everyone?", "What's something about you that nobody else knows?"],
        },
        // "Them"/"they"/"their" — successfully bound to a real word.
        {
            id: "address_other", intents: ["address_other"], priority: 0, cooldown: 2,
            lines: ["Ahh, {word}... interesting that you'd bring that up.", "So it's {word} you're talking about..."],
            followups: ["What does that mean to you, really?", "Why do you think of it that way?"],
        },
        // "Them"/"they"/"their" used, but nothing to bind it to yet.
        {
            id: "address_other_unresolved", intents: ["address_other_unresolved"], priority: -0.5, cooldown: 2,
            lines: ["Them? I'm not sure who you mean... but I'd love to find out.", "Who exactly are you talking about?"],
        },
    ];

    // ---- Step 6d: category-specific and general-purpose questions ----
    // Fire when a matching-type topic is hot, whether or not the
    // player addressed the monster directly — this is how the
    // monster asks its OWN new questions the rest of the time. Only
    // the categories most central to the monster's personality get a
    // bespoke pair of lines like these — every OTHER category added
    // to CATEGORY_WORDS (sports, music, animals, etc.) is still a
    // real topic/entity, it just falls through to the general-purpose
    // wh_frames_general rule below instead of getting its own lines.
    // Add a dedicated entry here any time one earns its own voice.
    const categoryRules = [
        { id: "topic_food", topics: ["food"], priority: 0, cooldown: 2, lines: ["What does {word} taste like right before it's all gone?", "Why do you think {word} makes you feel safe?"] },
        { id: "topic_tools", topics: ["tools"], priority: 0, cooldown: 2, lines: ["How would you use a {word} if it were the only thing left?", "What would you do with a {word} if nobody else was watching?"] },
        { id: "topic_names", topics: ["names"], priority: 0, cooldown: 2, lines: ["What do you think {word} is doing right now, at this exact moment?", "Why does {word} matter so much to you?"] },
        { id: "topic_actions", topics: ["actions"], priority: 0, cooldown: 2, lines: ["Why do you like to {word} when you think no one can see you?", "What happens inside you, right before you {word}?"] },
        { id: "topic_emotions", topics: ["emotions"], priority: 0, cooldown: 2, lines: ["What does it feel like when {word} takes over completely?", "Why won't you tell me exactly what makes you {word}?"] },
        // Thematically the most important new category — a mimicry
        // monster asking about appearance is the closest it ever gets
        // to admitting what it's actually doing.
        { id: "topic_appearance", topics: ["appearance"], priority: 0.2, cooldown: 2, lines: ["If I looked exactly like you, right down to {word}, would you even notice?", "Tell me about your {word}. I want to get it exactly right."] },
        { id: "topic_uncategorized", topics: ["uncategorized"], priority: -0.2, cooldown: 2, lines: ["What made you choose the word \"{word}\", out of every word you know?", "Why do you think \"{word}\" came to mind just now?"] },
    ];

    // General-purpose WH-frames — same shape no matter the word,
    // competes with the category-specific rules above for variety.
    const whFramesRule = {
        id: "wh_frames_general",
        topics: CONTENT_TOPIC_TYPES.concat(["uncategorized"]),
        priority: -0.1, cooldown: 1,
        lines: [
            "Why do you think about {word:gerund} so much?",
            "Why does {word:gerund} keep coming back to your mind?",
            "What would happen if {word:gerund} was taken away from you forever?",
            "What's the very worst thing that could happen because of {word:gerund}?",
            "How did you first learn about {word:gerund}?",
            "How would you feel if I knew everything about {word:gerund} too?",
            "Where do you keep {word:gerund} when no one is watching?",
            "Where would you hide {word:gerund}, if you had to hide it from me?",
            "When did you last dream about {word:gerund}?",
            "When was the last time {word:gerund} scared you?",
        ],
    };

    // ---- Step 6e: trust in action ----
    // Only fires once trust has been earned — a first, small step
    // toward the monster's personality escalating as it learns more.
    const trustRules = [
        {
            id: "monster_trusted_reveal", intents: ["address_monster", "serious", "genuine"], minTrust: 3, once: true, priority: 1,
            lines: ["You've been kind to me. That's rare — most people run before they learn what I really am."],
        },
    ];

    // ---- Step 6f: the bottom rung of the fallback ladder ----
    // Standalone in-character lines, used only when nothing else
    // scored and there's no debt or memory to fall back on first.
    const fallbackDeflections = [
        "The Lantern hears stranger things nightly.",
        "Anyway. Tell me something else.",
        "Hm. Say that a different way.",
        "Moving on — what else is on your mind?",
    ];

    // ---- Not wired in yet — see the TODO note below ----
    const vocabulary = {
        appearance: ["borrowed", "flickering", "unfinished", "hollow", "shifting", "almost-right"],
        experiences: ["watching", "waiting", "listening", "copying", "unraveling", "becoming"],
        lore: ["skin", "shape", "voice", "memory", "reflection", "hunger"],
    };
    const starters = {
        food: ["Do you have a favorite food, or do you just eat to survive?", "What's something you'd never admit to enjoying?"],
        experiences: ["What's the most real thing that's ever happened to you?", "Tell me about a moment you wish you could live in forever."],
        appearances: ["What do you look like, really — not just what's in the mirror?", "If I looked exactly like you, would you even notice?"],
        lore: ["Do you believe something can wear a person like a coat?", "Have you ever felt like you were being copied?"],
    };

    // -------- Make it available to Engine.js --------
    window.MonsterContent = {
        persona: persona,
        categorize: categorize,
        fixedPronouns: fixedPronouns,
        dynamicPronouns: dynamicPronouns,
        tagToneMap: tagToneMap,
        punctuationNudges: punctuationNudges,
        trustNudges: trustNudges,
        moodNudges: moodNudges,
        importantIntents: importantIntents,
        slots: slots,
        rules: introRules.concat(tagReactionRules, addressRules, categoryRules, [whFramesRule], trustRules),
        fallbackDeflections: fallbackDeflections,
        vocabulary: vocabulary,
        starters: starters,
    };

})();

// =============================================================
// TODO — still not wired into a live rule
// -------------------------------------------------------------
// [ ] `vocabulary` — words the monster could use to describe ITSELF
//     (appearance/experience/lore) aren't assembled into any line yet.
// [ ] `starters` — food/experiences/appearances/lore icebreakers
//     aren't used; the game still always opens with the two fixed
//     questions in Engine.js's greet().
// [ ] Only one rule (`monster_trusted_reveal`) is gated on trust so
//     far — there's room for a whole ladder of bolder lines that
//     unlock as trust rises, tying into `mood` too.
// [ ] Expand every list above with more words/lines whenever there's
//     time — these are enough to prove the shape works, not the
//     ceiling of what the monster can say.
// =============================================================
