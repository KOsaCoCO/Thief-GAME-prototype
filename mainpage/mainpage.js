// Runs after the page is loaded
document.addEventListener("DOMContentLoaded", () => {
    const greeting = document.getElementById("greeting");
    if (greeting) {
        console.log("Page loaded — greeting element found.");
    }
});
