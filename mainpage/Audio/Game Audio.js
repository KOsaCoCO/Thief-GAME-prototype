// =============================================================
// Game Audio
// -------------------------------------------------------------
// ONE shared file, linked into whichever page needs it with a plain
// <script src="...Audio/Game Audio.js"> tag — nothing else connects
// the pages together. Each page just needs an empty "mount" element
// for this file to fill in:
//   - mainpage.html:  #game-audio-mute-mount  -> the mute/unmute
//     square (top-right corner) + a hidden background <audio> player.
//   - Settings.html:  #game-audio-settings    -> the visible track
//     picker, volume slider, and play/mute controls.
// A page with neither container just gets no audio behavior — nothing
// else on it depends on this file.
//
// Plays LOCAL audio files from Audio/tracks/ (listed in
// Audio/tracks/tracklist.js) instead of embedding SoundCloud — that
// was tried first, but individual SoundCloud tracks can silently fail
// to stream (some are restricted from third-party embedding, which
// shows up as 404s on SoundCloud's own stream endpoints, with no way
// to know in advance). A local file you supply yourself always plays.
//
// The mute flag, volume level, and chosen track are stored in
// localStorage (shared by every page on this site), so picking a
// track in Settings is what plays on the main menu too, and a mute or
// volume change on one page carries over the next time any page using
// this file loads.
//
// Browsers still require a real click before ANY audio can be
// audible, local file or not — that's a platform rule, not something
// this file can bypass. The player starts muted (which autoplay is
// always allowed to do) so it's at least running, and the mute
// button / volume slider / track picker are all genuine user
// gestures that reliably make it audible.
//
// SAFE TO DELETE: remove this file's <script> tag from a page and
// that page just loses its audio controls.
// =============================================================

