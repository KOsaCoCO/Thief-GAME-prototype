// =============================================================
// Engine — THE GENERIC CONVERSATION PIPELINE (rarely edited)
// -------------------------------------------------------------
// This file knows nothing about monsters, mimicry, or hearts and
// livers. It only knows how to run ONE player message through nine
// stages and hand back ONE reply, using whatever "content" (persona,
// rules, slots, intents) it's given — see Monster Content.js for
// all of that. This split is straight out of the handbook the user
// shared: the engine owns state and permission, the content owns
// what gets said. Swap Monster Content.js for a different file and
// this file would run a completely different character unchanged.
// Word-level categorization is its own third sibling module,
// Lexicon.js (a generic 20-family/172-category atlas with a 0-5
// "leverage tier" per category) — Engine.js leans on it, but knows
// nothing about what's actually IN it either.
//
// THE NINE STAGES, always in this order:
//   1. normalize    — raw text -> tokens/keywords/question-flag
//   2. resolveRefs   — bind "you"/"them"/"I" to an actual entity
//   3. classify        — score which tone-tags and address-types apply,
//                          resolve each word's category via Lexicon.js
//   4. extractSlots      — write any permanent facts this line reveals
//   5. settleDebts          — did this answer pay off the monster's
//                              own last question?
//   6. remember               — save working memory, bump topics, log
//                                 a scored episode, harvest any
//                                 tier>=2 fact into the dread meter
//   7. select                    — gate + score response rules, or
//                                    fall down the ladder if nothing fits
//   8. render                      — turn the chosen rule into text,
//                                      never the same line twice running
//   9. decay                        — age the topic stack for next time
//
// ONE state object is threaded through all nine (see newState() —
// its shape is explained there). Stages 1-3 only ever READ state;
// stages 4-6 and 8-9 are the only ones allowed to WRITE it. Keeping
// that split is what makes the whole thing debuggable.
// =============================================================

