/* Completely suppress ChunkLoadError and missing resource errors globally.
   The Canva export has missing dynamic chunks - we need to suppress these
   errors completely so the page can render without waiting for missing files. */
(function () {
  // Suppress ALL console errors related to missing chunks and resources
  var originalError = console.error;
  console.error = function() {
    var args = Array.prototype.slice.call(arguments);
    var message = args.join(' ');
    if (
      message.includes('ChunkLoadError') ||
      message.includes('Failed to load resource') ||
      message.includes('_assets') ||
      message.includes('.map')
    ) {
      return; // Suppress these errors
    }
    return originalError.apply(console, args);
  };

  // Suppress unhandledrejection globally
  window.addEventListener('unhandledrejection', function(event) {
    if (event.reason) {
      var reason = String(event.reason);
      if (
        reason.includes('ChunkLoadError') ||
        reason.includes('Loading chunk') ||
        reason.includes('failed')
      ) {
        event.preventDefault();
      }
    }
  });

  // Suppress error events for missing chunks
  window.addEventListener('error', function(e) {
    if (e && (
      (e.filename && e.filename.includes('_assets/')) ||
      (e.message && e.message.includes('ChunkLoadError'))
    )) {
      e.preventDefault && e.preventDefault();
      return true;
    }
  }, true);
})();

/* Safari-specific image replacement fix.
   Replace media folder image URLs with custom folder URLs. */
(function () {
  var isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);

  if (isSafari) {
    var originalFetch = window.fetch;
    window.fetch = function() {
      var args = Array.prototype.slice.call(arguments);
      if (args[0] && typeof args[0] === 'string') {
        args[0] = args[0]
          .replace('8467e2714c5ea4e324f50a3489dbc008.png', 'custom/auditorium.png')
          .replace('38734efc5828800bfe3ee993e21f1550.png', 'custom/church.png')
          .replace('c852da63dec521c48a58aa96b6db10b1.png', 'custom/couple-1.png')
          .replace('943ae7beed07668ecf162e39ff1904b3.png', 'custom/couple-2.png');
      }
      return originalFetch.apply(window, args);
    };
  }
})();

/* Reception-section structural patch for Abin & Meera's wedding invite.
   The "Reception" block was built by repurposing a leftover Canva dress-code
   template section, which left it with: a duplicate venue address, a stray
   "Venue" label, a time styled as a small body label instead of the big
   decorative time font, and no venue photo / map link (the dress-code
   section never had those elements). This patches the live-rendered DOM
   once, after Canva's own runtime has painted it, to match the clean
   pattern already used by the ceremony/"Location" section.

   Note: Canva regenerates random id/class values on every render, so
   elements here are located by stable text content and by the inline
   "width/height + translate(...)" style Canva uses for its absolutely
   positioned blocks — never by id or class name. */
