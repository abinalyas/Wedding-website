/* Opening sequence for Abin & Meera's invite: a closed wax-sealed envelope
   covers the page; tapping it breaks the seal, lifts the flap, slides the
   invitation card out, and then dissolves to reveal the site underneath.

   Notes specific to this page:
   - This file is loaded as a plain <script> near the end of <body>, which runs
     BEFORE Canva's own bundles (they are `defer`red), so the overlay is on
     screen before Canva paints anything into #root and there is no flash of
     the site before the envelope.
   - The overlay is a single fixed element at the top of the stacking order,
     appended to <body>. It is deliberately kept out of Canva's #root subtree:
     Canva's runtime re-hydrates that subtree from its embedded JSON and would
     throw away anything we injected inside it.
   - override.js patches the page every 300ms by searching the WHOLE document
     for exact text ("Open map", "Reception", "6:30 PM", "Call", …) and for
     elements rotated by specific angles. None of those strings or angles are
     used here, so the two never collide. Keep it that way if you edit the
     copy below. */
(function () {
  "use strict";

  var SEEN_KEY = "am-envelope-seen";
  // Total time from the tap to the overlay being removed. Must stay in step
  // with the transition delays in the CSS below.
  var SEQUENCE_MS = 2650;

  // Shown once per browser session — a guest who reloads or comes back via the
  // back button gets straight to the invite rather than replaying the intro.
  try {
    if (window.sessionStorage && sessionStorage.getItem(SEEN_KEY)) return;
  } catch (e) {
    /* private mode / storage disabled — just play the intro */
  }

  var CSS =
    // --env-w drives every dimension so the whole thing scales as one piece.
    // The third term keeps the envelope inside short viewports (landscape
    // phones): height is width*.667, so capping width at 1.5*66vh caps height
    // at 66vh. Sizes are given as explicit width/height rather than
    // aspect-ratio, which older Safari collapses to a zero-height box.
    '.wenv{--env-w:min(78vw,420px,99vh);' +
      'position:fixed;top:0;right:0;bottom:0;left:0;z-index:2147483647;display:flex;align-items:center;' +
      'justify-content:center;background:#e9e7e2;cursor:pointer;' +
      // The page behind can still be scrolled by a trackpad over a fixed
      // overlay in some browsers; this plus the wheel/touch handlers stop it.
      'overscroll-behavior:none;touch-action:none;' +
      '-webkit-tap-highlight-color:transparent;' +
      'opacity:1;transition:opacity .75s ease .95s}' +
    '.wenv.is-done{opacity:0}' +

    '.wenv__stage{position:relative;display:flex;flex-direction:column;align-items:center;' +
      'gap:clamp(18px,4vh,34px);transform:scale(1);' +
      'transition:transform .8s cubic-bezier(.4,0,.2,1) .9s}' +
    '.wenv.is-done .wenv__stage{transform:scale(1.22)}' +

    // ---- envelope -------------------------------------------------------
    '.wenv__env{position:relative;width:var(--env-w);height:calc(var(--env-w)*.667);' +
      'perspective:1400px;filter:drop-shadow(0 18px 34px rgba(60,52,42,.22))}' +

    // Inside of the envelope, only seen through the opened flap.
    '.wenv__body{position:absolute;top:0;right:0;bottom:0;left:0;z-index:1;border-radius:3px;' +
      'background:linear-gradient(#e6e1d6,#efebe2)}' +

    // The card, sandwiched between the inside and the front pocket.
    '.wenv__card{position:absolute;left:4.5%;top:5%;width:91%;height:90%;z-index:2;' +
      'border-radius:2px;background:linear-gradient(#fdfcfa,#f6f3ed);' +
      'box-shadow:0 2px 10px rgba(60,52,42,.16);' +
      'display:flex;align-items:flex-start;justify-content:center;' +
      'transform:translateY(0);transition:transform .9s cubic-bezier(.33,0,.2,1) .62s}' +
    '.wenv.is-open .wenv__card{transform:translateY(-64%)}' +

    '.wenv__card-inner{text-align:center;color:#4a443c;' +
      'font-family:"Cormorant Garamond",Didot,"Bodoni MT",Garamond,Georgia,serif;' +
      // Only the top ~56% of the card clears the pocket, so the wording is
      // anchored near the card's top edge rather than centred on the card —
      // centred, the date fell below the pocket and was never seen.
      'padding-top:8%}' +
    '.wenv__mono{font-size:clamp(11px,2.4vw,14px);letter-spacing:.42em;' +
      'text-indent:.42em;color:#b08d46;margin-bottom:.55em}' +
    '.wenv__names{font-size:clamp(21px,5.2vw,31px);letter-spacing:.05em;line-height:1.15}' +
    '.wenv__rule{width:44px;height:1px;margin:.7em auto;background:#c8ad74}' +
    '.wenv__date{font-size:clamp(10px,2.2vw,12px);letter-spacing:.34em;' +
      'text-indent:.34em;color:#8b8377}' +

    // Front pocket — drawn over the card so the card reads as sliding out.
    '.wenv__front{position:absolute;top:0;right:0;bottom:0;left:0;z-index:3;border-radius:3px;' +
      'background:linear-gradient(160deg,#f5f2ea,#eae5da);' +
      'box-shadow:inset 0 1px 0 rgba(255,255,255,.8)}' +
    // Faint gold keyline, echoing the site's gold accents.
    '.wenv__front::after{content:"";position:absolute;top:7px;right:7px;bottom:7px;left:7px;border-radius:1px;' +
      'border:1px solid rgba(176,141,70,.28)}' +

    // Top flap: a triangle hinged on the envelope's top edge.
    '.wenv__flap{position:absolute;left:0;top:0;width:100%;height:62%;z-index:4;' +
      'background:linear-gradient(#f7f4ed,#efeae0);' +
      'clip-path:polygon(0 0,100% 0,50% 100%);' +
      'transform-origin:top center;transform:rotateX(0deg);' +
      'transition:transform .95s cubic-bezier(.5,0,.25,1) .2s,z-index 0s linear .68s}' +
    // Once past vertical the flap belongs behind the card, not in front of it.
    '.wenv.is-open .wenv__flap{transform:rotateX(-180deg);z-index:1}' +

    // ---- wax seal -------------------------------------------------------
    // Built from two halves so the break is real geometry rather than a fade.
    '.wenv__seal{position:absolute;left:50%;top:62%;' +
      'width:calc(var(--env-w)*.2);height:calc(var(--env-w)*.2);' +
      'z-index:5;transform:translate(-50%,-50%);' +
      'padding:0;border:0;background:none;cursor:pointer;' +
      '-webkit-tap-highlight-color:transparent}' +
    '.wenv__seal:focus-visible{outline:2px solid #b08d46;outline-offset:6px;border-radius:50%}' +
    '.wenv__half{position:absolute;top:0;height:100%;width:50%;' +
      'background:radial-gradient(120% 120% at 35% 30%,#a8404b,#7d1f2a 62%,#661722);' +
      'box-shadow:inset 0 1px 2px rgba(255,255,255,.28),inset 0 -2px 4px rgba(0,0,0,.32);' +
      'transition:transform .62s cubic-bezier(.36,0,.4,1),opacity .62s ease .12s}' +
    '.wenv__half--l{left:0;border-radius:100% 0 0 100%/50% 0 0 50%}' +
    '.wenv__half--r{right:0;border-radius:0 100% 100% 0/0 50% 50% 0}' +
    '.wenv.is-open .wenv__half--l{transform:translate(-42%,26%) rotate(-34deg);opacity:0}' +
    '.wenv.is-open .wenv__half--r{transform:translate(42%,30%) rotate(38deg);opacity:0}' +
    '.wenv__seal-mono{position:absolute;top:0;right:0;bottom:0;left:0;display:flex;align-items:center;' +
      'justify-content:center;color:rgba(255,236,214,.86);' +
      'font-family:"Cormorant Garamond",Didot,Garamond,Georgia,serif;' +
      'font-size:clamp(12px,2.9vw,17px);letter-spacing:.04em;pointer-events:none;' +
      'transition:opacity .28s ease}' +
    '.wenv.is-open .wenv__seal-mono{opacity:0}' +

    // ---- hint -----------------------------------------------------------
    '.wenv__hint{margin:0;color:#8b8377;font-size:clamp(10px,2.3vw,12px);' +
      'font-family:"Cormorant Garamond",Didot,Garamond,Georgia,serif;' +
      'letter-spacing:.36em;text-indent:.36em;text-transform:uppercase;' +
      'animation:wenv-breathe 2.6s ease-in-out infinite;transition:opacity .3s ease}' +
    '.wenv.is-open .wenv__hint{opacity:0;animation:none}' +
    '@keyframes wenv-breathe{0%,100%{opacity:.35}50%{opacity:.85}}' +

    // Guests who ask for less motion get the envelope, but it simply fades
    // rather than folding, sliding and scaling.
    '@media (prefers-reduced-motion:reduce){' +
      '.wenv,.wenv__stage,.wenv__card,.wenv__flap,.wenv__half,.wenv__seal-mono{' +
        'transition-duration:.25s!important;transition-delay:0s!important}' +
      '.wenv.is-done .wenv__stage{transform:none}' +
      '.wenv.is-open .wenv__card{transform:translateY(0)}' +
      '.wenv.is-open .wenv__flap{transform:rotateX(0deg)}' +
      '.wenv__hint{animation:none;opacity:.7}}';

  var HTML =
    '<div class="wenv__stage">' +
      '<div class="wenv__env">' +
        '<div class="wenv__body"></div>' +
        '<div class="wenv__card"><div class="wenv__card-inner">' +
          '<div class="wenv__mono">Together</div>' +
          '<div class="wenv__names">Abin &amp; Meera</div>' +
          '<div class="wenv__rule"></div>' +
          '<div class="wenv__date">26 . 08 . 2026</div>' +
        '</div></div>' +
        '<div class="wenv__front"></div>' +
        '<div class="wenv__flap"></div>' +
        '<button type="button" class="wenv__seal" aria-label="Open the invitation">' +
          '<span class="wenv__half wenv__half--l"></span>' +
          '<span class="wenv__half wenv__half--r"></span>' +
          '<span class="wenv__seal-mono">A&amp;M</span>' +
        '</button>' +
      '</div>' +
      '<p class="wenv__hint">Tap to open</p>' +
    '</div>';

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
      try { sessionStorage.setItem(SEEN_KEY, "1"); } catch (e) {}

      overlay.classList.add("is-open");
      // is-done drives the final fade/scale; its own CSS delay handles the
      // wait, so it can be set in the same frame as is-open.
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