(function () {
    "use strict";

    // ---- Every tunable number in the whole engine lives here ----
    // Change these to change how the monster "feels" — nothing else
    // in this file should need touching for a personality tweak.
    const W = {
        workingMemory: 12,      // how many raw turns we keep verbatim
        episodeCap: 400,        // how many compressed episodes we keep
        topicBoost: 1.0,        // how much a mention raises a topic's weight
        topicDecay: 0.82,       // how much weight survives each turn
        topicFloor: 0.08,       // below this, a topic is forgotten
        topicMax: 20,           // most topics tracked at once
        recencyDecay: 0.93,     // used by retrieve() for "how long ago"
        wRecency: 1.0,
        wImportance: 1.0,
        wRelevance: 1.6,        // weighted highest so callbacks stay on-topic
        intentMatch: 3.0,
        entityMatch: 2.5,
        topicOverlap: 1.5,
        keywordOverlap: 1.0,
        factBonus: 0.8,
        repeatPenalty: 2.5,
        minScore: 1.2,          // below this, fall to the ladder instead
        maxReasks: 1,           // how many times to chase an unpaid debt
    };

    const STORAGE_KEY = "talkingGameEngineState";

    // ---- Small, boring words normalize() strips out of "keywords" ----
    // Includes pronouns on purpose — resolveRefs() reads pronouns from
    // the full token list, but they should never themselves become a
    // "topic" the way a real word like "pizza" does.
    //
    // This list used to be too short — filler/function words like
    // "who", "since", "huh", "why", "even" were leaking through and
    // cluttering the topic stack as bogus "uncategorized" topics.
    // Grouped by kind below so it's easy to see what's covered and
    // add more later.
    const STOPWORDS = new Set([
        // pronouns
        "you", "your", "yours", "yourself", "i", "me", "my", "mine", "myself",
        "they", "them", "their", "theirs", "themselves",
        "he", "him", "his", "she", "her", "hers", "it", "its",
        "we", "us", "our", "ours", "who", "whom", "whose",
        // articles / determiners
        "a", "an", "the", "this", "that", "these", "those", "some", "any",
        "all", "both", "each", "few", "more", "most", "other", "such",
        "no", "nor", "only", "own", "same",
        // WH / question words (still detected for isQuestion in normalize(),
        // just shouldn't become "topics" of their own)
        "what", "where", "when", "why", "how", "which",
        // conjunctions / linking words
        "and", "but", "or", "so", "since", "because", "while", "although",
        "though", "if", "then", "than", "as",
        // prepositions
        "to", "of", "in", "on", "at", "for", "with", "from", "into", "onto",
        "about", "over", "under", "up", "down", "out",
        // "to be" / modal / helper verbs
        "is", "was", "are", "were", "am", "be", "been", "being",
        "do", "does", "did", "doing", "done",
        "have", "has", "had", "having",
        "can", "could", "will", "would", "shall", "should", "may", "might", "must",
        "not", "never",
        // filler / vague / low-content words
        "really", "very", "just", "too", "also", "actually", "literally",
        "maybe", "perhaps", "kind", "sort", "lot", "bit", "still", "even",
        "now", "here", "there", "again", "always", "like", "think", "know",
        "huh", "oh", "ah", "um", "uh", "well", "hey", "okay", "ok",
        "get", "got", "getting", "go", "going", "went", "come", "came",
        "something", "anything", "nothing", "everything",
        "someone", "anyone", "everyone", "nobody",
        "let", "let's", "make", "made", "making",
        // "yes"/"no"-family words — still read for affirm/deny in
        // normalize() (that check runs on tokens, not on this list),
        // they just shouldn't ALSO become topics.
        "yes", "yeah", "yep", "sure", "no", "nope", "nah", "never",
    ]);

    // Expanded BEFORE punctuation gets stripped, so "don't" becomes
    // "do not" instead of the meaningless "dont".
    const CONTRACTIONS = {
        "i'm": "i am", "i've": "i have", "i'll": "i will", "i'd": "i would",
        "you're": "you are", "you've": "you have", "you'll": "you will",
        "we're": "we are", "we've": "we have", "we'll": "we will",
        "they're": "they are", "they've": "they have", "they'll": "they will",
        "don't": "do not", "doesn't": "does not", "didn't": "did not",
        "can't": "can not", "won't": "will not", "wouldn't": "would not",
        "couldn't": "could not", "shouldn't": "should not", "isn't": "is not",
        "aren't": "are not", "wasn't": "was not", "weren't": "were not",
        "it's": "it is", "that's": "that is", "what's": "what is",
        "who's": "who is", "let's": "let us",
    };

    const AFFIRM_WORDS = ["yes", "yeah", "yep", "yup", "sure", "affirmative", "totally", "definitely", "correct", "right", "indeed", "absolutely", "certainly", "agreed", "exactly", "true"];
    const DENY_WORDS = ["no", "nope", "nah", "never", "negative", "incorrect", "wrong", "false", "not"];
    // Words that FLIP whichever affirm/deny word they sit right next
    // to ("not" is also its own DENY_WORD for a bare "not really",
    // but here it's checked as a NEIGHBOR of another polarity word —
    // see detectPolarity() below).
    const NEGATION_TRIGGERS = ["not", "never"];

    // =========================================================
    // STAGE 0 (setup) — the shared state object
    // =========================================================
    // One of these per player. Serialized straight to localStorage
    // (see saveState/loadState below) so the monster picks the
    // conversation back up after a refresh.
    function newState() {
        return {
            turn: 0,
            working: [],   // [{turn, speaker, text, intents, entities}] last 12
            topics: [],    // [{id, type, path, tier, weight, lastTurn}] decayed, capped
            facts: {},     // { key: {value, turn, confidence} }
            episodes: [],  // [{turn, text, keywords, entities, intents, importance}]
            debts: [],     // [{id, text, slot, expects, askedTurn, attempts, status, onYes, onNo, onAny, thenAsk}]
            used: {},      // { key: turnLastUsed } — cooldowns + no-repeat rendering
            variant: {},   // { key: lastIndexUsed } — no-repeat rendering
            trust: 0,      // -5..10, moved by tone
            mood: 0,       // -2..2, lightly smoothed by tone
            learnedCategories: {}, // { word: {family, path, tier} } — see classify()
            harvest: [],   // [{word, path, tier, turn}] — every tier>=2 fact captured
            maxTier: 0,    // 0..5, the "dread meter" — highest leverage tier reached
            thread: { ruleId: null, topic: null, followUps: 0 }, // what we're "on about" right now — see isFollowUp()/updateThread()
        };
    }

    function loadState() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (!saved) return newState();
            const parsed = JSON.parse(saved);
            // Guard against a corrupted or half-written save — start
            // fresh rather than crash the page.
            if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.working)) return newState();
            // Backfill fields added after some saves already existed,
            // so an older save doesn't crash on a missing property.
            if (!parsed.learnedCategories) parsed.learnedCategories = {};
            if (!parsed.harvest) parsed.harvest = [];
            if (parsed.maxTier === undefined) parsed.maxTier = 0;
            if (!parsed.thread) parsed.thread = { ruleId: null, topic: null, followUps: 0 };
            return parsed;
        } catch (error) {
            console.warn("[engine] Could not read saved state — starting fresh.", error);
            return newState();
        }
    }

    // ---- The Mira -> monster voice progression ----
    // Needs BOTH conditions, not just one — the atlas's own advice
    // ("escalate the entity's behaviour off the highest tier it has
    // reached") still decides WHETHER the mask should slip at all,
    // but a turn-count floor decides the earliest it's ALLOWED to.
    // Mira holds through turn 15 no matter what the player reveals;
    // the monster only fully appears from turn 25 on, and even then
    // only if the player has actually handed over tier-4+ material —
    // time passing alone never does it. Content gates on the result
    // via a rule's `voiceStage` field.
    const MIRA_HOLDS_THROUGH_TURN = 15;
    const MONSTER_EARLIEST_TURN = 25;

    function getVoiceStage(state) {
        if (state.turn >= MONSTER_EARLIEST_TURN && state.maxTier >= 4) return "monster";
        if (state.turn > MIRA_HOLDS_THROUGH_TURN && state.maxTier >= 2) return "transition";
        return "mira";
    }

    function saveState(state) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (error) {
            console.warn("[engine] Could not save state.", error);
        }
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    // ---- Deciding yes/no, without one "not" anywhere wrecking it ----
    // The old version set ONE negated flag for the whole sentence, so
    // "I'm not lying, yes I am human" read as a denial just because
    // "not" appeared somewhere earlier — the "not" had nothing to do
    // with "yes". This instead only flips an affirm/deny word when a
    // negation trigger sits in the two tokens right before IT
    // specifically — adjacency, not "anywhere in the sentence".
    function detectPolarity(tokens) {
        let affirm = false;
        let deny = false;

        tokens.forEach(function (word, index) {
            const isAffirmWord = AFFIRM_WORDS.indexOf(word) !== -1;
            const isDenyWord = DENY_WORDS.indexOf(word) !== -1;
            if (!isAffirmWord && !isDenyWord) return;

            const precedingWords = tokens.slice(Math.max(0, index - 2), index);
            const flipped = precedingWords.some(function (t) { return NEGATION_TRIGGERS.indexOf(t) !== -1; });

            if (flipped ? isDenyWord : isAffirmWord) affirm = true;
            if (flipped ? isAffirmWord : isDenyWord) deny = true;
        });

        return { affirm: affirm, deny: deny };
    }

    // ---- A special case: answering yes/no by echoing the question ----
    // "Are you human?" -> "I am." / "I'm not." never contains an
    // AFFIRM_WORDS/DENY_WORDS hit at all (detectPolarity() finds
    // nothing), but it's obviously a direct answer — a bare subject
    // plus auxiliary verb, optionally with "not". This only makes
    // sense as a reply to a specific yes/no question, so it's checked
    // separately in settleDebts() rather than folded into
    // detectPolarity() (which runs on every line, not just answers).
    function detectEchoAnswer(clean) {
        const match = /^i\s+(am|do|did|will|can|have|was|would|could|should)(\s+not)?\b/.exec(clean);
        if (!match) return null;
        return match[2] ? "no" : "yes";
    }

    // =========================================================
    // STAGE 1 — normalize
    // =========================================================
    // Raw text in, a small "nlu" (natural-language-understanding)
    // object out. Pure — never touches state.
    function normalize(raw) {
        let clean = String(raw).toLowerCase().trim();

        Object.keys(CONTRACTIONS).forEach(function (contraction) {
            clean = clean.split(contraction).join(CONTRACTIONS[contraction]);
        });

        const isQuestion = /\?\s*$/.test(raw) ||
            /^(who|what|where|when|why|how|which|do|does|did|can|could|will|would|are|is|have|has)\b/.test(clean);

        clean = clean.replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();
        const tokens = clean ? clean.split(" ") : [];

        const keywords = tokens.filter(function (t) { return !STOPWORDS.has(t) && t.length > 1; });
        const polarity = detectPolarity(tokens);

        return {
            raw: String(raw),      // kept for "/tag" scanning — clean strips the "/"
            clean: clean,
            tokens: tokens,
            keywords: keywords,
            isQuestion: isQuestion,
            affirm: polarity.affirm,
            deny: polarity.deny,
            resolved: [],           // filled in by resolveRefs()
            intents: [],            // filled in by classify()
            entities: [],           // filled in by classify()
        };
    }

    // =========================================================
    // STAGE 2 — resolveRefs
    // =========================================================
    // "You"/"I"/"me" always mean the same two people, so those bind
    // directly with no ambiguity. "They"/"them"/"their" could mean
    // whatever content word was mentioned most recently — bound
    // against the topic stack, recency first, same rule the handbook
    // uses ("it" almost always means the last thing said).
    function resolveRefs(nlu, state, content) {
        nlu.resolved = [];

        const byRecency = state.topics.slice().sort(function (a, b) {
            return (b.lastTurn - a.lastTurn) || (b.weight - a.weight);
        });

        nlu.tokens.forEach(function (tok) {
            const fixedEntityId = content.fixedPronouns[tok];
            if (fixedEntityId) {
                nlu.resolved.push({
                    pronoun: tok,
                    entityId: fixedEntityId,
                    entityType: fixedEntityId === "monster" ? "npc" : "person",
                });
                return;
            }

            const wantedTypes = content.dynamicPronouns[tok];
            if (!wantedTypes) return;

            for (let i = 0; i < byRecency.length; i++) {
                const topic = byRecency[i];
                if (wantedTypes.indexOf(topic.type) !== -1) {
                    nlu.resolved.push({ pronoun: tok, entityId: topic.id, entityType: topic.type });
                    return; // first (most recent) compatible match wins
                }
            }
            // No compatible topic exists yet — leave this pronoun
            // unresolved rather than guessing. See classify() for how
            // an unresolved "them" still gets acknowledged.
        });

        return nlu;
    }

    // ---- "/tag" and sentence-marker scanning, used by classify() ----
    // Lives here (not in content) since it's generic text-scanning
    // logic — only the TAG_TONE_MAP it's scanning for is content.
    function findTagsInText(text, tagToneMap) {
        if (!text) return [];
        const lowerText = text.toLowerCase();
        const tagPattern = /(?:^|\s)(\/[a-z]+)(?=$|[\s.,!?])/g;
        const found = [];
        let match = tagPattern.exec(lowerText);
        while (match !== null) {
            const toneKey = tagToneMap[match[1]];
            if (toneKey && found.indexOf(toneKey) === -1) found.push(toneKey);
            match = tagPattern.exec(lowerText);
        }
        return found;
    }

    function findPunctuationSignals(text) {
        if (!text) return [];
        const trimmed = text.trim();
        const signals = [];
        if (trimmed.endsWith("...")) signals.push("trailingEllipsis");
        if (/\b[A-Z]{2,}\b/.test(text)) signals.push("allCaps");
        if (text.includes("~")) signals.push("tilde");
        if (trimmed.endsWith("?")) signals.push("endsWithQuestion");
        if (/!!+/.test(trimmed)) signals.push("multipleExclamation");
        if (trimmed.endsWith(".") && !trimmed.endsWith("...")) signals.push("endsWithPeriodOnly");
        return signals;
    }

    // =========================================================
    // STAGE 3 — classify
    // =========================================================
    // Scores every intent that applies to this line: self-tagged
    // "/tags" (weight 3 each, nudged by sentence markers), phrase
    // intents, plus an "address_*" intent for whoever resolveRefs()
    // just bound a pronoun to. Also builds the entity list for this
    // turn — every real word gets typed via Lexicon.js's resolve(),
    // so it can be bumped onto the topic stack and matched against
    // rules.
    function classify(nlu, state, content) {
        const tagKeys = findTagsInText(nlu.raw, content.tagToneMap);
        const punctuationSignals = findPunctuationSignals(nlu.raw);

        const scores = {};
        tagKeys.forEach(function (id) { scores[id] = (scores[id] || 0) + 3; });
        punctuationSignals.forEach(function (signal) {
            (content.punctuationNudges[signal] || []).forEach(function (id) {
                if (scores[id] !== undefined) scores[id] += 1; // only reinforces an already-tagged tone
            });
        });

        // ---- Phrase-based intents ----
        // Unlike "/tags" (an exact symbol) or address pronouns (single
        // words), these are whole PHRASES scanned against the cleaned
        // sentence — "what if", "i feel", "suppose"... See Monster
        // Content.js's `phraseIntents` for the actual pattern lists;
        // this is generic enough that any content file could define
        // its own set of phrases to watch for.
        (content.phraseIntents || []).forEach(function (intent) {
            const matched = intent.patterns.some(function (pattern) { return pattern.test(nlu.clean); });
            if (matched) scores[intent.id] = (scores[intent.id] || 0) + (intent.weight || 2);
        });

        // "them" used but nothing to bind it to — still worth a reply.
        const thirdPartyTokenUsed = nlu.tokens.some(function (t) { return content.dynamicPronouns[t]; });
        const thirdPartyResolved = nlu.resolved.some(function (r) { return content.dynamicPronouns[r.pronoun]; });
        if (thirdPartyTokenUsed && !thirdPartyResolved) scores.address_other_unresolved = 2;

        nlu.resolved.forEach(function (ref) {
            let addressIntent;
            if (ref.entityId === "monster") addressIntent = "address_monster";
            else if (ref.entityId === "player") addressIntent = "address_self";
            else addressIntent = "address_other";
            scores[addressIntent] = (scores[addressIntent] || 0) + 2.5;
            if (addressIntent === "address_other") nlu.addressOtherEntityId = ref.entityId;
        });

        nlu.intents = Object.keys(scores)
            .map(function (id) { return { id: id, score: scores[id] }; })
            .sort(function (a, b) { return b.score - a.score; });

        // Built from nlu.tokens (not nlu.keywords) so each word still
        // knows what came right before it and where it sits in the
        // sentence. Every entity now carries a family (`type`, same
        // field name rules already gate on), a full atlas `path`, and
        // a leverage `tier` from Lexicon.js. Two passes:
        //   1. Resolve normally — Lexicon.resolve() (the atlas + the
        //      "saw"-style grammar guard + hot-topic bias for words
        //      with more than one meaning), or whatever we already
        //      LEARNED for this exact word on a past turn.
        //   2. Anything STILL "unknown" gets grouped with whichever
        //      OTHER real-category word in this SAME sentence sits
        //      closest to it — e.g. an unknown word sitting right
        //      next to "pizza" gets treated as food too. That guess is
        //      remembered in state.learnedCategories, so next time the
        //      monster sees that exact word again, it already knows
        //      the group — literally the monster building its own
        //      vocabulary out of what the player has said.
        const hotFamilies = state.topics.map(function (t) { return t.type; });
        const entities = [];

        nlu.tokens.forEach(function (word, index) {
            if (STOPWORDS.has(word) || word.length <= 1) return;
            const prevWord = index > 0 ? nlu.tokens[index - 1] : null;

            const learned = state.learnedCategories[word];
            const resolved = learned || window.Lexicon.resolve(word, prevWord, hotFamilies);

            entities.push({ id: word, type: resolved.family, path: resolved.path, tier: resolved.tier, tokenIndex: index });
        });

        // A few important multi-word phrases ("come in", "i promise")
        // are checked against the whole sentence, not per-token — see
        // Lexicon.js's PHRASE_ENTRIES. These are already fully
        // resolved, so they never need the "unknown" grouping pass,
        // but they DO count as real anchors for it.
        window.Lexicon.findPhraseMatches(nlu.clean).forEach(function (match) {
            const firstWord = match.id.split(" ")[0];
            const tokenIndex = nlu.tokens.indexOf(firstWord);
            entities.push({ id: match.id, type: match.family, path: match.path, tier: match.tier, tokenIndex: tokenIndex === -1 ? 0 : tokenIndex });
        });

        // Snapshot BEFORE any inferring happens, so one guess can't
        // cascade into the next (an inferred word shouldn't then act
        // as an "anchor" for its own neighbor — only real, originally-
        // resolved words should).
        const originalTypes = entities.map(function (e) { return e.type; });

        entities.forEach(function (entity, entityIndex) {
            if (originalTypes[entityIndex] !== "unknown") return;

            let closest = null;
            let closestDistance = Infinity;
            entities.forEach(function (other, otherIndex) {
                if (otherIndex === entityIndex || originalTypes[otherIndex] === "unknown") return;
                const distance = Math.abs(other.tokenIndex - entity.tokenIndex);
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closest = other;
                }
            });

            if (closest) {
                entity.type = closest.type;
                entity.path = closest.path;
                entity.tier = closest.tier;
                state.learnedCategories[entity.id] = { family: closest.type, path: closest.path, tier: closest.tier };
            }
        });

        // ---- What is a descriptor word actually describing? ----
        // "Blue" on its own means nothing — blue WHAT? Any word where
        // Lexicon.js's isDescriptor() is true (any `quality.*` word —
        // colours, but also sizes, sounds, textures...) gets linked to
        // the closest OTHER word in the SAME sentence that could
        // plausibly be the thing it's describing. Two kinds of
        // referent count: a real noun (isDescribable() — appearance, a
        // body part, clothing — "blue EYES"), or a pronoun bound to
        // "you"/"I" ("you're WEIRD" describes the monster just as much
        // as "blue eyes" describes eyes — without this, a plain insult
        // would wrongly look like an unresolved descriptor needing
        // clarification). Same nearest-neighbor idea as the "unknown"
        // grouping pass above, just answering "what does this
        // describe" instead of "what category is this." See
        // select()'s "{word} what?" clarification for what happens
        // when NO referent is found here.
        entities.forEach(function (entity) {
            if (!window.Lexicon.isDescriptor(entity.path)) return;

            const candidates = entities.filter(function (other) {
                return other !== entity && window.Lexicon.isDescribable(other.path);
            });
            nlu.resolved.forEach(function (ref) {
                const pronounIndex = nlu.tokens.indexOf(ref.pronoun);
                if (pronounIndex !== -1) candidates.push({ id: ref.entityId, path: null, tokenIndex: pronounIndex });
            });

            let closest = null;
            let closestDistance = Infinity;
            candidates.forEach(function (candidate) {
                const distance = Math.abs(candidate.tokenIndex - entity.tokenIndex);
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closest = candidate;
                }
            });

            entity.refersTo = closest ? closest.id : null;
            entity.refersToPath = closest ? closest.path : null;
        });

        nlu.resolved.forEach(function (ref) {
            if (!entities.some(function (e) { return e.id === ref.entityId; })) {
                entities.push({ id: ref.entityId, type: ref.entityType, path: null, tier: 0 });
            }
        });
        nlu.entities = entities;

        return nlu;
    }

    // =========================================================
    // STAGE 4 — extractSlots
    // =========================================================
    // Runs BEFORE settleDebts on purpose — so a debt asking "what's
    // your name?" can be paid by the fact this very line just wrote.
    function extractSlots(nlu, state, content) {
        content.slots.forEach(function (slotDef) {
            for (let i = 0; i < slotDef.patterns.length; i++) {
                const match = slotDef.patterns[i].exec(nlu.clean);
                if (match) {
                    const rawValue = match[1];
                    const value = slotDef.clean ? slotDef.clean(rawValue) : rawValue;
                    state.facts[slotDef.id] = {
                        value: value,
                        turn: state.turn,
                        confidence: slotDef.confidence !== undefined ? slotDef.confidence : 1,
                    };
                    return;
                }
            }
        });
    }

    // =========================================================
    // STAGE 5 — settleDebts
    // =========================================================
    // Was the monster's own outstanding question just answered?
    function settleDebts(nlu, state) {
        const events = [];

        state.debts.forEach(function (debt) {
            if (debt.status !== "open") return;

            if (debt.slot && state.facts[debt.slot] && state.facts[debt.slot].turn >= state.turn) {
                debt.status = "paid"; events.push({ type: "paid", debt: debt }); return;
            }
            if (debt.expects.indexOf("*any*") !== -1 && nlu.clean.length > 0) {
                debt.status = "paid"; events.push({ type: "paid", debt: debt }); return;
            }
            if (debt.expects.indexOf("*yesno*") !== -1) {
                const echoAnswer = detectEchoAnswer(nlu.clean);
                if (echoAnswer || nlu.affirm || nlu.deny) {
                    debt.answer = echoAnswer || (nlu.affirm ? "yes" : "no");
                    debt.status = "paid"; events.push({ type: "paid", debt: debt }); return;
                }
            }
            const matchedIntent = nlu.intents.find(function (i) { return debt.expects.indexOf(i.id) !== -1; });
            if (matchedIntent) {
                debt.status = "paid"; events.push({ type: "paid", debt: debt }); return;
            }

            if (state.turn > debt.askedTurn) {
                debt.attempts += 1;
                if (debt.attempts > W.maxReasks) {
                    debt.status = "dropped"; events.push({ type: "dropped", debt: debt });
                } else {
                    events.push({ type: "unpaid", debt: debt });
                }
            }
        });

        return events;
    }

    // =========================================================
    // STAGE 6 — remember
    // =========================================================
    function bumpTopic(state, id, type, path, tier) {
        const existing = state.topics.find(function (t) { return t.id === id; });
        if (existing) {
            existing.weight += W.topicBoost;
            existing.lastTurn = state.turn;
        } else {
            state.topics.push({ id: id, type: type, path: path || null, tier: tier || 0, weight: W.topicBoost, lastTurn: state.turn });
        }
        state.topics.sort(function (a, b) { return b.weight - a.weight; });
        state.topics = state.topics.slice(0, W.topicMax);
    }

    function importanceOf(nlu, content) {
        let importance = 0.2;
        if (nlu.entities.length) importance += 0.3;
        if (nlu.intents.length && nlu.intents[0].score >= 3) importance += 0.3;
        if (nlu.isQuestion) importance += 0.15;
        const hasImportantIntent = nlu.intents.some(function (i) { return content.importantIntents.indexOf(i.id) !== -1; });
        if (hasImportantIntent) importance += 0.5;
        return Math.min(1, importance);
    }

    function remember(nlu, state, content) {
        state.working.push({
            turn: state.turn,
            speaker: "player",
            text: nlu.raw,
            intents: nlu.intents.map(function (i) { return i.id; }),
            entities: nlu.entities.map(function (e) { return e.id; }),
        });
        if (state.working.length > W.workingMemory) state.working.shift();

        // Only words worth ASKING ABOUT become topics that a rule can
        // later pick as "{word}" — see Lexicon.js's isTopicWorthy().
        // Function words ("thanks", "maybe", "today") still count for
        // everything else (working memory, episodes, harvest below),
        // they just never get pushed into a mirroring question. "You"/
        // "I" (type "npc"/"person", from resolveRefs()'s fixed pronoun
        // binding) are excluded the same way — they're WHO is being
        // talked about, never a topic to mirror back on their own.
        nlu.entities.forEach(function (e) {
            if (e.type === "person" || e.type === "npc") return;
            if (window.Lexicon.isTopicWorthy(e.path)) bumpTopic(state, e.id, e.type, e.path, e.tier);
        });

        // The "harvest" — every real fact (tier >= 2: identity and up)
        // the player has handed over this turn, and the dread meter
        // that drives Monster Content.js's Mira -> monster voice
        // progression (see Engine.js's getVoiceStage()).
        nlu.entities.forEach(function (e) {
            if (e.tier >= 2) {
                state.harvest.push({ word: e.id, path: e.path, tier: e.tier, turn: state.turn });
                state.maxTier = Math.max(state.maxTier, e.tier);
            }
        });

        state.episodes.push({
            turn: state.turn,
            text: nlu.raw,
            keywords: nlu.keywords,
            entities: nlu.entities.map(function (e) { return e.id; }),
            intents: nlu.intents.map(function (i) { return i.id; }),
            importance: importanceOf(nlu, content),
        });
        if (state.episodes.length > W.episodeCap) state.episodes.shift();

        nlu.intents.forEach(function (intent) {
            const nudge = content.trustNudges[intent.id];
            if (nudge) state.trust = clamp(state.trust + nudge, -5, 10);
            const moodNudge = content.moodNudges[intent.id];
            if (moodNudge) state.mood = clamp(state.mood + moodNudge, -2, 2);
        });
    }

    // =========================================================
    // retrieve — the recency + importance + relevance formula
    // =========================================================
    function jaccard(a, b) {
        if (!a.length && !b.length) return 0;
        const setB = new Set(b);
        let intersection = 0;
        a.forEach(function (word) { if (setB.has(word)) intersection++; });
        const unionSize = new Set(a.concat(b)).size;
        return unionSize === 0 ? 0 : intersection / unionSize;
    }

    function retrieve(state, cueKeywords, k) {
        const now = state.turn;
        return state.episodes
            .map(function (e) {
                const recency = Math.pow(W.recencyDecay, now - e.turn);
                const relevance = jaccard(cueKeywords, e.keywords);
                const score = W.wRecency * recency + W.wImportance * e.importance + W.wRelevance * relevance;
                return { episode: e, score: score };
            })
            .sort(function (a, b) { return b.score - a.score; })
            .slice(0, k || 3);
    }

    // =========================================================
    // STAGE 7 — select (gate, then score, then the fallback ladder)
    // =========================================================
    // requiresEntity accepts either one type/id string or an array of
    // acceptable ones — some rules need more than one family (e.g. a
    // rule about "doing something physical" spans both `movement` and
    // `action`, which used to be one made-up "actions" category
    // before the real atlas replaced it).
    function entityMatches(e, wanted) {
        const list = Array.isArray(wanted) ? wanted : [wanted];
        return list.indexOf(e.id) !== -1 || list.indexOf(e.type) !== -1;
    }

    // ---- Is this reply just following up on what's already being ----
    // ---- talked about, rather than bringing up something new? ----
    // "oh really, what is it?" introduces no real topic word of its
    // own — every word in it is a stopword. Without this check, a
    // turn like that has nothing for select() to score against, and
    // fell through to the memory-callback ladder rung, which doesn't
    // require actual relevance to fire (recency/importance alone can
    // clear its threshold) — that's how an unrelated old line ("you
    // are weird") got dredged up over a perfectly normal follow-up.
    function isFollowUp(nlu, thread) {
        if (!thread.ruleId) return false;
        return !nlu.entities.some(function (e) {
            return window.Lexicon.isTopicWorthy(e.path) && e.id !== thread.topic;
        });
    }

    // ---- Picking a "hot topic" without stale ones winning forever ----
    // state.topics is sorted by cumulative weight, which means a word
    // mentioned five turns ago and repeated often can permanently
    // outrank something the player just said once. This prefers
    // whatever matches AND was mentioned THIS turn; only if nothing
    // matching was just said does it fall back to the older,
    // higher-weight history. (state.topics is already weight-sorted,
    // and filtering preserves that relative order, so picking [0] of
    // either group still gets the strongest candidate within it.)
    function pickHotTopic(state, matchFn) {
        const candidates = state.topics.filter(matchFn);
        if (!candidates.length) return null;
        const freshest = candidates.filter(function (t) { return t.lastTurn === state.turn; });
        return freshest.length ? freshest[0] : candidates[0];
    }

    function scoreRule(rule, nlu, state) {
        if (rule.intents && !rule.intents.some(function (id) { return nlu.intents.some(function (i) { return i.id === id; }); })) return null;
        if (rule.requiresEntity && !nlu.entities.some(function (e) { return entityMatches(e, rule.requiresEntity); })) return null;
        if (rule.forbidsEntityTypes && nlu.entities.some(function (e) { return rule.forbidsEntityTypes.indexOf(e.type) !== -1; })) return null;
        if (rule.requiresFact && !state.facts[rule.requiresFact]) return null;
        if (rule.forbidsFact && state.facts[rule.forbidsFact]) return null;
        if (rule.minTrust !== undefined && state.trust < rule.minTrust) return null;
        if (rule.maxTrust !== undefined && state.trust > rule.maxTrust) return null;
        if (rule.voiceStage && rule.voiceStage !== getVoiceStage(state)) return null;
        if (rule.once && state.used[rule.id] !== undefined) return null;
        if (rule.cooldown && state.used[rule.id] !== undefined && (state.turn - state.used[rule.id]) < rule.cooldown) return null;

        const intentMatched = !!(rule.intents && rule.intents.some(function (id) { return nlu.intents.some(function (i) { return i.id === id; }); }));
        const matchedEntity = rule.requiresEntity
            ? nlu.entities.find(function (e) { return entityMatches(e, rule.requiresEntity); })
            : null;
        const entityMatched = !!matchedEntity;
        const hotTopic = rule.topics
            ? pickHotTopic(state, function (t) { return rule.topics.indexOf(t.type) !== -1; })
            : null;
        const topicMatched = !!hotTopic;
        // Path-level gate — same idea as `topics` (family), but exact:
        // "identity.appearance", not just any `identity` word.
        const hotPathTopic = rule.requiresCategory
            ? pickHotTopic(state, function (t) { return t.path === rule.requiresCategory; })
            : null;
        const categoryMatched = !!hotPathTopic;
        const keywordScore = jaccard(nlu.keywords, rule.keywords || []);

        // A rule must match SOMETHING real before it's even a
        // candidate — priority alone is only a tie-breaker, never a
        // reason to fire. See the handbook's own warning about this.
        // A bare voiceStage gate with nothing else to match on is
        // allowed through here on purpose (see ruleToBeat callers) —
        // everything else still needs a real match.
        if (!intentMatched && !entityMatched && !topicMatched && !categoryMatched && keywordScore === 0 && !rule.voiceStage) return null;

        const lastUsedTurn = state.used[rule.id];
        const recencyOfLastUse = lastUsedTurn === undefined ? 0 : Math.pow(W.recencyDecay, state.turn - lastUsedTurn);

        const score =
            W.intentMatch * (intentMatched ? 1 : 0) +
            W.entityMatch * (entityMatched ? 1 : 0) +
            W.topicOverlap * (topicMatched ? hotTopic.weight : 0) +
            W.topicOverlap * (categoryMatched ? hotPathTopic.weight : 0) +
            W.keywordOverlap * keywordScore +
            W.factBonus * (rule.requiresFact ? 1 : 0) +
            (rule.priority || 0) -
            W.repeatPenalty * recencyOfLastUse;

        let matchedWord = null;
        if (categoryMatched) matchedWord = hotPathTopic.id;
        if (topicMatched) matchedWord = hotTopic.id;
        if (entityMatched) matchedWord = matchedEntity.id;
        if (intentMatched && rule.intents.indexOf("address_other") !== -1 && nlu.addressOtherEntityId) {
            matchedWord = nlu.addressOtherEntityId;
        }

        return { rule: rule, score: score, matchedWord: matchedWord };
    }

    function ruleToBeat(rule, matchedWord) {
        return { ruleId: rule.id, lines: rule.lines, followups: rule.followups || null, ask: rule.ask || null, matchedWord: matchedWord || null };
    }

    function select(nlu, state, content, debtEvents) {
        // ---- Priority: did this line pay off the monster's own question? ----
        const paidWithBranch = debtEvents.find(function (event) {
            return event.type === "paid" && (event.debt.onYes || event.debt.onNo || event.debt.onAny);
        });
        if (paidWithBranch) {
            const debt = paidWithBranch.debt;
            let lines = debt.onAny;
            if (!lines && debt.answer === "yes") lines = debt.onYes;
            if (!lines && debt.answer === "no") lines = debt.onNo;
            if (lines) {
                // Whatever real word the player actually used in their
                // answer — so an "onAny" line can echo it back with
                // "{word}" instead of asserting a fixed guess (this is
                // exactly how a hardcoded "Brown" survived unnoticed:
                // nothing was ever available to fill "{word}" here).
                const mentionedWord = nlu.entities.find(function (e) { return window.Lexicon.isTopicWorthy(e.path); });
                return { ruleId: "debt:" + debt.id, lines: lines, followups: null, ask: debt.thenAsk || null, matchedWord: mentionedWord ? mentionedWord.id : null };
            }
        }

        // ---- Conversation threads: stay on-topic through follow-ups ----
        // A low-content reply ("oh really, what is it?") should keep
        // talking about whatever thread is already active, not
        // randomly resurface an unrelated old memory. Up to 3
        // follow-ups in a row; the 4th deliberately lets the thread go
        // so something fresh can take over (see the fall-through
        // below, and ensureTopicToTalkAbout() in respond()).
        const followingUp = isFollowUp(nlu, state.thread);
        if (followingUp && state.thread.followUps < 3) {
            // A rule written specifically to continue THIS thread (see
            // Monster Content.js's "followUpFor") — e.g. the flower
            // rule revealing it's a foxglove when asked "what is it?".
            const followUpRule = content.rules.find(function (r) { return r.followUpFor === state.thread.ruleId; });
            if (followUpRule) {
                const usedTurn = state.used[followUpRule.id];
                const blockedByOnce = followUpRule.once && usedTurn !== undefined;
                const blockedByCooldown = followUpRule.cooldown && usedTurn !== undefined && (state.turn - usedTurn) < followUpRule.cooldown;
                if (!blockedByOnce && !blockedByCooldown) return ruleToBeat(followUpRule, null);
            }
            // No bespoke follow-up content (yet) — keep the thread
            // alive anyway by reusing wh_frames_general's own lines,
            // centered on whatever the thread's topic already is,
            // rather than inventing new generic text.
            const genericContinuation = content.rules.find(function (r) { return r.id === "wh_frames_general"; });
            if (genericContinuation && state.thread.topic) return ruleToBeat(genericContinuation, state.thread.topic);
        } else if (followingUp) {
            // The 4th follow-up in a row — let it go on purpose.
            state.thread = { ruleId: null, topic: null, followUps: 0 };
        }

        // ---- Priority: a bare descriptor with nothing to describe ----
        // A colour, size, sound, texture... with no referent found in
        // classify() (see its "what does this describe" pass) AND
        // nothing open for it to be answering — the monster shouldn't
        // guess what it means, it should ask. Skipped entirely if a
        // debt was paid or left unpaid THIS turn (already handled
        // above, or about to be handled by the unpaid-debt ladder rung
        // below) so this never double-answers something already dealt
        // with.
        const hadDebtActivity = debtEvents.some(function (event) { return event.type === "paid" || event.type === "unpaid"; });
        const unresolvedDescriptor = nlu.entities.find(function (e) { return window.Lexicon.isDescriptor(e.path) && !e.refersTo; });
        if (unresolvedDescriptor && !hadDebtActivity) {
            return {
                ruleId: "clarify_descriptor",
                lines: ["Wait — {word}? {word} what, exactly?", "Just \"{word}\"? {word} what?"],
                followups: null, ask: null, matchedWord: unresolvedDescriptor.id,
            };
        }

        // ---- Gate + score every rule, take the best ----
        const candidates = content.rules
            .map(function (rule) { return scoreRule(rule, nlu, state); })
            .filter(function (scored) { return scored !== null; })
            .sort(function (a, b) { return b.score - a.score; });

        if (candidates.length && candidates[0].score >= W.minScore) {
            return ruleToBeat(candidates[0].rule, candidates[0].matchedWord);
        }

        // ---- The fallback ladder — never "I don't understand" ----
        const unpaid = debtEvents.find(function (event) { return event.type === "unpaid"; });
        if (unpaid) {
            return { ruleId: "ladder:unpaid_debt", lines: ["You never answered: \"" + unpaid.debt.text + "\""], followups: null, ask: null, matchedWord: null };
        }

        const recalled = retrieve(state, nlu.keywords, 1)[0];
        if (recalled && recalled.score > 0.3) {
            return { ruleId: "ladder:memory_callback", lines: ["You said something earlier that's still sitting with me: \"" + recalled.episode.text + "\""], followups: null, ask: null, matchedWord: null };
        }

        if (state.topics.length) {
            // Same recency-first idea as pickHotTopic() above — prefer
            // whatever was mentioned THIS turn over older, heavier topics.
            const freshTopics = state.topics.filter(function (t) { return t.lastTurn === state.turn; });
            const hotTopic = freshTopics.length ? freshTopics[0] : state.topics[0];
            const topicRule = content.rules.find(function (r) { return r.topics && r.topics.indexOf(hotTopic.type) !== -1; });
            if (topicRule) return ruleToBeat(topicRule, hotTopic.id);
        }

        return { ruleId: "ladder:deflection", lines: content.fallbackDeflections, followups: null, ask: null, matchedWord: null };
    }

    // ---- Recording what the monster is "on about" now, for next turn ----
    // Called once, right after select() picks a beat. `thread.ruleId`
    // deliberately stays pinned to whatever rule ORIGINALLY started
    // the thread (not whichever follow-up/continuation rule just
    // fired) — that's what lets a later reply keep matching the same
    // `followUpFor` chain turn after turn. `thread.topic` works the
    // same way: a rule with no dynamic "{word}" (a flavor line like
    // mira_flowers) can declare a plain `topicHint` instead, so the
    // thread still has something concrete to continue.
    function updateThread(state, beat, content) {
        const rule = content.rules.find(function (r) { return r.id === beat.ruleId; });
        const beatTopic = beat.matchedWord || (rule && rule.topicHint) || null;

        const continuesThread = !!state.thread.ruleId && (
            beat.ruleId === state.thread.ruleId ||
            (rule && rule.followUpFor === state.thread.ruleId) ||
            (beatTopic !== null && beatTopic === state.thread.topic)
        );

        if (continuesThread) {
            state.thread.followUps += 1;
        } else {
            state.thread = { ruleId: beat.ruleId, topic: beatTopic, followUps: 0 };
        }
    }

    // =========================================================
    // STAGE 8 — render
    // =========================================================
    function pickFrom(lines, state, key) {
        const lastIndex = state.variant[key];
        let index = Math.floor(Math.random() * lines.length);
        if (lines.length > 1 && index === lastIndex) index = (index + 1) % lines.length;
        state.variant[key] = index;
        return lines[index];
    }

    // "{word}"/"{word:gerund}" fills in whatever entity the rule
    // matched on; "{factKey}" fills in a stored fact; "{personaKey}"
    // fills in a persona field. Unknown keys survive untouched, on
    // purpose, so a typo is visible instead of silently disappearing.
    function fill(text, state, content, matchedWord) {
        return text.replace(/\{(\w+)(?::(\w+))?\}/g, function (whole, key, form) {
            let value = null;
            if (key === "word" && matchedWord) value = matchedWord;
            else if (state.facts[key]) value = state.facts[key].value;
            else if (content.persona[key]) value = content.persona[key];
            if (value === null) return whole;
            return (form && window.WordCorrection) ? window.WordCorrection.getWordForm(value, form) : value;
        });
    }

    function render(beat, state, content) {
        let text = fill(pickFrom(beat.lines, state, beat.ruleId + ":line"), state, content, beat.matchedWord);

        if (beat.followups) {
            text = text + " " + fill(pickFrom(beat.followups, state, beat.ruleId + ":followup"), state, content, beat.matchedWord);
        }

        if (beat.ask) {
            text = text + " " + beat.ask.text;
            state.debts.push({
                id: beat.ruleId + ":" + state.turn,
                text: beat.ask.text,
                slot: beat.ask.slot || null,
                expects: beat.ask.expects || ["*any*"],
                onYes: beat.ask.onYes || null,
                onNo: beat.ask.onNo || null,
                onAny: beat.ask.onAny || null,
                thenAsk: beat.ask.thenAsk || null,
                askedTurn: state.turn,
                attempts: 0,
                status: "open",
            });
        }

        state.used[beat.ruleId] = state.turn;
        return text;
    }

    // =========================================================
    // STAGE 9 — decay
    // =========================================================
    function decay(state) {
        state.topics.forEach(function (t) { t.weight *= W.topicDecay; });
        state.topics = state.topics.filter(function (t) { return t.weight > W.topicFloor; });
    }

    // =========================================================
    // The two functions other files actually call
    // =========================================================

    // If the player hasn't given the monster anything to build a
    // mirroring question around yet — most commonly right at the
    // start of a conversation, before the topic stack has anything
    // in it — the monster reaches into its OWN vocabulary instead of
    // coming up empty. Resolved and bumped exactly like a player's
    // word would be (see Monster Content.js's monsterVocabulary), so
    // every existing category rule works on it completely unchanged.
    function ensureTopicToTalkAbout(state, content) {
        if (state.topics.length > 0) return;
        if (!content.monsterVocabulary || !content.monsterVocabulary.length) return;

        const word = content.monsterVocabulary[Math.floor(Math.random() * content.monsterVocabulary.length)];
        const resolved = window.Lexicon.resolve(word, null, []);
        if (window.Lexicon.isTopicWorthy(resolved.path)) {
            bumpTopic(state, word, resolved.family, resolved.path, resolved.tier);
        }
    }

    // One full turn: player line in, monster line out.
    function respond(rawText, state, content) {
        state.turn += 1;

        let nlu = normalize(rawText);
        nlu = resolveRefs(nlu, state, content);
        nlu = classify(nlu, state, content);
        extractSlots(nlu, state, content);
        const debtEvents = settleDebts(nlu, state);
        remember(nlu, state, content);
        ensureTopicToTalkAbout(state, content);

        const beat = select(nlu, state, content, debtEvents);
        updateThread(state, beat, content);
        const text = render(beat, state, content);

        decay(state);
        saveState(state);

        return { text: text, debug: buildDebugSnapshot(state) };
    }

    // The very first line shown, before the player has typed anything.
    // Turn 0 = never talked before -> the stranger greeting. Turn > 0
    // (loaded from localStorage) -> a returning-player line instead.
    function greet(state, content) {
        const rule = state.turn === 0
            ? content.rules.find(function (r) { return r.id === "ask_human"; })
            : content.rules.find(function (r) { return r.id === "welcome_back"; });

        const text = render(ruleToBeat(rule, null), state, content);
        saveState(state);
        return { text: text, debug: buildDebugSnapshot(state) };
    }

    function buildDebugSnapshot(state) {
        return {
            turn: state.turn,
            trust: state.trust,
            mood: state.mood,
            maxTier: state.maxTier,
            voiceStage: getVoiceStage(state),
            topics: state.topics.map(function (t) { return { id: t.id, type: t.type, path: t.path, weight: Math.round(t.weight * 100) / 100 }; }),
            facts: Object.keys(state.facts).reduce(function (acc, key) {
                acc[key] = state.facts[key].value;
                return acc;
            }, {}),
            debts: state.debts.map(function (d) { return { text: d.text, status: d.status }; }),
            learned: state.learnedCategories,
            harvest: state.harvest,
        };
    }

    function resetState() {
        try { localStorage.removeItem(STORAGE_KEY); } catch (error) { /* ignore */ }
    }

    // -------- Make these functions available to other files --------
    window.Engine = {
        newState: newState,
        loadState: loadState,
        saveState: saveState,
        resetState: resetState,
        respond: respond,
        greet: greet,
        retrieve: retrieve,
        getVoiceStage: getVoiceStage,
    };

})();
