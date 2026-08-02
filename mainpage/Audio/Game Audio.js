// =============================================================
// Game Audio
// -------------------------------------------------------------
// ONE shared file, linked into whichever page needs it with a plain
// <script src="...Audio/Game Audio.js"> tag — nothing else connects
// the pages together. Each page just needs an empty "mount" element
// for this file to fill in:
//   - mainpage.html:  #game-audio-mute-mount  -> the mute/unmute
//     square (top-right corner) + a hidden background player.
//   - Settings.html:  #game-audio-settings    -> the visible "now
//     playing" widget, the playlist-link input, and a Load button.
// A page with neither container just gets no audio behavior — nothing
// else on it depends on this file.
//
// The mute flag and the chosen playlist link are stored in
// localStorage (shared by every page on this site), so a link pasted
// in Settings is what plays on the main menu too, and muting on one
// page stays muted the next time any page using this file loads.
//
// IMPORTANT — there is no "local host" or backend involved anywhere
// here, and none is needed. The SoundCloud player (an <iframe>) and
// its control script (w.soundcloud.com/player/api.js) are loaded
// straight from soundcloud.com over the browser's own internet
// connection, exactly like loading an <img>. That works whether this
// page is opened as a plain file:// double-click or served from
// somewhere — the only requirement is being online, same as any page
// that embeds a YouTube or SoundCloud player normally.
//
// "Browsing" here means: paste a public SoundCloud playlist or track
// link (Settings has a "Browse SoundCloud" button that opens
// soundcloud.com in a new tab to go find one) and click Load. There's
// no bundled catalog of "popular playlists" — SoundCloud's own catalog
// changes constantly and isn't something this file can search without
// SoundCloud API credentials, which this project doesn't have. This
// keeps the feature honest: it plays whatever link you give it.
//
// SAFE TO DELETE: remove this file's <script> tag from a page and
// that page just loses its audio controls.
// =============================================================

