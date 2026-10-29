/* Seashell website: events + waitlist store.
   One interface, three adapters (picked by js/config.js):
     supabase  REST inserts into tables `events` and `waitlist` (db/supabase-schema.sql)
     artifact  the claude.ai artifact runtime `db` capability (private preview only)
     local     localStorage, with a visible console notice (nothing leaves the browser)

   Usage (after config.js):
     SeashellStore.trackEvent("buy_click", { section: "hero", price: 199 });
     SeashellStore.addToWaitlist("a@b.c", { section: "hero" });
   trackEvent never rejects (errors are logged). addToWaitlist rejects with { code, message }
   so the form can show a real error; code "duplicate" means the email is already on the list. */
(function () {
  "use strict";

  var cfg = window.SEASHELL_CONFIG || {};
  var SESSION_KEY = "seashell.session";
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function sessionId() {
    try {
      var id = sessionStorage.getItem(SESSION_KEY);
      if (!id) {
        id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
          : "s-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
        sessionStorage.setItem(SESSION_KEY, id);
      }
      return id;
    } catch (e) { return "s-nostorage"; }
  }

  // utm_* and ?place= from the address (an ad, a pitch QR code or a post carries them), stored in
  // sessionStorage on the landing page and sent with every event and the waitlist row, so later pages
  // (which have no query string) keep them. A new landing with any of these keys replaces the set.
  var CAMPAIGN_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "place"];
  function utm() {
    var out = {};
    try {
      var q = new URLSearchParams(location.search);
      CAMPAIGN_KEYS.forEach(function (k) {
        var v = q.get(k);
        if (v) out[k] = v.slice(0, 120);
      });
      if (Object.keys(out).length) sessionStorage.setItem("seashell.utm", JSON.stringify(out));
      else out = JSON.parse(sessionStorage.getItem("seashell.utm") || "{}");
    } catch (e) { /* storage blocked: keep what the URL gave */ }
    return out;
  }

  // Local mode is only honest on a developer's own machine (or a file opened from disk). Anywhere
  // else it means the deploy skipped deploy.py and nothing reaches the database.
  var DEV_HOST = /^(localhost|127\.0\.0\.1|\[::1\]|.*\.localhost)?$/;
  function isDevHost() { return DEV_HOST.test(location.hostname); }

  // lengths kept under the database's size checks (db/migrations/20261028200000_*.sql)
  function context() {
    return {
      path: location.pathname.slice(0, 500),
      referrer: (document.referrer || "").slice(0, 1000),
      user_agent: navigator.userAgent.slice(0, 500),
      session_id: sessionId(),
      tag: cfg.source || "site",
      utm: utm(),
      lang: navigator.language || "",
      viewport: window.innerWidth + "x" + window.innerHeight,
      ts: new Date().toISOString()
    };
  }

  /* ---------- adapter: supabase ----------
     Columns match db/supabase-schema.sql (the migration that is live in the project).
     Only the `apikey` header is sent: a publishable key (sb_publishable_...) is not a JWT and
     must not go in Authorization. `Prefer: return=minimal` because anon may INSERT but not SELECT. */
  function supabaseAdapter(url, key) {
    var base = url.replace(/\/+$/, "") + "/rest/v1/";
    function insert(table, row) {
      return fetch(base + table, {
        method: "POST",
        headers: { "apikey": key, "Content-Type": "application/json", "Prefer": "return=minimal" },
        body: JSON.stringify(row),
        keepalive: true
      }).then(function (res) {
        if (res.ok) return true;
        return res.text().then(function (t) {
          var err = new Error("supabase " + res.status);
          err.code = res.status === 409 ? "duplicate"
            : (res.status === 401 || res.status === 403) ? "forbidden" : "http_" + res.status;
          err.detail = t.slice(0, 300);
          throw err;
        });
      });
    }
    return {
      name: "supabase",
      event: function (name, props, c) {
        return insert("events", {
          name: name,
          props: Object.assign({ tag: c.tag, utm: c.utm, lang: c.lang, viewport: c.viewport }, props || {}),
          session_id: c.session_id, path: c.path, referrer: c.referrer, user_agent: c.user_agent
        });
      },
      waitlist: function (email, props, c) {
        return insert("waitlist", {
          email: email,
          source: String((props && props.section) || "unknown").slice(0, 60),   // which Buy-now button opened the form
          path: c.path, referrer: c.referrer, user_agent: c.user_agent,
          consent_at: c.ts,                                   // the moment "Join the waitlist" was pressed
          utm: Object.assign({ tag: c.tag, session_id: c.session_id }, c.utm)
        });
      }
    };
  }

  /* ---------- adapter: claude.ai artifact db ----------
     Collections `waitlist` and `events`, each viewer writing only under their own id:
       waitlist/<viewer id>                          one sign-up per viewer (a resubmit replaces it)
       events/<viewer id>/sessions/<session id>      one document per visit, events appended in it
     (one document per visit, not per event: an artifact database holds at most 25,000 documents).
     Publish with the rules in db/README.md so only Pau (owner) and editors read the rows. */
  function artifactAdapter(db, uid) {
    var sid = sessionId();
    var log = [];
    var started = new Date().toISOString();
    var chain = Promise.resolve();
    var sessionDoc = db.collection("events").doc(uid).collection("sessions").doc(sid);
    function flush(c) {
      // one write at a time per document: queue each set() behind the previous one
      var body = {
        session_id: sid, created_at: started, updated_at: new Date().toISOString(),
        path: c.path, referrer: c.referrer, user_agent: c.user_agent, tag: c.tag, utm: c.utm,
        events: log.slice(-400)
      };
      chain = chain.then(function () { return sessionDoc.set(body); });
      return chain;
    }
    return {
      name: "artifact",
      event: function (name, props, c) {
        log.push({ name: name, props: props || {}, ts: c.ts });
        return flush(c);
      },
      waitlist: function (email, props, c) {
        return db.collection("waitlist").doc(uid).set({
          email: email, source: (props && props.section) || "unknown", consent_at: c.ts,
          path: c.path, referrer: c.referrer, user_agent: c.user_agent, tag: c.tag, utm: c.utm,
          session_id: sid
        });
      }
    };
  }

  /* ---------- adapter: localStorage ---------- */
  function localAdapter(reason) {
    var noticed = false;
    function notice() {
      if (noticed) return; noticed = true;
      if (!isDevHost()) console.error("[Seashell store] NOT CONFIGURED on " + location.hostname +
        ": no Supabase url/key in js/config.js. Deploy with site-v1/deploy_v1.py. Sign-ups are refused.");
      console.warn("[Seashell store] LOCAL MODE (" + reason + "): page views, Buy-now clicks and waitlist " +
        "sign-ups stay in this browser's localStorage (keys seashell.events, seashell.waitlist). Nothing " +
        "is sent anywhere. The deployed copy (site-v1/deploy_v1.py) carries the key and writes to Supabase.");
    }
    function push(key, row) {
      notice();
      try {
        var arr = JSON.parse(localStorage.getItem(key) || "[]");
        arr.push(row);
        localStorage.setItem(key, JSON.stringify(arr.slice(-500)));
      } catch (e) { /* private window or blocked storage: nothing to keep */ }
      return Promise.resolve(true);
    }
    return {
      name: "local",
      event: function (name, props, c) { return push("seashell.events", Object.assign({ name: name, props: props || {} }, c)); },
      waitlist: function (email, props, c) { return push("seashell.waitlist", Object.assign({ email: email, consent_at: c.ts, props: props || {} }, c)); }
    };
  }

  /* ---------- pick the adapter ---------- */
  function tryArtifact() {
    var claude = window.claude;
    if (!claude || typeof claude.use !== "function") return Promise.resolve(null);
    return Promise.all([claude.use("db"), claude.use("user")]).then(function (r) {
      var db = r[0], user = r[1];
      if (!db || !user) return null;
      // a view-only viewer cannot write (their own subtree needs Contributor): use their browser instead
      var canWrite = typeof user.can === "function" ? user.can("data.write") : null;
      return Promise.all([user.id(), canWrite]).then(function (r2) {
        var uid = r2[0];
        if (!uid || r2[1] === false) return null;
        return artifactAdapter(db, uid);
      });
    }).catch(function () { return null; });
  }

  var ready = (function () {
    var want = cfg.adapter || "auto";
    var sb = cfg.supabase || {};
    var hasSb = !!(sb.url && sb.anonKey);
    if (want === "local") return Promise.resolve(localAdapter("set in config.js"));
    if (want === "supabase") {
      return Promise.resolve(hasSb ? supabaseAdapter(sb.url, sb.anonKey) : localAdapter("supabase url/anonKey empty"));
    }
    // "auto" and "artifact": inside a claude.ai artifact the db capability wins (private preview)
    return tryArtifact().then(function (a) {
      if (a) return a;
      if (want === "artifact") return localAdapter("not inside a claude.ai artifact with db");
      return hasSb ? supabaseAdapter(sb.url, sb.anonKey) : localAdapter("no supabase url/anonKey in config.js");
    });
  })();

  function isValidEmail(email) {
    email = String(email || "").trim();
    return email.length <= 254 && EMAIL.test(email);
  }

  window.SeashellStore = {
    ready: ready.then(function (a) { return a.name; }),
    isValidEmail: isValidEmail,

    trackEvent: function (name, props) {
      var c = context();
      return ready.then(function (a) { return a.event(name, props, c); })
        .catch(function (err) { console.error("[Seashell store] event failed", name, err); return false; });
    },

    addToWaitlist: function (email, props) {
      email = String(email || "").trim().toLowerCase();
      if (!isValidEmail(email)) return Promise.reject({ code: "invalid_email", message: "Enter a valid email address, like name@example.com." });
      var c = context();
      return ready.then(function (a) {
          // never show "You're on the list" for an email that only went into this browser
          if (a.name === "local" && !isDevHost()) {
            throw { code: "not_configured" };
          }
          return a.waitlist(email, props, c);
        })
        .then(function () { return { ok: true }; })
        .catch(function (err) {
          var code = (err && err.code) || "unknown";
          if (code !== "duplicate") console.error("[Seashell store] waitlist failed", err);
          throw { code: code, message: code === "not_configured"
            ? "The waitlist is not switched on yet, so your email was not saved. Please try again later."
            : "That did not go through. Check the address and try again." };
        });
    }
  };
})();
