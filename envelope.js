/* Opening sequence for Abin & Meera's invite: a photographed wax-sealed
   envelope covers the page; tapping breaks the seal, lifts the flap, slides the
   invitation out, then dissolves to reveal the site underneath.

   Notes specific to this page:
   - Loaded as a plain <script> near the end of <body>, which runs BEFORE
     Canva's own bundles (they are `defer`red), so the overlay is on screen
     before Canva paints into #root — no flash of the site first.
   - The overlay is appended to <body>, deliberately OUTSIDE Canva's #root:
     Canva's runtime re-hydrates that subtree from embedded JSON and would
     throw away anything injected inside it.
   - override.js patches the page every 300ms by searching the WHOLE document
     for exact text ("Open map", "Reception", "6:30 PM", "Call", …) and for
     elements rotated by specific angles. Nothing here uses those strings or
     angles, so the two never collide. Keep it that way if you edit the copy.
   - CSS and markup are built by joining ARRAYS, not by concatenating string
     literals with `+`. A missing `+` between two string literals is not a
     syntax error — automatic semicolon insertion silently ends the statement
     and every rule after it is discarded, which `node --check` does not catch.
     A missing comma in an array is a hard error, so this shape fails loudly.

   The artwork is four cut layers in _assets/envelope/, measured from the
   source renders. Every dimension below is derived from those pixel sizes, so
   if the artwork is ever re-cut these constants must be re-measured:

     body.webp    1210 x 878   envelope with the mouth open, no flap
     flap.webp    1210 x 611   the flap, apex down, hinge along its top edge
     seal-l/r     210 x 405    the seal split into two halves, 6px overlap

   The two source renders disagree about flap length (the folded-back flap in
   the open render is 510px, the closed one 611px), so the flap is a single
   image rotated in 3D rather than a front/back pair — its reverse is the same
   cream paper mirrored, which is imperceptible and keeps the geometry exact. */