(function () {
    "use strict";

    const STORAGE_MUTED    = "thiefGameAudioMuted";
    const STORAGE_PLAYLIST = "thiefGameAudioPlaylistUrl";
    const WIDGET_API_SRC   = "https://w.soundcloud.com/player/api.js";
    const BG_PLAYER_ID     = "game-audio-background-player";

    // -------- Shared state (localStorage) --------

    function isMuted() {
        return localStorage.getItem(STORAGE_MUTED) === "1";
    }
    function setMuted(muted) {
        localStorage.setItem(STORAGE_MUTED, muted ? "1" : "0");
    }
    function getPlaylistUrl() {
        return localStorage.getItem(STORAGE_PLAYLIST) || "";
    }
    function setPlaylistUrl(url) {
        localStorage.setItem(STORAGE_PLAYLIST, url);
    }

    // -------- SoundCloud widget (loaded from soundcloud.com, not local) --------

    let widgetApiLoadPromise = null;
    function loadWidgetApi() {
        if (window.SC && window.SC.Widget) return Promise.resolve();
        if (widgetApiLoadPromise) return widgetApiLoadPromise;
        widgetApiLoadPromise = new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = WIDGET_API_SRC;
            script.onload  = () => resolve();
            script.onerror = () => reject(new Error("Could not reach soundcloud.com for the widget API."));
            document.head.appendChild(script);
        });
        return widgetApiLoadPromise;
    }

    function buildWidgetIframe(playlistUrl) {
        const iframe = document.createElement("iframe");
        iframe.setAttribute("allow", "autoplay");
        iframe.setAttribute("frameborder", "no");
        iframe.setAttribute("scrolling", "no");
        // No auto_play: most browsers block scripted autoplay-with-sound
        // anyway, and a widget stuck half-way through an autoplay attempt
        // can make a manual press of its own play button look like it does
        // nothing. Letting the player start paused and only ever begin on
        // an actual click sidesteps that entirely.
        iframe.src = "https://w.soundcloud.com/player/?url=" +
            encodeURIComponent(playlistUrl) +
            "&show_artwork=false&visual=false";
        return iframe;
    }

    function applyMuteToBackgroundPlayer() {
        const iframe = document.getElementById(BG_PLAYER_ID);
        if (!iframe || !window.SC || !SC.Widget) return;
        SC.Widget(iframe).setVolume(isMuted() ? 0 : 100);
    }

    // -------- mainpage.html: mute button + background player --------

    function initMuteButton() {
        const mount = document.getElementById("game-audio-mute-mount");
        if (!mount) return;

        injectStyles();

        const btn = document.createElement("button");
        btn.id = "game-audio-toggle";
        btn.type = "button";
        btn.setAttribute("aria-label", "Toggle music");
        mount.appendChild(btn);
        updateButtonFace(btn);

        btn.addEventListener("click", () => {
            setMuted(!isMuted());
            updateButtonFace(btn);
            applyMuteToBackgroundPlayer();
        });

        const playlistUrl = getPlaylistUrl();
        if (!playlistUrl) return;   // nothing chosen yet in Settings — button still works, just nothing playing

        const iframe = buildWidgetIframe(playlistUrl);
        iframe.id = BG_PLAYER_ID;
        iframe.className = "game-audio-hidden-player";
        document.body.appendChild(iframe);

        loadWidgetApi()
            .then(() => {
                SC.Widget(iframe).bind(SC.Widget.Events.READY, applyMuteToBackgroundPlayer);
            })
            .catch((err) => console.warn("[game-audio]", err.message));
    }

    function updateButtonFace(btn) {
        btn.textContent = isMuted() ? "\u{1F507}" : "\u{1F50A}";   // muted speaker / loud speaker
        btn.classList.toggle("muted", isMuted());
    }

    // -------- Settings.html: visible player + editable playlist link --------

    function initSettingsPanel() {
        const container = document.getElementById("game-audio-settings");
        if (!container) return;

        injectStyles();

        container.innerHTML =
            '<h2 class="game-audio-title">Music</h2>' +
            '<p id="game-audio-mute-status" class="game-audio-mute-status"></p>' +
            '<div id="game-audio-player-slot" class="game-audio-player-slot"></div>' +
            '<label class="game-audio-label" for="game-audio-url-input">SoundCloud playlist or track link</label>' +
            '<input id="game-audio-url-input" class="game-audio-input" type="text" ' +
            'placeholder="https://soundcloud.com/artist/sets/playlist-name">' +
            '<div class="game-audio-buttons">' +
            '<button id="game-audio-load-btn" type="button" class="game-audio-btn">Load</button>' +
            '<button id="game-audio-mute-btn" type="button" class="game-audio-btn">Mute</button>' +
            '<a class="game-audio-btn game-audio-btn-secondary" href="https://soundcloud.com" target="_blank" rel="noopener">Browse SoundCloud &#8599;</a>' +
            '</div>' +
            '<p class="game-audio-hint">Find a playlist on SoundCloud, copy its link, paste it above and click Load — it plays here and on the main menu until you change it.</p>';

        const input    = document.getElementById("game-audio-url-input");
        const loadBtn  = document.getElementById("game-audio-load-btn");
        const muteBtn  = document.getElementById("game-audio-mute-btn");
        input.value = getPlaylistUrl();

        loadBtn.addEventListener("click", () => {
            const url = input.value.trim();
            if (!url) return;
            setPlaylistUrl(url);
            renderSettingsPlayer(url);
        });

        // Mute is shared with the main menu's button (same localStorage
        // flag) — this is the fix for a real bug: without a visible
        // toggle HERE, a mute flipped on earlier (e.g. testing the main
        // menu button) silently zeroes this preview's volume too, with
        // nothing on this page explaining why nothing's audible.
        muteBtn.addEventListener("click", () => {
            setMuted(!isMuted());
            updateMuteStatus(muteBtn);
            applyMuteToBackgroundPlayer();          // in case it's also playing on this page
            applyMuteToSettingsPlayer();
        });
        updateMuteStatus(muteBtn);

        if (getPlaylistUrl()) renderSettingsPlayer(getPlaylistUrl());
    }

    function updateMuteStatus(muteBtn) {
        const muted = isMuted();
        muteBtn.textContent = muted ? "Unmute" : "Mute";
        const status = document.getElementById("game-audio-mute-status");
        if (status) {
            status.textContent = muted
                ? "Currently muted — click Unmute below to hear it."
                : "";
            status.classList.toggle("visible", muted);
        }
    }

    function applyMuteToSettingsPlayer() {
        const slot = document.getElementById("game-audio-player-slot");
        const iframe = slot && slot.querySelector("iframe");
        if (!iframe || !window.SC || !SC.Widget) return;
        SC.Widget(iframe).setVolume(isMuted() ? 0 : 100);
    }

    function renderSettingsPlayer(url) {
        const slot = document.getElementById("game-audio-player-slot");
        if (!slot) return;

        slot.innerHTML = "";
        const iframe = buildWidgetIframe(url);
        iframe.className = "game-audio-visible-player";
        slot.appendChild(iframe);

        loadWidgetApi()
            .then(() => {
                SC.Widget(iframe).bind(SC.Widget.Events.READY, applyMuteToSettingsPlayer);
            })
            .catch((err) => console.warn("[game-audio]", err.message));
    }

    // -------- Styling — injected once, shared by both mount points --------

    function injectStyles() {
        if (document.getElementById("game-audio-styles")) return;
        const style = document.createElement("style");
        style.id = "game-audio-styles";
        style.textContent =
            "#game-audio-toggle{position:fixed;top:20px;right:20px;width:44px;height:44px;" +
            "font-size:1.3rem;line-height:1;display:flex;align-items:center;justify-content:center;" +
            "background-color:#ffffff;border:2px solid #2c3e50;border-radius:8px;cursor:pointer;" +
            "z-index:1000;transition:background-color .2s ease,transform .1s ease;}" +
            "#game-audio-toggle:hover{background-color:#eeeeee;}" +
            "#game-audio-toggle:active{transform:scale(0.94);}" +
            "#game-audio-toggle.muted{opacity:.55;}" +
            ".game-audio-hidden-player{position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;border:0;}" +
            ".game-audio-title{color:#2c3e50;margin-bottom:14px;}" +
            ".game-audio-player-slot{margin-bottom:14px;}" +
            ".game-audio-visible-player{width:100%;max-width:500px;height:166px;border:0;}" +
            ".game-audio-label{display:block;text-align:left;font-weight:bold;color:#2c3e50;margin:0 auto 6px;max-width:500px;}" +
            ".game-audio-input{width:100%;max-width:500px;padding:10px 12px;font-size:1rem;" +
            "font-family:inherit;border:2px solid #2c3e50;border-radius:6px;margin-bottom:12px;}" +
            ".game-audio-buttons{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:10px;}" +
            ".game-audio-btn{padding:10px 18px;font-family:inherit;font-weight:bold;font-size:.95rem;" +
            "color:#2c3e50;background-color:#ffffff;border:2px solid #2c3e50;border-radius:6px;" +
            "cursor:pointer;text-decoration:none;transition:background-color .2s ease,color .2s ease;}" +
            ".game-audio-btn:hover{background-color:#2c3e50;color:#ffffff;}" +
            ".game-audio-hint{font-size:.85rem;color:#666;max-width:500px;margin:0 auto;}" +
            ".game-audio-mute-status{display:none;font-size:.9rem;font-weight:bold;color:#c0392b;margin-bottom:10px;}" +
            ".game-audio-mute-status.visible{display:block;}";
        document.head.appendChild(style);
    }

    // -------- Init --------
    document.addEventListener("DOMContentLoaded", () => {
        initMuteButton();
        initSettingsPanel();
    });

})();
