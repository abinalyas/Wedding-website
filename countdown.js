/* Local self-contained wedding countdown → replaces the external Invitarium
   timer iframe (token 6e950298a33c648472) so it targets Abin & Meera's date. */
(function () {
  // Target: 24 Aug 2026, 2:00 PM (the wedding). Month is 0-indexed → 7 = August.
  var TARGET = new Date(2026, 7, 24, 14, 0, 0).getTime();
  var pad = function (n) { return String(n).padStart(2, "0"); };

  function build(box) {
    box.innerHTML = "";
    var W = box.clientWidth || 360;
    var wrap = document.createElement("div");
    wrap.style.cssText =
      "display:flex;flex-direction:column;align-items:center;justify-content:center;" +
      "width:100%;height:100%;font-family:Georgia,'Times New Roman',serif;color:#3c3c3c;";
    var nums = document.createElement("div");
    nums.style.cssText =
      "font-size:" + Math.round(W * 0.135) + "px;line-height:1;letter-spacing:1px;" +
      "display:flex;align-items:baseline;justify-content:center;";
    var labels = document.createElement("div");
    labels.style.cssText =
      "display:flex;justify-content:center;gap:" + Math.round(W * 0.06) + "px;margin-top:14px;" +
      "font-variant:small-caps;letter-spacing:3px;font-size:" + Math.round(W * 0.042) + "px;color:#6f6f6f;";
    ["Days", "Hours", "Minutes", "Seconds"].forEach(function (l) {
      var s = document.createElement("span"); s.textContent = l; labels.appendChild(s);
    });
    wrap.appendChild(nums); wrap.appendChild(labels); box.appendChild(wrap);
    return nums;
  }

  function tick(nums) {
    var d = Math.max(0, TARGET - Date.now());
    var day = Math.floor(d / 864e5); d -= day * 864e5;
    var hr = Math.floor(d / 36e5); d -= hr * 36e5;
    var mi = Math.floor(d / 6e4); d -= mi * 6e4;
    var se = Math.floor(d / 1e3);
    var dim = "color:#adaba6";
    nums.innerHTML =
      "<span>" + pad(day) + "</span><span>:</span>" +
      "<span>" + pad(hr) + "</span><span>:</span>" +
      "<span>" + pad(mi) + "</span>" +
      "<span style='" + dim + "'>:</span><span style='" + dim + "'>" + pad(se) + "</span>";
  }

  function replace() {
    var frames = document.querySelectorAll("iframe");
    for (var i = 0; i < frames.length; i++) {
      var f = frames[i];
      if (f.__cvDone) continue;
      if (f.src && f.src.indexOf("6e950298a33c648472") !== -1) {
        f.__cvDone = true;
        f.style.display = "none";
        var host = f.parentElement || f;
        if (getComputedStyle(host).position === "static") host.style.position = "relative";
        var box = document.createElement("div");
        box.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;";
        host.appendChild(box);
        var nums = build(box);
        tick(nums);
        setInterval(function () { tick(nums); }, 1000);
      }
    }
  }
  setInterval(replace, 300);
  if (window.MutationObserver) new MutationObserver(replace).observe(document.documentElement, { childList: true, subtree: true });
})();
