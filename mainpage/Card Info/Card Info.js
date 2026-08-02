// Card Info gallery — a small reference set of card TYPES, not one
// entry per numbered card. Numbers 1-60 are now assigned to suits at
// random each time a game starts (see Start Game CardDeck.js), so a
// static per-number gallery wouldn't mean anything anymore; this page
// instead documents the five distinct kinds of card that exist.
const SVG_NS = "http://www.w3.org/2000/svg";

const CARD_TYPES = [
    {
        id: "circle",
        shape: "circle",
        info: "Circle — one of the three suits. About 40% of this game's 60 numbers were dealt as Circles (reshuffled every game). Beats another Circle with a higher number, and beats any Triangle. Loses to every Square."
    },
    {
        id: "square",
        shape: "square",
        info: "Square — one of the three suits, and the rarest: only about 10% of this game's 60 numbers come up Square. Beats Circle and Triangle outright, and beats another Square only with a higher number."
    },
    {
        id: "triangle",
        shape: "triangle",
        info: "Triangle — one of the three suits, and the most common: about 50% of this game's 60 numbers are dealt as Triangles. Only beats another Triangle, and only with a higher number."
    },
    {
        id: "plus",
        shape: null,
        cssClass: "special",
        info: "A + pip on a card — any suit — grants a bonus: win an attack with it and you also take one extra Circle or Square from the field per pip. No card starts with one; calling a gamble correctly marks a random card in your hand instead. Pips stack up to 3 on the same card."
    },
    {
        id: "snatch-reward",
        shape: null,
        cssClass: "special-bonus-card",
        info: "Snatch & Guess reward — awarded to whichever side has more cards in hand when a Bonus Battle ends. Play it to start a timed Special Battle."
    },
];

function buildShape(shape) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.classList.add("card-shape");

    let el;
    if (shape === "circle") {
        el = document.createElementNS(SVG_NS, "circle");
        el.setAttribute("cx", "50");
        el.setAttribute("cy", "50");
        el.setAttribute("r", "38");
    } else if (shape === "square") {
        el = document.createElementNS(SVG_NS, "rect");
        el.setAttribute("x", "15");
        el.setAttribute("y", "15");
        el.setAttribute("width", "70");
        el.setAttribute("height", "70");
    } else {
        // triangle (apex up)
        el = document.createElementNS(SVG_NS, "polygon");
        el.setAttribute("points", "50,12 86,82 14,82");
    }
    svg.appendChild(el);
    return svg;
}

// Paints a card element to match one CARD_TYPES entry. extraBaseClasses
// lets the caller add its own classes (e.g. "detail-card") without
// paintCardType clobbering them.
function paintCardType(cardEl, type, extraBaseClasses) {
    cardEl.innerHTML = "";
    cardEl.className = [
        "card",
        ...extraBaseClasses,
        type.shape ? `shape-${type.shape}` : null,
        type.cssClass || null,
    ].filter(Boolean).join(" ");

    if (type.shape) {
        cardEl.appendChild(buildShape(type.shape));
    }
    if (type.id === "snatch-reward") {
        const cross = document.createElement("span");
        cross.className = "special-cross";
        cross.textContent = "✕";
        cardEl.appendChild(cross);
    }
}

// ---- Detail view controls ----

function openCardDetail(type) {
    const detailCard = document.getElementById("detail-card");
    const detailView = document.getElementById("detail-view");
    const detailText = document.getElementById("detail-text");
    const returnBtn  = document.getElementById("return-btn");

    paintCardType(detailCard, type, ["detail-card"]);
    detailText.textContent = type.info;

    // Re-trigger the zoom-in animation each time a card is opened
    detailCard.classList.remove("zoom-in");
    void detailCard.offsetWidth;     // force reflow
    detailCard.classList.add("zoom-in");

    detailView.classList.add("visible");
    detailView.setAttribute("aria-hidden", "false");
    returnBtn.classList.add("visible");
    document.body.classList.add("detail-open");
}

function closeCardDetail() {
    const detailView = document.getElementById("detail-view");
    const returnBtn  = document.getElementById("return-btn");

    detailView.classList.remove("visible");
    detailView.setAttribute("aria-hidden", "true");
    returnBtn.classList.remove("visible");
    document.body.classList.remove("detail-open");
}

// ---- Init ----

document.addEventListener("DOMContentLoaded", () => {
    const gallery = document.getElementById("gallery");
    if (!gallery) return;

    CARD_TYPES.forEach((type) => {
        const card = document.createElement("div");
        paintCardType(card, type, []);
        card.addEventListener("click", () => openCardDetail(type));
        gallery.appendChild(card);
    });

    // Return button closes the detail view
    document.getElementById("return-btn").addEventListener("click", closeCardDetail);

    // Click outside the content (on dark backdrop) also closes
    document.getElementById("detail-view").addEventListener("click", (e) => {
        if (e.target.id === "detail-view") closeCardDetail();
    });

    // Escape key closes the detail view
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeCardDetail();
    });

    console.log("Card Info page loaded with", CARD_TYPES.length, "card types.");
});