(function () {
    "use strict";

    const STORAGE_MUTED  = "thiefGameAudioMuted";
    const STORAGE_VOLUME = "thiefGameAudioVolume";
    const STORAGE_TRACK  = "thiefGameAudioTrackFile";
    const DEFAULT_VOLUME = 100;
    const AUDIO_EL_ID     = "game-audio-player";

    // Resolve Audio/tracks/ relative to THIS script's own location (not
    // the page's), so it works the same whether it's included as
    // "Audio/Game Audio.js" (mainpage.html) or "../Audio/Game Audio.js"
    // (Settings.html). document.currentScript is only valid during this
    // initial synchronous run, so it's captured here at the top.
    const SCRIPT_URL      = document.currentScript ? document.currentScript.src : "";
    const TRACKS_BASE_URL = SCRIPT_URL ? new URL("tracks/", SCRIPT_URL).href : "tracks/";

    // -------- Shared state (localStorage) --------

    function isMuted() {
        return localStorage.getItem(STORAGE_MUTED) === "1";
    }
    function setMuted(muted) {
        localStorage.setItem(STORAGE_MUTED, muted ? "1" : "0");
    }
    // The level played at when NOT muted (0-100). Mute is a separate,
    // temporary override — it never overwrites this, so unmuting always
    // comes back at whatever level was last set here.
    function getVolume() {
        const stored = Number(localStorage.getItem(STORAGE_VOLUME));
        return Number.isFinite(stored) && stored >= 0 && stored <= 100 ? stored : DEFAULT_VOLUME;
    }
    function setVolume(vol) {
        const clamped = Math.max(0, Math.min(100, Math.round(vol)));
        localStorage.setItem(STORAGE_VOLUME, String(clamped));
    }
    function getTrackFile() {
        return localStorage.getItem(STORAGE_TRACK) || "";
    }
    function setTrackFile(file) {
        localStorage.setItem(STORAGE_TRACK, file);
    }

    // -------- Track list (Audio/tracks/tracklist.js) --------

    let tracklistLoadPromise = null;
    function loadTracklist() {
        if (Array.isArray(window.GAME_AUDIO_TRACKS)) return Promise.resolve(window.GAME_AUDIO_TRACKS);
        if (tracklistLoadPromise) return tracklistLoadPromise;
        tracklistLoadPromise = new Promise((resolve) => {
            const script = document.createElement("script");
            script.src = TRACKS_BASE_URL + "tracklist.js";
            script.onload  = () => resolve(Array.isArray(window.GAME_AUDIO_TRACKS) ? window.GAME_AUDIO_TRACKS : []);
            script.onerror = () => resolve([]);
            document.head.appendChild(script);
        });
        return tracklistLoadPromise;
    }

    // -------- The <audio> element itself --------

    function createAudioElement(cssClass) {
        const audio = document.createElement("audio");
        audio.id = AUDIO_EL_ID;
        audio.loop = true;
        audio.preload = "auto";
        if (cssClass) audio.className = cssClass;
        return audio;
    }

    function setAudioTrack(audio, trackFile) {
        audio.src = TRACKS_BASE_URL + encodeURIComponent(trackFile);
    }

    function applyStateToAudio(audio) {
        audio.volume = getVolume() / 100;
        audio.muted  = isMuted();
    }

    // Starts the element muted (universally allowed for autoplay), then
    // makes a best-effort attempt to raise it to the real preference —
    // works on some browsers/repeat visits, not all. Callers that run
    // from an actual click (mute button, track picker, play button)
    // should call ensurePlayingAudibly() instead, which is reliable.
    function attemptAutoplay(audio) {
        const wantMuted = isMuted();
        audio.muted = true;
        audio.play().catch(() => {});
        if (!wantMuted) {
            setTimeout(() => { audio.muted = false; }, 50);
        }
    }

    // Called from real click/change handlers — guaranteed to be able to
    // make sound, since it always runs as the direct result of a user
    // gesture.
    function ensurePlayingAudibly(audio) {
        applyStateToAudio(audio);
        if (!isMuted() && audio.paused) {
            audio.play().catch(() => {});
        }
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
            const audio = document.getElementById(AUDIO_EL_ID);
            if (audio) ensurePlayingAudibly(audio);
        });

        const trackFile = getTrackFile();
        if (!trackFile) {
            btn.title = "No music set yet — add a track in Settings";
            return;
        }

        const audio = createAudioElement();
        setAudioTrack(audio, trackFile);
        document.body.appendChild(audio);
        attemptAutoplay(audio);
    }

    function updateButtonFace(btn) {
        btn.textContent = isMuted() ? "\u{1F507}" : "\u{1F50A}";   // muted speaker / loud speaker
        btn.classList.toggle("muted", isMuted());
    }

    // -------- Settings.html: track picker + volume + play/mute --------

    function initSettingsPanel() {
        const container = document.getElementById("game-audio-settings");
        if (!container) return;

        injectStyles();
        loadTracklist().then((tracks) => renderSettingsPanel(container, tracks));
    }

    function renderSettingsPanel(container, tracks) {
        if (!tracks || tracks.length === 0) {
            container.innerHTML =
                '<h2 class="game-audio-title">Music</h2>' +
                '<p class="game-audio-hint">No tracks yet — drop an audio file into ' +
                '<code>mainpage/Audio/tracks/</code> and list it in ' +
                '<code>tracklist.js</code>, then reload this page.</p>';
            return;
        }

        const optionsHtml = tracks
            .map((t) => `<option value="${escapeHtml(t.file)}">${escapeHtml(t.label || t.file)}</option>`)
            .join("");

        container.innerHTML =
            '<h2 class="game-audio-title">Music</h2>' +
            '<p id="game-audio-mute-status" class="game-audio-mute-status"></p>' +
            '<label class="game-audio-label" for="game-audio-track-select">Track</label>' +
            `<select id="game-audio-track-select" class="game-audio-input">${optionsHtml}</select>` +
            '<label class="game-audio-label" for="game-audio-volume-input">' +
            'Volume <span id="game-audio-volume-value"></span></label>' +
            '<input id="game-audio-volume-input" class="game-audio-volume" type="range" min="0" max="100" step="1">' +
            '<div class="game-audio-buttons">' +
            '<button id="game-audio-play-btn" type="button" class="game-audio-btn">Play</button>' +
            '<button id="game-audio-mute-btn" type="button" class="game-audio-btn">Mute</button>' +
            '</div>';

        const select      = document.getElementById("game-audio-track-select");
        const volumeInput = document.getElementById("game-audio-volume-input");
        const playBtn     = document.getElementById("game-audio-play-btn");
        const muteBtn     = document.getElementById("game-audio-mute-btn");

        // Fall back to the first listed track if nothing's saved yet, or
        // the saved one is no longer in the list (file renamed/removed).
        let currentFile = getTrackFile();
        if (!tracks.some((t) => t.file === currentFile)) {
            currentFile = tracks[0].file;
            setTrackFile(currentFile);
        }
        select.value = currentFile;

        const audio = createAudioElement();
        setAudioTrack(audio, currentFile);
        container.appendChild(audio);
        attemptAutoplay(audio);

        function updatePlayButton() {
            playBtn.textContent = audio.paused ? "Play" : "Pause";
        }
        audio.addEventListener("play",  updatePlayButton);
        audio.addEventListener("pause", updatePlayButton);
        updatePlayButton();

        select.addEventListener("change", () => {
            setTrackFile(select.value);
            setAudioTrack(audio, select.value);
            ensurePlayingAudibly(audio);   // change event = real gesture
        });

        playBtn.addEventListener("click", () => {
            if (audio.paused) {
                ensurePlayingAudibly(audio);
            } else {
                audio.pause();
            }
        });

        muteBtn.addEventListener("click", () => {
            setMuted(!isMuted());
            updateMuteStatus(muteBtn);
            ensurePlayingAudibly(audio);
        });
        updateMuteStatus(muteBtn);

        volumeInput.value = String(getVolume());
        updateVolumeLabel();
        volumeInput.addEventListener("input", () => {
            setVolume(Number(volumeInput.value));
            updateVolumeLabel();
            if (isMuted()) {
                setMuted(false);
                updateMuteStatus(muteBtn);
            }
            ensurePlayingAudibly(audio);
        });
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

    function updateVolumeLabel() {
        const label = document.getElementById("game-audio-volume-value");
        if (label) label.textContent = getVolume() + "%";
    }

    function escapeHtml(str) {
        const div = document.createElement("div");
        div.textContent = String(str);
        return div.innerHTML;
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
            ".game-audio-title{color:#2c3e50;margin-bottom:14px;}" +
            ".game-audio-label{display:block;text-align:left;font-weight:bold;color:#2c3e50;margin:0 auto 6px;max-width:500px;}" +
            ".game-audio-input{width:100%;max-width:500px;padding:10px 12px;font-size:1rem;" +
            "font-family:inherit;border:2px solid #2c3e50;border-radius:6px;margin-bottom:12px;background-color:#ffffff;}" +
            ".game-audio-buttons{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:10px;}" +
            ".game-audio-btn{padding:10px 18px;font-family:inherit;font-weight:bold;font-size:.95rem;" +
            "color:#2c3e50;background-color:#ffffff;border:2px solid #2c3e50;border-radius:6px;" +
            "cursor:pointer;text-decoration:none;transition:background-color .2s ease,color .2s ease;}" +
            ".game-audio-btn:hover{background-color:#2c3e50;color:#ffffff;}" +
            ".game-audio-hint{font-size:.85rem;color:#666;max-width:500px;margin:0 auto;}" +
            ".game-audio-hint code{background-color:#e8e8e8;padding:1px 5px;border-radius:4px;}" +
            ".game-audio-mute-status{display:none;font-size:.9rem;font-weight:bold;color:#c0392b;margin-bottom:10px;}" +
            ".game-audio-mute-status.visible{display:block;}" +
            ".game-audio-volume{width:100%;max-width:500px;display:block;margin:0 auto 16px;accent-color:#2c3e50;}";
        document.head.appendChild(style);
    }

    // -------- Init --------
    document.addEventListener("DOMContentLoaded", () => {
        initMuteButton();
        initSettingsPanel();
    });

})();
