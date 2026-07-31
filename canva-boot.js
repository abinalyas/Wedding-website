/* Holds Canva's app bundles until the envelope is opened.

   Why: the hero's pearls fly in from off-screen over roughly 4.5 seconds,
   starting the moment Canva paints. That is the best moment on the site, and
   with the envelope covering the screen it was always over before anyone saw
   it. The drift is driven by Canva's own JS changing layout position each
   frame — not a CSS animation or transition — so it cannot be paused with
   animation-play-state or the Web Animations API. The only way to put it in
   front of a guest is to not start Canva until the envelope opens.

   How: the four `defer`red bundles in index.html carry type="text/x-canva-hold"
   instead of a real script type, so the browser fetches nothing and runs
   nothing. (The other two Canva scripts, strings.js and ru-RU.js, are plain
   data, run during parse, and are left alone.) boot() re-inserts them as real
   scripts, in document order.

   Safety: this file also arms a timer. If nothing has booted Canva within
   BOOT_DEADLINE_MS — envelope.js threw, an asset 404'd, whatever — it boots
   anyway, so a failure in the intro can never leave a guest with a blank page.
   That is deliberately independent of envelope.js. */
(function () {
  "use strict";

  var HOLD_TYPE = "text/x-canva-hold";
  var BOOT_DEADLINE_MS = 9000;
  var booted = false;

  function boot() {
    if (booted) return;
    booted = true;

    var held = document.querySelectorAll('script[type="' + HOLD_TYPE + '"]');
    for (var i = 0; i < held.length; i++) {
      var old = held[i];
      var s = document.createElement("script");
      // Copy every attribute except the holding type: integrity and
      // crossorigin in particular must survive or SRI rejects the file.
      for (var a = 0; a < old.attributes.length; a++) {
        var at = old.attributes[a];
        if (at.name === "type") continue;
        s.setAttribute(at.name, at.value);
      }
      // Dynamically inserted scripts default to async, which would let them
      // execute out of order; the runtime must come up before the app.
      s.async = false;
      old.parentNode.insertBefore(s, old);
    }
  }

  window.__bootCanva = boot;

  window.setTimeout(function () {
    if (!booted) boot();
  }, BOOT_DEADLINE_MS);
})();
