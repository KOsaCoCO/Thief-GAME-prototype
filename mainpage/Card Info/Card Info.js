// Build a 6 x 6 grid of card cells.
// Shape distribution (12 / 6 / 18 = 36):
//   Cards  1 - 12 : circle
//   Cards 13 - 18 : square
//   Cards 19 - 36 : triangle
const TOTAL_CARDS = 36;
const SVG_NS = "http://www.w3.org/2000/svg";

function getShapeForCard(cardNumber) {
    if (cardNumber <= 12) return "circle";
    if (cardNumber <= 18) return "square";
    return "triangle";
}

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

// Fills a card container with its shape SVG + number span
function paintCard(cardEl, cardId, shape) {
    cardEl.innerHTML = "";
    cardEl.appendChild(buildShape(shape));
    const num = document.createElement("span");
    num.className = "card-number";
    num.textContent = cardId;
    cardEl.appendChild(num);
}

// ---- Detail view controls ----

function openCardDetail(cardId, shape) {
    const detailCard = document.getElementById("detail-card");
    const detailView = document.getElementById("detail-view");
    const returnBtn  = document.getElementById("return-btn");

    detailCard.className = `card detail-card shape-${shape}`;
    detailCard.dataset.cardId = cardId;
    detailCard.dataset.shape = shape;
    paintCard(detailCard, cardId, shape);

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

    for (let i = 1; i <= TOTAL_CARDS; i++) {
        const shape = getShapeForCard(i);
        const card = document.createElement("div");
        card.className = `card shape-${shape}`;
        card.dataset.cardId = i;
        card.dataset.shape = shape;
        paintCard(card, i, shape);

        card.addEventListener("click", () => openCardDetail(i, shape));
        gallery.appendChild(card);
    }

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

    console.log("Card Info page loaded with", TOTAL_CARDS, "cards.");
});
