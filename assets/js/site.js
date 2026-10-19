/* WubbzP.com shared scripts. Every feature checks that its elements exist,
   so this one file can be loaded on every page. */
(function () {
  "use strict";

  function storage(type) {
    try {
      var s = window[type];
      s.setItem("wubbzp-test", "1");
      s.removeItem("wubbzp-test");
      return s;
    } catch (e) {
      return null;
    }
  }
  var session = storage("sessionStorage");
  var local = storage("localStorage");
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Footer year
  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  // Pronunciation buttons
  document.querySelectorAll("[data-play]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var audio = document.getElementById(btn.getAttribute("data-play"));
      if (audio) { audio.currentTime = 0; audio.play(); }
    });
  });

  // Mystery "?" on the Cover Collection placeholder: spin, sparkle, tease.
  var mystery = document.getElementById("mystery");
  if (mystery) {
    var wrap = mystery.parentNode;
    var bubble = wrap.querySelector(".mystery-bubble");
    var lines = ["It's a surprise!", "Coming soon!", "No peeking!", "Wow! Wow!", "Stay tuned!"];
    var n = 0, timer;
    mystery.addEventListener("click", function () {
      bubble.textContent = lines[n++ % lines.length];
      mystery.classList.remove("pop");
      void mystery.offsetWidth;
      mystery.classList.add("pop");
      wrap.classList.add("show-bubble");
      clearTimeout(timer);
      timer = setTimeout(function () { wrap.classList.remove("show-bubble"); }, 1600);
      if (reduceMotion) return;
      var shapes = ["★", "♪", "✦", "♫"];
      for (var i = 0; i < 8; i++) {
        var s = document.createElement("span");
        var a = (Math.PI * 2 * i) / 8;
        s.className = "sparkle";
        s.setAttribute("aria-hidden", "true");
        s.textContent = shapes[i % shapes.length];
        s.style.setProperty("--dx", Math.cos(a) * 70 + "px");
        s.style.setProperty("--dy", Math.sin(a) * 70 + "px");
        wrap.appendChild(s);
        s.addEventListener("animationend", function () { this.remove(); });
      }
    });
  }

  // Visitor counter (Abacus, a free counting API). Each browser session is
  // counted once; later page views in the same session only read the total.
  var counter = document.getElementById("counter");
  if (counter) {
    var API = "https://abacus.jasoncameron.dev";
    var COUNTER = "wubbzp-com/visits";
    var status = document.getElementById("counter-status");
    var counted = session && session.getItem("wubbzp-counted") === "1";

    var show = function (value) {
      var digits = String(value).padStart(6, "0").split("");
      counter.innerHTML = digits.map(function (d) { return "<span>" + d + "</span>"; }).join("");
      counter.setAttribute("aria-label", value + " visitors");
    };

    var cached = local && parseInt(local.getItem("wubbzp-count"), 10);
    if (cached > 0) show(cached);

    fetch(API + (counted ? "/get/" : "/hit/") + COUNTER, { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        var value = Number(data.value);
        if (!isFinite(value)) throw new Error("No count");
        show(value);
        if (session) session.setItem("wubbzp-counted", "1");
        if (local) local.setItem("wubbzp-count", String(value));
      })
      .catch(function () {
        if (status) status.textContent = "The counter's taking a nap! Check back soon.";
      });
  }

  // Pickers: the original site's Characters-page layout (thumbnails on the
  // left, details on the right, CLOSE X to go back to the overview).
  document.querySelectorAll("[data-picker]").forEach(function (picker) {
    var tabs = Array.prototype.slice.call(picker.querySelectorAll("[role=tab]"));
    var panels = Array.prototype.slice.call(picker.querySelectorAll(".picker-panel"));
    var overview = picker.querySelector(".picker-panel[data-overview]");
    var close = picker.querySelector(".close-x");
    var stage = picker.querySelector(".picker-stage");

    function panelFor(id) {
      for (var i = 0; i < panels.length; i++) if (panels[i].id === id) return panels[i];
      return null;
    }

    function select(id, opts) {
      opts = opts || {};
      var panel = panelFor(id) || overview;
      panels.forEach(function (p) { p.hidden = p !== panel; });
      var anySelected = false;
      tabs.forEach(function (t) {
        var on = t.getAttribute("aria-controls") === panel.id;
        if (on) anySelected = true;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
      });
      if (!anySelected && tabs[0]) tabs[0].tabIndex = 0;
      if (close) close.hidden = panel === overview;
      if (opts.updateHash) {
        history.replaceState(null, "", panel === overview ? location.pathname : "#" + panel.id);
      }
      if (opts.scroll) {
        var rect = stage.getBoundingClientRect();
        if (rect.top < 0 || rect.top > window.innerHeight * 0.6) {
          stage.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
        }
      }
      if (opts.focusPanel) {
        var heading = panel.querySelector("h2");
        if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
      }
    }

    picker.addEventListener("click", function (e) {
      var link = e.target.closest("a[href^='#']");
      if (!link || !panelFor(link.getAttribute("href").slice(1))) return;
      e.preventDefault();
      select(link.getAttribute("href").slice(1), { updateHash: true, scroll: true, focusPanel: !link.matches("[role=tab]") });
    });

    picker.addEventListener("keydown", function (e) {
      var i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      var next = null;
      if (e.key === "ArrowDown" || e.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = tabs[(i - 1 + tabs.length) % tabs.length];
      if (e.key === "Home") next = tabs[0];
      if (e.key === "End") next = tabs[tabs.length - 1];
      if (!next) return;
      e.preventDefault();
      next.focus();
      select(next.getAttribute("aria-controls"), { updateHash: true });
    });

    if (close) {
      close.addEventListener("click", function () {
        select(overview.id, { updateHash: true, focusPanel: true });
      });
    }

    window.addEventListener("hashchange", function () {
      select(location.hash.slice(1));
    });

    picker.classList.add("is-ready");
    select(location.hash.slice(1));
  });

  // Copy-to-clipboard buttons (Contact page)
  document.querySelectorAll("[data-copy]").forEach(function (btn) {
    var out = document.getElementById(btn.getAttribute("aria-describedby"));
    btn.addEventListener("click", function () {
      var text = btn.getAttribute("data-copy");
      var done = function (msg) { if (out) out.textContent = msg; };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          function () { done("Copied! Wow, wow!"); },
          function () { done("Couldn't copy. The address is " + text); }
        );
      } else {
        done("Couldn't copy. The address is " + text);
      }
    });
  });
})();
