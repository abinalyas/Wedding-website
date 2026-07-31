/* Background music for the invite.

   Drop a licensed audio file at the path in SRC below and this wires itself
   up. Until that file exists nothing at all happens — no control is drawn, no
   errors are logged — so the site is unaffected while a track is being chosen.

   Two things shape the design:

   - Browsers refuse to start audio without a user gesture, which normally
     means a wedding site cannot have music until someone hunts for a play
     button. The envelope solves that: breaking the seal IS the gesture, so
     the track can begin exactly as the invitation opens. envelope.js fires
     `am:opened` for this; if the envelope is ever removed, the first click or
     touch anywhere serves the same purpose.

   - Guests open wedding sites at work and on trains. The control is always
     visible once music starts, the choice is remembered, and anyone who mutes
     is never asked again.

   Note for iOS: the hardware silent switch mutes HTML5 audio and there is no
   way around it from a web page. On an iPhone with the ringer off there will
   be no sound however this is written. */
(function () {
  "use strict";

  var SRC = "_assets/music.m4a";
  var VOLUME = 0.32;      // background level — present, not competing
  var FADE_MS = 1600;     // gentle rise as the card slides out
  var PREF_KEY = "am-music-muted";

  var audio, button, fadeTimer, started = false, startListenersAttached = false;

  function muted() {
    try { return localStorage.getItem(PREF_KEY) === "1"; } catch (e) { return false; }
  }
  function setMuted(v) {
    try { localStorage.setItem(PREF_KEY, v ? "1" : "0"); } catch (e) {}
  }

  var ICON_ON = "<path d='M4 8v6h4l5 4V4L8 8H4z' fill='currentColor'/>" +
    "<path d='M16 8.5a4 4 0 0 1 0 5M18.5 6a7.5 7.5 0 0 1 0 10' stroke='currentColor' " +
    "stroke-width='1.6' fill='none' stroke-linecap='round'/>";
  var ICON_OFF = "<path d='M4 8v6h4l5 4V4L8 8H4z' fill='currentColor'/>" +
    "<path d='M16.5 9.5l5 5M21.5 9.5l-5 5' stroke='currentColor' stroke-width='1.6' " +
    "stroke-linecap='round'/>";

  function paintButton() {
    if (!button || !audio) return;
    var off = audio.muted || audio.paused;
    button.innerHTML = "<svg viewBox='0 0 24 22' width='19' height='19' aria-hidden='true'>" +
      (off ? ICON_OFF : ICON_ON) + "</svg>";
    button.setAttribute("aria-label", off ? "Play music" : "Mute music");
    button.setAttribute("aria-pressed", off ? "true" : "false");
  }

  function fadeTo(target, done) {
    window.clearInterval(fadeTimer);
    var steps = Math.max(1, Math.round(FADE_MS / 50));
    var from = audio.volume;
    var i = 0;
    fadeTimer = window.setInterval(function () {
      i++;
      audio.volume = Math.min(1, Math.max(0, from + (target - from) * (i / steps)));
      if (i >= steps) {
        window.clearInterval(fadeTimer);
        if (done) done();
      }
    }, 50);
  }

  function addButton() {
    if (button) return;
    var style = document.createElement("style");
    style.textContent =
      ".am-music{position:fixed;right:max(16px,env(safe-area-inset-right));" +
      "bottom:max(16px,env(safe-area-inset-bottom));z-index:2147483000;" +
      "width:40px;height:40px;border-radius:50%;display:flex;align-items:center;" +
      "justify-content:center;cursor:pointer;color:#a4843f;" +
      "background:rgba(252,250,246,.86);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);" +
      "border:1px solid rgba(164,132,63,.28);box-shadow:0 2px 10px rgba(104,86,60,.16);" +
      "opacity:0;transform:translateY(6px);transition:opacity .5s ease,transform .5s ease}" +
      ".am-music.is-in{opacity:1;transform:none}" +
      ".am-music:hover{background:rgba(255,254,251,.96)}" +
      ".am-music:focus-visible{outline:2px solid #b08d46;outline-offset:3px}";
    document.head.appendChild(style);

    button = document.createElement("button");
    button.type = "button";
    button.className = "am-music";
    paintButton();
    button.addEventListener("click", function (e) {
      e.stopPropagation();
      if (audio.paused || audio.muted) {
        audio.muted = false;
        setMuted(false);
        audio.play().then(function () { fadeTo(VOLUME); }).catch(function () {});
      } else {
        setMuted(true);
        fadeTo(0, function () { audio.muted = true; paintButton(); });
      }
      paintButton();
    });
    document.body.appendChild(button);
    window.requestAnimationFrame(function () { button.classList.add("is-in"); });
  }

  function playAudio() {
    if (!audio) return;
    if (muted()) { audio.muted = true; paintButton(); return; }
    audio.volume = 0;
    var p = audio.play();
    if (p && p.catch) {
      // Autoplay can still be refused — for example on mobile low-power mode
      // or a site-level sound block. The control is already on screen, so leave
      // it to the guest to tap it again if needed.
      p.then(function () { fadeTo(VOLUME); paintButton(); })
       .catch(function () { paintButton(); });
    } else {
      fadeTo(VOLUME);
    }
  }

  function start() {
    if (started || !audio) return;
    started = true;
    addButton();
    if (muted()) { audio.muted = true; paintButton(); return; }
    if (audio.readyState < 2) {
      audio.load();
      audio.addEventListener("canplay", playAudio, { once: true });
      return;
    }
    playAudio();
  }

  function attachStartListeners() {
    if (startListenersAttached) return;
    startListenersAttached = true;
    window.addEventListener("am:opened", start);
    // Fallback for any path where the envelope is not in play.
    document.addEventListener("click", start, { once: true });
    document.addEventListener("touchend", start, { once: true });
  }

  function init() {
    audio = new Audio();
    audio.src = SRC;
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 0;
    audio.setAttribute("playsinline", "");

    // No track in place yet (or it failed to load) — stay completely silent
    // and draw nothing rather than leaving a dead control on the page.
    audio.addEventListener("error", function () { audio = null; });

    attachStartListeners();
  }

  if (document.body) init();
  else document.addEventListener("DOMContentLoaded", init);
})();
