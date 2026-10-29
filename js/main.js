/* Seashell site v1: page behaviour (step 897). Own code. Everything degrades: the pages read
   without this file. Motion follows the measured durations of SPEC.md section 11. */
(function () {
  "use strict";
  var root = document.documentElement;
  root.classList.add("js");
  var store = window.SeashellStore;
  var cfg = window.SEASHELL_CONFIG || {};
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var phone = matchMedia("(max-width: 989px)");
  var view = document.body.getAttribute("data-view") || "";
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

  /* ---------- page view (the view name tells the three product views apart) ---------- */
  if (store) store.trackEvent("page_view", { title: document.title, view: view });

  /* ---------- the announcement bar: two messages swap every 2.9 s with a 0.4 s fade ---------- */
  var bar = $(".mbar");
  if (bar && !reduced) {
    var msgs = $$("span", bar), i = 0;
    setInterval(function () {
      msgs[i].hidden = true; i = (i + 1) % msgs.length; msgs[i].hidden = false;
    }, 2900);
  }

  /* ---------- the phone menu: 0.42 s slide, backdrop 0.34 s ---------- */
  var menu = $("#menu"), burger = $(".burger");
  var openMenu = function (on) {
    if (!menu) return;
    if (on) { menu.hidden = false; requestAnimationFrame(function () { menu.classList.add("is-open"); }); }
    else { menu.classList.remove("is-open"); setTimeout(function () { menu.hidden = true; }, reduced ? 0 : 420); }
    burger && burger.setAttribute("aria-expanded", on ? "true" : "false");
    document.body.style.overflow = on ? "hidden" : "";
  };
  burger && burger.addEventListener("click", function () { openMenu(true); });
  $$("[data-menu-close]").forEach(function (b) { b.addEventListener("click", function () { openMenu(false); }); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && menu && !menu.hidden) openMenu(false); });

  /* ---------- the backstage header hides on the way down, returns on the way up ---------- */
  var bh = $("#bh");
  if (bh) {
    var lastY = window.scrollY;
    window.addEventListener("scroll", function () {
      var y = window.scrollY;
      bh.classList.toggle("is-hidden", y > lastY && y > 80);
      lastY = y;
    }, { passive: true });
  }

  /* ---------- page change: a white veil, 0.26 s ---------- */
  var veil = $(".veil");
  if (veil && !reduced) {
    $$("a[href]").forEach(function (a) {
      var href = a.getAttribute("href");
      if (!href || href.charAt(0) === "#" || /^(https?:|mailto:)/.test(href) || a.hasAttribute("data-buy") || a.target) return;
      a.addEventListener("click", function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
        e.preventDefault();
        veil.classList.add("is-on");
        setTimeout(function () { location.href = a.href; }, 260);
      });
    });
    window.addEventListener("pageshow", function () { veil.classList.remove("is-on"); });
  }

  /* ---------- lazy pictures fade in (0.3 s); a 2 s pulse while they load ---------- */
  $$("img[loading=lazy]").forEach(function (img) {
    var box = img.closest(".pic");
    var done = function () { img.classList.add("is-in"); box && box.classList.remove("is-loading"); };
    if (img.complete && img.naturalWidth) done();
    else { box && box.classList.add("is-loading"); img.addEventListener("load", done); img.addEventListener("error", done); }
  });

  /* ---------- rails: a track that moves 0.45 s, or slides that cross-fade 0.32 s ---------- */
  var rails = {};
  $$("[data-rail]").forEach(function (rail) {
    var name = rail.getAttribute("data-rail");
    var slides = $$("[data-slides] > *", rail);
    var track = $(".track", rail);
    var items = slides.length ? slides : (track ? $$(":scope > *", track) : []);
    if (!items.length) return;
    var n = items.length, at = 0;
    var counters = $$("[data-counter=" + name + "]");
    var show = function (k) {
      at = (k + n) % n;
      if (slides.length) items.forEach(function (el, j) { el.classList.toggle("is-on", j === at); });
      else if (track) {
        var x = 0;
        for (var j = 0; j < at; j++) x += items[j].getBoundingClientRect().width + parseFloat(getComputedStyle(items[j]).marginRight || 0) + parseFloat(getComputedStyle(track).gap || 0);
        track.style.transform = "translateX(" + (-x) + "px)";
      }
      counters.forEach(function (c) { c.textContent = (at + 1) + "/" + n; });
    };
    rails[name] = { show: show, next: function () { show(at + 1); }, prev: function () { show(at - 1); } };
    show(0);
  });
  $$("[data-next], [data-prev]").forEach(function (b) {
    var name = b.getAttribute("data-next") || b.getAttribute("data-prev") || (b.closest(".sec") && $("[data-rail]", b.closest(".sec")).getAttribute("data-rail"));
    b.addEventListener("click", function () { var r = rails[name]; if (r) (b.hasAttribute("data-next") ? r.next : r.prev)(); });
  });
  // swatches only mark the choice (every render is berry until the v4 set exists)
  $$(".swatch").forEach(function (s) {
    s.addEventListener("click", function () { $$(".swatch").forEach(function (o) { o.setAttribute("aria-pressed", o === s ? "true" : "false"); }); });
  });

  /* ---------- the four moves: poster first, the file loads on play ---------- */
  $$("[data-film=move]").forEach(function (fig) {
    var v = $("video", fig), play = $(".play", fig), mute = $(".mute", fig);
    if (!v) return;
    play.addEventListener("click", function () {
      if (!v.src) { v.src = v.getAttribute("data-src"); v.load(); }
      if (v.paused) { v.play().then(function () { play.setAttribute("aria-label", "pause"); play.style.opacity = "0"; }).catch(function () {}); }
      else { v.pause(); play.setAttribute("aria-label", "play"); play.style.opacity = ""; }
    });
    v.addEventListener("click", function () { play.click(); });
    v.addEventListener("ended", function () { play.style.opacity = ""; });
    mute && mute.addEventListener("click", function () {
      v.muted = !v.muted;
      mute.setAttribute("aria-pressed", v.muted ? "false" : "true");
      mute.setAttribute("aria-label", v.muted ? "sound on" : "sound off");
    });
  });

  /* ---------- the home film (step 911): silent, muted, looping; with reduced motion the poster picture under it stays ---------- */
  $$("video[data-hero]").forEach(function (v) {
    if (reduced) { v.removeAttribute("autoplay"); v.pause(); v.preload = "none"; v.hidden = true; return; }
    v.muted = true;
    var p = v.play();
    if (p && p.catch) p.catch(function () {});
  });

  /* ---------- accordions (one open per set) and the FAQ groups ---------- */
  var wire = function (sel, itemSel) {
    $$(sel).forEach(function (set) {
      var items = $$(itemSel, set);
      items.forEach(function (it) {
        var b = $(":scope > button", it);
        b && b.addEventListener("click", function () {
          var open = !it.classList.contains("is-open");
          items.forEach(function (o) { o.classList.remove("is-open"); $(":scope > button", o).setAttribute("aria-expanded", "false"); });
          if (open) { it.classList.add("is-open"); b.setAttribute("aria-expanded", "true"); }
        });
      });
    });
  };
  wire("[data-acc-set]", ".acc");
  wire("[data-faq-set]", ".faq-group");
  // on the phone each question opens on its own (one per group); the first group and its first question start open
  var openQ = function (dt, on) {
    $$("dt", dt.closest(".faq-group")).forEach(function (o) { o.classList.remove("is-open"); $("button", o).setAttribute("aria-expanded", "false"); });
    if (on) { dt.classList.add("is-open"); $("button", dt).setAttribute("aria-expanded", "true"); }
  };
  $$(".faq-group dt > button").forEach(function (b) {
    if (phone.matches) b.setAttribute("aria-expanded", "false");
    b.addEventListener("click", function () { if (phone.matches) openQ(b.parentNode, !b.parentNode.classList.contains("is-open")); });
  });
  if (phone.matches) {
    var g0 = $("[data-faq-set] .faq-group");
    if (g0) { g0.classList.add("is-open"); $(":scope > button", g0).setAttribute("aria-expanded", "true"); var q0 = $("dt", g0); q0 && openQ(q0, true); }
  }

  /* ---------- tabs (the three places) and the numbered markers ---------- */
  var setTab = function (id) {
    $$("[data-tabs] .tab").forEach(function (t) {
      var on = t.getAttribute("data-tab") === id;
      t.classList.toggle("is-on", on);
      if (t.style.display !== undefined && t.closest(".sign-m")) t.style.display = on ? "" : "none";
    });
    $$("[data-tab-for]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-tab-for") === id ? "true" : "false"); });
  };
  $$("[data-tab-for]").forEach(function (b) { b.addEventListener("click", function () { setTab(b.getAttribute("data-tab-for")); }); });
  $$("[data-state]").forEach(function (b) {
    if (b.tagName !== "BUTTON") return;
    b.addEventListener("click", function () {
      var id = b.getAttribute("data-state");
      $$("button[data-state]").forEach(function (o) { o.setAttribute("aria-pressed", o === b ? "true" : "false"); });
      $$("[data-states] .st").forEach(function (s) { s.classList.toggle("is-on", s.getAttribute("data-state") === id); });
    });
  });
  $$("[data-state-list]").forEach(function (list) {
    $$("button", list).forEach(function (b) {
      b.addEventListener("click", function () { $$("button", list).forEach(function (o) { o.setAttribute("aria-pressed", o === b ? "true" : "false"); }); });
    });
  });
  var hear = $("[data-hear]");
  hear && hear.addEventListener("click", function () { hear.textContent = "sound to come"; hear.disabled = true; });

  /* ---------- the phone intro on home: the mark draws itself, the word settles, then a 0.18 s fade ---------- */
  if (view === "home" && phone.matches && !reduced) {
    var seen = false;
    try { seen = sessionStorage.getItem("seashell.intro") === "1"; sessionStorage.setItem("seashell.intro", "1"); } catch (e) {}
    if (!seen) {
      var intro = document.createElement("div");
      intro.className = "intro is-on";
      intro.innerHTML = '<div class="lockup"><div class="mk"><img class="full" src="brand/mark.svg" alt="" style="position:absolute;inset:0;width:100%;height:100%"></div><img class="wd" src="brand/wordmark.svg" alt="Seashell"></div>';
      document.body.appendChild(intro);
      // the brush's centre line (pathLength 1) is inlined so its stroke can be drawn on
      fetch("brand/mark-line.svg").then(function (r) { return r.text(); }).then(function (svg) {
        var holder = document.createElement("div"); holder.innerHTML = svg;
        var el = holder.querySelector("svg"); if (!el) return;
        el.classList.add("line"); el.removeAttribute("role"); el.setAttribute("aria-hidden", "true");
        $(".mk", intro).prepend(el);
      }).catch(function () {});
      setTimeout(function () { intro.classList.add("is-out"); setTimeout(function () { intro.remove(); }, 180); }, 2400);
    }
  }

  $$("[data-up]").forEach(function (a) {
    a.addEventListener("click", function (e) { e.preventDefault(); window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" }); });
  });

  /* ---------- the journal: a drifting ring of tiles round the centre pair, and the viewer ---------- */
  var ground = $("[data-ring]");
  if (ground && window.JOURNAL) {
    var J = window.JOURNAL, pair = $("[data-pair]", ground), imgA = $("[data-a]", pair), imgB = $("[data-b]", pair), labEl = $(".lab", pair);
    var tiles = [], N = 48;
    for (var t = 0; t < N; t++) {
      var story = J[t % J.length], side = (t % 2) ? "b" : "a";
      var el = document.createElement("button");
      el.type = "button"; el.className = "tile"; el.setAttribute("aria-label", story.id);
      var src = story[side];
      el.innerHTML = src ? '<img src="' + src + '" alt="">' : '<span class="frame-empty" style="font-size:1rem; background:var(--panel); color:var(--meta)">' + story.id + '</span>';
      el.addEventListener("click", (function (s) { return function () { setPair(s); }; })(story));
      ground.appendChild(el); tiles.push(el);
    }
    var cur = J[0];   // the surf pair first (review-v4, fix 15)
    var setPair = function (s) {
      cur = s;
      [imgA, imgB].forEach(function (im, k) {
        var src = s[k ? "b" : "a"], alt = s[k ? "bAlt" : "aAlt"];
        im.style.opacity = 0;
        setTimeout(function () {
          if (src) { im.src = src; im.alt = alt; im.style.visibility = ""; }
          else { im.removeAttribute("src"); im.alt = alt; im.style.visibility = "hidden"; }
          im.style.opacity = 1;
        }, 160);
      });
      labEl.textContent = s.labA + " · " + s.labB;
    };
    var place = function (phase) {
      var W = ground.clientWidth, H = ground.clientHeight, cx = W / 2, cy = H / 2;
      var rx = phone.matches ? W * 0.44 : W * 0.39, ry = phone.matches ? H * 0.42 : H * 0.45;
      tiles.forEach(function (el, k) {
        var a = phase + k * Math.PI * 2 / N;
        var x = cx + rx * Math.cos(a), y = cy + ry * Math.sin(a);
        var s = (phone.matches ? 40 : 57) + (phone.matches ? 18 : 37) * (0.5 + 0.5 * Math.cos(a));   // 57 to 94 px, bigger at the right
        el.style.width = s + "px"; el.style.height = s * (0.76 + 0.54 * (0.5 + 0.5 * Math.sin(a))) + "px";
        el.style.transform = "translate(" + (x - s / 2) + "px," + (y - s / 2) + "px)";
      });
    };
    var phase = 0;
    place(phase);
    if (!reduced) (function tick() { phase += 0.0008; place(phase); requestAnimationFrame(tick); })();
    window.addEventListener("resize", function () { place(phase); });
    var viewer = $("#viewer");
    var openViewer = function () {
      if (!viewer) return;
      var im = $("[data-view-img]", viewer);
      if (cur.a) { im.src = cur.a; im.alt = cur.aAlt; im.style.display = ""; } else { im.removeAttribute("src"); im.alt = cur.aAlt; im.style.display = "none"; }
      $("[data-view-cap]", viewer).textContent = cur.cap;
      viewer.showModal();
    };
    pair.addEventListener("click", openViewer);
    pair.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openViewer(); } });
    viewer && $("[data-close]", viewer).addEventListener("click", function () { viewer.close(); });
    viewer && viewer.addEventListener("click", function (e) { if (e.target === viewer) viewer.close(); });
  }

  /* ---------- buy now: the Coming soon window and the waitlist ---------- */
  var dialog = $("#waitlist"), emailIn = $("#email"), lastSection = "unknown";
  var openSoon = function (section) {
    lastSection = section || "unknown";
    if (store) store.trackEvent("buy_click", { section: lastSection, price: cfg.price || 199, currency: cfg.currency || "EUR", view: view });
    if (!dialog) return;
    if (typeof dialog.showModal === "function") { if (!dialog.open) dialog.showModal(); setTimeout(function () { emailIn && emailIn.focus(); }, 60); }
    else location.hash = "#waitlist";
  };
  $$("[data-buy]").forEach(function (a) { a.addEventListener("click", function (e) { e.preventDefault(); openSoon(a.getAttribute("data-buy")); }); });
  $$("dialog.box").forEach(function (d) {
    $$("[data-close]", d).forEach(function (b) { b.addEventListener("click", function () { d.close(); }); });
    d.addEventListener("click", function (e) { if (e.target === d) d.close(); });
  });
  var yd = $("#yourdata");
  $$("[data-yourdata]").forEach(function (a) { a.addEventListener("click", function (e) { e.preventDefault(); yd && yd.showModal(); }); });
  if (dialog && location.hash === "#waitlist") openSoon("hash");

  var submitTo = function (form, email, hpField, msgEl, section, onDone) {
    var say = function (text, bad) { msgEl.textContent = text; msgEl.classList.toggle("is-error", !!bad); };
    if (!store) { say("The waitlist could not load. Reload the page and try again.", true); return; }
    if (hpField && hpField.value) { store.trackEvent("waitlist_error", { code: "bot", section: section }); onDone(); return; }
    if (!store.isValidEmail(email)) { say("Enter a valid email address, like name@example.com.", true); store.trackEvent("waitlist_error", { code: "invalid_email", section: section }); return; }
    var btn = $("button[type=submit]", form); btn.disabled = true;
    say("Adding you to the list…");
    store.addToWaitlist(email, { section: section, price: cfg.price || 199 })
      .then(function () { store.trackEvent("waitlist_submit", { ok: true, section: section, view: view }); say(""); onDone(); })
      .catch(function (err) {
        var code = (err && err.code) || "unknown";
        if (code === "duplicate") { store.trackEvent("waitlist_submit", { ok: true, duplicate: true, section: section, view: view }); say(""); onDone(); return; }
        store.trackEvent("waitlist_error", { code: code, section: section });
        say((err && err.message) || "That did not go through. Check the address and try again.", true);
      })
      .then(function () { btn.disabled = false; });
  };
  var form = $("#waitlist-form");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      submitTo(form, emailIn.value.trim(), form.website, $("#waitlist-msg"), lastSection, function () { dialog.classList.add("is-done"); var h = $(".done h3", dialog); h && h.focus(); });
    });
  }
  var ff = $(".ft-form");
  if (ff) {
    ff.addEventListener("submit", function (e) {
      e.preventDefault();
      var msg = $(".ft .msg");
      submitTo(ff, $("#ft-email").value.trim(), ff.website, msg, "footer", function () { ff.hidden = true; msg.textContent = "You're on the list. We write when pre-order opens."; });
    });
  }
})();