(function () {
  var CHURCH_MAP_URL = "https://share.google/mj4SUi6sxP5xCDd6x";
  var RECEPTION_MAP_URL = "https://share.google/MA3LIDcFJFWbJuGrc";
  var CALL_PHONE_URL = "tel:+919567882568";

  var calibrations = {};
  function reliableProportional(key, rawValue) {
    // A handful of ticks have measured elements (the "6:30 PM" wrapper's
    // width, the "Reception" heading's x-position) with wildly wrong
    // values — not just the known hidden-measurement-clone case, some
    // other transient render/reflow state. These values track window
    // width roughly proportionally (Canva's per-breakpoint sizing is
    // consistent, at least locally between nearby widths), so calibrate
    // each one once and only accept a fresh measurement if it's close to
    // what that calibration predicts for the current window width;
    // otherwise use the predicted value instead of trusting a possibly-bad
    // fresh reading.
    var winW = window.innerWidth;
    var cal = calibrations[key];
    if (!cal) {
      calibrations[key] = { value: rawValue, winW: winW };
      return rawValue;
    }
    var predicted = cal.value * (winW / cal.winW);
    if (rawValue > predicted * 0.8 && rawValue < predicted * 1.2) {
      calibrations[key] = { value: rawValue, winW: winW };
      return rawValue;
    }
    return predicted;
  }

  function isHiddenMeasurementClone(el) {
    // Canva keeps an invisible "position: absolute; opacity: 0;" duplicate
    // of some text (likely for a11y/measurement) alongside the real,
    // visible element. It matches the same text and the same structural
    // pattern, so anything that walks up to a "translate + width/height"
    // wrapper can accidentally land on the degenerate hidden one instead
    // of the real one — which is what caused a near-zero scale factor to
    // get computed and locked in once.
    var c = el;
    while (c) {
      var s = c.getAttribute && c.getAttribute("style");
      if (s && /opacity:\s*0\b/.test(s) && /position:\s*absolute/.test(s)) return true;
      c = c.parentElement;
    }
    return false;
  }

  function textEls(txt) {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var out = [];
    var n;
    while ((n = walker.nextNode())) {
      if (
        n.parentElement &&
        n.parentElement.tagName !== "SCRIPT" &&
        n.textContent.trim() === txt &&
        !isHiddenMeasurementClone(n.parentElement)
      ) {
        out.push(n.parentElement);
      }
    }
    return out;
  }

  function positionedWrapper(el) {
    var c = el;
    while (c) {
      var s = c.getAttribute && c.getAttribute("style");
      if (s && /width:\s*[\d.]+px/.test(s) && /height:\s*[\d.]+px/.test(s) && /translate\(/.test(s)) return c;
      c = c.parentElement;
    }
    return null;
  }

  function makeButton(href, label, scale) {
    // Canva's own "Open map" pill is an SVG shape (with its own <clipPath>
    // ids) layered behind plain text. Cloning that whole structure ran into
    // Canva's runtime re-processing the duplicate ids/shape unpredictably
    // (it rendered as a blank box, or shrank the text). A plain CSS pill
    // with the same visual values (colors, border, corner radius, font) is
    // simpler and renders reliably, and the whole pill is clickable instead
    // of just the text. Dimensions are design-space values (calibrated at
    // desktop width) multiplied by `scale`, since Canva recomputes its own
    // element sizes per breakpoint rather than using one shared page scale.
    var w = 509 * scale;
    var h = 108 * scale;
    var wrap = document.createElement("div");
    wrap.style.cssText =
      "width: " + w + "px; height: " + h + "px; border-radius: " + h / 2 + "px; background: rgb(248, 248, 247); " +
      "border: " + 2.5 * scale + "px solid rgb(209, 205, 196); display: flex; align-items: center; justify-content: center; box-sizing: border-box;";
    var a = document.createElement("a");
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = label;
    a.style.cssText =
      "font-family: YADSvvPAniY_0, auto; font-size: " + 46.6664 * scale + "px; color: rgb(64, 64, 64); " +
      "text-decoration: none; cursor: pointer; white-space: nowrap;";
    wrap.appendChild(a);
    return wrap;
  }

  function makeRealLink(wrapperEl, href) {
    if (!wrapperEl || wrapperEl.__linked) return;
    var span = wrapperEl.querySelector("span");
    if (!span) return;
    var a = document.createElement("a");
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener";
    a.style.textDecoration = "none";
    a.style.color = "inherit";
    a.style.cursor = "pointer";
    span.parentNode.insertBefore(a, span);
    a.appendChild(span);
    wrapperEl.__linked = true;
  }

  function patch() {
    // This runs on every patch tick, not just once. Canva recomputes each
    // element's box size live (window resize, and apparently sometimes on
    // its own) and can regenerate DOM nodes within the reception section —
    // when that happens, a one-time fix either goes stale (wrong position
    // for the new size) or vanishes entirely (a freshly-created ceremony
    // photo reverts to Canva's own default src; an injected clone/button
    // that isn't part of Canva's own render gets wiped along with the rest
    // of the section's children). So every step below is written to be
    // safely re-appliable: cheap style/src overwrites just happen again,
    // and inserted elements are tagged and re-created only if missing.
    var addressWrappers = textEls("Petrose Convention Centre, Vadayampady").map(positionedWrapper);
    var venueWrapper = positionedWrapper(textEls("Venue")[0]);
    var timeWrapper = positionedWrapper(textEls("6:30 PM")[0]);
    var headingWrapper = positionedWrapper(textEls("Reception")[0]);
    var ceremonyTimeWrapper = positionedWrapper(textEls("3:00 PM")[0]);
    var mapTextWrapper = positionedWrapper(textEls("Open map")[0]);
    // The visible pill/button look ("Open map" text + rounded, bordered
    // background) is two sibling elements — an SVG shape plus the text —
    // grouped one level up. Clone that whole group, not just the text,
    // or the reception copy renders as plain text with no button chrome.
    var mapWrapper = mapTextWrapper ? positionedWrapper(mapTextWrapper.parentElement) : null;
    // Canva serves a different-resolution file (different filename hash) for
    // this same photo depending on viewport/DPR, so matching by filename only
    // works at one screen size. The design's rotation angle is stable across
    // resolutions and unique to this element, so use that as the fingerprint.
    var photoWrapper = Array.from(document.querySelectorAll('div[style*="rotate("]')).find(function (d) {
      var style = d.getAttribute("style") || "";
      // Match rotation angle around -2.77 (flexible for Safari number formatting)
      return /rotate\(-2\.7\d+deg\)/.test(style) && d.querySelector("img") && !d.hasAttribute("data-custom-clone");
    });
    var photoImg = photoWrapper ? photoWrapper.querySelector("img") : null;

    if (!timeWrapper || !headingWrapper || !ceremonyTimeWrapper || !mapWrapper || !photoWrapper) {
      return; // Canva hasn't finished rendering this section yet — retry.
    }

    var receptionSection = timeWrapper.parentNode;
    if (!receptionSection) return;

    // Canva recomputes each element's own box width per breakpoint (mobile
    // isn't just a visual scale-down of the desktop layout — the numbers
    // are genuinely different), but the RATIO between breakpoints is
    // consistent. Everything below was calibrated against the "6:30 PM"
    // wrapper's desktop width (922.111px); multiplying by this ratio makes
    // it adapt to whatever breakpoint is actually rendering.
    var rawScale = parseFloat(timeWrapper.style.width) / 922.111;
    var rawHeadingCenterX =
      parseFloat(headingWrapper.style.transform.match(/translate\(([\d.]+)/)[1]) + parseFloat(headingWrapper.style.width) / 2;

    if (!(rawScale > 0.05 && rawScale < 5) || !isFinite(rawHeadingCenterX)) return; // not a usable reading at all

    var scale = reliableProportional("scale", rawScale);
    var headingCenterX = reliableProportional("headingCenterX", rawHeadingCenterX);

    // 1. Remove the duplicate address and the superfluous "Venue" label
    //    (the "Reception" heading already plays that role, same as "Location" does).
    //    Re-checked every tick in case Canva recreates them after a resize.
    for (var i = 1; i < addressWrappers.length; i++) {
      if (addressWrappers[i]) addressWrappers[i].remove();
    }
    if (venueWrapper) venueWrapper.remove();

    // 2. Restyle "6:30 PM" to match the ceremony's big decorative time font.
    var timeP = timeWrapper.querySelector("p");
    var sourceP = ceremonyTimeWrapper.querySelector("p");
    if (timeP && sourceP) timeP.setAttribute("style", sourceP.getAttribute("style"));
    timeWrapper.style.height = 115 * scale + "px";
    timeWrapper.style.width = 700 * scale + "px";

    // 3. Clone the ceremony's photo block into the reception section (for its
    //    position/rotation/frame styling), then swap in the real photos for
    //    each venue instead of the generic stock image both used to share.
    //    Re-set every tick: if Canva regenerated the ceremony <img>, it
    //    would otherwise silently revert to the generic stock photo.
    photoImg.src = "_assets/custom/church.png";

    var photoClone = receptionSection.querySelector('[data-custom-clone="photo"]');
    if (!photoClone || !photoClone.isConnected) {
      photoClone = photoWrapper.cloneNode(true);
      photoClone.removeAttribute("id");
      photoClone.setAttribute("data-custom-clone", "photo");
      var cloneImg = photoClone.querySelector("img");
      if (cloneImg) cloneImg.src = "_assets/custom/auditorium.png";
      receptionSection.appendChild(photoClone);
    }
    // Centered horizontally under the "Reception" heading (the ceremony's
    // own photo is intentionally off-center for a scrapbook look, but the
    // reception photo should read as centered, matching the button below it).
    var photoWidth = parseFloat(photoClone.style.width);
    photoClone.style.transform =
      "translate(" + (headingCenterX - photoWidth / 2) + "px, " + 620 * scale + "px) rotate(-2.77671deg)";
    // The source photo participates in Canva's own scroll-reveal animation
    // (opacity 0 until it scrolls into view, then animated to 1 by Canva's
    // own controller). cloneNode(true) copies whatever opacity the source
    // happened to be at that instant — if it was mid-reveal (or hasn't been
    // revealed yet), the clone freezes at opacity 0 forever, since it isn't
    // tracked by Canva's reveal system and nothing ever animates it back.
    // Force it visible every tick regardless of the source's own state.
    photoClone.style.opacity = "1";

    // 4. Add a real, working "Open map" button to the reception section,
    //    and make the ceremony's existing one a real link too.
    makeRealLink(mapWrapper, CHURCH_MAP_URL);

    var mapButton = receptionSection.querySelector('[data-custom-clone="map-button"]');
    if (!mapButton || !mapButton.isConnected) {
      mapButton = makeButton(RECEPTION_MAP_URL, "Open map", scale);
      mapButton.setAttribute("data-custom-clone", "map-button");
      mapButton.style.position = "absolute";
      mapButton.style.top = "0";
      mapButton.style.left = "0";
      receptionSection.appendChild(mapButton);
    }
    var btnWidth = 509 * scale;
    mapButton.style.transform = "translate(" + (headingCenterX - btnWidth / 2) + "px, " + 1500 * scale + "px)";
  }

  // The rings clip is a 3D render on a plain white studio background. Dropping
  // that white with mix-blend-mode:multiply is what makes it read as part of
  // the paper rather than a video pasted onto it: white multiplied against any
  // backdrop leaves the backdrop untouched, so the studio background disappears
  // while the gold rings stay gold. This only works while nothing between the
  // video and that backdrop creates its own stacking context, so the clip must
  // NOT sit inside a positioned / z-indexed / opacity'd wrapper.
  //
  // It replaces the calligraphic "and" in the CLOSING lockup, so the sign-off
  // reads Abin — rings — Meera and the rings do the joining literally. Only the
  // closing one: the hero uses the same "and" artwork and keeps it.
  //
  // It previously sat in a band of its own after the last section. That was
  // reachable only by scrolling to the very end, which most guests never do,
  // and it needed half a screen of empty runway to scrub over.
  //
  // The clip is cropped to the rings (2.5:1) so it drops into the gap between
  // the two names — 242px of clear space at desktop — without moving either of
  // them. Cropping also removed the generator's watermark, which sat below the
  // rings and is simply outside the new frame.
  var RINGS_SRC = "rings-inline.mp4";
  var RINGS_ASPECT_FALLBACK = 600 / 240;
  // How much taller than the "and" artwork the rings may be. The names' text
  // boxes carry line-height padding well beyond the glyphs, so the visual gap
  // is larger than the boxes suggest.
  var RINGS_SCALE_VS_AND = 1.5;

  function ringsScroller() {
    // The page does not scroll the window — Canva scrolls a nested container.
    return document.querySelector(".ZRRuDw") || window;
  }

  function ringsClosingParts() {
    // The closing section is the last one, and carries the same Abin / "and" /
    // Meera lockup as the hero. Everything is found by text and geometry, never
    // by class name, since Canva regenerates those on every render.
    var sections = Array.from(document.querySelectorAll("section"));
    if (!sections.length) return null;
    var closing = sections[sections.length - 1];
    if (closing.textContent.indexOf("With Love") === -1) return null;

    var names = Array.from(closing.querySelectorAll("p,span,div")).filter(function (e) {
      return e.children.length === 0 && /^(abin|meera)$/i.test(e.textContent.trim());
    });
    if (names.length < 2) return null;

    var abin = null, meera = null;
    names.forEach(function (e) {
      if (/abin/i.test(e.textContent)) abin = e; else meera = e;
    });
    if (!abin || !meera) return null;

    var ar = abin.getBoundingClientRect(), mr = meera.getBoundingClientRect();
    if (!(ar.height > 10) || !(mr.height > 10)) return null;
    // The "and" is the wide, short image whose centre falls between the two
    // names. Testing that it sits strictly BETWEEN their boxes looks tighter
    // but fails: Canva's text boxes carry line-height padding far past the
    // glyphs, so the artwork overlaps them and the check silently found
    // nothing. Centres are stable.
    var aMid = ar.top + ar.height / 2, mMid = mr.top + mr.height / 2;
    var lo = Math.min(aMid, mMid), hi = Math.max(aMid, mMid);
    var and = Array.from(closing.querySelectorAll("img")).find(function (im) {
      var r = im.getBoundingClientRect();
      if (!(r.width > r.height * 3)) return false;
      var mid = r.top + r.height / 2;
      return mid > lo && mid < hi;
    });
    if (!and) return null;
    return { closing: closing, abin: abin, meera: meera, and: and };
  }

  // Canva leaves a long empty run between the reception's "Open map" button and
  // the couple photos below — about 180px on a phone. This pulls the following
  // section up over most of it. A negative margin on the section is deliberate:
  // the alternative is editing the inline heights Canva writes onto five nested
  // wrappers, which it rewrites on every re-render.
  var GAP_KEEP_FRACTION = 0.11;  // empty space to keep, as a share of viewport
  var GAP_KEEP_MIN = 56;

  function tightenReceptionGap() {
    // Anchored on the "Open map" button, which is genuinely the lowest thing in
    // the section. Measuring the section's lowest mounted child instead looks
    // more robust but is not: Canva mounts contents progressively and patch()
    // builds this button late, so an early reading finds only the "6:30 PM"
    // text, reports ~540px of empty space where there is really ~180px, and
    // over-pulls. Waiting for the button means the gap simply stays as Canva
    // left it until the measurement can be trusted — never a wrong-looking
    // intermediate that has to be walked back on screen.
    var button = document.querySelector('[data-custom-clone="map-button"]');
    if (!button) return;
    var secs = Array.from(document.querySelectorAll("section"));
    var reception = secs.find(function (s) { return s.textContent.indexOf("6:30 PM") !== -1; });
    if (!reception || !reception.contains(button)) return;
    var next = reception.nextElementSibling;
    if (!next || next.tagName !== "SECTION") return;

    var br = button.getBoundingClientRect();
    var nr = next.getBoundingClientRect();
    var sr = reception.getBoundingClientRect();
    if (!(br.height > 4) || !(nr.height > 40) || !(sr.height > 80)) return;

    // Steer towards the target rather than computing it once: the section's
    // own height changes with Canva's breakpoints, and this needs no clearing
    // of the margin to re-measure.
    var keep = Math.max(GAP_KEEP_MIN, window.innerHeight * GAP_KEEP_FRACTION);
    var delta = (nr.top - br.bottom) - keep;
    if (Math.abs(delta) < 4) return;

    var current = parseFloat(next.style.marginTop) || 0;
    // Never push it below where Canva put it, and never pull more than half the
    // section, whatever a bad reading might ask for.
    var wanted = Math.max(-sr.height * 0.5, Math.min(0, current - delta));
    next.style.marginTop = Math.round(wanted) + "px";
  }

  function addRingsAnimation() {
    var parts = ringsClosingParts();
    if (!parts) return; // Canva has not rendered the closing section yet.

    var andRect = parts.and.getBoundingClientRect();
    var closingRect = parts.closing.getBoundingClientRect();
    var abinRect = parts.abin.getBoundingClientRect();
    var meeraRect = parts.meera.getBoundingClientRect();

    var band = parts.closing.querySelector('[data-custom-clone="rings-inline"]');
    var video = band ? band.querySelector("video") : null;

    if (!band || !band.isConnected) {
      band = document.createElement("div");
      band.setAttribute("data-custom-clone", "rings-inline");
      // Absolutely positioned inside the section, exactly as Canva positions
      // its own blocks, so it sits in the lockup without disturbing the flow.
      // No z-index here, deliberately: it would create a stacking context and
      // isolate the video's multiply blend, putting the clip's white studio
      // background back as a visible white box.
      band.style.cssText =
        "position:absolute;display:flex;align-items:center;justify-content:center;" +
        "pointer-events:none;";

      video = document.createElement("video");
      video.src = RINGS_SRC;
      video.muted = true;
      video.loop = false;        // position on screen drives it, not playback
      video.autoplay = false;
      video.preload = "auto";
      video.playsInline = true;  // iOS: never go fullscreen
      video.setAttribute("playsinline", "");
      video.setAttribute("muted", "");
      video.setAttribute("aria-hidden", "true");
      video.style.cssText = "display:block;mix-blend-mode:multiply;pointer-events:none;";

      band.appendChild(video);
      // The "and" artwork stays in the DOM, just hidden — restoring it is one
      // line if the rings ever need to come out.
      parts.and.style.visibility = "hidden";
      // Held by the section, with the section made its containing block. The
      // two alternatives both failed: left in the scroll container's coordinate
      // space the rings were invisible on phones, and hung off the "and"
      // image's own parent they were clipped by its overflow and their multiply
      // blend was isolated by its stacking context — the white studio
      // background came back as a visible box.
      if (getComputedStyle(parts.closing).position === "static") {
        parts.closing.style.position = "relative";
      }
      parts.closing.appendChild(band);
    }
    parts.and.style.visibility = "hidden";

    // Sized from the "and" artwork it replaces rather than from a computed gap:
    // the "and" is 5:1 and the rings 2.5:1, so matching its box exactly would
    // leave them tiny, but it is a reliable anchor where the gap is not.
    if (!(andRect.height > 10) || !(closingRect.width > 60)) return;

    var aspect = (video.videoWidth && video.videoHeight)
      ? video.videoWidth / video.videoHeight
      : RINGS_ASPECT_FALLBACK;
    var h = andRect.height * RINGS_SCALE_VS_AND;
    var w = h * aspect;
    // Never wider than the longer name, so the lockup stays a column.
    var maxW = Math.max(abinRect.width, meeraRect.width);
    if (w > maxW) { w = maxW; h = w / aspect; }

    // Place once per layout, never during scrolling.
    //
    // The band lives inside the section and so travels with it for free; the
    // names beside it are pure page scroll and move perfectly smoothly. Any
    // rewriting of left/top while a guest is scrolling competes with that.
    // Comparing rounded values was not enough: Canva re-renders sections as they
    // virtualise in and out, which nudges the measured rects a pixel or two, and
    // every nudge became a visible jump against otherwise smooth motion.
    //
    // The layout only genuinely changes when the breakpoint does, so key on the
    // viewport width and on the "and" artwork's own height — Canva resizes that
    // with its breakpoints — and skip everything otherwise.
    var layoutKey = window.innerWidth + ":" + Math.round(andRect.height);
    if (band.__layoutKey === layoutKey) {
      ringsScrub(band, video);
      // This tick only runs when nothing is scrolling, which makes it the right
      // moment to re-take the scrub's measurements — the page's height keeps
      // changing as the patches above settle.
      if (band.__scrubMeasure) band.__scrubMeasure();
      return;
    }
    band.__layoutKey = layoutKey;
    band.__scrubGeom = null;

    video.style.width = w + "px";
    video.style.height = "auto";
    band.style.width = Math.round(w) + "px";
    band.style.height = Math.round(h) + "px";

    // Centred horizontally on the "and" artwork, and vertically on the midpoint
    // between the two names — the artwork itself sits high in the gap, so
    // matching it left the rings closer to "Abin" than to "Meera".
    var midX = andRect.left + andRect.width / 2;
    var midY = ((abinRect.top + abinRect.height / 2) +
                (meeraRect.top + meeraRect.height / 2)) / 2;
    band.style.left = Math.round(midX - closingRect.left - w / 2) + "px";
    band.style.top = Math.round(midY - closingRect.top - h / 2) + "px";

    ringsScrub(band, video);
    if (band.__scrubMeasure) band.__scrubMeasure();
  }

  function ringsScrub(band, video) {
    // Scrolling down runs the rings together, scrolling back up separates them.
    // The clip is encoded with every frame a keyframe so seeking lands anywhere
    // cheaply — a normal encode has about six and would snap between them.
    //
    // It completes as the lockup arrives at the middle of the screen, NOT at the
    // very bottom of the page. Finishing at the bottom made sense when the clip
    // was a standalone finale, but as part of a sign-off the rings need to be
    // resolved while the guest is actually reading it — otherwise Abin and Meera
    // are joined by two rings frozen mid-tumble. It also means no runway of
    // empty space is needed after the section any more.
    if (band.__scrubBound) return;
    band.__scrubBound = true;

    var scroller = ringsScroller();
    var queued = false;
    var primed = false;

    function apply() {
      queued = false;
      var d = video.duration;
      if (!d || !isFinite(d)) return;
      // Cheap and guarded: any scroll will prime the decoder if the load event
      // did not manage it, which matters only on iOS but costs nothing else.
      if (!primed) prime();
      var win = scroller === window;
      var scrollTop = win ? window.pageYOffset : scroller.scrollTop;

      // Read nothing but scrollTop while scrolling. Where the band sits in the
      // page, how tall it is and how far the page scrolls are all fixed until
      // the layout changes, so they are measured on the idle tick instead
      // (see measure() below). Calling getBoundingClientRect here forced a
      // layout on every scroll frame, on the same main thread that has to
      // repaint the blended video — so the measuring was itself part of what
      // made the rings stutter.
      var m = band.__scrubGeom;
      if (!m) {
        measure();
        m = band.__scrubGeom;
        if (!m) return;
      }

      // Run from the rings entering the screen to whichever comes FIRST: them
      // reaching centre screen, or the page running out of scroll. On a phone
      // the closing section is short and last, so there is not enough scroll
      // left to bring the lockup to the middle — mapping only to centre left
      // the rings almost, but never quite, joined at the bottom of the page.
      var start = m.top0 - m.vh;
      var end = Math.min(m.top0 - (m.vh / 2 - m.height / 2), m.maxScroll);
      var p = (end - start) > 8 ? (scrollTop - start) / (end - start) : 1;
      p = Math.max(0, Math.min(1, p));
      seekTo(p * d);
    }

    // Only ever one seek in flight: issue one, keep only the most recent target
    // while it runs, and go to that target the moment it completes.
    //
    // Assigning currentTime again while a seek is still running does not queue,
    // it abandons the one in flight and starts over, so the old code could keep
    // restarting the decoder without it ever landing. Measured on desktop a seek
    // completes in about 1.7ms and this changes nothing there — it is insurance
    // for slower hardware, where the seek can outlast the frame that asked for
    // it. Note this is NOT what was making the rings judder; that was measured
    // and ruled out.
    var seeking = false;
    var wanted = null;

    function seekTo(t) {
      if (seeking) {
        wanted = t;
        return;
      }
      var d = video.duration;
      if (Math.abs(t - video.currentTime) <= d / 240) return; // already there
      seeking = true;
      try {
        video.currentTime = t;
      } catch (e) {
        seeking = false;
      }
    }

    function seekDone() {
      seeking = false;
      if (wanted === null) return;
      var t = wanted;
      wanted = null;
      seekTo(t);
    }
    video.addEventListener("seeked", seekDone);
    // A seek that fails leaves no "seeked" event behind, which would wedge the
    // scrub permanently; these release it.
    video.addEventListener("error", seekDone);
    video.addEventListener("stalled", seekDone);
    // Everything the scrub needs that is not scrollTop. Re-taken on the idle
    // tick, so it stays correct as Canva re-renders and as the patches above
    // change the page's height — but never during a scroll.
    function measure() {
      var win = scroller === window;
      var r = band.getBoundingClientRect();
      if (!(r.height > 0)) return;
      var vh = (win ? window.innerHeight : scroller.clientHeight) || window.innerHeight;
      var scrollTop = win ? window.pageYOffset : scroller.scrollTop;
      band.__scrubGeom = {
        top0: scrollTop + r.top - (win ? 0 : scroller.getBoundingClientRect().top),
        height: r.height,
        vh: vh,
        maxScroll: win
          ? (document.documentElement.scrollHeight - vh)
          : (scroller.scrollHeight - scroller.clientHeight)
      };
    }
    band.__scrubMeasure = measure;

    function onScroll() {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(apply);
    }

    scroller.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", function () {
      band.__scrubGeom = null;
      onScroll();
    }, { passive: true });
    if (video.readyState >= 1) apply();
    else video.addEventListener("loadedmetadata", apply, { once: true });

    // iOS renders nothing at all for a video that has never played, so a
    // scrubbed-only clip stays blank there however correctly it is positioned.
    // Playing and pausing immediately primes the decoder without anything being
    // seen to play.
    //
    // This used to wait for the envelope's "am:opened" tap. That was wrong: the
    // band is only built once the closing section mounts, which is long after
    // the envelope has gone, so the listener was attached to an event that had
    // already fired and never ran. A muted video needs no gesture on iOS, so
    // prime as soon as there is data — with the gesture listeners kept only as
    // a fallback for anywhere that refuses.
    function prime() {
      if (primed || !video) return;
      primed = true;
      var pr = video.play();
      if (pr && pr.then) pr.then(function () { video.pause(); apply(); })
                           .catch(function () { primed = false; });
      else { video.pause(); apply(); }
    }
    if (video.readyState >= 2) prime();
    else video.addEventListener("loadeddata", prime, { once: true });
    document.addEventListener("touchend", prime);
    document.addEventListener("click", prime);
  }

  function removeWishesSection() {
    // Drop the leftover "wishes/our families" section (couple photos +
    // "It would mean the world to us..." + the date) entirely, so the page
    // goes straight from the Reception "Call" block to the closing
    // "With Love and Blessings" section, with no empty gap in between.
    if (window.__wishesRemoved) return;
    var sections = document.querySelectorAll("section");
    for (var i = 0; i < sections.length; i++) {
      if (sections[i].textContent.indexOf("It would mean the world to us") !== -1) {
        window.__wishesRemoved = true;
        sections[i].remove();
        return;
      }
    }
  }

  function swapIntroCoupleImages() {
    // The two generic stock "couple" photos under the "Together with their
    // families..." intro text, replaced with the real couple photos. Same
    // resolution-swap issue as the ceremony/reception photos (Canva serves
    // a different file per viewport/DPR), so match by each photo's stable
    // design rotation angle rather than by filename. Re-applied every tick
    // in case Canva ever regenerates these <img> elements.
    [
      { rotation: "-6.05501deg", src: "_assets/custom/couple-1.png" },
      { rotation: "9.5948deg", src: "_assets/custom/couple-2.png" },
    ].forEach(function (pair) {
      var wrapper = Array.from(document.querySelectorAll('div[style*="rotate(' + pair.rotation + ')"]')).find(function (d) {
        return d.querySelector("img");
      });
      var img = wrapper ? wrapper.querySelector("img") : null;
      if (img && img.src.indexOf(pair.src) === -1) img.src = pair.src;
    });
  }

  function addCallLink() {
    // The "Call" pill is Canva decorative text/shape with no real link
    // (same as "Open map" originally) — wrap it in a real tel: link.
    if (window.__callLinked) return;
    var p = Array.from(document.querySelectorAll("p")).find(function (el) {
      return el.textContent.trim() === "Call";
    });
    var wrapper = p ? positionedWrapper(p) : null;
    if (!wrapper) return;
    window.__callLinked = true;
    makeRealLink(wrapper, CALL_PHONE_URL);
  }

  function fitHeadingOneLine(text) {
    // "Before the wedding" sits in the same fixed-size text box as the
    // single-word headings ("Location", "Reception"), but at this font
    // size the phrase is just slightly wider than the box, so it wraps to
    // a second line. Shrink the font just enough to fit on one line.
    //
    // This must be fully re-evaluated on every call (not just once ever):
    // Canva recomputes the box width live on window resize, so a value
    // that fit at one window size can wrap at another. It always resets to
    // the ORIGINAL font-size first before measuring, so repeated calls
    // don't compound a shrink on top of a previous shrink.
    var p = Array.from(document.querySelectorAll("p")).find(function (el) {
      return el.textContent.trim() === text;
    });
    if (!p) return;

    if (!p.__origFontSize) {
      // Cache the pristine values once, from the very first real (already
      // fits-or-not, doesn't matter) measurement, so later calls always
      // shrink from the true original — never from an already-shrunk size.
      p.__origFontSize = getComputedStyle(p).fontSize;
      p.__origLineHeight = getComputedStyle(p).lineHeight;
    }
    p.style.fontSize = p.__origFontSize;
    p.style.setProperty("--H97cbQ", p.__origFontSize);
    p.style.lineHeight = p.__origLineHeight;

    var originalWhiteSpace = p.style.whiteSpace;
    p.style.whiteSpace = "nowrap";
    var naturalWidth = p.scrollWidth;
    var containerWidth = p.parentElement.getBoundingClientRect().width;
    // getBoundingClientRect is post-scale (visual px); scrollWidth is
    // pre-scale (layout px). Recover the container's own layout width by
    // reading the ancestor scale factor, so both sides compare fairly.
    var scaleMatch = "";
    var c = p;
    while (c) {
      var s = c.getAttribute && c.getAttribute("style");
      if (s && /scale\(/.test(s)) {
        scaleMatch = /scale\(([\d.]+)/.exec(s);
        break;
      }
      c = c.parentElement;
    }
    var scale = scaleMatch ? parseFloat(scaleMatch[1]) : 1;
    var containerLayoutWidth = containerWidth / scale;
    p.style.whiteSpace = originalWhiteSpace;

    if (naturalWidth <= containerLayoutWidth) return; // fits at original size

    var ratio = (containerLayoutWidth / naturalWidth) * 0.97; // small safety margin
    var currentSize = parseFloat(p.__origFontSize);
    var currentLineHeight = parseFloat(p.__origLineHeight);
    p.style.setProperty("--H97cbQ", currentSize * ratio + "px");
    p.style.fontSize = currentSize * ratio + "px";
    if (!isNaN(currentLineHeight)) p.style.lineHeight = currentLineHeight * ratio + "px";
  }

  function runPatches() {
    patch();
    removeWishesSection();
    addCallLink();
    fitHeadingOneLine("Before the wedding");
    swapIntroCoupleImages();
    tightenReceptionGap();
    addRingsAnimation();
  }

  // Never run any of this while a scroll is in flight.
  //
  // runPatches() walks the whole document for text and then reads layout dozens
  // of times. Canva's own text scrolls on the compositor and never notices that.
  // Anything that has to be painted on the main thread every frame does, and on
  // Safari the blended rings video is exactly that.
  //
  // Measured on desktop this costs nothing — frame pacing is a flat 60fps with
  // the timer running — so it is not proven to be what made the rings judder on
  // a phone. But it is real main-thread work landing on a fixed cadence during
  // scrolling, for no benefit: the patches are idempotent and exist to catch
  // Canva re-rendering, which does not happen mid-scroll. So they are held back
  // until scrolling settles.
  var scrolling = false;
  var scrollIdle = 0;
  var missed = false;

  function onUserScroll() {
    scrolling = true;
    clearTimeout(scrollIdle);
    scrollIdle = setTimeout(function () {
      scrolling = false;
      if (missed) {
        missed = false;
        runPatches();
      }
    }, 180);
  }

  function patchesWhenIdle() {
    if (scrolling) {
      missed = true;
      return;
    }
    runPatches();
  }

  // Capture, because scroll does not bubble and the page scrolls in a nested
  // container that does not exist yet when this runs.
  document.addEventListener("scroll", onUserScroll, true);
  window.addEventListener("wheel", onUserScroll, { passive: true });
  window.addEventListener("touchmove", onUserScroll, { passive: true });

  setInterval(patchesWhenIdle, 300);
  if (window.MutationObserver) {
    // Coalesced to one run per frame. It used to call runPatches synchronously
    // for every mutation batch — while runPatches itself mutates the DOM, so it
    // was re-entering itself and could fire far more often than the timer.
    var moQueued = false;
    new MutationObserver(function () {
      if (moQueued) return;
      moQueued = true;
      requestAnimationFrame(function () {
        moQueued = false;
        patchesWhenIdle();
      });
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
  document.addEventListener("DOMContentLoaded", runPatches);
  window.addEventListener("load", runPatches);
})();
