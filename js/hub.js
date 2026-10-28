/* Seashell website v2: the hub, drawn to scale from packaging-study §A11 (spec v2), and its 31 × 11 dot display.
   Units are millimetres, SVG y points down (6 o'clock is +y). Spec v2 numbers used here:
     body Ø42.0; lugs at 12 and 6, inner width 20.4, cheeks 2.0, bar axis 23.0, tips 25.0
     cap: 12 lobes, tips at Ø42.0, valleys 0.6 deep; ribs fan from the 6 o'clock lobe tip (hinge) to the lobes
          at 56° or more from it and stop at the smooth clear disc Ø29.7 (r 14.84)
     display: 31 × 11 white LEDs, pitch 0.8 × 1.0, block centre (-0.6, -1.65) with +y = 12 o'clock
     pads: five, 1.8 pitch, at 9 o'clock on the side wall, so a top view does not show them
   The display is fixed in the body under the window; the cap (scallops + ribs) rotates over it.
   overlay() lights the same 31 x 11 display over a Blender render, at the dot positions Blender's camera gives
   (js/dots.js, cad/render_web.py).
   Works in the browser (window.SeashellHub) and in node (module.exports) to write img/hub-drawing.svg. */
(function (root) {
  "use strict";

  var COLS = 31, ROWS = 11, PX = 0.8, PY = 1.0, MCX = -0.6, MCY = 1.65;
  var R_BODY = 21.0, R_VALLEY = 20.4, R_CLEAR = 14.84, LOBES = 12;
  var HINGE_DEG = 90;                         // SVG angle of the 6 o'clock lobe tip

  /* ---------- fonts: 3 × 5 (two lines of eight) and 5 × 7 (one line of five) ---------- */
  var F3 = {
    A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110", E: "111100110100111",
    F: "111100110100100", G: "011100101101011", H: "101101111101101", I: "111010010010111", J: "001001001101010",
    K: "101101110101101", L: "100100100100111", M: "101111111101101", N: "110101101101101", O: "010101101101010",
    P: "110101110100100", Q: "010101101110011", R: "110101110101101", S: "011100010001110", T: "111010010010010",
    U: "101101101101111", V: "101101101101010", W: "101101111111101", X: "101101010101101", Y: "101101010010010",
    Z: "111001010100111", "0": "111101101101111", "1": "010110010010111", "2": "110001010100111", "3": "110001010001110",
    "4": "101101111001001", "5": "111100110001110", "6": "011100111101111", "7": "111001010010010", "8": "111101111101111",
    "9": "111101111001110", ":": "000010000010000", ".": "000000000000010", "-": "000000111000000", "!": "010010010000010",
    "'": "010010000000000", "•": "000111111111000", "▮": "111111111111111", "▯": "111101101101111", "▶": "100110111110100",
    " ": "000000000000000"
  };
  var F5 = {
    A: "01110100011000111111100011000110001", B: "11110100011000111110100011000111110", C: "01110100011000010000100001000101110",
    D: "11100100101000110001100011001011100", E: "11111100001000011110100001000011111", F: "11111100001000011110100001000010000",
    G: "01110100011000010111100011000101111", H: "10001100011000111111100011000110001", I: "01110001000010000100001000010001110",
    K: "10001100101010011000101001001010001", L: "10000100001000010000100001000011111", M: "10001110111010110101100011000110001",
    N: "10001110011010110011100011000110001", O: "01110100011000110001100011000101110", P: "11110100011000111110100001000010000",
    R: "11110100011000111110101001001010001", S: "01111100001000001110000010000111110", T: "11111001000010000100001000010000100",
    U: "10001100011000110001100011000101110", V: "10001100011000110001100010101000100", W: "10001100011000110101101011010101010",
    Y: "10001100010101000100001000010000100", " ": "00000000000000000000000000000000000",
    "0": "01110100011001110101110011000101110", "1": "00100011000010000100001000010001110", "2": "01110100010000100010001000100011111",
    "3": "11111000100010000010000011000101110", "4": "00010001100101010010111110001000010", "5": "11111100001111000001000011000101110",
    "6": "00110010001000011110100011000101110", "7": "11111000010001000100010000100001000", "8": "01110100011000101110100011000101110",
    "9": "01110100011000101111000010001001100", ":": "00000001000010000000001000010000000"
  };

  // text -> array of columns, each column an array of booleans (rows of the glyph)
  function strip(text, big) {
    var font = big ? F5 : F3, w = big ? 5 : 3, h = big ? 7 : 5, cols = [];
    String(text).toUpperCase().split("").forEach(function (ch, i) {
      var g = font[ch] || (big ? F5[" "] : F3[" "]);
      if (i) cols.push(new Array(h).fill(false));                // one blank column between letters
      for (var c = 0; c < w; c++) {
        var col = [];
        for (var r = 0; r < h; r++) col.push(g.charAt(r * w + c) === "1");
        cols.push(col);
      }
    });
    return cols;
  }

  /* A frame is { l1, l2 } (two lines of the small font), { big } (one line of the large font),
     { l1 } alone (one small line, centred) or { l1, bar: n } (a line over a bar n columns long, a held press).
     A line longer than the display can scroll: { l2, tick: offset }. */
  function bitmap(frame) {
    var on = new Uint8Array(COLS * ROWS);
    if (!frame) return on;
    function put(cols, top, offset) {
      var start = offset == null ? Math.floor((COLS - cols.length) / 2) : COLS - offset;
      cols.forEach(function (col, i) {
        var c = start + i;
        if (c < 0 || c >= COLS) return;
        col.forEach(function (lit, r) { if (lit) on[(top + r) * COLS + c] = 1; });
      });
    }
    if (frame.big != null) { put(strip(frame.big, true), 2, frame.tick); return on; }
    if (frame.bar != null) {
      put(strip(frame.l1 || "", false), 0);
      for (var b = 0; b < Math.min(COLS, frame.bar); b++) for (var br = 7; br <= 9; br++) on[br * COLS + b] = 1;
      return on;
    }
    if (frame.l2 == null) { put(strip(frame.l1 || "", false), 3); return on; }
    put(strip(frame.l1 || "", false), 0);
    put(strip(frame.l2, false), 6, frame.tick);
    return on;
  }
  function width(text, big) { return strip(text, big).length; }

  /* ---------- geometry ---------- */
  function f(n) { return Math.round(n * 1000) / 1000; }
  function polar(r, deg) { var a = deg * Math.PI / 180; return [r * Math.cos(a), r * Math.sin(a)]; }

  function scallopPath() {
    var pts = [], step = 360 / LOBES;
    for (var i = 0; i < 720; i++) {
      var deg = i / 2;
      var rel = ((deg - HINGE_DEG) % step + step) % step;        // 0 at a lobe tip
      var t = (rel <= step / 2 ? rel : step - rel) / (step / 2);   // 0 tip → 1 valley
      var r = R_VALLEY + (R_BODY - R_VALLEY) * Math.sqrt(Math.max(0, 1 - t * t));
      var p = polar(r, deg);
      pts.push((i ? "L" : "M") + f(p[0]) + " " + f(p[1]));
    }
    return pts.join("") + "Z";
  }

  function ribs() {
    var hinge = polar(R_BODY, HINGE_DEG), out = [];
    for (var k = 2; k <= LOBES - 2; k++) {                        // lobes 60° to 300° from the hinge (≥ 56°)
      var tip = polar(R_BODY - 0.25, HINGE_DEG + k * 30);
      out.push("M" + f(hinge[0]) + " " + f(hinge[1] - 0.25) + "L" + f(tip[0]) + " " + f(tip[1]));
    }
    return out.join("");
  }

  function lug(sign) {   // sign -1: 12 o'clock, +1: 6 o'clock
    var y0 = sign * 18.4, y1 = sign * 25.0, top = Math.min(y0, y1), h = Math.abs(y1 - y0);
    return '<rect x="-12.2" y="' + f(top) + '" width="2" height="' + f(h) + '" rx="1"/>' +
           '<rect x="10.2" y="' + f(top) + '" width="2" height="' + f(h) + '" rx="1"/>';
  }

  var uid = 0;
  /* opts: { ring: bool, strap: bool, arc: "text", label: "accessible name", pad: viewBox half size } */
  function markup(opts) {
    opts = opts || {};
    var id = "h" + (++uid), half = opts.pad || (opts.ring || opts.arc ? 33 : 26.5), s = [];
    s.push('<svg class="hub" viewBox="' + (-half) + " " + (-half) + " " + 2 * half + " " + 2 * half + '" ' +
      (opts.label ? 'role="img" aria-label="' + opts.label + '"' : 'aria-hidden="true"') + ' data-ui>');
    s.push('<defs><clipPath id="' + id + 'c"><path d="' + scallopPath() + '"/></clipPath>' +
      '<mask id="' + id + 'm"><rect x="-30" y="-30" width="60" height="60" fill="#fff"/><circle r="' + R_CLEAR + '" fill="#000"/></mask>' +
      '<filter id="' + id + 'g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="0.32" result="b"/>' +
      '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      (opts.arc ? '<path id="' + id + 'a" d="M' + f(polar(30.5, -190)[0]) + " " + f(polar(30.5, -190)[1]) +
        " A 30.5 30.5 0 1 1 " + f(polar(30.5, 10)[0]) + " " + f(polar(30.5, 10)[1]) + '"/>' : "") +
      "</defs>");
    if (opts.arc) s.push('<g class="hub__arc"><text text-anchor="middle"><textPath href="#' + id + 'a" startOffset="50%">' + opts.arc + "</textPath></text></g>");
    if (opts.ring) {
      s.push('<g class="hub__ring">');
      for (var i = 0; i < 24; i++) {
        var p = polar(27.2, -90 + i * 15);
        s.push('<circle class="r" cx="' + f(p[0]) + '" cy="' + f(p[1]) + '" r="0.55"/>');
      }
      s.push("</g>");
    }
    if (opts.strap) {
      s.push('<g class="hub__strap"><g class="hub__strap-a"><rect x="-10" y="-70" width="20" height="47.6" rx="1"/>' +
        '<path class="stitch" d="M -8.6 -70 V -24 M 8.6 -70 V -24"/></g>' +
        '<g class="hub__strap-b"><rect x="-10" y="22.4" width="20" height="47.6" rx="1"/>' +
        '<path class="stitch" d="M -8.6 24 V 70 M 8.6 24 V 70"/></g></g>');
    }
    s.push('<g class="hub__lugs">' + lug(-1) + lug(1) + "</g>");
    s.push('<g class="hub__bars"><rect x="-10.2" y="-23.4" width="20.4" height="0.8" rx="0.4"/>' +
      '<rect x="-10.2" y="22.6" width="20.4" height="0.8" rx="0.4"/></g>');
    s.push('<circle class="hub__body" r="' + R_BODY + '"/>');
    s.push('<g class="hub__cap"><g class="hub__turn">' +
      '<path class="hub__shell" d="' + scallopPath() + '"/>' +
      '<g clip-path="url(#' + id + 'c)"><g mask="url(#' + id + 'm)"><path class="hub__ribs" d="' + ribs() + '"/></g></g>' +
      '<path class="hub__key" d="M -16.6 -12.4 A 20.7 20.7 0 0 1 -3.6 -20.4"/>' +
      '</g><circle class="hub__disc" r="' + R_CLEAR + '"/>');
    s.push('<g class="hub__dots" filter="url(#' + id + 'g)">');
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        s.push('<circle class="d" cx="' + f(MCX + (c - (COLS - 1) / 2) * PX) + '" cy="' + f(MCY + (r - (ROWS - 1) / 2) * PY) + '" r="0.26"/>');
      }
    }
    s.push("</g></g></svg>");
    return s.join("");
  }

  /* ---------- live control (browser only) ---------- */
  function create(container, opts) {
    container.innerHTML = markup(opts || {});
    return drive(container.querySelector("svg"));
  }

  /* the display over a render: data = { res: [w, h], dots: [[x, y] x 341], jac } from js/dots.js.
     Each dot is a unit circle mapped by the camera's Jacobian, so it lands as the ellipse the lens makes. */
  function overlay(box, data, label) {
    var j = data.jac, id = "o" + (++uid), s = [];
    s.push('<svg class="hub hub--over" viewBox="0 0 ' + data.res[0] + " " + data.res[1] + '" preserveAspectRatio="none" ' +
      (label ? 'role="img" aria-label="' + label + '"' : 'aria-hidden="true"') + ' data-ui>' +
      '<defs><filter id="' + id + 'g" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2" result="b"/>' +
      '<feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' +
      '<g class="hub__dots" filter="url(#' + id + 'g)">');
    data.dots.forEach(function (p) {
      s.push('<circle class="d" r="1.15" transform="matrix(' + [j[0][0], j[1][0], j[0][1], j[1][1], p[0], p[1]].join(" ") + ')"/>');
    });
    s.push("</g></svg>");
    box.insertAdjacentHTML("beforeend", s.join(""));
    return drive(box.lastElementChild);
  }

  function drive(svg) {
    var dots = Array.prototype.slice.call(svg.querySelectorAll(".d"));
    var ringDots = Array.prototype.slice.call(svg.querySelectorAll(".r"));
    // target = what the display should show; lit = what the DOM shows; a pending dot reads target when it fires,
    // so a new frame never leaves half of the old one behind
    var target = new Uint8Array(COLS * ROWS), lit = new Uint8Array(COLS * ROWS), pending = new Uint8Array(COLS * ROWS);
    var ticker = null, current = null;
    var reduced = root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function set(i) { if (lit[i] !== target[i]) { lit[i] = target[i]; dots[i].classList.toggle("on", !!lit[i]); } }
    function apply(next, sweep) {
      for (var i = 0; i < next.length; i++) {
        target[i] = next[i];
        if (lit[i] === target[i]) continue;
        if (!sweep || reduced) { set(i); continue; }
        if (pending[i]) continue;
        pending[i] = 1;
        (function (k) {
          setTimeout(function () { pending[k] = 0; set(k); }, (k % COLS) * 16 + Math.random() * 70 + (target[k] ? 40 : 0));
        })(i);
      }
    }
    function stopTicker() { svg.classList.remove("is-ticking"); if (ticker) { clearInterval(ticker); ticker = null; } }

    var api = {
      svg: svg,
      /* show(frame, { sweep: true }) ; a frame with { scroll: "text" } on line 2 runs as a ticker
         (a static fallback goes in l2 for reduced motion) */
      show: function (frame, o) {
        o = o || {};
        var key = JSON.stringify(frame);
        if (key === current && !o.force) return;
        current = key;
        stopTicker();
        if (frame && frame.scroll && !reduced) {
          var big = frame.big != null, text = frame.scroll, total = width(text, big) + COLS + 6, off = 0;
          var base = big ? null : (frame.l1 || "");
          var draw = function (sweep) {
            var fr = big ? { big: text, tick: off } : { l1: base, l2: text, tick: off };
            apply(bitmap(fr), sweep);
          };
          off = Math.floor(COLS / 2) + 4; draw(o.sweep);
          ticker = setInterval(function () { svg.classList.add("is-ticking"); off = off >= total ? 0 : off + 1; draw(false); }, 95);
          return;
        }
        apply(bitmap(frame), o.sweep);
      },
      clear: function (o) { current = null; stopTicker(); apply(new Uint8Array(COLS * ROWS), o && o.sweep); },
      ring: function (n) { ringDots.forEach(function (d, i) { d.classList.toggle("on", i < n); }); },
      stop: stopTicker
    };
    return api;
  }

  /* the display alone, lit dots only: inline chips in a sentence and the ghost notifications.
     "MISSED|CALL" = two small lines; bg: true draws the dark window behind it */
  function mini(text, bg, big) {
    var parts = String(text).split("|");
    var on = bitmap(big ? { big: parts[0] } : parts.length > 1 ? { l1: parts[0], l2: parts[1] } : { l1: parts[0] });
    var y0 = big ? 2 * PY : 0, w = COLS * PX + 1.6, h = (big ? 7 : ROWS) * PY + 1.6, s = [];
    s.push('<svg class="mini" viewBox="0 ' + f(y0) + " " + f(w) + " " + f(h) + '" aria-hidden="true" data-ui>');
    if (bg) s.push('<rect class="mini__bg" y="' + f(y0) + '" width="' + f(w) + '" height="' + f(h) + '" rx="' + f(h / 2) + '"/>');
    s.push('<g class="mini__dots">');
    for (var i = 0; i < on.length; i++) {
      if (!on[i]) continue;
      s.push('<circle cx="' + f(1.2 + (i % COLS) * PX) + '" cy="' + f(1.3 + Math.floor(i / COLS) * PY) + '" r="0.32"/>');
    }
    s.push("</g></svg>");
    return s.join("");
  }

  var api = { markup: markup, create: create, overlay: overlay, mini: mini, bitmap: bitmap, COLS: COLS, ROWS: ROWS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SeashellHub = api;
})(typeof window !== "undefined" ? window : globalThis);
