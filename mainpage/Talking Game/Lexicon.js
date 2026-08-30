// =============================================================
// Lexicon — THE WORD CATEGORY ATLAS (generic, reusable, no persona)
// -------------------------------------------------------------
// This file knows nothing about monsters or Mira — it only knows how
// to look up what KIND of thing a word is. Ships alongside Engine.js
// and Monster Content.js as its own sibling module, same as the
// reference handbook it's built from: 20 "families" (broad topics
// like `feeling` or `belief`), each split into a few `categories`
// (like `feeling.fear`), each word carrying a "leverage TIER" from
// 0 (small talk) to 5 (binding/consent language) — a fixed property
// of the category, not something scored separately.
//
// A word can land in MORE than one category on purpose — "spirit" is
// a drink, a ghost, and a mood. This file hands back every match;
// resolve() is the part that picks ONE, using the order described
// below. Nothing is ever silently thrown away: a word nothing
// matches comes back as "unknown", which is still a usable keyword.
// =============================================================

(function () {
    "use strict";

    // ---- The 20 families, each family -> { category: {tier, words[]} } ----
    // Folklore and modern vocabulary are folded straight into the
    // categories they belong to (not a separate axis) — a doorbell
    // camera and a crossroads are both `place.threshold`.
    const ATLAS = {
        identity: {
            // The atlas's own note: "Proper nouns. Capture with a slot
            // regex, not a word list." True for CAPTURING the
            // player's own name — but this game still wants to notice
            // when a THIRD name comes up in conversation ("my friend
            // Sarah"), so a small common-names seed list lives here
            // too, on top of Monster Content.js's separate slot regex.
            name: { tier: 5, words: ["john", "mary", "alex", "sarah", "mike", "anna", "tom", "emma", "james", "lisa", "mira"] },
            kinship: { tier: 3, words: ["mother", "father", "mum", "dad", "sister", "brother", "son", "daughter", "wife", "husband", "partner", "grandmother", "cousin", "family"] },
            role: { tier: 2, words: ["nurse", "teacher", "driver", "student", "soldier", "cook", "cleaner", "clerk", "manager", "artist"] },
            origin: { tier: 2, words: ["born", "hometown", "village", "abroad", "local", "stranger", "newcomer", "raised"] },
            age: { tier: 2, words: ["young", "old", "child", "teenager", "adult", "elderly", "birthday"] },
            appearance: { tier: 1, words: ["tall", "short", "thin", "pale", "scar", "hair", "eyes", "face", "hands", "limp", "wrinkly"] },
            trait: { tier: 1, words: ["kind", "cruel", "shy", "brave", "careless", "stubborn", "honest", "clever", "quiet", "reckless"] },
            self: { tier: 0, words: ["i", "me", "my", "myself", "mine", "we", "us"] },
        },
        feeling: {
            fear: { tier: 4, words: ["afraid", "scared", "terrified", "frightened", "dread", "panic", "nervous", "anxious", "spooked", "phobia"] },
            sadness: { tier: 4, words: ["sad", "miserable", "grief", "mourning", "lonely", "hopeless", "crying", "tears", "empty", "heartbroken"] },
            shame: { tier: 4, words: ["ashamed", "guilty", "embarrassed", "humiliated", "regret", "fault", "sorry", "disgrace", "weak"] },
            anger: { tier: 3, words: ["angry", "furious", "mad", "rage", "annoyed", "irritated", "resent", "hate", "bitter", "spite"] },
            joy: { tier: 1, words: ["happy", "glad", "delighted", "cheerful", "excited", "pleased", "relieved", "content", "laughing"] },
            love: { tier: 3, words: ["love", "adore", "fond", "care", "miss", "cherish", "devoted", "attached", "precious"] },
            disgust: { tier: 3, words: ["disgusted", "sick", "revolted", "gross", "repulsed", "nauseous", "filthy"] },
            surprise: { tier: 0, words: ["surprised", "shocked", "startled", "stunned", "unexpected", "sudden"] },
            mood: { tier: 1, words: ["mood", "tired", "restless", "calm", "tense", "numb", "edgy", "fine", "okay"] },
            desire: { tier: 3, words: ["want", "wish", "need", "crave", "hope", "long", "dream", "yearn"] },
            comfort: { tier: 3, words: ["safe", "comfortable", "cosy", "warm", "secure", "protected", "relaxed"] },
            certainty: { tier: 0, words: ["sure", "certain", "doubt", "maybe", "perhaps", "definitely", "unsure", "confident", "guess"] },
        },
        body: {
            part: { tier: 1, words: ["head", "hand", "arm", "leg", "chest", "throat", "skin", "back", "heart", "stomach", "liver", "bones", "eyeballs", "nails", "torso"] },
            sense: { tier: 1, words: ["see", "hear", "smell", "taste", "touch", "feel", "listen", "watch", "notice"] },
            health: { tier: 4, words: ["ill", "sick", "unwell", "fever", "medicine", "doctor", "hospital", "condition", "pills", "diagnosis"] },
            injury: { tier: 4, words: ["hurt", "wound", "cut", "bruise", "broken", "bleeding", "blood", "pain", "ache"] },
            sleep: { tier: 3, words: ["sleep", "asleep", "awake", "dream", "nightmare", "insomnia", "bed", "rest", "woke"] },
            hunger: { tier: 1, words: ["hungry", "thirsty", "starving", "full", "appetite", "fed", "eat", "drink"] },
            death: { tier: 4, words: ["dead", "death", "died", "dying", "funeral", "grave", "buried", "corpse", "killed", "gone"] },
        },
        food: {
            meal: { tier: 1, words: ["breakfast", "lunch", "dinner", "supper", "snack", "meal", "feast", "takeaway"] },
            ingredient: { tier: 1, words: ["bread", "toast", "beans", "meat", "cheese", "egg", "rice", "salt", "sugar", "flour", "onion", "fish", "chicken", "pumpkin"] },
            dish: { tier: 1, words: ["soup", "stew", "pie", "sandwich", "cake", "noodles", "curry", "porridge", "roast", "pizza", "candy"] },
            drink: { tier: 1, words: ["water", "tea", "coffee", "milk", "juice", "soda"] },
            alcohol: { tier: 1, words: ["beer", "wine", "ale", "whisky", "vodka", "spirits", "spirit", "drunk", "pub", "bar", "pint"] },
            taste: { tier: 1, words: ["sweet", "bitter", "sour", "salty", "spicy", "bland", "delicious", "stale", "rotten"] },
        },
        time: {
            unit: { tier: 0, words: ["second", "minute", "hour", "day", "week", "month", "year", "moment"] },
            timeofday: { tier: 1, words: ["morning", "noon", "afternoon", "evening", "night", "midnight", "dawn", "dusk", "sunrise", "witching"] },
            calendar: { tier: 0, words: ["monday", "friday", "weekend", "january", "summer", "winter", "autumn", "spring", "season"] },
            frequency: { tier: 1, words: ["always", "never", "often", "sometimes", "rarely", "daily", "again", "usually", "every"] },
            duration: { tier: 0, words: ["long", "short", "forever", "brief", "while", "since", "until", "yet"] },
            sequence: { tier: 0, words: ["before", "after", "then", "next", "first", "last", "finally", "earlier", "later", "already"] },
            era: { tier: 0, words: ["past", "present", "future", "childhood", "nowadays", "ago", "once"] },
            occasion: { tier: 3, words: ["birthday", "wedding", "funeral", "anniversary", "holiday", "christmas", "party", "reunion"] },
        },
        place: {
            settlement: { tier: 2, words: ["town", "city", "village", "street", "neighbourhood", "suburb", "hamlet", "district"] },
            building: { tier: 2, words: ["house", "church", "shop", "school", "hospital", "station", "factory", "inn", "library", "office", "motel", "stairwell", "lift"] },
            room: { tier: 3, words: ["kitchen", "bedroom", "bathroom", "cellar", "attic", "hallway", "stairs", "garage", "closet", "basement"] },
            threshold: { tier: 5, words: ["door", "doorway", "gate", "window", "mirror", "crossroads", "bridge", "well", "porch", "fence", "stile"] },
            naturalplace: { tier: 2, words: ["forest", "woods", "field", "river", "lake", "hill", "cave", "beach", "moor", "garden"] },
            direction: { tier: 0, words: ["north", "south", "east", "west", "left", "right", "forward"] },
            position: { tier: 0, words: ["above", "below", "behind", "under", "inside", "outside", "beside", "between"] },
            distance: { tier: 0, words: ["close", "near", "far", "miles", "away", "nearby", "distant", "reach"] },
            home: { tier: 4, words: ["home", "address", "flat", "apartment", "landlord", "rent", "live", "alone", "upstairs"] },
        },
        movement: {
            motion: { tier: 1, words: ["walk", "run", "go", "come", "leave", "arrive", "climb", "fall", "crawl", "turn"] },
            transport: { tier: 1, words: ["car", "bus", "train", "bike", "taxi", "plane", "boat", "drive", "ride", "ticket"] },
            journey: { tier: 1, words: ["trip", "travel", "journey", "route", "road", "path", "way", "commute", "visit"] },
            speed: { tier: 0, words: ["fast", "slow", "quick", "hurry", "rush", "suddenly", "gradually"] },
            pursuit: { tier: 4, words: ["follow", "following", "chase", "escape", "flee", "hide", "catch", "trapped", "cornered", "outrun"] },
        },
        object: {
            tool: { tier: 1, words: ["knife", "hammer", "key", "rope", "torch", "lamp", "shovel", "scissors", "needle"] },
            container: { tier: 1, words: ["box", "bag", "jar", "bottle", "case", "drawer", "chest", "envelope", "basket"] },
            clothing: { tier: 1, words: ["coat", "shirt", "shoes", "hat", "dress", "gloves", "scarf", "jacket", "boots", "suit", "heels"] },
            furniture: { tier: 1, words: ["chair", "table", "bed", "sofa", "shelf", "desk", "cupboard", "wardrobe"] },
            material: { tier: 0, words: ["wood", "iron", "stone", "glass", "paper", "cloth", "plastic", "silver", "bone", "ash"] },
            valuable: { tier: 1, words: ["money", "gold", "ring", "jewel", "watch", "coin", "treasure", "savings"] },
            device: { tier: 1, words: ["phone", "laptop", "camera", "radio", "television", "charger", "screen", "recorder"] },
            keepsake: { tier: 4, words: ["photograph", "letter", "locket", "souvenir", "gift", "album", "diary"] },
            waste: { tier: 0, words: ["rubbish", "junk", "broken", "scrap", "dust", "rot"] },
        },
        nature: {
            weather: { tier: 0, words: ["rain", "snow", "wind", "storm", "fog", "cold", "hot", "cloudy", "thunder", "frost"] },
            sky: { tier: 1, words: ["sun", "moon", "stars", "sky", "dark", "light", "shadow", "eclipse"] },
            animal: { tier: 1, words: ["dog", "cat", "bird", "crow", "rat", "horse", "fox", "insect", "spider", "wolf", "lion", "tiger", "bear", "rabbit", "snake", "elephant", "mouse", "cow", "pig", "sheep", "pet"] },
            plant: { tier: 0, words: ["tree", "flower", "flowers", "foxglove", "grass", "root", "leaf", "thorn", "rowan", "branch", "seed"] },
            terrain: { tier: 0, words: ["mud", "rock", "sand", "ice", "water", "earth", "ground", "slope"] },
            element: { tier: 0, words: ["fire", "air", "smoke", "ash", "flame", "steam"] },
            event: { tier: 1, words: ["flood", "earthquake", "drought", "blackout", "accident"] },
        },
        social: {
            friendship: { tier: 3, words: ["friend", "mate", "buddy", "company", "together", "close", "trust", "known"] },
            romance: { tier: 4, words: ["partner", "girlfriend", "boyfriend", "married", "divorce", "crush", "date"] },
            familyrel: { tier: 3, words: ["family", "parents", "siblings", "relatives", "household", "adopted", "estranged", "raised"] },
            enmity: { tier: 3, words: ["enemy", "rival", "grudge", "feud", "betrayed", "argument"] },
            group: { tier: 1, words: ["team", "club", "crew", "gang", "church", "community", "work", "class", "society", "housemates", "neighbours", "gym"] },
            status: { tier: 1, words: ["boss", "leader", "respected", "nobody", "famous", "outsider", "popular", "ignored"] },
            trust: { tier: 4, words: ["trust", "secret", "promise", "betray", "lie", "honest", "confide", "rely", "depend"] },
            courtesy: { tier: 0, words: ["hello", "goodbye", "please", "thanks", "sorry", "welcome", "evening"] },
            obligation: { tier: 5, words: ["owe", "favour", "debt", "promise", "swear", "deal", "bargain", "agreed", "invited"] },
            solitude: { tier: 4, words: ["alone", "lonely", "nobody", "isolated"] },
        },
        work: {
            job: { tier: 2, words: ["work", "job", "shift", "office", "boss", "colleague", "career", "unemployed", "fired", "overtime", "commute"] },
            trade: { tier: 1, words: ["shop", "market", "business", "customer", "sell", "buy", "stock", "order"] },
            money: { tier: 1, words: ["money", "cash", "wage", "salary", "rent", "bill", "cost", "broke", "savings"] },
            price: { tier: 0, words: ["cheap", "expensive", "free", "worth", "afford", "price", "discount"] },
            transaction: { tier: 1, words: ["pay", "paid", "buy", "sell", "refund", "spend", "charge"] },
            debt: { tier: 4, words: ["debt", "loan", "borrowed", "owe", "repay", "overdue", "collector"] },
            wealth: { tier: 1, words: ["rich", "poor", "comfortable", "struggling", "inheritance", "poverty"] },
            contract: { tier: 5, words: ["contract", "sign", "agreement", "terms", "binding", "witness", "clause", "consent"] },
        },
        conflict: {
            violence: { tier: 3, words: ["fight", "hit", "attack", "punch", "struggle", "beat", "strangle", "stab"] },
            weapon: { tier: 3, words: ["gun", "blade", "axe", "bat", "weapon", "bullet"] },
            threat: { tier: 4, words: ["threat", "warning", "danger", "careful"] },
            crime: { tier: 4, words: ["stole", "theft", "police", "arrested", "crime", "guilty", "court", "prison"] },
            punishment: { tier: 3, words: ["punish", "fine", "sentence", "revenge", "payback", "justice", "deserve"] },
            danger: { tier: 3, words: ["dangerous", "risky", "unsafe", "trap", "warned", "reckless", "edge"] },
            safety: { tier: 4, words: ["safe", "protect", "shelter", "guard", "locked", "refuge", "secure"] },
            enemy: { tier: 3, words: ["enemy", "creature", "thing", "monster", "stalker"] },
        },
        mind: {
            knowledge: { tier: 1, words: ["know", "learn", "understand", "realise", "aware", "figured"] },
            memory: { tier: 4, words: ["remember", "forget", "memory", "recall", "childhood"] },
            belief: { tier: 3, words: ["believe", "think", "faith", "convinced", "superstition", "suppose", "reckon"] },
            opinion: { tier: 1, words: ["like", "dislike", "prefer", "favourite", "hate", "love", "best", "worst"] },
            doubt: { tier: 1, words: ["doubt", "unsure", "confused", "questioning", "wonder"] },
            plan: { tier: 2, words: ["plan", "intend", "decided", "tomorrow", "later", "will"] },
            secret: { tier: 5, words: ["secret", "hidden", "confess", "admit"] },
            lie: { tier: 4, words: ["lie", "lied", "pretend", "fake", "cover", "truth", "honest"] },
            dream: { tier: 4, words: ["dream", "nightmare", "vision", "sleepwalk", "recurring"] },
            madness: { tier: 4, words: ["crazy", "imagining", "hallucinate", "paranoid", "voices"] },
        },
        communication: {
            language: { tier: 0, words: ["word", "say", "speak", "talk", "tell", "mean", "call", "named"] },
            question: { tier: 0, words: ["who", "what", "where", "when", "why", "how", "which", "ask"] },
            information: { tier: 1, words: ["news", "fact", "detail", "report", "heard", "told", "apparently"] },
            rumour: { tier: 2, words: ["rumour", "gossip", "story", "supposedly", "legend", "tale"] },
            writing: { tier: 1, words: ["letter", "note", "book", "diary", "message", "sign", "written", "list"] },
            media: { tier: 0, words: ["phone", "text", "call", "email", "message", "post", "online", "video", "photo", "notification", "blocked", "posted"] },
            naming: { tier: 5, words: ["name", "called", "spelled"] },
            silence: { tier: 3, words: ["silence", "quiet", "hushed"] },
        },
        belief: {
            religion: { tier: 2, words: ["church", "prayer", "priest", "faith", "sin", "blessing", "bible", "service"] },
            deity: { tier: 2, words: ["god", "gods", "saint", "angel", "devil", "lord"] },
            spirit: { tier: 3, words: ["ghost", "spirit", "haunted", "apparition", "presence", "shade", "revenant", "changeling", "wight", "hag", "doppelganger"] },
            magic: { tier: 3, words: ["magic", "spell", "charm", "witch", "enchant", "ritual", "hex", "summon"] },
            ritual: { tier: 5, words: ["ritual", "candle", "circle", "chant", "offering", "invoke"] },
            superstition: { tier: 3, words: ["luck", "unlucky", "jinx", "thirteen"] },
            fate: { tier: 2, words: ["fate", "destiny", "doomed", "coincidence", "chance"] },
            curse: { tier: 4, words: ["curse", "cursed", "hex", "doomed", "marked"] },
            omen: { tier: 3, words: ["omen", "sign", "warning", "crow", "static", "howling"] },
            taboo: { tier: 5, words: ["forbidden"] },
            morality: { tier: 3, words: ["right", "wrong", "good", "evil", "deserve", "fair", "sin", "forgive"] },
            protection: { tier: 4, words: ["salt", "iron", "rowan", "horseshoe", "charm", "amulet", "cross"] },
        },
        culture: {
            music: { tier: 1, words: ["music", "song", "band", "sing", "guitar", "piano", "album", "radio", "tune", "melody", "drums", "violin", "concert", "singer", "rhythm", "beat"] },
            story: { tier: 1, words: ["story", "book", "film", "show", "character", "novel", "tale", "ending"] },
            game: { tier: 1, words: ["game", "play", "cards", "dice", "puzzle", "win", "lose", "rules", "number", "guess"] },
            sport: { tier: 1, words: ["football", "match", "team", "swim", "training", "score", "soccer", "basketball", "tennis", "baseball", "hockey", "golf", "swimming", "running", "boxing", "volleyball", "cricket", "skiing", "cycling", "ball"] },
            festival: { tier: 2, words: ["festival", "holiday", "christmas", "halloween", "carnival", "tradition", "parade"] },
            humour: { tier: 1, words: ["joke", "funny", "laugh", "tease", "silly", "hilarious"] },
            art: { tier: 1, words: ["paint", "draw", "photo", "sculpture", "design", "craft", "sew"] },
            fashion: { tier: 0, words: ["style", "clothes", "wear", "fashion", "dressed", "look"] },
        },
        quality: {
            size: { tier: 0, words: ["big", "small", "huge", "tiny", "large", "narrow", "wide", "thick", "thin"] },
            quantity: { tier: 0, words: ["many", "few", "some", "all", "none", "lots", "several", "enough", "plenty"] },
            number: { tier: 0, words: ["one", "two", "three", "first", "second", "third", "half", "dozen", "hundred"] },
            colour: { tier: 0, words: ["red", "black", "white", "blue", "green", "grey", "gray", "yellow", "purple", "orange", "pink", "brown", "hazel", "amber", "navy", "turquoise", "maroon", "beige", "violet"] },
            shape: { tier: 0, words: ["round", "square", "flat", "curved", "sharp", "straight", "twisted"] },
            texture: { tier: 0, words: ["rough", "smooth", "wet", "dry", "sticky", "soft", "hard", "damp"] },
            sound: { tier: 1, words: ["loud", "noise", "scream", "whisper", "knock", "creak", "footsteps", "breathing", "static", "buzzing", "alarm", "siren"] },
            smell: { tier: 1, words: ["smell", "stink", "scent", "burning", "musty"] },
            temperature: { tier: 0, words: ["hot", "cold", "warm", "freezing", "chill", "icy"] },
            light: { tier: 1, words: ["dark", "bright", "dim", "shadow", "flicker", "glow", "blackout", "candle"] },
            evaluation: { tier: 1, words: ["good", "bad", "terrible", "wonderful", "awful", "fine", "perfect", "wrong", "strange", "odd", "weird", "pretty", "beautiful", "handsome", "cute", "ugly", "scary"] },
            degree: { tier: 0, words: ["slightly", "quite", "totally", "barely", "almost", "completely"] },
        },
        action: {
            create: { tier: 1, words: ["make", "build", "write", "cook", "grow", "fix", "repair", "design"] },
            destroy: { tier: 1, words: ["break", "burn", "smash", "ruin", "tear", "destroy", "kill"] },
            give: { tier: 3, words: ["give", "offer", "hand", "lend", "gift", "share", "allow"] },
            take: { tier: 1, words: ["take", "get", "grab", "steal", "keep", "hold", "collect"] },
            help: { tier: 2, words: ["help", "save", "support", "rescue", "protect"] },
            harm: { tier: 3, words: ["hurt", "harm", "damage", "betray", "abandon", "neglect", "failed"] },
            change: { tier: 1, words: ["change", "become", "grow", "spread", "worse", "better", "different"] },
            startstop: { tier: 0, words: ["start", "begin", "stop", "finish", "end", "continue", "quit", "again"] },
            succeedfail: { tier: 2, words: ["win", "lose", "succeed", "fail", "managed", "tried"] },
            search: { tier: 2, words: ["look", "search", "find", "found", "lost", "missing", "hunt", "seek"] },
            hide: { tier: 4, words: ["hide", "hidden", "buried", "concealed"] },
            watch: { tier: 4, words: ["watching", "stare", "saw", "seen", "noticed"] },
            openclose: { tier: 5, words: ["open", "opened", "close", "shut", "lock", "unlock"] },
        },
        logic: {
            cause: { tier: 0, words: ["because", "therefore", "since", "reason", "caused"] },
            condition: { tier: 0, words: ["if", "unless", "when", "whenever", "suppose", "otherwise"] },
            contrast: { tier: 0, words: ["but", "however", "although", "though", "instead", "except", "still"] },
            negation: { tier: 0, words: ["not", "never", "none", "nothing", "nobody", "without"] },
            affirmation: { tier: 0, words: ["yes", "yeah", "sure", "okay", "exactly", "true", "agreed"] },
            hedge: { tier: 0, words: ["maybe", "perhaps", "probably", "might", "seems"] },
            emphasis: { tier: 0, words: ["really", "definitely", "absolutely", "truly", "honestly", "seriously"] },
            quantifier: { tier: 0, words: ["every", "each", "any", "most", "both", "either"] },
            deixis: { tier: 0, words: ["this", "that", "these", "those", "here", "there", "it", "them", "him", "her"] },
        },
        meta: {
            quest: { tier: 0, words: ["quest", "task", "mission", "objective", "goal", "reward"] },
            system: { tier: 0, words: ["save", "load", "menu", "settings", "pause", "restart", "quit", "exit"] },
            ui: { tier: 0, words: ["inventory", "map", "health", "level", "score", "screen", "button"] },
        },
    };

    const FAMILIES = Object.keys(ATLAS);

    // ---- Which categories are worth ASKING ABOUT ----
    // Every category above is real for classifying/scoring/harvest
    // purposes, but a handful of them are pure function words or
    // discourse glue — nothing a curious question could ever mirror
    // back sensibly. Turning one of these into "{word}" produced bugs
    // like "Why does thanks keep coming back to your mind?" (social.
    // courtesy, tier 0). This is checked ONLY when picking what to
    // build a new question or mirroring line around — these words
    // still count fully everywhere else (intents, harvest, tone).
    const NON_TOPIC_PATHS = new Set([
        "logic.cause", "logic.condition", "logic.contrast", "logic.negation",
        "logic.affirmation", "logic.hedge", "logic.emphasis", "logic.quantifier", "logic.deixis",
        "social.courtesy",
        // "mean"/"say"/"talk"/"tell"/"call" — words ABOUT communicating,
        // not something worth mirroring back ("So now you want to know
        // about mean and me..." was a real, reported bug).
        "communication.language", "communication.question",
        "time.unit", "time.calendar", "time.sequence", "time.duration", "time.era",
        "quality.degree", "quality.quantity", "quality.number",
        "meta.quest", "meta.system", "meta.ui",
    ]);

    // A null path (an "unknown" word) is still fair game — that's
    // deliberately the one case topic_unknown exists to react to.
    function isTopicWorthy(path) {
        return !path || !NON_TOPIC_PATHS.has(path);
    }

    // ---- Descriptor words, and what they can describe ----
    // A DESCRIPTOR (any `quality.*` word — a colour, a size, a sound,
    // a texture...) is never a topic on its own the way a noun is —
    // "blue" means nothing without knowing blue WHAT. Generic over
    // the whole family on purpose: colours are just the one that
    // broke first, not the only one this applies to ("loud" or "soft"
    // have exactly the same problem). quality.degree/quantity/number
    // are excluded since they're already NON_TOPIC_PATHS (function
    // words, not real descriptions).
    function isDescriptor(path) {
        if (!path) return false;
        const family = path.split(".")[0];
        return family === "quality" && isTopicWorthy(path);
    }

    // A DESCRIBABLE word is the kind of noun a descriptor could
    // plausibly be attached to — "blue EYES", "loud DRESS" (a dress
    // can't be loud, but the mechanism only needs "plausible", not
    // "grammatical" — see the note on classify() in Engine.js).
    const DESCRIBABLE_PATHS = new Set(["identity.appearance", "body.part", "object.clothing"]);
    function isDescribable(path) {
        return !!path && DESCRIBABLE_PATHS.has(path);
    }

    // ---- A handful of the atlas's own MULTI-WORD seeds ----
    // Most of the atlas is single words, matched per-token below. But
    // a few multi-word phrases are too important to drop — these are
    // literally the tier-5 "binding" language the whole premise hangs
    // on ("this is the tier that ends the game, and it is always
    // given, never taken"). Checked against the whole cleaned
    // sentence, longest-first, the same way Engine.js already checks
    // phrase-based intents.
    const PHRASE_ENTRIES = [
        { phrase: "come in", family: "social", category: "obligation", tier: 5 },
        { phrase: "you may enter", family: "social", category: "obligation", tier: 5 },
        { phrase: "i invite you", family: "social", category: "obligation", tier: 5 },
        { phrase: "i promise", family: "social", category: "obligation", tier: 5 },
        { phrase: "i swear it", family: "social", category: "obligation", tier: 5 },
        { phrase: "it is yours", family: "social", category: "obligation", tier: 5 },
        { phrase: "take it", family: "social", category: "obligation", tier: 5 },
        { phrase: "let you in", family: "social", category: "obligation", tier: 5 },
        { phrase: "you can call me", family: "communication", category: "naming", tier: 5 },
        { phrase: "my name is", family: "communication", category: "naming", tier: 5 },
        { phrase: "never told anyone", family: "mind", category: "secret", tier: 5 },
        { phrase: "nobody knows", family: "mind", category: "secret", tier: 5 },
        { phrase: "by myself", family: "social", category: "solitude", tier: 4 },
        { phrase: "no one is coming", family: "social", category: "solitude", tier: 4 },
    ].sort(function (a, b) { return b.phrase.length - a.phrase.length; }); // longest match first

    // ---- The homograph guardrail ----
    // Grammar-based, not sense-based — this catches "I SAW your face"
    // (verb, past tense of "see") vs. "hand me the SAW" (the tool),
    // which the atlas can't tell apart on its own since it only lists
    // "saw" under object.tool. Add more words here as they come up.
    const GRAMMAR_GUARDS = {
        saw: {
            verbAfter: ["i", "you", "we", "they", "he", "she", "who", "never", "just", "finally", "always"],
            verbFamily: "body", verbCategory: "sense",
        },
    };

    // ---- Every category a word matches, unresolved ----
    function categorize(word) {
        const hits = [];
        FAMILIES.forEach(function (family) {
            const categories = ATLAS[family];
            Object.keys(categories).forEach(function (category) {
                if (categories[category].words.indexOf(word) !== -1) {
                    hits.push({ family: family, category: category, path: family + "." + category, tier: categories[category].tier });
                }
            });
        });
        return hits;
    }

    // ---- Phrase scan over the whole cleaned sentence ----
    function findPhraseMatches(cleanText) {
        const matches = [];
        PHRASE_ENTRIES.forEach(function (entry) {
            if (cleanText.indexOf(entry.phrase) !== -1) {
                matches.push({ id: entry.phrase, family: entry.family, category: entry.category, path: entry.family + "." + entry.category, tier: entry.tier });
            }
        });
        return matches;
    }

    // ---- Pick ONE category for a word ----
    // Order: grammar guard, then hot-topic bias (prefer whatever
    // family is already warm in this conversation), then the first
    // atlas hit, then "unknown" — never discarded.
    function resolve(word, prevWord, hotFamilies) {
        const guard = GRAMMAR_GUARDS[word];
        if (guard && prevWord && guard.verbAfter.indexOf(prevWord) !== -1) {
            return { family: guard.verbFamily, category: guard.verbCategory, path: guard.verbFamily + "." + guard.verbCategory, tier: ATLAS[guard.verbFamily][guard.verbCategory].tier };
        }

        const hits = categorize(word);
        if (hits.length === 0) {
            return { family: "unknown", category: "unknown", path: null, tier: 0 };
        }
        if (hits.length === 1) return hits[0];

        if (hotFamilies && hotFamilies.length) {
            const biased = hits.find(function (h) { return hotFamilies.indexOf(h.family) !== -1; });
            if (biased) return biased;
        }

        return hits[0];
    }

    // -------- Make these available to other files --------
    window.Lexicon = {
        FAMILIES: FAMILIES,
        ATLAS: ATLAS,
        categorize: categorize,
        resolve: resolve,
        findPhraseMatches: findPhraseMatches,
        isTopicWorthy: isTopicWorthy,
        isDescriptor: isDescriptor,
        isDescribable: isDescribable,
    };

})();
