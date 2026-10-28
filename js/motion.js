/* Seashell website v2.1: the scroll story (GSAP 3.12.5 + ScrollTrigger, cdnjs).
   Native scroll, no GSAP pinning: the long sections use CSS position: sticky and GSAP drives what happens inside.
   Moves follow ui-ux-pro-max's GSAP presets: #6 scrubbed storytelling (scrub 1) for the reveal, #5 staggered reveal
   (y 16-24, power2.out) for headings and text, #13 subtle parallax for the footage; step changes are timed, not scrubbed.
   prefers-reduced-motion, or GSAP missing: this file does nothing and main.js has set every final state.
   GSAP is fetched only after the page has loaded, so the first screen paints without waiting for the CDN. */
(function () {
  "use strict";
  var root = document.documentElement;
  if (!root.classList.contains("motion")) return;
  var LIBS = ["https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js",
              "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"];
  var fetchLib = function (i) {
    if (i === LIBS.length) { start(); return; }
    var el = document.createElement("script");
    el.src = LIBS[i];
    el.onload = function () { fetchLib(i + 1); };
    el.onerror = function () { root.classList.remove("motion"); };   // CDN blocked: fall back to the calm page
    document.head.appendChild(el);
  };
  if (document.readyState === "complete") fetchLib(0); else addEventListener("load", function () { fetchLib(0); });

function start() {
  var page = window.SeashellPage || { hubs: {} };
  if (!window.gsap || !window.ScrollTrigger) { root.classList.remove("motion"); return; }
  var gsap = window.gsap, ST = window.ScrollTrigger;
  gsap.registerPlugin(ST);
  var q = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var mm = gsap.matchMedia();
  var F = page.FRAMES || {};
  var saveData = !!(navigator.connection && navigator.connection.saveData);
  var play = function (v) {
    if (!v || saveData) return;
    if (!v.getAttribute("src")) { v.src = v.getAttribute("data-src"); v.addEventListener("playing", function () { v.classList.add("is-playing"); }); }
    var p = v.play(); if (p && p.catch) p.catch(function () {});
  };
  var pause = function (v) { if (v && !v.paused) v.pause(); };

  /* ---------- 0. the light rises: one ground for the whole page, blended from each section's tone to the next as it
     comes in, applied to the sections on screen (the ones off screen keep their own tone) ---------- */
  var secs = q("main > [data-tone], footer[data-tone]"), bar = document.querySelector(".bar");
  var rgb = function (name) {
    var h = getComputedStyle(root).getPropertyValue("--" + name).trim().replace("#", "");
    return [0, 2, 4].map(function (i) { return parseInt(h.slice(i, i + 2), 16); });
  };
  var tones = secs.map(function (s) { return s.getAttribute("data-tone"); }), cols = tones.map(rgb);
  var tops = [], bots = [];
  var measure = function () { secs.forEach(function (s, i) { var r = s.getBoundingClientRect(); tops[i] = r.top + scrollY; bots[i] = r.bottom + scrollY; }); };
  var ground = function () {
    var y = scrollY, vh = innerHeight, probe = y + vh * 0.95, k = 0;
    for (var i = 0; i < secs.length; i++) if (tops[i] <= probe) k = i;
    if (tones[k] === "berry") k--;                                   // the footer is a hard cut, not a blend
    var t = k > 0 ? Math.min(1, Math.max(0, (probe - tops[k]) / (vh * 0.5))) : 1;
    t = t * t * (3 - 2 * t);
    var a = cols[Math.max(0, k - 1)], b = cols[k];
    var c = a.map(function (v, j) { return Math.round(v + (b[j] - v) * t); });
    var css = "rgb(" + c.join(",") + ")";
    secs.forEach(function (s, i) {
      if (tones[i] === "berry") return;
      s.style.backgroundColor = tops[i] < y + vh && bots[i] > y ? css : "";
    });
    // the header: the ground it sits on, or the berry footer
    var hy = y + 80, under = 0;
    for (var j = 0; j < secs.length; j++) if (tops[j] <= hy) under = j;
    if (tones[under] === "berry") { root.setAttribute("data-head", "berry"); bar.style.backgroundColor = ""; bar.style.color = ""; return; }
    root.setAttribute("data-head", "ground");
    var lum = (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
    bar.style.backgroundColor = css;
    bar.style.color = lum > 0.42 ? "#0B0B0C" : "#F4F4EF";
  };
  ST.addEventListener("refresh", function () { measure(); ground(); });
  measure();
  ST.create({ start: 0, end: "max", onUpdate: ground });

  /* ---------- 1. without the phone: four beats, one at a time; only the beat on screen plays its clip ---------- */
  var beats = q(".beat"), intro = document.querySelector(".pain__intro");
  if (beats.length) {
    var vids = beats.map(function (b) { return b.querySelector(".beat__vid"); });
    var cur = -1, introOn = true;
    var goBeat = function (i, first) {
      if (i === cur) return;
      var prev = cur; cur = i;
      if (prev >= 0) gsap.to(beats[prev], { autoAlpha: 0, duration: 0.6, ease: "power2.inOut", overwrite: true });
      gsap.to(beats[i], { autoAlpha: 1, duration: first ? 0 : 0.6, ease: "power2.inOut", overwrite: true });
      var words = q(".beat__line, .beat__sub", beats[i]);
      if (!first) gsap.fromTo(words, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: "power2.out", stagger: 0.1, delay: 0.2, overwrite: true });
      var note = beats[i].querySelector(".ping");
      if (note) gsap.fromTo(note, { opacity: 0, y: -10 }, { keyframes: [{ opacity: 0.74, y: 0, duration: 0.35, ease: "power2.out" }, { opacity: 0.74, duration: 1.6 }, { opacity: 0.32, duration: 0.8 }], delay: first ? 0.9 : 0.5, overwrite: true });
      vids.forEach(function (v, k) { if (k !== i) pause(v); });
      if (!first) play(vids[i]);
    };
    goBeat(0, true);
    // the first clip waits until the page has loaded, so the still stays the largest paint
    setTimeout(function () { if (cur === 0 && scrollY < innerHeight * 2.4) play(vids[0]); }, 400);
    ST.create({
      trigger: ".pain", start: "top top", end: "bottom bottom",
      onUpdate: function (s) {
        goBeat(Math.min(beats.length - 1, Math.floor(s.progress * beats.length * 0.999)));
        var show = s.progress < 0.06;
        if (show !== introOn) { introOn = show; gsap.to(intro, { autoAlpha: show ? 1 : 0, y: show ? 0 : -16, duration: 0.4, ease: "power2.out", overwrite: true }); }
      }
    });
    ST.create({ trigger: ".pain", start: "top bottom", end: "bottom top",
      onLeave: function () { vids.forEach(pause); }, onEnterBack: function () { play(vids[cur]); } });
    // slow drift on the footage while the section scrolls (parallax, subtle)
    gsap.fromTo(q(".beat__media"), { scale: 1.06 }, { scale: 1, ease: "none", scrollTrigger: { trigger: ".pain", start: "top top", end: "bottom bottom", scrub: 1 } });
  }

  /* ---------- 2. the reveal: a 48-frame turntable from the CAD, scrubbed; then the display lights ---------- */
  var rbox = document.querySelector(".rbox"), Hub = window.SeashellHub, DOTS = window.SeashellDots;
  if (rbox && Hub && DOTS && DOTS.turn) {
    var small = matchMedia("(max-width: 47.99em)").matches, size = small ? 800 : 1600, N = 48;
    var cv = document.createElement("canvas");
    cv.width = size; cv.height = size * 0.75; cv.setAttribute("aria-hidden", "true");
    rbox.appendChild(cv);
    var ctx = cv.getContext("2d"), frames = [], drawn = -1, want = 0;
    var draw = function (f) {
      want = Math.max(0, Math.min(N - 1, Math.round(f)));
      for (var d = 0; d < N; d++) {                                  // the nearest frame that has arrived
        var k = [want - d, want + d].filter(function (x) { return x >= 0 && x < N && frames[x] && frames[x]._ok; })[0];
        if (k != null) {
          if (k !== drawn) { ctx.drawImage(frames[k], 0, 0, cv.width, cv.height); drawn = k; rbox.classList.add("is-seq"); }
          return;
        }
      }
    };
    var loadSeq = function () {
      if (frames.length) return;
      for (var i = 0; i < N; i++) {
        var im = new Image();
        im.decoding = "async";
        im.onload = function () { this._ok = true; if (Math.abs(this._i - want) < 3 || drawn < 0) draw(want); };
        im._i = i;
        im.src = "img/seq/turn-" + (i < 10 ? "0" : "") + i + "-" + size + ".webp";
        frames.push(im);
      }
    };
    if ("IntersectionObserver" in window) {
      var seqIO = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { loadSeq(); seqIO.disconnect(); } }, { rootMargin: "100% 0px" });
      seqIO.observe(document.querySelector(".reveal"));
    } else loadSeq();
    var disp = Hub.overlay(rbox, DOTS.turn), lit = false;
    var light = function (on) {
      if (on === lit) return;
      lit = on;
      if (on) disp.show(F.marta, { sweep: true }); else disp.clear({ sweep: true });
    };
    var state = { f: 0 };
    var revealText = q(".reveal__text > *");
    mm.add("(min-width: 48em) and (min-height: 600px)", function () {
      var toCentre = function () { return -(parseFloat(getComputedStyle(document.querySelector(".reveal__pic")).getPropertyValue("--cx")) / 100 - 0.5) * innerWidth; };
      var rt = gsap.timeline({ defaults: { ease: "none" }, scrollTrigger: {
        trigger: ".reveal", start: "top top", end: "bottom bottom", scrub: 1, invalidateOnRefresh: true,
        onUpdate: function (s) { light(s.progress > 0.42); }
      } });
      rt.fromTo(rbox, { opacity: 0, scale: 0.94, x: toCentre }, { opacity: 1, scale: 1, duration: 0.14, ease: "power2.out" }, 0)
        .fromTo(state, { f: 0 }, { f: N - 1, duration: 0.4, ease: "power1.out", onUpdate: function () { draw(state.f); } }, 0)
        .to(rbox, { x: 0, duration: 0.16, ease: "power2.inOut" }, 0.5)
        .fromTo(revealText, { opacity: 0, y: 24 }, { opacity: 1, y: 0, stagger: 0.025, duration: 0.12, ease: "power2.out" }, 0.6)
        .set({}, {}, 1);   // the timeline spans the whole scroll, so the positions above are fractions of it
      return function () { gsap.set([rbox, revealText], { clearProps: "all" }); };
    });
    mm.add("(max-width: 47.99em), (max-height: 599px)", function () {
      gsap.fromTo(rbox, { opacity: 0 }, { opacity: 1, ease: "none", scrollTrigger: { trigger: ".reveal__pic", start: "top 95%", end: "top 55%", scrub: 0.6 } });
      gsap.fromTo(state, { f: 0 }, { f: N - 1, ease: "power1.out", scrollTrigger: {
        trigger: ".reveal__pic", start: "top 90%", end: "top 10%", scrub: 0.6,
        onUpdate: function (s) { draw(state.f); light(s.progress > 0.96); }
      } });
      gsap.from(revealText, { opacity: 0, y: 24, stagger: 0.08, duration: 0.6, ease: "power2.out", scrollTrigger: { trigger: ".reveal__text", start: "top 85%", once: true } });
    });
    draw(0);
  }

  /* ---------- section headings rise once as they come in ---------- */
  q("[data-rise]").forEach(function (el) {
    gsap.from(el, { y: 16, opacity: 0, duration: 0.6, ease: "power2.out", scrollTrigger: { trigger: el, start: "top 88%", once: true } });
  });

  /* ---------- 4. split: the pain plays on the left; on the right the cover wipes off the hub once ---------- */
  q(".pair").forEach(function (pair) {
    var shutter = pair.querySelector(".shutter"), v = pair.querySelector(".pair__vid");
    var words = q(".pair__words > *", pair), fix = q(".pair__fix figcaption > *", pair);
    if (shutter) {
      var cover = document.createElement("span");
      cover.className = "shutter__cover"; cover.setAttribute("aria-hidden", "true");
      shutter.appendChild(cover);
      ST.create({ trigger: pair, start: "top 60%", once: true, onEnter: function () {
        gsap.timeline()
          .fromTo(words, { y: 24, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.08, duration: 0.6, ease: "power2.out" })
          .to(cover, { scaleX: 0, duration: 0.9, ease: "power3.inOut" }, 0.25)
          .fromTo(fix, { y: 16, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.08, duration: 0.5, ease: "power2.out" }, 0.8);
      } });
    }
    if (v) ST.create({ trigger: pair, start: "top bottom", end: "bottom top", onToggle: function (s) { if (s.isActive) play(v); else pause(v); } });
  });

  /* ---------- 5. how it works: the block holds still, the step changes at each quarter of its scroll ---------- */
  var stepEls = q(".step"), names = stepEls.map(function (s) { return s.getAttribute("data-step"); });
  if (stepEls.length && page.setStep) {
    var at = function (p) { return names[Math.min(names.length - 1, Math.floor(p * names.length * 0.999))]; };
    ST.create({ trigger: ".how", start: "top top", end: "bottom bottom",
      onUpdate: function (s) { page.setStep(at(s.progress)); },
      onToggle: function (s) { if (s.isActive) page.setStep(at(s.progress), true); } });
  }

  /* ---------- 6. triathlon: one continuous move from the swim to the run ---------- */
  mm.add("(min-width: 56em)", function () {
    var track = document.querySelector(".tri__track"), puck = document.querySelector(".tri__puck"), line = document.querySelector(".tri__line");
    if (!track) return;
    var win = document.querySelector(".tri__window");
    var dist = function () { return Math.max(0, track.scrollWidth - win.clientWidth); };
    // a caption shows only while its whole line is inside the page margins, so no text is cut by the screen edge
    var caps = q(".leg figcaption"), m = function () { return parseFloat(getComputedStyle(document.querySelector(".tri__head")).paddingLeft) || 16; };
    var edge = function () {
      var w = innerWidth, mm_ = m();
      caps.forEach(function (c) { var r = c.getBoundingClientRect(); c.classList.toggle("is-out", r.left < mm_ - 1 || r.right > w - mm_ + 1); });
    };
    gsap.timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: ".tri", start: "top top", end: "bottom bottom", scrub: 1, invalidateOnRefresh: true, onUpdate: edge, onRefresh: edge } })
      .fromTo(track, { x: 0 }, { x: function () { return -dist(); }, duration: 1 }, 0)
      .fromTo(puck, { x: 0 }, { x: function () { return line.offsetWidth - puck.getBoundingClientRect().width; }, duration: 1 }, 0)
      .eventCallback("onUpdate", edge);
    edge();
    return function () { caps.forEach(function (c) { c.classList.remove("is-out"); }); };
  });

  /* ---------- 7. the use-case pictures open from the bottom, once ---------- */
  gsap.fromTo(q(".print img"), { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.8, ease: "power3.out", stagger: 0.1,
    scrollTrigger: { trigger: ".uses__field", start: "top 75%", once: true } });

  /* fonts and lazy pictures change heights: measure again once everything is in */
  ST.refresh();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ST.refresh(); });
}
})();
