/* Seashell website: page behaviour. Everything degrades: the page reads without this file. */
(function () {
  "use strict";
  var root = document.documentElement;
  root.classList.add("js");
  var store = window.SeashellStore;
  var cfg = window.SEASHELL_CONFIG || {};
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- page view ---------- */
  if (store) store.trackEvent("page_view", { title: document.title });

  /* ---------- reveals on scroll (once) ---------- */
  var toReveal = document.querySelectorAll("[data-reveal]");
  if ("IntersectionObserver" in window && !reduced) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    toReveal.forEach(function (el) { io.observe(el); });
  } else {
    toReveal.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* ---------- voices: the index with preview ---------- */
  var who = document.querySelector(".voices__who");
  var quoteEl = document.querySelector(".voices__quote");
  var srcEl = document.querySelector(".voices__src");
  if (who && quoteEl) {
    var rows = Array.prototype.slice.call(who.querySelectorAll(".voice"));
    var fine = matchMedia("(hover: hover) and (pointer: fine)");
    var current = null;
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
    rows[0] && (current = rows[0]);
  }

  /* ---------- the hub: tabs ---------- */
  var tabs = document.querySelectorAll(".tab");
  var panels = document.querySelectorAll(".hub__desc");
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabs.forEach(function (t) { t.setAttribute("aria-selected", t === tab ? "true" : "false"); t.tabIndex = t === tab ? 0 : -1; });
      panels.forEach(function (p) { p.hidden = p.id !== tab.getAttribute("aria-controls"); });
    });
    tab.addEventListener("keydown", function (e) {
      var i = Array.prototype.indexOf.call(tabs, tab);
      var next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : -1;
      if (next < 0 || next >= tabs.length) return;
      e.preventDefault(); tabs[next].focus(); tabs[next].click();
    });
  });

  /* ---------- the live thing: a name on the two-line display ---------- */
  var nameIn = document.getElementById("who-name");
  var line1 = document.getElementById("screen-line1");
  if (nameIn && line1) {
    var render = function () {
      var v = nameIn.value.replace(/\s+/g, " ").trim().toUpperCase().slice(0, 12);
      line1.textContent = v || "MARTA";
    };
    nameIn.addEventListener("input", render);
    render();
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