(function () {
  "use strict";

  var BASE = "_assets/envelope/";

  // Measured from the artwork; everything scales from the envelope's width.
  var ENV_RATIO  = 878 / 1210;   // envelope height / width
  var FLAP_RATIO = 611 / 1210;   // flap height / envelope width
  var SEAL_W     = 0.19;         // seal width, as a share of envelope width
  var SEAL_RATIO = 405 / 407;    // seal height / seal width
  // Vertical centre of the seal, as a share of envelope height. The flap's
  // apex sits at 611/878 = 69.6%, so this straddles the point the way a real
  // seal does — holding the flap down rather than sitting above it.
  var SEAL_Y     = 0.62;

  // Phase timings, in step with the transition delays in the CSS below.
  var REVEAL_MS    = 2500;  // earliest the grown card may start fading
  var FADE_MS      = 600;   // the card's fade, after which the overlay goes
  // Cap on waiting for Canva to paint the hero. Past this the overlay lifts
  // regardless, so a slow or broken boot can never strand a guest on it.
  var HERO_WAIT_MS = 6000;

  // The envelope plays on every load, deliberately. It was previously gated
  // behind a sessionStorage flag so it only ran once per tab, but that flag
  // survives a reload — including a hard reload — so once it had been seen the
  // intro was simply gone for the life of that tab, which makes the site look
  // broken to anyone checking their own changes. Guests arrive once and the
  // envelope is the front door, so replaying it costs little. To restore the
  // old behaviour, bail out early when sessionStorage's "am-envelope-seen" is
  // set and write that key in open().

  var CSS = [
    // --env-w drives every dimension so the whole thing scales as one piece.
    // The 96vh term keeps it inside short viewports (landscape phones).
    ".wenv{--env-w:min(88vw,470px,96vh);",
      "position:fixed;top:0;right:0;bottom:0;left:0;z-index:2147483647;",
      "display:flex;align-items:center;justify-content:center;",
      "background:radial-gradient(120% 90% at 50% 42%,#faf8f4 0%,#f1ede6 55%,#e7e2d9 100%);",
      "cursor:pointer;overscroll-behavior:none;touch-action:none;",
      "-webkit-tap-highlight-color:transparent;",
      // The overlay is focused on mount so it receives keys; it is a container,
      // not a control, so it must not paint a focus ring around the viewport.
      "outline:none;",
      "opacity:1;transition:opacity .55s ease}",
    ".wenv.is-done{opacity:0}",

    ".wenv__stage{position:relative;display:flex;flex-direction:column;align-items:center}",

    // ---- reveal -----------------------------------------------------------
    // The site is revealed by growing the invitation itself until it fills the
    // screen, then fading it. Previously the whole overlay just faded out, so
    // the page appeared *behind* the envelope rather than coming out of it.
    // The envelope fades first so the card is alone as it expands.
    ".wenv.is-reveal .wenv__body,.wenv.is-reveal .wenv__flap,",
      ".wenv.is-reveal .wenv__seal{opacity:0;transition:opacity .45s ease}",
    // The exact transform is measured and set in JS, since it depends on the
    // card's position on screen and the viewport it has to cover.
    ".wenv.is-reveal .wenv__card{transition:transform 1s cubic-bezier(.4,0,.25,1);",
      "box-shadow:0 10px 60px rgba(104,86,60,.16)}",

    // ---- envelope ---------------------------------------------------------
    ".wenv__env{position:relative;width:var(--env-w);",
      "height:calc(var(--env-w)*", ENV_RATIO.toFixed(4), ");",
      "perspective:1600px;",
      // Contact shadow: tight and dark where the paper meets the surface, wide
      // and faint further out. The artwork itself has no baked shadow, so this
      // is the only one — and being CSS it can respond as the flap lifts.
      "filter:drop-shadow(0 2px 3px rgba(104,86,60,.17)) drop-shadow(0 22px 38px rgba(104,86,60,.21));",
      "transition:transform .5s cubic-bezier(.2,0,.2,1)}",
    ".wenv:not(.is-open) .wenv__env:hover{transform:translateY(-6px) scale(1.012)}",

    // Every layer fills the envelope box; the artwork's own alpha does the
    // shaping, so no clip-path is involved anywhere.
    ".wenv__layer{position:absolute;left:0;top:0;width:100%;display:block;",
      "user-select:none;-webkit-user-drag:none;pointer-events:none}",

    // The invitation, behind the envelope. It is only ever seen above the
    // envelope's top edge, where the body artwork has no pixels.
    ".wenv__card{position:absolute;left:5%;top:3%;width:90%;height:92%;z-index:2;",
      "border-radius:2px;background:linear-gradient(#fffefb,#f7f4ec);",
      "box-shadow:0 3px 14px rgba(104,86,60,.22);",
      "display:flex;align-items:flex-start;justify-content:center;overflow:hidden;",
      "transform:translateY(0);transition:transform 1s cubic-bezier(.33,0,.2,1) .72s}",
    ".wenv.is-open .wenv__card{transform:translateY(-66%)}",

    ".wenv__card-inner{position:relative;text-align:center;color:#524a3d;",
      "font-family:Didot,'Bodoni MT','Cormorant Garamond',Garamond,Georgia,serif;",
      // Only the top of the card clears the envelope, so the wording is
      // anchored near its top edge rather than centred on the card.
      "padding-top:7%}",
    ".wenv__mono{font-size:clamp(9px,2.1vw,11px);letter-spacing:.44em;text-indent:.44em;",
      "color:#a4843f;text-transform:uppercase;margin-bottom:.9em}",
    ".wenv__names{font-size:clamp(22px,5.6vw,33px);letter-spacing:.04em;line-height:1.12}",
    ".wenv__rule{width:38px;height:1px;margin:.75em auto;",
      "background:linear-gradient(90deg,transparent,#c9ab6b,transparent)}",
    ".wenv__date{font-size:clamp(9px,2vw,11px);letter-spacing:.36em;text-indent:.36em;color:#93897a}",

    // Envelope body, drawn over the card so the card reads as sliding out.
    ".wenv__body{z-index:3}",

    // ---- flap -------------------------------------------------------------
    // Hinged on the envelope's top edge. Closed it covers the mouth; once past
    // vertical it drops behind the card, which is what lets the card pass over
    // it on the way out.
    ".wenv__flap{position:absolute;left:0;top:0;width:100%;",
      "height:calc(var(--env-w)*", FLAP_RATIO.toFixed(4), ");z-index:4;",
      "transform-origin:top center;transform:rotateX(0deg);",
      "transition:transform 1.05s cubic-bezier(.5,0,.25,1) .24s,z-index 0s linear .78s}",
    ".wenv.is-open .wenv__flap{transform:rotateX(-179.4deg);z-index:1}",
    ".wenv__flap img{position:absolute;left:0;top:0;width:100%;display:block;",
      "user-select:none;-webkit-user-drag:none;pointer-events:none}",

    // ---- wax seal ---------------------------------------------------------
    ".wenv__seal{position:absolute;left:50%;top:", (SEAL_Y*100).toFixed(1), "%;",
      "width:calc(var(--env-w)*", SEAL_W, ");",
      "height:calc(var(--env-w)*", (SEAL_W*SEAL_RATIO).toFixed(4), ");",
      "z-index:5;transform:translate(-50%,-50%) rotate(-3deg);",
      "padding:0;border:0;background:none;cursor:pointer;",
      "-webkit-tap-highlight-color:transparent;",
      "filter:drop-shadow(0 3px 4px rgba(104,80,36,.36))}",
    ".wenv__seal:focus-visible{outline:2px solid #b08d46;outline-offset:9px;border-radius:50%}",
    // Once the halves have fallen away there is nothing left to ring, and a
    // stray gold circle hanging in mid-air is very visible against the paper.
    ".wenv.is-open .wenv__seal{outline:none}",
    // Each half is a little over half the seal so the join never shows a gap.
    ".wenv__half{position:absolute;top:0;height:100%;width:51.6%;display:block;",
      "user-select:none;-webkit-user-drag:none;pointer-events:none;",
      "transition:transform .7s cubic-bezier(.34,.02,.5,1),opacity .7s ease .16s}",
    ".wenv__half--l{left:0}",
    ".wenv__half--r{right:0}",
    // The halves fall away rather than fading in place — they tip, drop and
    // rotate under gravity, and only then fade.
    ".wenv.is-open .wenv__half--l{transform:translate(-34%,42%) rotate(-31deg);opacity:0}",
    ".wenv.is-open .wenv__half--r{transform:translate(34%,48%) rotate(36deg);opacity:0}",

    // ---- hint -------------------------------------------------------------
    ".wenv__hint{margin:clamp(16px,3.6vh,30px) 0 0;color:#9a8f7d;",
      "font-family:Didot,'Bodoni MT',Garamond,Georgia,serif;",
      "font-size:clamp(9px,2.1vw,11px);letter-spacing:.42em;text-indent:.42em;",
      "text-transform:uppercase;",
      "animation:wenv-breathe 3s ease-in-out infinite;transition:opacity .35s ease}",
    ".wenv.is-open .wenv__hint{opacity:0;animation:none}",
    "@keyframes wenv-breathe{0%,100%{opacity:.45}50%{opacity:.95}}",

    // Guests who ask for less motion get the envelope, but it simply fades
    // rather than folding, sliding and scaling.
    "@media (prefers-reduced-motion:reduce){",
      ".wenv,.wenv__stage,.wenv__card,.wenv__flap,.wenv__half,.wenv__env{",
        "transition-duration:.25s!important;transition-delay:0s!important}",
      ".wenv.is-done .wenv__stage{transform:none}",
      ".wenv.is-open .wenv__card{transform:translateY(0)}",
      ".wenv.is-open .wenv__flap{transform:rotateX(0deg)}",
      ".wenv__hint{animation:none;opacity:.85}}"
  ].join("");

  var HTML = [
    "<div class='wenv__stage'>",
      "<div class='wenv__env'>",
        "<div class='wenv__card'><div class='wenv__card-inner'>",
          "<div class='wenv__mono'>Together</div>",
          "<div class='wenv__names'>Abin &amp; Meera</div>",
          "<div class='wenv__rule'></div>",
          "<div class='wenv__date'>26 . 08 . 2026</div>",
        "</div></div>",
        "<img class='wenv__layer wenv__body' src='", BASE, "body.webp' alt='' ",
          "fetchpriority='high' decoding='async'>",
        "<div class='wenv__flap'>",
          "<img src='", BASE, "flap.webp' alt='' fetchpriority='high' decoding='async'>",
        "</div>",
        "<button type='button' class='wenv__seal' aria-label='Open the invitation'>",
          "<img class='wenv__half wenv__half--l' src='", BASE, "seal-l.webp' alt='' ",
            "fetchpriority='high' decoding='async'>",
          "<img class='wenv__half wenv__half--r' src='", BASE, "seal-r.webp' alt='' ",
            "fetchpriority='high' decoding='async'>",
        "</button>",
      "</div>",
      "<p class='wenv__hint'>Tap to open</p>",
    "</div>"
  ].join("");

  function mount() {
    if (document.querySelector(".wenv")) return;

    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    var overlay = document.createElement("div");
    overlay.className = "wenv";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Wedding invitation of Abin and Meera");
    // Focus lands on the overlay, not the seal, so the keydown handler below
    // receives keys without painting a focus ring around the seal — browsers
    // that treat programmatic focus as :focus-visible would leave that ring
    // hanging in mid-air after the wax has fallen away. Tabbing to the seal
    // still rings it, which is the case the ring is actually for.
    overlay.setAttribute("tabindex", "-1");
    overlay.innerHTML = HTML;
    document.body.appendChild(overlay);

    // Hold the page still underneath while the envelope is up.
    var block = function (e) { e.preventDefault(); };
    overlay.addEventListener("wheel", block, { passive: false });
    overlay.addEventListener("touchmove", block, { passive: false });
    var prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    overlay.focus({ preventScroll: true });

    // Canva has not started yet — canva-boot.js is holding its bundles so the
    // hero's pearls fly in while a guest is actually looking at the page
    // rather than behind the envelope. Poll for the hero appearing so the
    // overlay can be lifted the moment there is something behind it.
    function heroPainted() {
      var root = document.getElementById("root");
      return !!(root && root.querySelector("section"));
    }

    var opened = false;
    function open() {
      if (opened) return;
      opened = true;

      overlay.classList.add("is-open");

      // Phase 2: the envelope fades and the invitation grows to fill the
      // screen, so the site emerges from inside the card rather than simply
      // appearing behind the envelope. The transform has to be measured
      // rather than written in CSS: it depends on where the card has slid to
      // and how much of the viewport it must cover.
      var revealAt = window.setTimeout(function () {
        var card = overlay.querySelector(".wenv__card");
        var r = card.getBoundingClientRect();
        // Undo the slide to get the card's untransformed box, so the scale
        // below is applied about its own centre predictably.
        var h = r.height, w = r.width;
        var top = r.top + 0.66 * h;
        var cx = r.left + w / 2, cy = top + h / 2;
        var dx = window.innerWidth / 2 - cx;
        var dy = window.innerHeight / 2 - cy;
        var scale = Math.max(window.innerWidth / w, window.innerHeight / h) * 1.08;
        card.style.transform =
          "translate(" + dx + "px," + dy + "px) scale(" + scale + ")";
        overlay.classList.add("is-reveal");
      }, 1750);

      // Phase 3: the grown card fades, uncovering the site behind it. This
      // waits for the hero to exist so the card never fades onto a blank
      // screen, but no longer than HERO_WAIT_MS — if Canva is slow or has
      // failed, showing the page late beats holding a guest on the overlay.
      var t0 = Date.now();
      var boots = false;
      var doneAt = window.setInterval(function () {
        var waited = Date.now() - t0;
        if (waited < REVEAL_MS) return;
        // Canva starts here rather than at the tap, and measurably paints the
        // hero about 100ms later (its bundles were preloaded in <head>, so
        // this is execution time only). Starting it at the tap instead meant
        // the pearls had already flown most of the way in by the time the card
        // cleared; starting it now puts the whole entrance in front of a guest
        // as the card fades away over them.
        if (!boots) { boots = true; if (window.__bootCanva) window.__bootCanva(); return; }
        if (!heroPainted() && waited < HERO_WAIT_MS) return;
        window.clearInterval(doneAt);
        overlay.classList.add("is-done");
        window.setTimeout(function () {
          overlay.removeEventListener("wheel", block);
          overlay.removeEventListener("touchmove", block);
          document.documentElement.style.overflow = prevOverflow;
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        }, FADE_MS);
      }, 80);

      window.setTimeout(function () { window.clearTimeout(revealAt); }, REVEAL_MS + 200);
    }

    overlay.addEventListener("click", open);
    overlay.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
        e.preventDefault();
        open();
      }
    });
  }

  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
