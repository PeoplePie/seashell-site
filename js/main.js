/* Seashell website v2.1: page behaviour that does not need GSAP. Everything degrades: the page reads without
   this file, and with reduced motion this file alone sets every drawing to its final state.
   js/motion.js (GSAP) runs after it and takes over the scroll-driven parts. */
(function () {
  "use strict";
  var root = document.documentElement;
  root.classList.add("js");
  var store = window.SeashellStore;
  var cfg = window.SEASHELL_CONFIG || {};
  var Hub = window.SeashellHub;
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var page = window.SeashellPage = { hubs: {} };

  /* ---------- page view ---------- */
  if (store) store.trackEvent("page_view", { title: document.title });

  /* ---------- the hub: the drawing (how it works) and the display over the renders ---------- */
  var ARC = "Press to answer · Turn for volume · Hold for help";
  var DOTS = window.SeashellDots || {};
  // the drawings and the displays are built when they come near the screen, so the first screen paints sooner
  var whenNear = function (el, fn) {
    if (!("IntersectionObserver" in window)) { fn(); return; }
    var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); fn(); } }, { rootMargin: "100% 0px" });
    io.observe(el);
  };
  var how0 = document.querySelector("[data-hub=how]");
  var ensureHow = function () {
    if (!page.hubs.how && Hub && how0) page.hubs.how = Hub.create(how0, { ring: true, strap: true, arc: ARC, label: how0.getAttribute("data-label") });
    return page.hubs.how;
  };
  var overlayOf = function (box) {
    var data = DOTS[box.getAttribute("data-dots")], inner = box.querySelector(".rhub__in");
    if (!box._hub && Hub && data && inner) box._hub = Hub.overlay(inner, data);
    return box._hub;
  };
  if (Hub) {
    document.querySelectorAll("[data-mini]").forEach(function (el) {
      el.innerHTML = Hub.mini(el.getAttribute("data-mini"), el.classList.contains("chip"), el.hasAttribute("data-big"));
    });
  }
  var FRAMES = page.FRAMES = {
    press: { l1: "ANSWERED", l2: "00:03" },
    vol: function (n) { return { l1: "VOL", l2: "▮▮▮▮▮".slice(0, n) + "▯▯▯▯▯".slice(0, 5 - n) }; },
    pin: function (n) { return { l1: "PIN", l2: ("•••7").slice(0, n) }; },
    hold: function (n) { return { l1: "HOLD", bar: n }; },
    help: { l1: "CALLING", l2: "HELP" },
    marta: { l1: "MARTA", l2: "CALLING" },
    calling: function (name) { return { l1: name || "MARTA", l2: "CALLING" }; }
  };
  var G = function () { return window.gsap; };     // GSAP arrives after this file; moves fall back to end states

  /* ---------- how it works: each move plays once when its step comes up (motion.js picks the step) ---------- */
  var how = null, howBox = how0;
  var stepEls = Array.prototype.slice.call(document.querySelectorAll(".step"));
  var timers = [], shownStep = null;
  var later = function (fn, ms) { timers.push(setTimeout(fn, ms)); };
  var every = function (fn, ms) { var t = setInterval(fn, ms); timers.push(t); return t; };
  var stopAll = function () { timers.forEach(function (t) { clearTimeout(t); clearInterval(t); }); timers = []; };
  page.setStep = function (step, force) {
    how = ensureHow();
    if (!how || (shownStep === step && !force)) return;
    shownStep = step;
    howBox.setAttribute("data-step", step);
    stepEls.forEach(function (li) { li.classList.toggle("is-on", li.getAttribute("data-step") === step); });
    stopAll();
    var svg = how.svg, ring = svg.querySelector(".hub__ring"), arc = svg.querySelector(".hub__arc");
    var turn = svg.querySelector(".hub__turn"), cap = svg.querySelector(".hub__cap"), strap = svg.querySelector(".hub__strap");
    var sa = svg.querySelector(".hub__strap-a"), sb = svg.querySelector(".hub__strap-b"), g = G();
    if (ring) ring.style.opacity = step === "hold" ? 1 : 0;      // the ring belongs to Hold only
    if (arc) arc.style.opacity = step === "clip" ? 0 : 1;        // the strap takes the arc's place
    how.ring(0);
    if (g) { g.set([turn, arc], { svgOrigin: "0 0" }); g.to([turn, arc], { rotation: 0, duration: 0.3, ease: "power2.out", overwrite: true }); }
    if (step !== "clip" && strap) strap.style.opacity = 0;
    if (step === "hold") {                                       // the ring fills like a held press, then the call goes out
      if (reduced) { how.ring(24); how.show(FRAMES.help); return; }
      var n = 0;
      how.show(FRAMES.hold(0), { sweep: true });
      var t = every(function () {
        n++; how.ring(n); how.show(FRAMES.hold(Math.round(n / 24 * 31)));
        if (n >= 24) { clearInterval(t); later(function () { how.show(FRAMES.help, { sweep: true }); }, 250); }
      }, 125);
    } else if (step === "press") {                               // the top dips once, the call is answered and counts
      how.show(FRAMES.press, { sweep: true });
      if (g && cap && !reduced) g.fromTo(cap, { scale: 1, svgOrigin: "0 0" }, { keyframes: [{ scale: 0.962, duration: 0.12, ease: "power2.in" }, { scale: 1, duration: 0.23, ease: "power3.out" }] });
      if (!reduced) { var secs = 3; every(function () { secs = secs >= 59 ? 3 : secs + 1; how.show({ l1: "ANSWERED", l2: "00:" + (secs < 10 ? "0" : "") + secs }); }, 1000); }
    } else if (step === "turn") {                                // 15° clicks: volume up four, then back four for the PIN
      if (reduced || !g) { how.show(FRAMES.pin(4)); return; }
      var path = [1, 2, 3, 4, 3, 2, 1, 0];
      how.show(FRAMES.vol(1), { sweep: true });
      path.forEach(function (c, k) {
        later(function () {
          g.to([turn, arc], { rotation: c * 15, duration: 0.14, ease: "back.out(1.7)", overwrite: true });
          how.show(k < 4 ? FRAMES.vol(1 + c) : FRAMES.pin(k - 3));
        }, 500 + k * 420);
      });
    } else if (step === "clip") {                                // a strap slides through both lugs
      how.clear({ sweep: true });
      if (strap) strap.style.opacity = 1;
      if (g && !reduced) { g.fromTo(sa, { y: -30 }, { y: 0, duration: 0.5, ease: "power3.out" }); g.fromTo(sb, { y: 30 }, { y: 0, duration: 0.5, ease: "power3.out" }); }
    }
  };
  if (how0 && "IntersectionObserver" in window) {
    // the calm page (no motion): the step in the middle of the screen is the one shown
    var stepIO = new IntersectionObserver(function (entries) {
      if (root.classList.contains("motion")) return;
      entries.forEach(function (en) { if (en.isIntersecting) page.setStep(en.target.getAttribute("data-step")); });
    }, { rootMargin: "-38% 0px -60% 0px" });
    stepEls.forEach(function (s) { stepIO.observe(s); });
  }
  if (how0) whenNear(how0, function () { if (!shownStep) page.setStep("hold"); });

  /* ---------- the renders' displays: safety holds for help in a loop, the split panels show their moment ---------- */
  var onView = function (el, enter, leave) {
    if (!("IntersectionObserver" in window)) { enter(); return; }
    new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) enter(); else if (leave) leave(); }); }, { threshold: 0.35 }).observe(el);
  };
  document.querySelectorAll(".rhub[data-show]").forEach(function (box) {
    var kind = box.getAttribute("data-show");
    if (kind === "name") return;
    whenNear(box, function () { showOn(box, overlayOf(box), kind); });
  });
  function showOn(box, hub, kind) {
    if (!hub) return;
    if (kind === "hold") {
      if (reduced) { hub.show(FRAMES.help); return; }
      var loop = null;
      var cycle = function () {
        var k = 0;
        hub.show(FRAMES.hold(0), { sweep: true });
        clearInterval(loop);
        loop = setInterval(function () {
          k++;
          if (k <= 31) hub.show(FRAMES.hold(k));
          else if (k === 34) hub.show(FRAMES.help, { sweep: true });
          else if (k === 62) hub.clear({ sweep: true });
          else if (k >= 72) k = -1;
        }, 97);
      };
      onView(box, cycle, function () { clearInterval(loop); hub.clear(); });
    } else {
      var fr = kind === "answered" ? FRAMES.press : FRAMES.marta;
      if (reduced) { hub.show(fr); return; }
      onView(box, function () { setTimeout(function () { hub.show(fr, { sweep: true }); }, 700); });
    }
  }

  /* ---------- colours: six renders + the live display ---------- */
  var colBox = document.querySelector(".rhub--studio"), colImg = document.querySelector(".colours__img");
  var nameIn = document.getElementById("who-name");
  var showName = function (sweep) {
    var colours = colBox && overlayOf(colBox);
    if (!colours) return;
    var v = (nameIn && nameIn.value || "").replace(/[^A-Za-z0-9 ]+/g, "").trim().toUpperCase().slice(0, 8);
    colours.show(FRAMES.calling(v), { sweep: sweep });
  };
  if (colBox) whenNear(colBox, function () { showName(false); });
  if (nameIn) nameIn.addEventListener("input", function () { showName(true); });
  var NAMES = { berry: "berry blue", watermelon: "watermelon", ocean: "ocean orange", mint: "mint", violet: "violet", white: "white" };
  document.querySelectorAll(".swatch input").forEach(function (r) {
    // warm the cache on hover or focus, so the swap is instant
    var warm = function () { var i = new Image(); i.src = "img/col-" + r.value + "-600.webp"; };
    r.closest(".swatch").addEventListener("pointerenter", warm, { once: true });
    r.addEventListener("focus", warm, { once: true });
    r.addEventListener("change", function () {
      if (!r.checked || !colImg) return;
      var v = r.value;
      colImg.srcset = "img/col-" + v + "-600.webp 600w, img/col-" + v + "-960.webp 960w";
      colImg.src = "img/col-" + v + "-960.webp";
      colImg.alt = "Render of the hub in " + NAMES[v];
    });
  });

  /* ---------- the header takes the tone of the section under it ---------- */
  var toned = document.querySelectorAll("main > [data-tone], footer[data-tone]");
  var headIO = null;
  var watchHead = function () {
    if (!("IntersectionObserver" in window)) return;
    if (headIO) headIO.disconnect();
    var head = parseInt(getComputedStyle(root).getPropertyValue("--head"), 10) || 60;
    headIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) root.setAttribute("data-head", en.target.getAttribute("data-tone")); });
    }, { rootMargin: -(head) + "px 0px " + -(innerHeight - head - 2) + "px 0px" });
    toned.forEach(function (s) { headIO.observe(s); });
  };
  watchHead();
  addEventListener("resize", function () { clearTimeout(watchHead.t); watchHead.t = setTimeout(watchHead, 200); });

  /* ---------- voices: the index with preview ---------- */
  var who = document.querySelector(".voices__who");
  var quoteEl = document.querySelector(".voices__quote");
  var srcEl = document.querySelector(".voices__src");
  if (who && quoteEl) {
    var rows = Array.prototype.slice.call(who.querySelectorAll(".voice"));
    var fine = matchMedia("(hover: hover) and (pointer: fine)");
    var current = rows[0] || null;
    var select = function (row) {
      if (row === current) return;
      current = row;
      rows.forEach(function (r) { r.setAttribute("aria-pressed", r === row ? "true" : "false"); });
      var swap = function () {
        quoteEl.textContent = row.dataset.quote;
        if (srcEl) srcEl.textContent = row.dataset.src;
        quoteEl.classList.remove("is-fading");
      };
      if (reduced) { swap(); return; }
      quoteEl.classList.add("is-fading");
      setTimeout(swap, 240);
    };
    rows.forEach(function (row) {
      row.addEventListener("click", function () { select(row); });
      row.addEventListener("focus", function () { select(row); });
      row.addEventListener("pointerenter", function () { if (fine.matches) select(row); });
    });
  }

  /* ---------- Buy now → Coming soon ---------- */
  var dialog = document.getElementById("waitlist");
  var emailIn = document.getElementById("email");
  var lastSection = "unknown";
  var openSoon = function (section) {
    lastSection = section || "unknown";
    if (store) store.trackEvent("buy_click", { section: lastSection, price: cfg.price || 199, currency: cfg.currency || "EUR" });
    if (!dialog) return;
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
      setTimeout(function () { emailIn && emailIn.focus(); }, 60);
    } else {
      location.hash = "#waitlist";
    }
  };
  document.querySelectorAll("[data-buy]").forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      openSoon(a.getAttribute("data-buy"));
    });
  });
  if (dialog) {
    dialog.querySelectorAll("[data-close]").forEach(function (b) {
      // a link to #price so it also closes the no-script :target fallback; with script it acts as a button
      b.setAttribute("role", "button");
      b.addEventListener("click", function (e) { e.preventDefault(); dialog.close(); });
      b.addEventListener("keydown", function (e) { if (e.key === " ") { e.preventDefault(); dialog.close(); } });
    });
    dialog.addEventListener("click", function (e) {
      if (e.target === dialog) dialog.close();
    });
    if (location.hash === "#waitlist") openSoon("hash");
  }

  /* ---------- the waitlist form ---------- */
  var form = document.getElementById("waitlist-form");
  var msg = document.getElementById("waitlist-msg");
  var say = function (text, isError) {
    msg.textContent = text;
    msg.classList.toggle("is-error", !!isError);
    emailIn.setAttribute("aria-invalid", isError ? "true" : "false");
  };
  if (form && !store) {
    // store.js failed to load: never let the browser submit (the email would land in the address bar)
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      say("The waitlist could not load. Reload the page and try again.", true);
    });
  }
  if (form && store) {
    var submitBtn = form.querySelector("button[type=submit]");
    emailIn.addEventListener("blur", function () {
      if (emailIn.value && !store.isValidEmail(emailIn.value)) say("Enter a valid email address, like name@example.com.", true);
      else say("");
    });
    emailIn.addEventListener("input", function () { if (msg.classList.contains("is-error")) say(""); });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = emailIn.value.trim();
      // honeypot: people never see this field, form-filling bots do. Look done, store nothing.
      if (form.website && form.website.value) {
        store.trackEvent("waitlist_error", { code: "bot", section: lastSection });
        dialog.classList.add("is-done");
        return;
      }
      if (!store.isValidEmail(email)) {
        say("Enter a valid email address, like name@example.com.", true);
        emailIn.focus();
        store.trackEvent("waitlist_error", { code: "invalid_email", section: lastSection });
        return;
      }
      submitBtn.disabled = true;
      say("Adding you to the list…");
      store.addToWaitlist(email, { section: lastSection, price: cfg.price || 199 })
        .then(function () {
          store.trackEvent("waitlist_submit", { ok: true, section: lastSection });
          dialog.classList.add("is-done");
          say("");
          var done = dialog.querySelector(".soon__done h3");
          done && done.focus();
        })
        .catch(function (err) {
          var code = (err && err.code) || "unknown";
          if (code === "duplicate") {
            store.trackEvent("waitlist_submit", { ok: true, duplicate: true, section: lastSection });
            dialog.classList.add("is-done");
            say("");
            return;
          }
          store.trackEvent("waitlist_error", { code: code, section: lastSection });
          say((err && err.message) || "That did not go through. Check the address and try again.", true);
        })
        .then(function () { submitBtn.disabled = false; });
    });
  }
})();
