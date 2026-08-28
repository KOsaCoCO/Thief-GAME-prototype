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
//
// THE NINE STAGES, always in this order:
//   1. normalize    — raw text -> tokens/keywords/question-flag
//   2. resolveRefs   — bind "you"/"them"/"I" to an actual entity
//   3. classify        — score which tone-tags and address-types apply
//   4. extractSlots      — write any permanent facts this line reveals
//   5. settleDebts          — did this answer pay off the monster's
//                              own last question?
//   6. remember               — save working memory, bump topics,
//                                 log a scored episode
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
            topics: [],    // [{id, type, weight, lastTurn}] decayed, capped
            facts: {},     // { key: {value, turn, confidence} }
            episodes: [],  // [{turn, text, keywords, entities, intents, importance}]
            debts: [],     // [{id, text, slot, expects, askedTurn, attempts, status, onYes, onNo, onAny, thenAsk}]
            used: {},      // { key: turnLastUsed } — cooldowns + no-repeat rendering
            variant: {},   // { key: lastIndexUsed } — no-repeat rendering
            trust: 0,      // -5..10, moved by tone
            mood: 0,       // -2..2, lightly smoothed by tone
            learnedCategories: {}, // { word: guessedCategory } — see classify()
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
            return parsed;
        } catch (error) {
            console.warn("[engine] Could not read saved state — starting fresh.", error);
            return newState();
        }
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
    // "/tags" (weight 3 each, nudged by sentence markers), plus an
    // "address_*" intent for whoever resolveRefs() just bound a
    // pronoun to. Also builds the entity list for this turn — every
    // real word gets typed via content.categorize(), so it can be
    // bumped onto the topic stack and matched against rules.
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
        // sentence. Two passes:
        //   1. Categorize normally — content.categorize() (the static
        //      list + the "saw"-style homograph guardrail), or
        //      whatever category we already LEARNED for this exact
        //      word on a past turn (see pass 2 and Player learning,
        //      below).
        //   2. Anything STILL uncategorized gets grouped with
        //      whichever OTHER real-category word in this SAME
        //      sentence sits closest to it — e.g. an unknown word
        //      sitting right next to "pizza" gets treated as "food"
        //      too. That guess is then remembered in
        //      state.learnedCategories, so next time the monster sees
        //      that exact word again, it already knows the group —
        //      literally the monster building its own vocabulary out
        //      of what the player has said, which is the whole point
        //      of this game.
        const entities = [];
        nlu.tokens.forEach(function (word, index) {
            if (STOPWORDS.has(word) || word.length <= 1) return;
            const prevWord = index > 0 ? nlu.tokens[index - 1] : null;
            let type = content.categorize(word, prevWord);
            if (type === "uncategorized" && state.learnedCategories[word]) {
                type = state.learnedCategories[word];
            }
            entities.push({ id: word, type: type, tokenIndex: index });
        });

        // Snapshot BEFORE any inferring happens, so one guess can't
        // cascade into the next (an inferred word shouldn't then act
        // as an "anchor" for its own neighbor — only real, originally-
        // categorized words should).
        const originalTypes = entities.map(function (e) { return e.type; });

        entities.forEach(function (entity, entityIndex) {
            if (originalTypes[entityIndex] !== "uncategorized") return;

            let closestType = null;
            let closestDistance = Infinity;
            entities.forEach(function (other, otherIndex) {
                if (otherIndex === entityIndex || originalTypes[otherIndex] === "uncategorized") return;
                const distance = Math.abs(other.tokenIndex - entity.tokenIndex);
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestType = originalTypes[otherIndex];
                }
            });

            if (closestType) {
                entity.type = closestType;
                state.learnedCategories[entity.id] = closestType;
            }
        });

        nlu.resolved.forEach(function (ref) {
            if (!entities.some(function (e) { return e.id === ref.entityId; })) {
                entities.push({ id: ref.entityId, type: ref.entityType });
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
            if (debt.expects.indexOf("*yesno*") !== -1 && (nlu.affirm || nlu.deny)) {
                debt.answer = nlu.affirm ? "yes" : "no";
                debt.status = "paid"; events.push({ type: "paid", debt: debt }); return;
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
    function bumpTopic(state, id, type) {
        const existing = state.topics.find(function (t) { return t.id === id; });
        if (existing) {
            existing.weight += W.topicBoost;
            existing.lastTurn = state.turn;
        } else {
            state.topics.push({ id: id, type: type, weight: W.topicBoost, lastTurn: state.turn });
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

        nlu.entities.forEach(function (e) { bumpTopic(state, e.id, e.type); });

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
    function scoreRule(rule, nlu, state) {
        if (rule.intents && !rule.intents.some(function (id) { return nlu.intents.some(function (i) { return i.id === id; }); })) return null;
        if (rule.requiresEntity && !nlu.entities.some(function (e) { return e.id === rule.requiresEntity || e.type === rule.requiresEntity; })) return null;
        if (rule.forbidsEntityTypes && nlu.entities.some(function (e) { return rule.forbidsEntityTypes.indexOf(e.type) !== -1; })) return null;
        if (rule.requiresFact && !state.facts[rule.requiresFact]) return null;
        if (rule.forbidsFact && state.facts[rule.forbidsFact]) return null;
        if (rule.minTrust !== undefined && state.trust < rule.minTrust) return null;
        if (rule.maxTrust !== undefined && state.trust > rule.maxTrust) return null;
        if (rule.once && state.used[rule.id] !== undefined) return null;
        if (rule.cooldown && state.used[rule.id] !== undefined && (state.turn - state.used[rule.id]) < rule.cooldown) return null;

        const intentMatched = !!(rule.intents && rule.intents.some(function (id) { return nlu.intents.some(function (i) { return i.id === id; }); }));
        const matchedEntity = rule.requiresEntity
            ? nlu.entities.find(function (e) { return e.id === rule.requiresEntity || e.type === rule.requiresEntity; })
            : null;
        const entityMatched = !!matchedEntity;
        const hotTopic = rule.topics ? state.topics.find(function (t) { return rule.topics.indexOf(t.type) !== -1; }) : null;
        const topicMatched = !!hotTopic;
        const keywordScore = jaccard(nlu.keywords, rule.keywords || []);

        // A rule must match SOMETHING real before it's even a
        // candidate — priority alone is only a tie-breaker, never a
        // reason to fire. See the handbook's own warning about this.
        if (!intentMatched && !entityMatched && !topicMatched && keywordScore === 0) return null;

        const lastUsedTurn = state.used[rule.id];
        const recencyOfLastUse = lastUsedTurn === undefined ? 0 : Math.pow(W.recencyDecay, state.turn - lastUsedTurn);

        const score =
            W.intentMatch * (intentMatched ? 1 : 0) +
            W.entityMatch * (entityMatched ? 1 : 0) +
            W.topicOverlap * (topicMatched ? hotTopic.weight : 0) +
            W.keywordOverlap * keywordScore +
            W.factBonus * (rule.requiresFact ? 1 : 0) +
            (rule.priority || 0) -
            W.repeatPenalty * recencyOfLastUse;

        let matchedWord = null;
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
            if (lines) return { ruleId: "debt:" + debt.id, lines: lines, followups: null, ask: debt.thenAsk || null, matchedWord: null };
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
            const hotTopic = state.topics[0];
            const topicRule = content.rules.find(function (r) { return r.topics && r.topics.indexOf(hotTopic.type) !== -1; });
            if (topicRule) return ruleToBeat(topicRule, hotTopic.id);
        }

        return { ruleId: "ladder:deflection", lines: content.fallbackDeflections, followups: null, ask: null, matchedWord: null };
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

    // One full turn: player line in, monster line out.
    function respond(rawText, state, content) {
        state.turn += 1;

        let nlu = normalize(rawText);
        nlu = resolveRefs(nlu, state, content);
        nlu = classify(nlu, state, content);
        extractSlots(nlu, state, content);
        const debtEvents = settleDebts(nlu, state);
        remember(nlu, state, content);

        const beat = select(nlu, state, content, debtEvents);
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
            topics: state.topics.map(function (t) { return { id: t.id, type: t.type, weight: Math.round(t.weight * 100) / 100 }; }),
            facts: Object.keys(state.facts).reduce(function (acc, key) {
                acc[key] = state.facts[key].value;
                return acc;
            }, {}),
            debts: state.debts.map(function (d) { return { text: d.text, status: d.status }; }),
            learned: state.learnedCategories,
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
    };

})();
