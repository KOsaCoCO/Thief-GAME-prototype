// =============================================================
// Track list — Start Game Audio's local music catalog
// -------------------------------------------------------------
// A static page can't ask the browser "what files are in this folder"
// — there's no server here to ask, especially when this page is just
// opened as a plain file:// double-click. This file is the low-tech
// substitute: list your tracks here by hand and Game Audio.js reads
// this array to build the picker in Settings.
//
// To add a track:
//   1. Drop the actual audio file (e.g. "my-song.mp3") into this same
//      folder (mainpage/Audio/tracks/).
//   2. Add one line below with its filename and a display label.
//   3. Reload the page — it'll show up in the Settings music picker.
//
// "file" must exactly match the filename you dropped in this folder
// (case-sensitive on some systems). "label" is just what's shown in
// the dropdown — call it whatever you want.
// =============================================================

window.GAME_AUDIO_TRACKS = [
    // { file: "my-song.mp3", label: "My Song" },
];
