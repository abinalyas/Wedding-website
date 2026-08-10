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

/* Safety net for the WebP images.

   Every image on the page ships as WebP rather than PNG, which is simply the
   wrong container for photographs and for the large soft-gradient artwork Canva
   exported. The six custom photographs go 4.61MB -> 0.59MB, and Canva's own
   media 14.25MB -> 3.46MB. That is far and away the biggest reason the page was
   slow to show anything on a phone: the paper texture alone, painted by every
   section, was 1.68MB and is 27KB as WebP.

   Every original PNG is still in the repo, so if a WebP ever fails to load — an
   old browser, a bad transfer, some behaviour of Canva's runtime not anticipated
   here — fall straight back to the PNG rather than leaving a hole in the page.

   Capture phase, because "error" from an <img> does not bubble. */
(function () {
  document.addEventListener("error", function (e) {
    var el = e && e.target;
    if (!el || el.tagName !== "IMG") return;
    var src = el.getAttribute("src") || "";
    if (src.indexOf(".webp") === -1) return;
    if (src.indexOf("custom/") === -1 && src.indexOf("media/") === -1) return;
    if (el.__webpFellBack) return;   // only ever swap once
    el.__webpFellBack = true;
    el.src = src.replace(/\.webp(\?|$)/, ".png$1");
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
          .replace('8467e2714c5ea4e324f50a3489dbc008.png', 'custom/auditorium.webp')
          .replace('38734efc5828800bfe3ee993e21f1550.png', 'custom/church.webp')
          .replace('c852da63dec521c48a58aa96b6db10b1.png', 'custom/couple-1.webp')
          .replace('943ae7beed07668ecf162e39ff1904b3.png', 'custom/couple-2.webp');
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

  function boxIn(section, el) {
    // An element's rendered box expressed in `section`'s own coordinate space —
    // the space Canva's translate() uses for absolutely positioned children.
    //
    // Everything that positions the date lines goes through this, because
    // mixing the two spaces is what broke the first two attempts: style.height
    // and style.width are in Canva's DESIGN units (the time box declares 89)
    // while translate() is in rendered pixels (that same box is 26 tall on a
    // phone), and adding one to the other put the date 145px too low, straight
    // through the photo.
    if (!section || !el) return null;
    var s = section.getBoundingClientRect();
    var r = el.getBoundingClientRect();
    if (!(r.width > 0) && !(r.height > 0)) return null;
    return {
      top: r.top - s.top,
      bottom: r.bottom - s.top,
      height: r.height,
      centerX: (r.left + r.width / 2) - s.left
    };
  }

  function ensureDateLine(section, key, text, anchor, centerX, scale) {
    // The wedding and the reception fall on different days — 24 and 26 August —
    // but Canva's design carries one date, in the hero, and each event section
    // shows only a time. Without a date beside each time a guest reading the
    // ceremony section has no way to know it is not on the headline date.
    //
    // This is a new element rather than an edit to Canva's own text, and that
    // is deliberate. Folding the date into the time string ("24 Aug · 2:00 PM")
    // was tried first and broke the section: once the text is long enough to
    // wrap, Canva splits it into one text node per line, textEls() matches a
    // single text node and so found nothing, and patch() bailed out entirely —
    // taking the map button, the venue photo and the time's decorative font
    // with it. Owning the element outright avoids every one of those couplings.
    if (!section || !anchor) return;
    var el = section.querySelector('[data-custom-clone="' + key + '"]');
    if (!el || !el.isConnected) {
      el = document.createElement("div");
      el.setAttribute("data-custom-clone", key);
      el.style.position = "absolute";
      el.style.top = "0";
      el.style.left = "0";
      section.appendChild(el);
    }
    if (el.textContent !== text) el.textContent = text;

    // Sized from the time's own rendered text so the date is always a fixed
    // fraction of it, at any breakpoint, rather than from a design-space
    // constant that would need its own scale conversion.
    var a = boxIn(section, anchor);
    if (!a || !(a.height > 0) || !isFinite(centerX)) return;

    var fs = Math.max(11, a.height * 0.46);
    var w = section.getBoundingClientRect().width * 0.9;
    el.style.width = w + "px";
    el.style.textAlign = "center";
    el.style.whiteSpace = "nowrap";
    el.style.fontFamily = "YADSvvPAniY_0, auto";
    el.style.fontSize = fs + "px";
    el.style.lineHeight = 1.2;
    el.style.color = "rgb(64, 64, 64)";
    el.style.transform =
      "translate(" + (centerX - w / 2) + "px, " + (a.bottom + fs * 0.35) + "px)";
  }

  function shiftDownOnce(el, delta) {
    // Idempotent: patch() runs every tick, so the shift already applied is
    // remembered and the element is moved relative to its ORIGINAL y, never
    // relative to wherever the last tick left it. Without that it would creep
    // down the page a little further every 300ms.
    if (!el) return;
    var applied = parseFloat(el.getAttribute("data-date-shift") || "0");
    if (Math.abs(applied - delta) < 0.5) return;
    var m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(el.style.transform || "");
    if (!m) return;
    var baseY = parseFloat(m[2]) - applied;
    el.style.transform = el.style.transform.replace(
      /translate\([-\d.]+px,\s*[-\d.]+px\)/,
      "translate(" + parseFloat(m[1]) + "px, " + (baseY + delta) + "px)"
    );
    el.setAttribute("data-date-shift", String(delta));
  }

  function makeRoomForDateLine(section, dateEl, blockers, clearance) {
    if (!section || !dateEl) return;
    var d = boxIn(section, dateEl);
    if (!d || !(d.height > 0)) return;

    // How far the things below the date must move for it to clear them,
    // measured against where each would sit UNSHIFTED so the answer is the same
    // on every tick instead of compounding its own last correction.
    var need = 0;
    for (var i = 0; i < blockers.length; i++) {
      var b = blockers[i];
      if (!b) continue;
      var r = boxIn(section, b);
      if (!r) continue;
      var applied = parseFloat(b.getAttribute("data-date-shift") || "0");
      // Skip only what finishes above the date. Testing the blocker's TOP was
      // wrong: the photo's wrapper carries its tilted frame and shadow, so it
      // starts a few pixels higher than the date even while overlapping it.
      if (r.bottom - applied <= d.top) continue;
      need = Math.max(need, d.bottom + clearance - (r.top - applied));
    }
    need = Math.max(0, Math.round(need));

    for (var j = 0; j < blockers.length; j++) shiftDownOnce(blockers[j], need);

    // Grow the section to match, or the button is pushed out through the
    // bottom edge. The base is captured once, before anything has moved.
    var base = parseFloat(section.getAttribute("data-base-height") || "0");
    if (!base) {
      base = section.getBoundingClientRect().height;
      section.setAttribute("data-base-height", String(base));
    }
    section.style.minHeight = (base + need) + "px";
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
    var ceremonyTimeWrapper = positionedWrapper(textEls("2:00 PM")[0]);
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

    // 2. Restyle the reception time to match the ceremony's big decorative font.
    var timeP = timeWrapper.querySelector("p");
    var sourceP = ceremonyTimeWrapper.querySelector("p");
    if (timeP && sourceP) timeP.setAttribute("style", sourceP.getAttribute("style"));
    timeWrapper.style.height = 115 * scale + "px";
    timeWrapper.style.width = 700 * scale + "px";

    // 2b. A date beside each time, since the two events are on different days.
    //     The ceremony's line is centred on its own time box; the reception's
    //     on the "Reception" heading, the same anchor its photo and map button
    //     already use — its time box is deliberately left off-centre by the
    //     width it is given above.
    var ceremonySection = ceremonyTimeWrapper.parentNode;
    var ceremonyTimeBox = boxIn(ceremonySection, ceremonyTimeWrapper);
    var receptionHeadingBox = boxIn(receptionSection, headingWrapper);
    if (ceremonyTimeBox) {
      ensureDateLine(ceremonySection, "ceremony-date", "24 August 2026",
                     ceremonyTimeWrapper, ceremonyTimeBox.centerX, scale);
    }
    if (receptionHeadingBox) {
      ensureDateLine(receptionSection, "reception-date", "26 August 2026",
                     timeWrapper, receptionHeadingBox.centerX, scale);
    }

    //     Canva packs this section tightly — on a 375px phone there are 9px
    //     between the address and the time and 22px between the time and the
    //     photo — so the ceremony's date landed on the photo's white frame with
    //     a pearl in the gap. Make room by moving the photo and its button down
    //     by however much is actually needed, measured rather than assumed so it
    //     holds at every breakpoint, and grow the section to match so the shift
    //     does not push the button out of the bottom.
    makeRoomForDateLine(
      ceremonyTimeWrapper.parentNode,
      ceremonyTimeWrapper.parentNode.querySelector('[data-custom-clone="ceremony-date"]'),
      [photoWrapper, mapWrapper],
      18 * scale
    );

    // 3. Clone the ceremony's photo block into the reception section (for its
    //    position/rotation/frame styling), then swap in the real photos for
    //    each venue instead of the generic stock image both used to share.
    //    Re-set every tick: if Canva regenerated the ceremony <img>, it
    //    would otherwise silently revert to the generic stock photo.
    photoImg.src = "_assets/custom/church.webp";

    var photoClone = receptionSection.querySelector('[data-custom-clone="photo"]');
    if (!photoClone || !photoClone.isConnected) {
      photoClone = photoWrapper.cloneNode(true);
      photoClone.removeAttribute("id");
      // cloneNode copies the ceremony photo's shift bookkeeping too, which
      // would make the clone look pre-shifted to any later measurement.
      photoClone.removeAttribute("data-date-shift");
      photoClone.setAttribute("data-custom-clone", "photo");
      var cloneImg = photoClone.querySelector("img");
      if (cloneImg) cloneImg.src = "_assets/custom/auditorium.webp";
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
  // the invite rather than a video pasted onto it: white multiplied against any
  // backdrop leaves the backdrop untouched, so the studio background disappears
  // into whatever is behind it while the gold rings stay gold. This only works
  // while nothing between the video and that backdrop creates its own stacking
  // context, so the clip must NOT sit inside a positioned / z-indexed /
  // opacity'd wrapper.
  //
  // It sits in a band of its own between the reception and details sections —
  // below the reception's "Open map" button, above the couple photos.
  //
  // An earlier version overlaid it inside a section instead, using a negative
  // margin so it took no layout height, which avoided the band's background
  // having to match anything. That worked on desktop and failed completely on
  // phones: Canva's sections are far shorter relative to their width there (the
  // ceremony section is 681px tall at 375px wide, against 2298px at desktop),
  // so the free space inside them collapses to about 38px and there is simply
  // nowhere to overlay. Worse, the old code bailed out when the space was too
  // small WITHOUT having styled the video, leaving it at its intrinsic 1088px
  // on a 375px screen. Hence a real band, and a background sampled to match.
  var RINGS_SRC = "rings-scroll.mp4";
  var RINGS_WIDTH_FRACTION = 0.46;  // clip width, as a share of the band's width
  var RINGS_BAND_PADDING = 0.16;    // vertical breathing room, as a share of clip height
  var RINGS_FALLBACK_BG = "#efece6";
  // How much of a screen the rings get to play over. A full screen read as
  // dead space and risked guests stopping before they reached the bottom, so
  // the band is a little over half a screen: the rings come into view sooner,
  // the closing section stays visible above them, and the scrub still has
  // enough travel not to snap.
  var RINGS_RUNWAY = 0.55;

  // Phones get their own treatment. The runway is the band's height, and with
  // the clip centred in it half of that height lands as blank paper between
  // "Meera" and the rings — 215px on a 375x812 phone, which reads as the page
  // having ended. Three things change here, none of which cost much travel:
  //
  //   - a slightly shorter band,
  //   - the clip sitting high in it rather than centred, so the runway is blank
  //     space BELOW the rings, at the very end of the page, where it is just
  //     the bottom margin instead of a gap in the middle of the sign-off,
  //   - the scrub finishing a little before the true bottom, so a guest who
  //     stops a thumb's width short still sees the rings meet.
  var RINGS_PHONE_MAX_W = 820;
  var RINGS_RUNWAY_PHONE = 0.32;
  var RINGS_CLIP_BIAS_PHONE = 0.20;  // share of the band's spare height above the clip
  var RINGS_FINISH_EARLY_PHONE = 0.10;  // of a screen, before the page truly ends

  function ringsIsPhone() {
    return window.innerWidth <= RINGS_PHONE_MAX_W;
  }

  function ringsScroller() {
    // The page does not scroll the window — Canva scrolls a nested container.
    return document.querySelector(".ZRRuDw") || window;
  }

  function ringsSectionTexture(section) {
    // Every Canva section paints its own full-bleed copy of the paper texture.
    // Finding it lets the band be given the same paper rather than a guess.
    var sr = section.getBoundingClientRect();
    if (!(sr.width > 0)) return null;
    return Array.from(section.querySelectorAll("img")).find(function (im) {
      var r = im.getBoundingClientRect();
      return r.width >= sr.width * 0.9 && r.height >= sr.height * 0.5;
    }) || null;
  }

  function ringsSampleColour(img) {
    // Read the texture's average colour straight out of the image, so the band
    // matches the sections exactly instead of relying on a hardcoded cream that
    // drifts as soon as anything about the artwork changes. Same-origin, so the
    // canvas is not tainted.
    try {
      if (!img.complete || !img.naturalWidth) return null;
      var c = document.createElement("canvas");
      c.width = 8; c.height = 8;
      var ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0, 8, 8);
      var d = ctx.getImageData(0, 0, 8, 8).data;
      var r = 0, g = 0, b = 0, n = 0;
      for (var i = 0; i < d.length; i += 4) { r += d[i]; g += d[i+1]; b += d[i+2]; n++; }
      return "rgb(" + Math.round(r/n) + "," + Math.round(g/n) + "," + Math.round(b/n) + ")";
    } catch (e) {
      return null;
    }
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
    // The band closes the invitation: it is the last thing on the page, so the
    // rings come together exactly as a guest reaches the bottom. Sitting it
    // mid-page meant the animation finished as the band left the top of the
    // screen, which is well before anyone had finished reading.
    var sections = Array.from(document.querySelectorAll("section"));
    if (!sections.length) return; // Canva has not rendered yet.
    var host = sections[sections.length - 1];

    var band = document.querySelector('[data-custom-clone="rings-band"]');
    var video = band ? band.querySelector("video") : null;

    if (!band || !band.isConnected) {
      band = document.createElement("div");
      band.setAttribute("data-custom-clone", "rings-band");
      // flex-start rather than centre: where the clip sits inside the band is
      // set below, since on a phone it is deliberately not centred.
      band.style.cssText =
        "width:100%;display:flex;align-items:flex-start;justify-content:center;" +
        "overflow:hidden;background:" + RINGS_FALLBACK_BG + ";";

      video = document.createElement("video");
      video.src = RINGS_SRC;
      video.muted = true;
      video.loop = false;          // driven by scroll position, not by playback
      video.autoplay = false;
      video.preload = "auto";
      video.playsInline = true;    // iOS: never go fullscreen
      video.setAttribute("playsinline", "");
      video.setAttribute("muted", "");
      video.setAttribute("aria-hidden", "true");

      band.appendChild(video);
      host.parentNode.insertBefore(band, host.nextSibling);
    }

    var bandWidth = band.getBoundingClientRect().width;
    if (!(bandWidth > 80)) return; // not laid out yet

    // Size from the band's WIDTH, which tracks the viewport predictably, rather
    // than from a share of a section's height — that is what broke on phones.
    var aspect = (video.videoWidth && video.videoHeight)
      ? video.videoWidth / video.videoHeight
      : 560 / 374;
    var clipWidth = bandWidth * RINGS_WIDTH_FRACTION;
    var clipHeight = clipWidth / aspect;

    video.style.cssText =
      "width:" + clipWidth + "px;height:auto;display:block;" +
      "mix-blend-mode:multiply;pointer-events:none;";

    // The band is the scrub's runway. As the last element on the page nothing
    // can be scrolled past it, so its height IS the travel the five seconds
    // play over — a band only as tall as the clip would compress them into
    // 150px and snap.
    var sc = ringsScroller();
    var viewportH = (sc === window ? window.innerHeight : sc.clientHeight)
      || window.innerHeight;
    var phone = ringsIsPhone();
    var bandH = Math.round(viewportH * (phone ? RINGS_RUNWAY_PHONE : RINGS_RUNWAY));
    band.style.height = bandH + "px";

    // Where the clip sits in that height. On a phone, high up, so the spare
    // height falls below the rings rather than between them and "Meera".
    //
    // On a desktop, left exactly as it was: centred. Not merely for consistency
    // — at 1350px the clip works out taller than the band (415px against 350px)
    // and is cropped by the band's overflow, so centring is what keeps that crop
    // even top and bottom. Aligning to the top there would quietly take the
    // whole crop out of the bottom of the rings.
    if (phone) {
      var spare = Math.max(0, bandH - clipHeight);
      band.style.alignItems = "flex-start";
      band.style.paddingTop = Math.round(spare * RINGS_CLIP_BIAS_PHONE) + "px";
      band.style.boxSizing = "border-box";
    } else {
      band.style.alignItems = "center";
      band.style.paddingTop = "0px";
    }

    // Match the band to the paper it sits between. Sampled once and remembered,
    // since it cannot change without the artwork changing.
    if (!band.__bgSet) {
      var tex = ringsSectionTexture(host);
      if (tex) {
        var colour = ringsSampleColour(tex);
        if (colour) {
          band.style.backgroundColor = colour;
          // The same texture at the same rendered scale, so the band carries the
          // paper's grain and not just its colour.
          var tr = tex.getBoundingClientRect();
          band.style.backgroundImage = "url('" + tex.getAttribute("src") + "')";
          band.style.backgroundSize = Math.round(tr.width) + "px " + Math.round(tr.height) + "px";
          band.style.backgroundPosition = "center center";
          band.style.backgroundRepeat = "no-repeat";
          band.__bgSet = true;
        }
      }
    }

    ringsScrub(band, video);
  }

  function ringsScrub(band, video) {
    // Scrub the clip from the band's travel through the viewport: scrolling down
    // runs the rings forward, scrolling up runs them backward. The clip is
    // encoded with every frame a keyframe so seeking lands anywhere cheaply — a
    // normal encode has about six keyframes and would snap between them.
    if (band.__scrubBound) return;
    band.__scrubBound = true;

    var scroller = ringsScroller();
    var queued = false;

    function apply() {
      queued = false;
      var d = video.duration;
      if (!d || !isFinite(d)) return;
      // Run from the moment the band first appears to the moment the page can
      // scroll no further, so the rings meet exactly as a guest reaches the
      // bottom. The old mapping finished when the band cleared the TOP of the
      // screen — as the last element it never does, so the rings would have
      // stopped part-joined; mid-page it meant they joined far too early.
      var p;
      var win = scroller === window;
      var vh = win ? window.innerHeight : scroller.clientHeight;
      var maxScroll = win
        ? (document.documentElement.scrollHeight - vh)
        : (scroller.scrollHeight - scroller.clientHeight);
      var scrollTop = win ? window.pageYOffset : scroller.scrollTop;
      var r = band.getBoundingClientRect();
      var bandTop = scrollTop + r.top - (win ? 0 : scroller.getBoundingClientRect().top);
      var start = bandTop - vh;   // band's top edge just entering from below
      // On a phone, finish a little before the page truly ends. Landing the
      // join on the very last pixel means a guest who stops a thumb's width
      // short never sees the rings meet at all, which is the whole point of
      // them.
      var end = maxScroll - (ringsIsPhone() ? vh * RINGS_FINISH_EARLY_PHONE : 0);
      if (end - start > 40) {
        p = (scrollTop - start) / (end - start);
      } else {
        // Degenerate (band not last, or page too short to scroll) — fall back
        // to its travel across the viewport.
        p = (vh - r.top) / (vh + r.height);
      }
      p = Math.max(0, Math.min(1, p));
      var t = p * d;
      // Seeking costs more than it is worth for sub-frame moves.
      if (Math.abs(t - video.currentTime) > d / 121) {
        try { video.currentTime = t; } catch (e) {}
      }
    }
    function onScroll() {
      if (queued) return;
      queued = true;
      // rAF coalesces the burst of scroll events into one seek per frame, but
      // it does not run at all in some contexts (throttled or non-compositing
      // pages), which would leave the clip frozen. The timer is a floor.
      var raf = window.requestAnimationFrame(run);
      var timer = window.setTimeout(run, 120);
      function run() {
        window.cancelAnimationFrame(raf);
        window.clearTimeout(timer);
        apply();
      }
    }

    scroller.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    if (video.readyState >= 1) apply();
    else video.addEventListener("loadedmetadata", apply, { once: true });

    // iOS will not render a frame for a video that has never played, so a
    // scrubbed-only clip stays blank there. The envelope's tap is a real user
    // gesture, which is the one moment play() is allowed; playing and pausing
    // immediately primes the decoder without anything being seen to play.
    function prime() {
      var pr = video.play();
      if (pr && pr.then) pr.then(function () { video.pause(); apply(); })
                           .catch(function () {});
      else { video.pause(); apply(); }
    }
    window.addEventListener("am:opened", prime, { once: true });
    document.addEventListener("touchend", prime, { once: true });
    document.addEventListener("click", prime, { once: true });
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
      { rotation: "-6.05501deg", src: "_assets/custom/couple-1.webp" },
      { rotation: "9.5948deg", src: "_assets/custom/couple-2.webp" },
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

  setInterval(runPatches, 300);
  if (window.MutationObserver) {
    new MutationObserver(runPatches).observe(document.documentElement, { childList: true, subtree: true });
  }
  document.addEventListener("DOMContentLoaded", runPatches);
  window.addEventListener("load", runPatches);
})();
