/* Opening sequence for Abin & Meera's invite: a photographed wax-sealed
   envelope covers the page; tapping releases the seal, lifts the flap, slides
   the invitation out, then pushes in until the card becomes the site.

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
     front.webp   1210 x 878   the front pocket, V notch cut out — the card
                               slides up behind this
     seal.webp     407 x 405   the gold wax seal, whole

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

  // The surface the envelope sits on, and the colour of the retracting panels.
  var BACKDROP   = "#f1ede6";

  // Phase timings, in step with the transition delays in the CSS below.
  var REVEAL_AT_MS      = 1750;  // when the push-in begins
  // Canva is started this far ahead of the window opening. It paints ~100ms
  // after booting, so the site is on screen behind the card the instant the
  // window starts to open — otherwise the hole would reveal a blank page.
  var BOOT_LEAD_MS      = 250;
  var REVEAL_DUR_MS     = 1200;  // how long the push-in runs
  var REVEAL_ENV_SCALE  = 1.9;   // how far the envelope travels toward the viewer
  // Earliest the arrived card may fade. Set to the end of the push-in so the
  // page is uncovered exactly as the movement settles.
  var REVEAL_MS    = REVEAL_AT_MS + REVEAL_DUR_MS;
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
      // Flat, not a gradient: the reveal splits this backdrop into four panels that
      // retract to open a window, and a gradient cannot be divided across four
      // independently-scaled panels without showing seams.
      "background:", BACKDROP, ";",
      "cursor:pointer;overscroll-behavior:none;touch-action:none;",
      "-webkit-tap-highlight-color:transparent;",
      // The overlay is focused on mount so it receives keys; it is a container,
      // not a control, so it must not paint a focus ring around the viewport.
      "outline:none;",
      "opacity:1;transition:opacity .55s ease}",
    ".wenv.is-done{opacity:0}",

    ".wenv__stage{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center}",

    // ---- the window -------------------------------------------------------
    // Four panels framing a hole the size of the card. They retract to open the
    // hole out to the full viewport, and the live site is simply behind them —
    // so what grows out of the envelope IS the page, rather than a picture of a
    // card that fades to reveal it.
    ".wenv__shade{position:fixed;background:", BACKDROP, ";z-index:0;will-change:transform}",
    // Once the panels are carrying the backdrop, the overlay must stop painting
    // its own or it would cover the hole.
    ".wenv.is-reveal{background:transparent}",
    ".wenv.is-reveal .wenv__shade{transition:transform ", (REVEAL_DUR_MS/1000),
      "s cubic-bezier(.36,0,.2,1)}",
    ".wenv.is-reveal .wenv__shade--t{transform:scaleY(0)}",
    ".wenv.is-reveal .wenv__shade--b{transform:scaleY(0)}",
    ".wenv.is-reveal .wenv__shade--l{transform:scaleX(0)}",
    ".wenv.is-reveal .wenv__shade--r{transform:scaleX(0)}",

    // ---- reveal -----------------------------------------------------------
    // A push-in on the whole tableau: everything travels toward the viewer, the
    // envelope fading as it passes, and the card — nearest, and already out of
    // the envelope — overtakes the frame and becomes the page.
    //
    // Scaling the card alone (the earlier version) read as a dissolve rather
    // than an arrival, and pushing through the envelope's mouth instead would
    // have meant travelling past the very thing the guest just took out, as
    // well as blowing a 1210px image up tenfold. Growing the envelope as it
    // goes is what sells this as camera movement rather than the envelope
    // simply evaporating.
    ".wenv.is-reveal .wenv__env{transform:scale(", REVEAL_ENV_SCALE, ");",
      "transition:transform ", (REVEAL_DUR_MS/1000), "s cubic-bezier(.36,0,.2,1);",
      // Scaling a filtered layer is the classic phone-judder trap, and the
      // contact shadow is meaningless once the envelope is airborne anyway.
      "filter:none}",
    ".wenv.is-reveal .wenv__body,.wenv.is-reveal .wenv__front,",
      ".wenv.is-reveal .wenv__flap{opacity:0;",
      "transition:opacity .5s ease .18s}",
    // The card's own transform is measured in JS: it has to undo the envelope's
    // scale, land dead centre, and cover whatever viewport it finds.
    ".wenv.is-reveal .wenv__card{transition:transform ", (REVEAL_DUR_MS/1000),
      "s cubic-bezier(.36,0,.2,1)}",

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

    // The invitation, sitting INSIDE the envelope: in front of the interior,
    // behind the front pocket. It used to be behind a single flat body layer,
    // so it could only appear above the envelope's top edge and read as coming
    // from behind rather than out of the mouth. Through the pocket's V notch
    // it is now visible resting inside once the flap lifts, exactly as a real
    // card is, and then slides up out of the opening.
    ".wenv__card{position:absolute;left:5%;top:3%;width:90%;height:92%;z-index:3;",
      "border-radius:2px;",
      "display:flex;align-items:flex-start;justify-content:center;overflow:hidden;",
      "transform:translateY(0);transition:transform 1s cubic-bezier(.33,0,.2,1) .72s}",
    ".wenv.is-open .wenv__card{transform:translateY(-66%)}",

    // The printed face of the card. It fades at the reveal so the card becomes
    // an empty frame — the window through which the site is already showing.
    ".wenv__card-paper{position:absolute;top:0;right:0;bottom:0;left:0;border-radius:2px;",
      "background:linear-gradient(#fffefb,#f7f4ec);box-shadow:0 3px 14px rgba(104,86,60,.22)}",
    ".wenv.is-reveal .wenv__card-paper,.wenv.is-reveal .wenv__card-inner{opacity:0;",
      "transition:opacity .4s ease}",

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
    // Envelope interior — behind the card.
    ".wenv__body{z-index:2}",
    // Front pocket — in front of the card, so the card slides out of the
    // mouth rather than up from behind the whole envelope.
    ".wenv__front{z-index:4}",

    // ---- flap -------------------------------------------------------------
    // Hinged on the envelope's top edge. Closed it covers the mouth; once past
    // vertical it drops behind the card, which is what lets the card pass over
    // it on the way out.
    ".wenv__flap{position:absolute;left:0;top:0;width:100%;",
      "height:calc(var(--env-w)*", FLAP_RATIO.toFixed(4), ");z-index:5;",
      "transform-origin:top center;transform:rotateX(0deg);",
      "transition:transform 1.05s cubic-bezier(.5,0,.25,1) .24s,z-index 0s linear .78s}",
    ".wenv.is-open .wenv__flap{transform:rotateX(-179.4deg);z-index:1}",
    ".wenv__flap img{position:absolute;left:0;top:0;width:100%;display:block;",
      "user-select:none;-webkit-user-drag:none;pointer-events:none}",

    // ---- wax seal ---------------------------------------------------------
    // The seal is a child of the flap, so it lifts with it as one piece. Real
    // wedding seals are self-adhesive and stuck to the flap only — you do not
    // crack them open. This also lets the artwork be used whole; it used to be
    // split down the middle into two falling halves, and a dead-straight split
    // is not how wax breaks.
    //
    // Positioned within the flap rather than the envelope: the flap is
    // FLAP_RATIO of the envelope's width tall, so the seal's centre — SEAL_Y
    // of the envelope's HEIGHT — lands at this fraction of the flap.
    ".wenv__seal{position:absolute;left:50%;",
      "top:", ((SEAL_Y * ENV_RATIO / FLAP_RATIO) * 100).toFixed(1), "%;",
      "width:calc(var(--env-w)*", SEAL_W, ");",
      "height:calc(var(--env-w)*", (SEAL_W*SEAL_RATIO).toFixed(4), ");",
      "z-index:6;transform:translate(-50%,-50%) rotate(-3deg);",
      "padding:0;border:0;background:none;cursor:pointer;",
      "-webkit-tap-highlight-color:transparent;",
      "filter:drop-shadow(0 3px 4px rgba(104,80,36,.36));",
      // Two separate timings: a quick tilt as it unsticks, then a fade timed
      // to the middle of the flap's swing.
      "transition:transform .2s cubic-bezier(.3,0,.4,1),opacity .38s ease .58s}",
    ".wenv__seal img{width:100%;height:100%;display:block;",
      "user-select:none;-webkit-user-drag:none;pointer-events:none}",
    ".wenv__seal:focus-visible{outline:2px solid #b08d46;outline-offset:9px;border-radius:50%}",
    ".wenv.is-open .wenv__seal{outline:none}",
    // The release: a small tilt and lift as the adhesive gives, then it rides
    // the flap up and fades away through the second half of the rotation —
    // past vertical you would be seeing the back of a domed gold object, which
    // reads wrong, so it is gone before that.
    ".wenv.is-open .wenv__seal{transform:translate(-50%,-52%) rotate(-8.5deg);opacity:0}",

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
      ".wenv,.wenv__stage,.wenv__card,.wenv__flap,.wenv__seal,.wenv__env{",
        "transition-duration:.25s!important;transition-delay:0s!important}",
      ".wenv.is-done .wenv__stage{transform:none}",
      ".wenv.is-open .wenv__card{transform:translateY(0)}",
      ".wenv.is-open .wenv__flap{transform:rotateX(0deg)}",
      ".wenv__hint{animation:none;opacity:.85}}"
  ].join("");

  var HTML = [
    "<div class='wenv__stage'>",
      "<div class='wenv__env'>",
        "<div class='wenv__card'><div class='wenv__card-paper'></div>",
          "<div class='wenv__card-inner'>",
          "<div class='wenv__mono'>Together</div>",
          "<div class='wenv__names'>Abin &amp; Meera</div>",
          "<div class='wenv__rule'></div>",
          "<div class='wenv__date'>26 . 08 . 2026</div>",
        "</div></div>",
        "<img class='wenv__layer wenv__body' src='", BASE, "body.webp' alt='' ",
          "fetchpriority='high' decoding='async'>",
        "<img class='wenv__layer wenv__front' src='", BASE, "front.webp' alt='' ",
          "fetchpriority='high' decoding='async'>",
        "<div class='wenv__flap'>",
          "<img src='", BASE, "flap.webp' alt='' fetchpriority='high' decoding='async'>",
          "<button type='button' class='wenv__seal' aria-label='Open the invitation'>",
            "<img src='", BASE, "seal.webp' alt='' fetchpriority='high' decoding='async'>",
          "</button>",
        "</div>",
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

      // Breaking the seal is a real user gesture, which is the one thing
      // browsers require before audio may start. music.js listens for this.
      try { window.dispatchEvent(new CustomEvent("am:opened")); } catch (e) {}

      // Phase 2: the envelope fades and the invitation grows to fill the
      // screen, so the site emerges from inside the card rather than simply
      // appearing behind the envelope. The transform has to be measured
      // rather than written in CSS: it depends on where the card has slid to
      // and how much of the viewport it must cover.
      var revealAt = window.setTimeout(function () {
        var env = overlay.querySelector(".wenv__env");
        var card = overlay.querySelector(".wenv__card");
        var r = card.getBoundingClientRect();
        var er = env.getBoundingClientRect();

        // The card is a child of the envelope, so the envelope's scale
        // multiplies onto it. Everything below is worked out in the card's own
        // pre-transform space and then divided back out by that scale.
        var S = REVEAL_ENV_SCALE;
        var w = r.width, h = r.height;
        // Undo the slide to get the card's untransformed box — the transform
        // set here replaces the slide rather than adding to it.
        var cx = r.left + w / 2;
        var cy = (r.top + 0.66 * h) + h / 2;
        var ex = er.left + er.width / 2, ey = er.top + er.height / 2;

        // The envelope scales about its own centre, which drags the card with
        // it; this puts the card back in the middle of the screen afterwards.
        var tx = (window.innerWidth / 2 - ex) / S + ex - cx;
        var ty = (window.innerHeight / 2 - ey) / S + ey - cy;
        // Cover the viewport, with a margin so no edge creeps in, then divide
        // out the envelope's scale so the two do not compound.
        var cover = Math.max(window.innerWidth / w, window.innerHeight / h) * 1.1;

        card.style.transform =
          "translate(" + tx + "px," + ty + "px) scale(" + (cover / S) + ")";

        // Frame the card with four backdrop panels, then retract them so the
        // hole opens out to the whole viewport. The site is already painted
        // behind, so the window shows the real page from the first frame. The
        // hole does not have to track the card exactly — by now the card's
        // paper has faded and only the hole is visible.
        var vw = window.innerWidth, vh = window.innerHeight;
        [["t", 0, 0, vw, r.top, "top"],
         ["b", 0, r.bottom, vw, vh - r.bottom, "bottom"],
         ["l", 0, r.top, r.left, r.height, "left"],
         ["r", r.right, r.top, vw - r.right, r.height, "right"]
        ].forEach(function (p) {
          var el = document.createElement("div");
          el.className = "wenv__shade wenv__shade--" + p[0];
          el.style.left = p[1] + "px";
          el.style.top = p[2] + "px";
          el.style.width = Math.max(0, p[3]) + "px";
          el.style.height = Math.max(0, p[4]) + "px";
          el.style.transformOrigin = p[5];
          overlay.appendChild(el);
        });

        // Let the panels paint at full size for one frame, otherwise they are
        // created and scaled to zero in the same style recalculation and the
        // window simply snaps open.
        window.requestAnimationFrame(function () {
          window.requestAnimationFrame(function () {
            overlay.classList.add("is-reveal");
          });
        });
        return;
      }, REVEAL_AT_MS);

      // Phase 3: the grown card fades, uncovering the site behind it. This
      // waits for the hero to exist so the card never fades onto a blank
      // screen, but no longer than HERO_WAIT_MS — if Canva is slow or has
      // failed, showing the page late beats holding a guest on the overlay.
      // Start Canva just before the window opens. At the tap instead, the
      // pearls would have flown most of the way in unseen; any later and the
      // window would open onto a blank page.
      var bootAt = window.setTimeout(function () {
        if (window.__bootCanva) window.__bootCanva();
      }, Math.max(0, REVEAL_AT_MS - BOOT_LEAD_MS));

      var t0 = Date.now();
      var doneAt = window.setInterval(function () {
        var waited = Date.now() - t0;
        if (waited < REVEAL_MS) return;
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
