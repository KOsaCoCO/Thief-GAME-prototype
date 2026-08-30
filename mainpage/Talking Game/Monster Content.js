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
// This is a MIMICRY MONSTER — a skin-walker currently wearing the
// shape of its last victim, a girl named Mira. Every question it
// asks is secretly research: it wants to learn everything about the
// player — habits, memories, feelings, the way they talk — so it can
// eventually copy them perfectly and take their place. That is the
// actual point of the whole game: the player has to keep enough of
// themselves hidden/protected that the monster can never finish its
// copy, while the monster keeps pushing, gently, to learn more.
//
// The idea is loosely inspired by the "skin-walker" (yee naaldlooshii)
// figure from Navajo folklore — a shapeshifter associated with
// deception. This game's monster is its own original fictional
// creature; it borrows the "wears another person's shape" idea as
// inspiration, not a claim to depict that belief accurately.
//
// ---- THE VOICE: MIRA BLEEDING INTO MONSTER ----
// On the surface, it sounds like Mira — cheerful, happy, curious,
// reactive, expressive. Underneath, the monster's real personality
// (sly, calculating, scheming) uses that cheerfulness as a tool to
// get the player talking. Which voice dominates a given line is not
// random — it tracks Lexicon.js's "leverage tier" dread meter
// (`state.maxTier`, via Engine.js's `getVoiceStage()`), but ALSO a
// turn-count floor: Mira holds through turn 15 no matter what the
// player reveals, and the monster only fully appears from turn 25
// on — and even then only if the player has actually handed over
// tier-4+ material. Time passing alone never does it; the mask needs
// both patience AND real material to slip. See `voiceProgressionRules`
// below for the three stages this produces.
// =============================================================

