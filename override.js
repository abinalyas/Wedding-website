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

  function textEls(txt) {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var out = [];
    var n;
    while ((n = walker.nextNode())) {
      if (n.parentElement && n.parentElement.tagName !== "SCRIPT" && n.textContent.trim() === txt) {
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
    if (window.__receptionPatched) return;

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
    var photoWrapper = Array.from(document.querySelectorAll('div[style*="rotate(-2.77671deg)"]')).find(function (d) {
      return d.querySelector("img");
    });
    var photoImg = photoWrapper ? photoWrapper.querySelector("img") : null;

    if (
      addressWrappers.length < 2 ||
      !addressWrappers[0] ||
      !addressWrappers[1] ||
      !venueWrapper ||
      !timeWrapper ||
      !headingWrapper ||
      !ceremonyTimeWrapper ||
      !mapWrapper ||
      !photoWrapper
    ) {
      return; // Canva hasn't finished rendering this section yet — retry.
    }

    var receptionSection = timeWrapper.parentNode;
    if (!receptionSection) return;

    window.__receptionPatched = true;

    // Canva recomputes each element's own box width per breakpoint (mobile
    // isn't just a visual scale-down of the desktop layout — the numbers
    // are genuinely different), but the RATIO between breakpoints is
    // consistent. Everything below was calibrated against the "6:30 PM"
    // wrapper's desktop width (922.111px); multiplying by this ratio makes
    // it adapt to whatever breakpoint is actually rendering.
    var scale = parseFloat(timeWrapper.style.width) / 922.111;

    // 1. Remove the duplicate address and the superfluous "Venue" label
    //    (the "Reception" heading already plays that role, same as "Location" does).
    addressWrappers[1].remove();
    venueWrapper.remove();

    // 2. Restyle "6:30 PM" to match the ceremony's big decorative time font.
    var timeP = timeWrapper.querySelector("p");
    var sourceP = ceremonyTimeWrapper.querySelector("p");
    if (timeP && sourceP) timeP.setAttribute("style", sourceP.getAttribute("style"));
    timeWrapper.style.height = 115 * scale + "px";
    timeWrapper.style.width = 700 * scale + "px";

    // 3. Clone the ceremony's photo block into the reception section (for its
    //    position/rotation/frame styling), then swap in the real photos for
    //    each venue instead of the generic stock image both used to share.
    var photoClone = photoWrapper.cloneNode(true);
    photoClone.removeAttribute("id");
    photoClone.style.transform = "translate(" + 176.364 * scale + "px, " + 620 * scale + "px) rotate(-2.77671deg)";
    var cloneImg = photoClone.querySelector("img");
    if (cloneImg) cloneImg.src = "_assets/custom/auditorium.jpg";
    receptionSection.appendChild(photoClone);

    photoImg.src = "_assets/custom/church.webp";

    // 4. Add a real, working "Open map" button to the reception section,
    //    and make the ceremony's existing one a real link too.
    makeRealLink(mapWrapper, CHURCH_MAP_URL);

    var mapButton = makeButton(RECEPTION_MAP_URL, "Open map", scale);
    var btnWidth = 509 * scale;
    var headingCenterX = parseFloat(headingWrapper.style.transform.match(/translate\(([\d.]+)/)[1]) + parseFloat(headingWrapper.style.width) / 2;
    mapButton.style.position = "absolute";
    mapButton.style.transform = "translate(" + (headingCenterX - btnWidth / 2) + "px, " + 1500 * scale + "px)";
    mapButton.style.top = "0";
    mapButton.style.left = "0";
    receptionSection.appendChild(mapButton);
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
  }

  setInterval(runPatches, 300);
  if (window.MutationObserver) {
    new MutationObserver(runPatches).observe(document.documentElement, { childList: true, subtree: true });
  }
  document.addEventListener("DOMContentLoaded", runPatches);
  window.addEventListener("load", runPatches);
})();
