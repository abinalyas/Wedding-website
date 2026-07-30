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

  // The rings clip is a 3D render on a plain white studio background with the
  // generator's watermark in the bottom-right corner. Two tricks make it read
  // as part of the invite rather than a video pasted onto it:
  //   * mix-blend-mode:multiply — white multiplied against any backdrop leaves
  //     the backdrop untouched, so the white studio background disappears into
  //     whatever is behind it while the gold rings stay gold. This only works
  //     while nothing between the video and that backdrop creates its own
  //     stacking context, so the video must NOT sit inside a positioned/
  //     z-indexed/opacity'd wrapper.
  //   * clip-path — crops the watermark off the bottom-right, plus a little off
  //     each edge to tighten the framing around the rings.
  var RINGS_CROP = { top: 0.06, right: 0.12, bottom: 0.16, left: 0.12 };
  var RINGS_VISIBLE_FRACTION = 1 - RINGS_CROP.top - RINGS_CROP.bottom;
  var RINGS_ASPECT = 1088 / 720; // clip's intrinsic ratio; re-read once metadata loads
  var RINGS_MAX_WIDTH = 420;
  var RINGS_GAP_MARGIN = 34; // breathing room so the rings clear the button above
  // Where the rings actually sit within the clip's frame, as a share of frame
  // height. The render is not vertically centred — the rings sit high with
  // shadow/floor below — so centring the cropped box in the empty space leaves
  // the rings grazing the button. Centre on this instead.
  var RINGS_CONTENT_CENTER = 0.33;
  // Share of the ceremony section's height that sits empty below its "Open map"
  // button — measured at desktop (163px of 2298px) and proportional across
  // Canva's breakpoints, since Canva scales a section's contents with its box.
  var RINGS_GAP_FRACTION = 163 / 2298;

  function addRingsAnimation() {
    // Drop the wedding-rings clip into the empty space at the bottom of the
    // ceremony section, below its "Open map" button.
    //
    // Deliberately NOT inserted as its own full-width band between the two
    // sections: each Canva section paints its own copy of the paper-texture
    // background image, restarting the texture's gradient at every section
    // boundary, so a separate band can never line up with its neighbours and
    // always shows as a visible seam. Overlaying the clip inside a section
    // instead means it blends against that section's real background and no
    // seam exists at all. The wrapper is zero-height and the video is pulled
    // up over the section with a negative margin, so it adds no layout height.
    var ceremonySection = Array.from(document.querySelectorAll("section")).find(function (s) {
      return s.textContent.indexOf("3:00 PM") !== -1;
    });
    if (!ceremonySection) return; // Canva hasn't rendered this section yet.

    var wrapper = document.querySelector('[data-custom-clone="rings-wrapper"]');
    var video = wrapper ? wrapper.querySelector("video") : null;

    if (!wrapper || !wrapper.isConnected) {
      wrapper = document.createElement("div");
      wrapper.setAttribute("data-custom-clone", "rings-wrapper");
      // Zero height + overflow visible: contributes nothing to the page flow,
      // it only centres the video horizontally. No position/z-index/opacity
      // here, or it would isolate the video's multiply blend (see above).
      wrapper.style.cssText =
        "height: 0; overflow: visible; display: flex; justify-content: center; align-items: flex-start;";

      video = document.createElement("video");
      video.src = "rings-animation.mp4";
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.playsInline = true; // iOS: play inline instead of going fullscreen
      video.setAttribute("playsinline", "");
      video.setAttribute("muted", "");
      // Some browsers reset a media element to paused when it is re-parented,
      // and a loop that has to seek back to 0 fails on hosts that don't answer
      // Range requests. Nudge it back into playing on both events.
      video.addEventListener("ended", function () {
        video.currentTime = 0;
        var p = video.play();
        if (p && p.catch) p.catch(function () {});
      });

      wrapper.appendChild(video);
      ceremonySection.parentNode.insertBefore(wrapper, ceremonySection.nextSibling);
    }

    if (video.videoWidth && video.videoHeight) RINGS_ASPECT = video.videoWidth / video.videoHeight;

    // Size the empty space as a fraction of the section's own height rather
    // than by measuring the "Open map" pill directly. Canva virtualizes
    // offscreen sections and keeps degenerate duplicates of some text nodes,
    // so a text-anchored measurement intermittently reads a wrong position
    // (and once wrote a -1204px offset that parked the clip over the button).
    // The section height is a single, always-present measurement, and the gap
    // below the button is a stable share of it across Canva's breakpoints.
    var sectionHeight = ceremonySection.getBoundingClientRect().height;
    if (!(sectionHeight > 400)) return; // section not laid out yet
    var gap = sectionHeight * RINGS_GAP_FRACTION;

    // Size the clip so its *visible* (post-crop) height fits the empty space.
    var visibleHeight = Math.min(gap - RINGS_GAP_MARGIN, RINGS_MAX_WIDTH / RINGS_ASPECT * RINGS_VISIBLE_FRACTION);
    var layoutHeight = visibleHeight / RINGS_VISIBLE_FRACTION;
    var width = layoutHeight * RINGS_ASPECT;

    video.style.cssText =
      "width: " + width + "px; height: auto; display: block;" +
      "mix-blend-mode: multiply;" +
      "clip-path: inset(" +
        RINGS_CROP.top * 100 + "% " + RINGS_CROP.right * 100 + "% " +
        RINGS_CROP.bottom * 100 + "% " + RINGS_CROP.left * 100 + "%);" +
      // Sits on top of the section, so let clicks through to the button above.
      "pointer-events: none;" +
      // With no margin the video would start at the section's bottom edge;
      // pull it up so the rings land in the middle of the empty space.
      "margin-top: " + (-gap / 2 - RINGS_CONTENT_CENTER * layoutHeight) + "px;";

    if (video.paused && video.readyState >= 2) {
      var play = video.play();
      if (play && play.catch) play.catch(function () {});
    }
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
    addRingsAnimation();
  }

  setInterval(runPatches, 300);
  if (window.MutationObserver) {
    new MutationObserver(runPatches).observe(document.documentElement, { childList: true, subtree: true });
  }
  document.addEventListener("DOMContentLoaded", runPatches);
  window.addEventListener("load", runPatches);
})();