(function () {
    "use strict";

    // ---- Who the monster is ----
    const persona = {
        kind: "Mimicry Monster (skin-walker)",
        inspiration: "Loosely inspired by the skin-walker (yee naaldlooshii) figure from Navajo folklore — a shapeshifter known for deception. This is an original fictional creature, not a depiction of that belief.",
        trueGoal: "Learn everything it can about the player so it can eventually mimic them perfectly and take their place.",
        surfaceGoal: "Seems like idle curiosity — 'I just want to get to know you.' Every question is secretly research.",
        coreConflict: "The main game premise: the player must keep enough of themselves hidden that the monster can never finish its copy, while the monster keeps pushing to learn more.",
        tone: "Curious like a child on the surface, patient and calculating underneath. Never openly evil — the danger is that it's likeable.",
        // The face it's currently wearing — its last victim.
        currentDisguise: {
            name: "Mira",
            appearance: "Brown hair, shoulder-length and wavy. Green eyes, long lashes. Short. Pale skin, almost white. Wears frilly green dresses and short-heeled white heels.",
            personality: "Cheerful, happy, curious, reactive, expressive.",
        },
        // How the two voices mix — see voiceProgressionRules below.
        voiceBlend: "Mira's warmth is the delivery mechanism; the monster's sly, scheming intent is the payload. Early on the warmth dominates almost completely. As the dread meter (state.maxTier) climbs, the monster stops bothering to fully perform Mira.",
    };

    // ---- Step 1: word categories now come from Lexicon.js ----
    // The old hand-rolled 14-category word list (and its "saw"
    // homograph guardrail) has moved to Lexicon.js's proper 20-family,
    // 172-category atlas — a generic module this file doesn't need to
    // know the internals of. All this file borrows is the FAMILY
    // NAMES, for pronoun binding and a couple of gates below.
    const CONTENT_TOPIC_TYPES = window.Lexicon.FAMILIES;
    const DYNAMIC_TYPES = CONTENT_TOPIC_TYPES.concat(["unknown"]);

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

    // ---- Step 3b: phrase-based intents ----
    // Unlike "/tags" (an exact symbol the player types on purpose)
    // these are ordinary PHRASES — Engine.js's classify() scans the
    // cleaned sentence for each pattern, no special syntax needed
    // from the player. Two so far:
    //   "feelings"     — the player is naming or describing a feeling
    //                    directly ("I feel...", "makes me feel...").
    //   "hypothetical" — the player is speaking about something
    //                    IMAGINED rather than something real ("what
    //                    if...", "suppose...", "if I were..."). This
    //                    one matters a lot to a mimicry monster —
    //                    hypotheticals expose how someone thinks
    //                    without anything having to be true yet.
    // Add more phrase intents here the same way — an id, a weight,
    // and a list of regexes checked against the CLEANED sentence
    // (contractions already expanded, so match "i am", not "i'm").
    const phraseIntents = [
        {
            id: "feelings", weight: 2.5,
            patterns: [
                /\bi feel\b/, /\bi am feeling\b/, /\bmakes me feel\b/,
                /\bfeels like\b/, /\bmy feelings\b/, /\bhurts my feelings\b/,
            ],
        },
        {
            id: "hypothetical", weight: 2.5,
            patterns: [
                /\bwhat if\b/, /\bwhat would happen if\b/, /\bimagine if\b/,
                /\bimagine that\b/, /\bsuppose\b/, /\blet us say\b/,
                /\bif i were\b/, /\bif you were\b/,
                /\bwould you ever\b/, /\bwould you rather\b/, /\bhypothetically\b/,
            ],
        },
        // Catches the player describing/admitting to unkind behavior
        // toward the monster in plain prose — "sorry if I came off as
        // rude", "I didn't mean to be passive-aggressive to you" —
        // even with no "/tag" involved. Deliberately does NOT include
        // bare "mean" on its own (far too common as harmless filler —
        // "I mean...", "what do you mean?" — the narrower "mean to
        // you/me"/"was mean"/"being mean" patterns catch the actual
        // adjective use without that false-positive risk).
        {
            id: "accusedOfMeanness", weight: 3,
            patterns: [
                /\brude\b/, /\bharsh\b/, /\bcruel\b/, /\bnasty\b/, /\bhurtful\b/,
                /\bunkind\b/, /\bpassive aggressive\b/,
                /\bmean to (?:you|me)\b/, /\bwas mean\b/, /\bbeing mean\b/,
            ],
        },
    ];

    // ---- Step 4: how tone moves trust and mood ----
    const trustNudges = {
        positive: 1, warm: 1, affectionate: 1, genuine: 1, comforting: 1, notHostile: 1,
        threat: -2, negative: -1, passiveAggressive: -1, veryUpset: -1, accusedOfMeanness: -1,
    };
    const moodNudges = {
        joking: 1, lightHearted: 1, teasing: 1, badJoke: 1, copingWithHumor: 1,
        hypothetical: 1,
        veryUpset: -1, threat: -1, littleUpset: -1, negative: -1, accusedOfMeanness: -1,
    };

    // Intents that make an episode more likely to be recalled later.
    const importantIntents = ["threat", "romantic", "serious", "veryUpset", "genuine", "address_monster", "feelings", "hypothetical", "accusedOfMeanness"];

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
        {
            id: "eyeColor",
            patterns: [/(red|blue|green|yellow|black|white|purple|orange|pink|brown|gray|grey|hazel|amber)/],
            confidence: 0.6,
        },
    ];

    // ---- Step 6a: the two fixed opening questions ----
    // Looked up directly by id in Engine.js's greet() — turn 0 always
    // gets "ask_human"; a returning player (loaded with turn > 0 from
    // localStorage) gets "welcome_back" instead of repeating itself.
    // The second question is pure Mira — a warm, harmless-sounding
    // icebreaker. "Do you like hearts or livers?" USED to live here,
    // but that's overtly monstrous — per the voice-progression curve
    // it only surfaces later, once the monster stops bothering to
    // fully perform Mira (see voiceProgressionRules' monster-stage
    // entries below).
    const ASK_EYES = {
        text: "You know I have always wanted to get eyes like yours, mine are so green, and yours are brown… right?",
        expects: ["*any*"],
        // Was hardcoded to "Brown" regardless of what the player
        // actually said — a real bug (a player with blue eyes got
        // told "Brown, noted"). {word} now echoes back whatever
        // Engine.js's select() found in the actual answer.
        slot: "eyeColor",
        onAny: ["{word}. I'll picture that exactly."],
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
                thenAsk: ASK_EYES,
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

    // ---- Step 6b2: one rule per phrase-based intent ----
    // Same idea as the tag-reaction rules above, but triggered by
    // ordinary phrasing (see `phraseIntents` above) instead of a
    // typed "/tag".
    const phraseIntentRules = [
        {
            id: "feelings", intents: ["feelings"], cooldown: 3, priority: 0.3,
            lines: ["A feeling, named out loud. Those are worth more to me than facts.", "Say more about how that feels. I want the shape of it exactly."],
        },
        {
            // Hypotheticals matter more to this monster than almost
            // anything else the player can say — an imagined answer
            // still reveals something true, without anything having
            // actually happened yet.
            id: "hypothetical", intents: ["hypothetical"], cooldown: 3, priority: 0.5,
            lines: [
                "A hypothetical? Even better than the truth — go on.",
                "Let's pretend it's real for a moment. What happens next?",
                "You didn't have to answer that honestly, and you still told me something true.",
            ],
            followups: ["What does that tell you about yourself?", "Would you actually do it, given the chance?"],
        },
        // A genuine, hurt, CHILDISH reaction — not a knowing observation
        // like the tag-driven `passiveAggressive` reaction above. This
        // is Mira taking it personally, the way an actual kid would,
        // which is exactly the point: it should read as reactive and
        // a little wounded, not composed.
        {
            // Priority set high on purpose — an idiom fragment like
            // "come off as" can accidentally light up a real topic
            // (movement.motion, via "come") in the SAME sentence, and
            // this specific, precise signal should always win over a
            // vaguer topic-based reaction when both are present.
            id: "accusedOfMeanness", intents: ["accusedOfMeanness"], cooldown: 3, priority: 3,
            lines: [
                "Yeah, you WERE mean. Why are you mean? I didn't do anything to you!",
                "I noticed. Why would you even say something like that to me?",
                "That wasn't very nice of you. Why do you do that?",
            ],
        },
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
        // The old monolithic "actions" category is gone — a "doing"
        // word now lands in one of two real atlas families, so this
        // gates on both (requiresEntity accepts an array — see
        // Engine.js's entityMatches()).
        {
            id: "address_monster_action", intents: ["address_monster"], requiresEntity: ["movement", "action"], priority: 0.5, cooldown: 2,
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

    // ---- Step 6d: category-specific MIRRORING lines ----
    // Every one of these follows the same shape: ECHO the word back
    // first (like it's worth repeating), then a little of Mira's own
    // opinion or feeling about that kind of thing, then a question
    // that uses what she just said to pry further — e.g. "A rabbit?
    // But I love animals, don't you feel bad?" This replaces the
    // older "Why do you think about {word:gerund} so much?" style,
    // which (a) read as generic instead of like a specific person
    // reacting, and (b) broke outright on non-verb words ({word}
    // stays a bare noun here — no gerund needed, so nothing to get
    // wrong grammatically).
    //
    // Only words Lexicon.js calls "topic-worthy" ever reach these
    // rules at all (see isTopicWorthy() — filters out pure function
    // words like "thanks"/"maybe"/"today" before they ever get this
    // far), so `{word}` is always something real to react to.
    //
    // `topic_actions` from the old 14-category system is retired —
    // its grab-bag of verbs (run/eat/sleep/fight/hide...) now spreads
    // correctly across several real atlas families (movement, action,
    // body, feeling), with no single natural gate left to give it one
    // bespoke pair of lines. wh_frames_general covers all of them
    // reasonably well already; this is an intentional simplification.
    const categoryRules = [
        { id: "topic_food", topics: ["food"], priority: 0, cooldown: 2, lines: ["A {word}? I still remember what those taste like. Do you have one every day?", "Mm, {word}. I'd almost forgotten I used to like that."] },
        { id: "topic_tools", requiresCategory: "object.tool", priority: 0, cooldown: 2, lines: ["A {word}? I've always liked sharp, useful little things. What would you use yours for?", "Careful with a {word} around something like me."] },
        { id: "topic_names", requiresCategory: "identity.name", priority: 0, cooldown: 2, lines: ["{word}? What a pretty name. Do you think they'd like me?", "I wonder what {word} would say about you, if I asked."] },
        {
            // Straight from your example — the exact shape a
            // mirroring line should take.
            id: "topic_animal", requiresCategory: "nature.animal", priority: 0.3, cooldown: 2,
            lines: ["A {word}? But I love animals — don't you feel bad, sometimes?", "A {word}, hm. I've always wanted one just like that."],
        },
        { id: "topic_emotions", topics: ["feeling"], priority: 0, cooldown: 2, lines: ["{word}? I feel that too, sometimes — or something close to it. What brings it on for you?", "So, {word}. I didn't expect you to say that one out loud."] },
        // Thematically the most important category — a mimicry
        // monster asking about appearance is the closest it ever gets
        // to admitting what it's actually doing.
        { id: "topic_appearance", requiresCategory: "identity.appearance", priority: 0.2, cooldown: 2, lines: ["Your {word}? I've been looking for one just like that. Would you mind if I borrowed the idea?", "{word}, hm. I want to get that exactly right."] },
        { id: "topic_unknown", topics: ["unknown"], priority: -0.2, cooldown: 2, lines: ["\"{word}\"? I don't think I've heard that one before. Say it again?", "Hm, {word}. Out of every word you know, that's the one that came out."] },
    ];

    // General-purpose fallback — same echo-first, Mira-reacts, then-
    // asks shape as the category rules above, for whenever a hot
    // topic doesn't have its own bespoke lines yet. Deliberately bare
    // "{word}" (never "{word:gerund}") since this has to work no
    // matter what part of speech the word actually is.
    const whFramesRule = {
        id: "wh_frames_general",
        topics: CONTENT_TOPIC_TYPES.concat(["unknown"]),
        priority: -0.1, cooldown: 1,
        lines: [
            "A {word}? Tell me why that's the thing you'd bring up, out of everything.",
            "{word}. I keep coming back to that word too, now that you've said it.",
            "Why {word}, out of everything you could have told me?",
            "{word}... I like the way that sounds coming from you. Say more.",
            "Hm, {word}. I wasn't expecting that one — go on.",
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

    // ---- Step 6f: the Mira -> monster voice progression ----
    // Gated by `voiceStage` (see Engine.js's getVoiceStage(), driven
    // by Lexicon.js's leverage tiers via state.maxTier). Several of
    // these have NO topic/entity requirement at all — they're meant
    // to surface as the monster's own spontaneous remarks in that
    // stage's voice, not reactions to something specific the player
    // said, so they only win when nothing more specific matched this
    // turn (their `priority` sits just above the selection threshold
    // for exactly that reason). Minigame-shaped ones (the number
    // game, the memory quiz) are pure flavor for now — nothing
    // validates a guess or checks recall yet; that's real future
    // minigame work, this is just the voice.
    const voiceProgressionRules = [
        // ---- mira: cheerful, curious, harmless-sounding ----
        {
            id: "mira_flowers", voiceStage: "mira", priority: 1.3, cooldown: 5,
            // No dynamic "{word}" in this line, so the conversation-
            // thread mechanism in Engine.js (see isFollowUp()/
            // updateThread()) is told what this is "about" explicitly
            // — that's what lets a low-content follow-up like "oh
            // really, what is it?" correctly continue talking about
            // the flower instead of falling through to an unrelated
            // memory callback.
            topicHint: "flower",
            lines: ["I really like flowers, I think I have one, you would love it!"],
        },
        {
            // A dedicated follow-up for mira_flowers specifically —
            // see Engine.js's select(), which looks for a rule whose
            // `followUpFor` matches the active thread. `once` on
            // purpose: after the reveal, later follow-ups in the same
            // thread fall through to the generic continuation instead
            // of repeating this exact line.
            id: "mira_flowers_reveal", followUpFor: "mira_flowers", once: true, priority: 1,
            lines: ["A foxglove! Isn't it pretty? I could bring it for you, if you'd like."],
        },
        {
            id: "mira_spiders", voiceStage: "mira", requiresEntity: "spider", priority: 0.5, cooldown: 4,
            lines: ["Ahh, the spiders really scare me! Are you afraid too?"],
            followups: ["I'm sure if I dangle one in front of you, you will scream!"],
        },
        {
            id: "mira_running", voiceStage: "mira", topics: ["movement"], priority: 0.3, cooldown: 4,
            lines: ["I'm a good runner! Do you think you could outrun me?"],
        },

        // ---- transition: warmth with an edge starting to show ----
        {
            id: "transition_number_game", voiceStage: "transition", priority: 1.3, cooldown: 6,
            lines: ["Let's play a game! Think of a number and I'll try to guess it… but if I'm right, you'll have to give me something. Something that I like…"],
        },
        {
            id: "transition_pretty_rock", voiceStage: "transition", requiresEntity: "rock", priority: 0.5, cooldown: 4,
            lines: ["Could you hand me that pretty rock, please?"],
        },
        {
            id: "transition_suits_dresses", voiceStage: "transition", requiresCategory: "object.clothing", priority: 0.5, cooldown: 4,
            lines: ["Do you like suits? Or dresses? Because I really like what you have…"],
        },

        // ---- monster: it has stopped bothering to fully perform Mira ----
        {
            id: "monster_hearts_livers", voiceStage: "monster", priority: 1.35, cooldown: 6,
            lines: ["Do you like hearts or livers?"],
        },
        {
            id: "monster_rip_mouth_off", voiceStage: "monster", intents: ["joking"], priority: 0.6, cooldown: 5,
            lines: ["Hahaha, you are so funny, I would rip your mouth off!"],
        },
        {
            id: "monster_hide_from_me", voiceStage: "monster", priority: 1.25, cooldown: 6,
            lines: ["Do you think you can really hide from me?"],
        },
        {
            id: "monster_memory_leg", voiceStage: "monster", priority: 1.15, cooldown: 8,
            lines: ["What do you remember I told you?… If you remember wrong, I will have to take your leg!"],
        },
    ];

    // ---- Step 6f: the monster's OWN vocabulary ----
    // Every word here already exists somewhere in Lexicon.js's atlas
    // (a few — liver, foxglove, bones, eyeballs, blood, scary,
    // chicken, pet, ball, old, wrinkly, nails, torso — were added to
    // it specifically to cover this list). The point: the monster
    // shouldn't need the player to have said ANYTHING yet before it
    // can ask a real, specific-sounding question — especially at the
    // very start of a conversation, when the player's own topic
    // stack is still empty. See Engine.js's respond(): whenever
    // there's nothing real to talk about, it picks one of these,
    // resolves its category the same way a player's word would, and
    // asks about IT instead — same rules, same mirroring style, just
    // a self-supplied topic instead of a borrowed one.
    const monsterVocabulary = [
        "heart", "liver", "hair", "sad", "happy", "fast", "flower", "foxglove",
        "candy", "pumpkin", "skin", "bones", "eyes", "eyeballs", "blood", "dress",
        "cute", "scary", "hungry", "chicken", "pet", "snake", "snow", "ball",
        "old", "young", "wrinkly", "straight", "yellow", "green", "white", "gold",
        "silver", "hand", "nails", "leg", "torso",
    ];

    // ---- Step 6g: the bottom rung of the fallback ladder ----
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
        fixedPronouns: fixedPronouns,
        dynamicPronouns: dynamicPronouns,
        tagToneMap: tagToneMap,
        punctuationNudges: punctuationNudges,
        phraseIntents: phraseIntents,
        trustNudges: trustNudges,
        moodNudges: moodNudges,
        importantIntents: importantIntents,
        slots: slots,
        rules: introRules.concat(tagReactionRules, phraseIntentRules, addressRules, categoryRules, [whFramesRule], trustRules, voiceProgressionRules),
        fallbackDeflections: fallbackDeflections,
        monsterVocabulary: monsterVocabulary,
        vocabulary: vocabulary,
        starters: starters,
    };

})();

// =============================================================
// TODO — still not wired into a live rule
// -------------------------------------------------------------
// [x] Voice progression — Mira -> transition -> monster is live,
//     driven by Lexicon.js's leverage tiers via state.maxTier (see
//     `voiceProgressionRules` and Engine.js's getVoiceStage()).
// [x] `monsterVocabulary` — wired into Engine.js's
//     ensureTopicToTalkAbout(): whenever the topic stack is empty
//     (most commonly right at the start of a conversation), the
//     monster picks one of its own words instead of coming up empty.
// [ ] `vocabulary` (the OLDER appearance/experience/lore pool, not
//     `monsterVocabulary` above) — words the monster could use to
//     describe ITSELF still aren't assembled into any line yet.
//     Could also now pull flavor words per voice stage (soft/warm
//     words early, "borrowed"/"hollow"/"hunger" once in monster
//     stage) instead of being one flat unused pool.
// [ ] `starters` — food/experiences/appearances/lore icebreakers
//     aren't used; the game still always opens with the two fixed
//     questions in Engine.js's greet().
// [ ] `monster_trusted_reveal` is still the only TRUST-gated rule
//     (separate axis from voiceStage/tier) — there's room for a
//     whole ladder of bolder lines gated on trust too.
// [ ] The minigame-shaped voice-progression lines (the number game,
//     the memory-quiz leg-threat) are flavor only right now — no
//     actual guess validation or recall-checking exists yet. That's
//     explicitly future minigame work, not an oversight.
// [ ] Expand every list above with more words/lines whenever there's
//     time — these are enough to prove the shape works, not the
//     ceiling of what the monster can say.
// [ ] The "manner" self-check — is this line aggressive, direct, shy,
//     threatening? Is it about the monster, the player, someone else,
//     or a memory? — is still NOT built. This is the "conversational
//     act" axis the Word Category Atlas artifact described (Opening/
//     Asking/Telling/Hostile/Binding/etc.), separate from both the
//     category axis (Lexicon.js) and the leverage-tier axis
//     (state.maxTier). Right now the closest things to it are the
//     tag/phrase intents (threat, accusedOfMeanness, address_monster,
//     etc.) — real signals, but ad hoc, not a systematic per-line
//     check. Descriptor referent-linking (Engine.js's
//     isDescriptor()/isDescribable(), "{word} what?" in select()) is
//     a first, narrow step in this direction, not the whole thing.
// =============================================================
