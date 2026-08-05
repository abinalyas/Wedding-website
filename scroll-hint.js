/* "Scroll" prompt, phones only.

   Guests were landing on the invitation and then just... stopping. On a phone
   the hero fills the screen edge to edge — pearls, paper, the couple's names —
   with nothing poking above the fold to suggest there is more underneath, and
   because it drifts and fades as it settles, more than one person read the
   whole thing as a video and sat waiting for it to play. This gives them
   somewhere to go.

   Phones only, deliberately. On a desktop the scrollbar already says the page
   continues, so there is no confusion to fix and no reason to add furniture.

   Two things it must not do:

   - Appear over the envelope. It waits for the envelope to take itself out of
     the DOM rather than counting off a fixed delay, so it stays correct if the
     reveal timing is ever changed.
   - Be dismissed by anything other than the guest. envelope.js positions the
     page as it opens, so the dismiss listeners are only attached once the
     prompt is actually on screen, and they additionally require real movement
     rather than any scroll event at all.

   Styled to match the envelope's own "Tap to open" — same Didot, same wide
   letterspacing, same soft grey — so it reads as part of the invitation rather
   than as a piece of interface bolted on. */
(function () {
  "use strict";

  var MAX_WIDTH = 820;      // above this the scrollbar does the job
  var MIN_SCROLLABLE = 120; // don't prompt a scroll that would go nowhere
  var MOVE_PX = 8;          // movement that counts as "they have started"

  var el = null;
  var shown = false;
  var dismissed = false;
  var startTop = 0;

  function isPhone() {
    return window.innerWidth <= MAX_WIDTH;
  }

  function scroller() {
    // Canva scrolls a nested container, not the window.
    return document.querySelector(".ZRRuDw") || null;
  }

  function scrollTopOf(sc) {
    return sc ? sc.scrollTop : (window.pageYOffset || 0);
  }

  function addStyle() {
    var css = [
      // A full-width strip rather than just the words, because it carries the
      // scrim. On a 375x812 phone Canva's hero is 731px tall, so the next
      // section's body copy already sits in the bottom 81px of the screen —
      // right where this goes. Without the fade the prompt lands on top of that
      // text and both become hard to read.
      ".am-scroll{position:fixed;left:0;right:0;bottom:0;",
      "z-index:2147482000;pointer-events:none;",
      "display:flex;flex-direction:column;align-items:center;justify-content:flex-end;",
      "gap:7px;padding-top:92px;",
      "padding-bottom:calc(max(18px,env(safe-area-inset-bottom)) + 4px);",
      "color:#9a8f7d;opacity:0;transition:opacity .9s ease}",
      ".am-scroll.is-in{opacity:1}",

      ".am-scroll__word{margin:0;font-family:Didot,'Bodoni MT',Garamond,Georgia,serif;",
      "font-size:9.5px;letter-spacing:.42em;text-indent:.42em;text-transform:uppercase}",

      // The chevron drifts down and brightens, then eases back — a nudge in the
      // direction to go, rather than an arrow bouncing for attention.
      ".am-scroll__arrow{display:block;animation:am-scroll-nudge 2.4s cubic-bezier(.4,0,.2,1) infinite}",
      "@keyframes am-scroll-nudge{0%,100%{transform:translateY(0);opacity:.4}",
      "50%{transform:translateY(5px);opacity:.95}}",

      "@media (prefers-reduced-motion:reduce){",
      ".am-scroll__arrow{animation:none;opacity:.85}}"
    ].join("");

    var style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  }

  function paperColour() {
    // Read the section's own paper texture rather than hardcoding a cream, the
    // same way override.js colours the rings band, so the scrim keeps matching
    // if the artwork is ever changed. Same-origin, so the canvas is untainted.
    try {
      var sec = document.querySelector("section");
      if (!sec) return null;
      var sr = sec.getBoundingClientRect();
      var tex = Array.from(sec.querySelectorAll("img")).filter(function (im) {
        var r = im.getBoundingClientRect();
        return r.width >= sr.width * 0.9 && r.height >= sr.height * 0.5;
      })[0];
      if (!tex || !tex.complete || !tex.naturalWidth) return null;
      var c = document.createElement("canvas");
      c.width = 8; c.height = 8;
      var ctx = c.getContext("2d");
      ctx.drawImage(tex, 0, 0, 8, 8);
      var d = ctx.getImageData(0, 0, 8, 8).data;
      var r = 0, g = 0, b = 0, n = 0;
      for (var i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
      return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
    } catch (e) {
      return null;
    }
  }

  function build() {
    addStyle();
    el = document.createElement("div");
    el.className = "am-scroll";

    // Measured at rgb(236,236,235) on the current artwork; sampled rather than
    // trusted, with that as the fallback.
    var p = paperColour() || [236, 236, 235];
    var rgb = p[0] + "," + p[1] + "," + p[2];
    // Reaches full paper before the words start, so they always sit on clean
    // stock however the section behind happens to fall. The bottom of the page
    // is this colour anyway, so the solid part is invisible.
    el.style.backgroundImage =
      "linear-gradient(to bottom," +
      "rgba(" + rgb + ",0) 0%," +
      "rgba(" + rgb + ",.72) 38%," +
      "rgba(" + rgb + ",1) 68%," +
      "rgba(" + rgb + ",1) 100%)";
    // Decorative: it repeats what a scrollbar or a swipe already conveys, and
    // it cannot be interacted with.
    el.setAttribute("aria-hidden", "true");
    el.innerHTML =
      "<p class='am-scroll__word'>Scroll</p>" +
      "<svg class='am-scroll__arrow' width='15' height='9' viewBox='0 0 15 9' " +
      "fill='none' xmlns='http://www.w3.org/2000/svg'>" +
      "<path d='M1 1l6.5 6.5L14 1' stroke='currentColor' stroke-width='1.1' " +
      "stroke-linecap='round' stroke-linejoin='round'/></svg>";
    document.body.appendChild(el);
  }

  function dismiss() {
    if (dismissed || !el) return;
    dismissed = true;
    el.classList.remove("is-in");
    window.setTimeout(function () {
      if (el && el.parentNode) el.parentNode.removeChild(el);
      el = null;
    }, 900);
  }

  function onMove() {
    if (!shown) return;
    if (Math.abs(scrollTopOf(scroller()) - startTop) < MOVE_PX) return;
    dismiss();
  }

  function show() {
    if (shown || dismissed) return;
    shown = true;
    build();
    startTop = scrollTopOf(scroller());

    // Attached only now, so that the page being positioned as the envelope
    // opens cannot count as the guest having scrolled.
    //
    // Bound to the scroll container itself, the way override.js does it, rather
    // than relying on a capture listener on document: scroll does not bubble,
    // and leaning on capture to catch a nested container's scroll is the kind
    // of thing that works in one engine and not another. The document listener
    // stays as a backstop, and touch/wheel catch the gesture even before the
    // container has moved.
    var sc = scroller();
    if (sc) sc.addEventListener("scroll", onMove, { passive: true });
    document.addEventListener("scroll", onMove, true);
    window.addEventListener("scroll", onMove, { passive: true });
    window.addEventListener("wheel", dismiss, { passive: true });
    window.addEventListener("touchmove", dismiss, { passive: true });

    // A timer rather than requestAnimationFrame: rAF does not run while the tab
    // is in the background, so a guest who opened the link and glanced away
    // would come back to a prompt that had been built but never faded in. This
    // only needs the element to have been in the DOM for a tick so that the
    // opacity transition has something to move from.
    window.setTimeout(function () {
      if (el) el.classList.add("is-in");
    }, 30);
  }

  function ready() {
    // Not until the envelope has gone, the page is actually scrollable, and
    // Canva has painted something to scroll.
    if (document.querySelector(".wenv")) return false;
    var sc = scroller();
    if (!sc) return false;
    if (sc.scrollHeight - sc.clientHeight < MIN_SCROLLABLE) return false;
    return true;
  }

  function pollUntilReady() {
    var waited = 0;
    var timer = window.setInterval(function () {
      waited += 200;
      if (dismissed || shown) { window.clearInterval(timer); return; }
      // If they got going on their own before this was ready, stay out of it.
      if (scrollTopOf(scroller()) > MOVE_PX) {
        dismissed = true;
        window.clearInterval(timer);
        return;
      }
      if (ready()) {
        window.clearInterval(timer);
        // A beat after the reveal settles, so it fades in rather than being
        // there the instant the site appears.
        window.setTimeout(show, 900);
        return;
      }
      // Canva has had every chance by now; something is wrong, so say nothing.
      if (waited > 30000) window.clearInterval(timer);
    }, 200);
  }

  function watch() {
    if (!isPhone()) return;
    // Start counting from the moment the envelope is opened, not from page
    // load. A guest may well look at the envelope for a while before tapping
    // it, and a budget that started at load would quietly expire while they
    // did — leaving the one guest who hesitated as the one who never gets the
    // prompt. If there is no envelope in play, begin straight away.
    if (document.querySelector(".wenv")) {
      window.addEventListener("am:opened", pollUntilReady, { once: true });
    } else {
      pollUntilReady();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", watch);
  } else {
    watch();
  }
})();
