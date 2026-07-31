/* Opening sequence for Abin & Meera's invite: a closed, wax-sealed envelope
   covers the page; tapping breaks the seal, lifts the flap, slides the
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
     A missing comma in an array is a hard error, so this shape fails loudly. */
(function () {
  "use strict";

  // Total time from the tap to the overlay being removed. Must stay in step
  // with the transition delays in the CSS below.
  var SEQUENCE_MS = 2750;

  // The envelope plays on every load, deliberately. It was previously gated
  // behind a sessionStorage flag so it only ran once per tab, but that flag
  // survives a reload — including a hard reload — so once it had been seen the
  // intro was simply gone for the life of that tab, which makes the site look
  // broken to anyone checking their own changes. Guests arrive once and the
  // envelope is the front door, so replaying it costs little. To restore the
  // old behaviour, bail out early when sessionStorage's "am-envelope-seen" is
  // set and write that key in open().

  // Paper grain, as an inline SVG so the page stays self-contained. Laid over
  // the paper at low opacity; without it the envelope reads as flat plastic.
  var GRAIN =
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E" +
    "%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E" +
    "%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E\")";

  // Metallic gold for the seal. The highlight sits off-centre so the wax reads
  // as catching light from the upper left, but the tonal range is deliberately
  // narrow — a wider one made it look like a polished sphere rather than a
  // flat pool of poured wax.
  var GOLD_WAX =
    "radial-gradient(88% 88% at 36% 28%,#eddaa8 0%,#dfc68d 34%,#cdb073 62%,#b8994f 84%,#a2833f 100%)";
  var GOLD_INK = "#a4843f";

  var CSS = [
    // --env-w drives every dimension so the whole thing scales as one piece.
    // The 99vh term keeps it inside short viewports (landscape phones): height
    // is width*.66, so this caps height at ~65vh. Explicit width/height rather
    // than aspect-ratio, which older Safari collapses to a zero-height box.
    ".wenv{--env-w:min(86vw,460px,99vh);--gold:", GOLD_INK, ";",
      "position:fixed;top:0;right:0;bottom:0;left:0;z-index:2147483647;",
      "display:flex;align-items:center;justify-content:center;",
      // Warm cream, lifted slightly in the middle like the backdrop of a
      // styled flat-lay photograph.
      "background:radial-gradient(120% 90% at 50% 42%,#faf8f4 0%,#f1ede6 55%,#e7e2d9 100%);",
      "cursor:pointer;overscroll-behavior:none;touch-action:none;",
      "-webkit-tap-highlight-color:transparent;",
      "opacity:1;transition:opacity .8s ease 1s}",
    ".wenv.is-done{opacity:0}",

    ".wenv__stage{position:relative;display:flex;flex-direction:column;",
      "align-items:center;transform:scale(1);",
      "transition:transform .85s cubic-bezier(.4,0,.2,1) .95s}",
    ".wenv.is-done .wenv__stage{transform:scale(1.25)}",

    // ---- envelope ---------------------------------------------------------
    ".wenv__env{position:relative;width:var(--env-w);height:calc(var(--env-w)*.66);",
      "perspective:1500px;",
      // Soft contact shadow — close and dark underneath, wide and faint out.
      "filter:drop-shadow(0 3px 5px rgba(104,86,60,.16)) drop-shadow(0 26px 42px rgba(104,86,60,.2));",
      "transition:transform .5s cubic-bezier(.2,0,.2,1)}",
    // Gentle lift on hover / touch, only while still closed.
    ".wenv:not(.is-open) .wenv__env:hover{transform:translateY(-6px) scale(1.012)}",

    // Inside of the envelope, only seen once the flap lifts.
    ".wenv__body{position:absolute;top:0;right:0;bottom:0;left:0;z-index:1;",
      "border-radius:4px;background:linear-gradient(#e4ded0,#efeae0)}",

    // The invitation, sandwiched between the inside and the front pocket.
    ".wenv__card{position:absolute;left:4%;top:4.5%;width:92%;height:91%;z-index:2;",
      "border-radius:2px;background:linear-gradient(#fffefc,#f7f4ed);",
      "box-shadow:0 3px 12px rgba(104,86,60,.2);",
      "display:flex;align-items:flex-start;justify-content:center;overflow:hidden;",
      "transform:translateY(0);transition:transform .95s cubic-bezier(.33,0,.2,1) .66s}",
    ".wenv.is-open .wenv__card{transform:translateY(-64%)}",
    ".wenv__card::after{content:'';position:absolute;top:0;right:0;bottom:0;left:0;",
      "background-image:", GRAIN, ";opacity:.035;pointer-events:none}",

    ".wenv__card-inner{position:relative;text-align:center;color:#524a3d;",
      "font-family:Didot,'Bodoni MT','Cormorant Garamond',Garamond,Georgia,serif;",
      // Only the top ~56% of the card clears the pocket, so the wording is
      // anchored near the card's top edge rather than centred on the card —
      // centred, the date fell below the pocket and was never seen.
      "padding-top:7%}",
    ".wenv__mono{font-size:clamp(9px,2.1vw,11px);letter-spacing:.44em;text-indent:.44em;",
      "color:var(--gold);text-transform:uppercase;margin-bottom:.9em}",
    ".wenv__names{font-size:clamp(22px,5.6vw,33px);letter-spacing:.04em;line-height:1.12}",
    ".wenv__rule{width:38px;height:1px;margin:.75em auto;",
      "background:linear-gradient(90deg,transparent,#c9ab6b,transparent)}",
    ".wenv__date{font-size:clamp(9px,2vw,11px);letter-spacing:.36em;text-indent:.36em;color:#93897a}",

    // ---- front pocket + flap folds ----------------------------------------
    // Drawn over the card so the card reads as sliding out of the envelope.
    ".wenv__front{position:absolute;top:0;right:0;bottom:0;left:0;z-index:3;",
      "border-radius:4px;background:linear-gradient(158deg,#fbf9f4,#f2eee5 62%,#ece7dc);",
      "box-shadow:inset 0 1px 0 rgba(255,255,255,.9)}",
    ".wenv__front::after{content:'';position:absolute;top:0;right:0;bottom:0;left:0;",
      "border-radius:4px;background-image:", GRAIN, ";opacity:.05;pointer-events:none}",

    // The side and bottom flaps of an envelope's back, as very slight tonal
    // changes rather than drawn lines — that is all they are on real paper.
    ".wenv__fold{position:absolute;top:0;right:0;bottom:0;left:0;z-index:3}",
    ".wenv__fold--l{background:linear-gradient(90deg,#efeade,#f6f3ec);",
      "-webkit-clip-path:polygon(0 0,51% 50%,0 100%);clip-path:polygon(0 0,51% 50%,0 100%)}",
    ".wenv__fold--r{background:linear-gradient(270deg,#efeade,#f6f3ec);",
      "-webkit-clip-path:polygon(100% 0,49% 50%,100% 100%);clip-path:polygon(100% 0,49% 50%,100% 100%)}",
    ".wenv__fold--b{background:linear-gradient(0deg,#eee9dc,#f7f4ed);",
      "-webkit-clip-path:polygon(0 100%,50% 47%,100% 100%);clip-path:polygon(0 100%,50% 47%,100% 100%)}",

    // "TAP TO OPEN", printed on the envelope below the seal.
    ".wenv__tap{position:absolute;left:0;right:0;top:70%;z-index:4;text-align:center;",
      "color:var(--gold);font-family:Didot,'Bodoni MT',Garamond,Georgia,serif;",
      "font-size:clamp(8px,1.9vw,10px);letter-spacing:.42em;text-indent:.42em;",
      "text-transform:uppercase;pointer-events:none;",
      "animation:wenv-breathe 3s ease-in-out infinite;transition:opacity .35s ease}",
    ".wenv.is-open .wenv__tap{opacity:0;animation:none}",
    ".wenv__tap svg{display:block;margin:.85em auto 0}",
    "@keyframes wenv-breathe{0%,100%{opacity:.62}50%{opacity:1}}",

    // ---- top flap ---------------------------------------------------------
    // Hinged on the envelope's top edge; carries the "YOU'RE INVITED" line.
    ".wenv__flap{position:absolute;left:0;top:0;width:100%;height:52%;z-index:5;",
      "background:linear-gradient(#fdfcf8,#f4f1e8 70%,#eee9de);",
      "-webkit-clip-path:polygon(0 0,100% 0,50% 100%);clip-path:polygon(0 0,100% 0,50% 100%);",
      "transform-origin:top center;transform:rotateX(0deg);",
      "filter:drop-shadow(0 2px 2px rgba(104,86,60,.14));",
      "transition:transform 1s cubic-bezier(.5,0,.25,1) .22s,z-index 0s linear .72s}",
    // Once past vertical the flap belongs behind the card, not in front of it.
    ".wenv.is-open .wenv__flap{transform:rotateX(-180deg);z-index:1}",
    ".wenv__flap::after{content:'';position:absolute;top:0;right:0;bottom:0;left:0;",
      "background-image:", GRAIN, ";opacity:.05;pointer-events:none}",

    // Sits high on the flap: the wording is em-sized and so does not shrink in
    // step with the envelope, and at phone widths a lower position put it
    // underneath the seal.
    ".wenv__invited{position:absolute;left:0;right:0;top:30%;text-align:center;",
      "color:var(--gold);font-family:Didot,'Bodoni MT',Garamond,Georgia,serif;",
      "font-size:clamp(8px,1.95vw,10px);letter-spacing:.46em;text-indent:.46em;",
      "text-transform:uppercase;pointer-events:none}",
    ".wenv__fleuron{display:block;margin:0 auto .9em}",

    // ---- wax seal ---------------------------------------------------------
    // Two halves, so the break is real geometry rather than a cross-fade. The
    // uneven border-radius on the outer edges gives the hand-poured wobble.
    ".wenv__seal{position:absolute;left:50%;top:47%;",
      "width:calc(var(--env-w)*.225);height:calc(var(--env-w)*.225);",
      "z-index:6;transform:translate(-50%,-50%) rotate(-3.5deg);",
      "padding:0;border:0;background:none;cursor:pointer;",
      "-webkit-tap-highlight-color:transparent;",
      "filter:drop-shadow(0 4px 6px rgba(104,80,36,.34))}",
    ".wenv__seal:focus-visible{outline:2px solid #b08d46;outline-offset:8px;border-radius:50%}",
    ".wenv__half{position:absolute;top:0;height:100%;width:51%;",
      "background-image:", GOLD_WAX, ";background-size:200% 100%;",
      "box-shadow:inset 0 3px 5px rgba(255,247,220,.4),inset 0 -5px 9px rgba(96,72,30,.26);",
      "transition:transform .66s cubic-bezier(.36,0,.4,1),opacity .66s ease .14s}",
    ".wenv__half--l{left:0;z-index:2;background-position:left center;",
      "border-radius:100% 0 0 100%/50% 0 0 50%}",
    ".wenv__half--r{right:0;z-index:1;background-position:right center;",
      "border-radius:0 100% 100% 0/0 50% 50% 0}",
    ".wenv.is-open .wenv__half--l{transform:translate(-46%,28%) rotate(-36deg);opacity:0}",
    ".wenv.is-open .wenv__half--r{transform:translate(46%,32%) rotate(40deg);opacity:0}",

    // Monogram sits above the halves so it stays centred while they part.
    ".wenv__stamp{position:absolute;top:0;right:0;bottom:0;left:0;z-index:3;display:flex;",
      "flex-direction:column;align-items:center;justify-content:center;",
      "color:#6d5220;pointer-events:none;transition:opacity .3s ease}",
    ".wenv.is-open .wenv__stamp{opacity:0}",
    // Engraved look: a dark letter with a fine light shadow beneath it.
    ".wenv__initials{display:flex;align-items:center;gap:.42em;",
      "font-family:Didot,'Bodoni MT',Garamond,Georgia,serif;",
      "font-size:clamp(15px,3.9vw,23px);letter-spacing:.02em;",
      "text-shadow:0 1px 0 rgba(255,244,214,.45)}",
    ".wenv__bar{width:1px;height:1.35em;background:currentColor;opacity:.5}",
    ".wenv__sprig{display:block;margin-top:.42em;opacity:.7}",
    // Inner rim, the impression left by the stamp.
    ".wenv__rim{position:absolute;top:13%;right:13%;bottom:13%;left:13%;z-index:3;",
      "border:1px solid rgba(125,96,38,.34);border-radius:50%;",
      "box-shadow:inset 0 1px 1px rgba(255,247,220,.3);pointer-events:none;",
      "transition:opacity .3s ease}",
    ".wenv.is-open .wenv__rim{opacity:0}",

    // Guests who ask for less motion get the envelope, but it simply fades
    // rather than folding, sliding and scaling.
    "@media (prefers-reduced-motion:reduce){",
      ".wenv,.wenv__stage,.wenv__card,.wenv__flap,.wenv__half,.wenv__stamp,.wenv__rim,.wenv__env{",
        "transition-duration:.25s!important;transition-delay:0s!important}",
      ".wenv.is-done .wenv__stage{transform:none}",
      ".wenv.is-open .wenv__card{transform:translateY(0)}",
      ".wenv.is-open .wenv__flap{transform:rotateX(0deg)}",
      ".wenv__tap{animation:none;opacity:.85}}"
  ].join("");

  // Small ornaments as inline SVG rather than unicode glyphs: iOS renders
  // U+2665 and friends as full-colour emoji, which would wreck the gold.
  var FLEURON = [
    "<svg class='wenv__fleuron' width='16' height='9' viewBox='0 0 16 9' fill='none' aria-hidden='true'>",
      "<path d='M8 .8 9.5 4.5 8 8.2 6.5 4.5Z' fill='currentColor' opacity='.85'/>",
      "<path d='M.5 4.5h5M10.5 4.5h5' stroke='currentColor' stroke-width='.7' opacity='.6'/>",
    "</svg>"
  ].join("");

  var HEART_RULE = [
    "<svg width='74' height='7' viewBox='0 0 74 7' fill='none' aria-hidden='true'>",
      "<path d='M2 3.5h22M50 3.5h22' stroke='currentColor' stroke-width='.7' ",
        "stroke-linecap='round' stroke-dasharray='1 4' opacity='.7'/>",
      "<path d='M37 6.2C34.4 4.3 32.8 3.1 32.8 1.9c0-.9.7-1.6 1.6-1.6.6 0 1.1.3 1.5.8.4-.5.9-.8 1.5-.8",
        ".9 0 1.6.7 1.6 1.6 0 1.2-1.6 2.4-4.2 4.3Z' fill='currentColor' opacity='.8'/>",
    "</svg>"
  ].join("");

  var SPRIG = [
    "<svg class='wenv__sprig' width='34' height='9' viewBox='0 0 26 7' fill='none' aria-hidden='true'>",
      "<path d='M13 6.4C10 6.4 7 5.2 4 2.6M13 6.4c3 0 6-1.2 9-3.8' stroke='currentColor' ",
        "stroke-width='.7' stroke-linecap='round'/>",
      "<path d='M6.6 2.2c-.5-.9-1.5-1.4-2.5-1.3.1 1 .7 1.9 1.6 2.3ZM9.4 4c-.4-.9-1.3-1.5-2.3-1.5",
        ".1 1 .6 1.9 1.5 2.4ZM19.4 2.2c.5-.9 1.5-1.4 2.5-1.3-.1 1-.7 1.9-1.6 2.3ZM16.6 4c.4-.9 1.3-1.5 2.3-1.5",
        "-.1 1-.6 1.9-1.5 2.4Z' fill='currentColor'/>",
    "</svg>"
  ].join("");

  var HTML = [
    "<div class='wenv__stage'>",
      "<div class='wenv__env'>",
        "<div class='wenv__body'></div>",
        "<div class='wenv__card'><div class='wenv__card-inner'>",
          "<div class='wenv__mono'>Together</div>",
          "<div class='wenv__names'>Abin &amp; Meera</div>",
          "<div class='wenv__rule'></div>",
          "<div class='wenv__date'>26 . 08 . 2026</div>",
        "</div></div>",
        "<div class='wenv__front'></div>",
        "<div class='wenv__fold wenv__fold--l'></div>",
        "<div class='wenv__fold wenv__fold--r'></div>",
        "<div class='wenv__fold wenv__fold--b'></div>",
        "<div class='wenv__tap'>Tap to open", HEART_RULE, "</div>",
        "<div class='wenv__flap'>",
          "<div class='wenv__invited'>", FLEURON, "You&rsquo;re invited</div>",
        "</div>",
        "<button type='button' class='wenv__seal' aria-label='Open the invitation'>",
          "<span class='wenv__half wenv__half--l'></span>",
          "<span class='wenv__half wenv__half--r'></span>",
          "<span class='wenv__rim'></span>",
          "<span class='wenv__stamp'>",
            "<span class='wenv__initials'>A<span class='wenv__bar'></span>M</span>",
            SPRIG,
          "</span>",
        "</button>",
      "</div>",
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
    overlay.innerHTML = HTML;
    document.body.appendChild(overlay);

    // Hold the page still underneath while the envelope is up.
    var block = function (e) { e.preventDefault(); };
    overlay.addEventListener("wheel", block, { passive: false });
    overlay.addEventListener("touchmove", block, { passive: false });
    var prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    var seal = overlay.querySelector(".wenv__seal");
    if (seal) seal.focus({ preventScroll: true });

    var opened = false;
    function open() {
      if (opened) return;
      opened = true;

      // is-done drives the closing fade/scale; its own CSS delay handles the
      // wait, so both classes can go on in the same frame.
      overlay.classList.add("is-open");
      overlay.classList.add("is-done");

      window.setTimeout(function () {
        overlay.removeEventListener("wheel", block);
        overlay.removeEventListener("touchmove", block);
        document.documentElement.style.overflow = prevOverflow;
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, SEQUENCE_MS);
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
