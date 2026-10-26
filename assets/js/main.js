/* Site orchestration: wire navigation, scroll-spy, scroll-reveal, and the
   BibTeX copy button. Mirrors the TerraZero site's behavior, trimmed to the
   features this page uses. */
(function () {
  "use strict";

  // ---- navigation ----------------------------------------------------------
  function initNav() {
    var toggle = document.querySelector(".nav-toggle");
    var nav = document.getElementById("nav");
    if (toggle && nav) {
      toggle.addEventListener("click", function () {
        var open = nav.classList.toggle("open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
      });
      nav.querySelectorAll("a").forEach(function (a) {
        a.addEventListener("click", function () {
          nav.classList.remove("open");
          toggle.setAttribute("aria-expanded", "false");
        });
      });
    }

    // scroll-spy; a link may also cover extra sections listed in data-spy
    var links = Array.prototype.slice.call(document.querySelectorAll("#nav a"));
    var map = {};
    links.forEach(function (a) {
      var ids = [a.getAttribute("href").slice(1)].concat((a.getAttribute("data-spy") || "").split(/\s+/));
      ids.forEach(function (id) {
        if (id && document.getElementById(id)) map[id] = a;
      });
    });
    var sections = Object.keys(map).map(function (id) { return document.getElementById(id); });
    if (!("IntersectionObserver" in window) || !sections.length) return;
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          links.forEach(function (l) { l.classList.remove("active"); });
          var a = map[e.target.id];
          if (a) a.classList.add("active");
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });
    sections.forEach(function (s) { obs.observe(s); });
  }

  // ---- scroll reveal -------------------------------------------------------
  function initReveal() {
    var items = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) {
      items.forEach(function (i) { i.classList.add("in"); });
      return;
    }
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); obs.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.05 });
    items.forEach(function (i) { obs.observe(i); });
  }

  // ---- hero timeline -------------------------------------------------------
  // The CSS choreography runs once when .is-playing is added (to .tl for the
  // rail, to each .tl-item for its dot/title/panel). Wide screens: play the
  // whole ~3 s sequence once the timeline is on screen. Stacked (narrow)
  // layout: play each work as it scrolls in, spaced at least one --t-step
  // after the previous one so they still land one by one.
  function initTimeline() {
    var tl = document.querySelector(".tl");
    if (!tl) return;
    var items = Array.prototype.slice.call(tl.querySelectorAll(".tl-item"));
    function playAll() {
      tl.classList.add("is-playing");
      items.forEach(function (i) { i.classList.add("is-playing"); });
    }
    if (!("IntersectionObserver" in window)) { playAll(); return; }
    var opts = { rootMargin: "0px 0px -8% 0px", threshold: 0.25 };

    // Breakpoint mirrored from the stacked-layout @media rule in styles.css.
    if (!window.matchMedia("(max-width: 760px)").matches) {
      var obsAll = new IntersectionObserver(function (entries) {
        if (entries.some(function (e) { return e.isIntersecting; })) { playAll(); obsAll.disconnect(); }
      }, opts);
      obsAll.observe(tl);
      return;
    }

    var step = parseFloat(getComputedStyle(tl).getPropertyValue("--t-step")) || 0.66;
    var nextStart = 0;  // seconds, performance.now() clock
    var obsItem = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        obsItem.unobserve(e.target);
        var now = performance.now() / 1000;
        var start = Math.max(now + 0.1, nextStart);
        nextStart = start + step;
        e.target.style.setProperty("--d", (start - now).toFixed(2) + "s");
        tl.classList.add("is-playing");
        e.target.classList.add("is-playing");
      });
    }, opts);
    items.forEach(function (i) { obsItem.observe(i); });
  }



  // ---- ambient videos ------------------------------------------------------
  // Decorative <video autoplay muted loop> clips (the Phase 1 self-play grid).
  // iOS WebKit pauses muted autoplay video whenever it judges it not visible
  // (off-screen, or hidden by CSS such as the scroll-reveal fade) and does not
  // reliably resume it; macOS does not apply that policy. So drive playback
  // explicitly: play while on screen, pause when off, and undo any pause the
  // browser makes on its own while the clip is visible (there are no controls,
  // so every pause is a system pause).
  function initAmbientVideos() {
    var videos = Array.prototype.slice.call(document.querySelectorAll("video[autoplay]"));
    if (!videos.length) return;
    var visible = new Set();
    // set when the browser refuses play() (e.g. iOS Low Power Mode); the
    // pause listener then stops retrying until the clip re-enters the view
    var refused = new Set();
    function play(v) {
      var p = v.play();
      if (p && p.then) p.then(function () { refused.delete(v); }, function () { refused.add(v); });
    }
    function sync(v) {
      if (visible.has(v) && !document.hidden) { if (v.paused) play(v); } else if (!v.paused) v.pause();
    }
    if (!("IntersectionObserver" in window)) { videos.forEach(play); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) visible.add(e.target); else { visible.delete(e.target); refused.delete(e.target); }
        sync(e.target);
      });
    }, { threshold: 0 });
    videos.forEach(function (v) {
      io.observe(v);
      v.addEventListener("pause", function () {
        setTimeout(function () { if (!refused.has(v)) sync(v); }, 250);
      });
    });
    document.addEventListener("visibilitychange", function () { videos.forEach(sync); });
    window.addEventListener("pageshow", function () { videos.forEach(sync); });
  }

  // ---- play-in-view videos -------------------------------------------------
  // <video muted data-play-in-view> (the teaser): start when it scrolls into
  // view and pause when it leaves, like the Terra Series panels. It has
  // controls, so a pause made while on screen is the reader's and is left alone.
  function initPlayInView() {
    var videos = Array.prototype.slice.call(document.querySelectorAll("video[data-play-in-view]"));
    if (!videos.length || !("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        else v.pause();
      });
    }, { threshold: 0.25 });
    videos.forEach(function (v) { io.observe(v); });
  }

  // ---- stat count-up -------------------------------------------------------
  // Rows marked [data-countup]: 0.5 s after the row's last counter becomes
  // visible, every .count[data-to] in it animates together over 6 s from
  // data-from (default 0) to data-to: a slow start, a surge through the
  // middle, then a long settle onto the value. The markup holds the final
  // values, so no-JS and reduced-motion readers just see them; with JS the
  // counters show their start value until the count starts.
  function initCountUp() {
    var rows = Array.prototype.slice.call(document.querySelectorAll("[data-countup]"));
    if (!rows.length) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var DURATION = 6000;
    var START_DELAY = 500; // let the row's .reveal fade (0.5 s) finish first
    var ROLL_FADE_DELAY = 1000; // odometer digits start fading in 1 s after the trigger
    function fmt(v, dec) {
      return v.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
    }
    function counters(row) {
      return Array.prototype.slice.call(row.querySelectorAll(".count[data-to]")).map(function (el) {
        var from = parseFloat(el.dataset.from || "0");
        return { el: el, from: from, to: parseFloat(el.dataset.to), dec: parseInt(el.dataset.dec || "0", 10) };
      });
    }
    // [data-roll] counters are odometers: each digit is a strip of digits behind
    // a one-digit window, ordered so a falling value moves the strip down (the
    // next lower digit rolls in from above). Integers only.
    function buildRoll(c) {
      var el = c.el;
      var n = String(Math.floor(Math.max(c.from, c.to))).length;
      el.textContent = "";
      el.classList.add("count-roll");
      el._cols = [];
      for (var i = n - 1; i >= 0; i--) {
        var col = document.createElement("span");
        col.className = "roll-col";
        col.setAttribute("aria-hidden", "true");
        var strip = document.createElement("span");
        strip.className = "roll-strip";
        // cell k (top = 0) holds digit k % 10: 0, 1, ..., 9, 0. The leading
        // column shows its zeros as blanks, so 10 -> 9 rolls the "1" out and
        // leaves the slot empty while the lower digits keep their place.
        for (var k = 0; k <= 10; k++) {
          var cell = document.createElement("span");
          cell.textContent = (i === n - 1 && n > 1 && k % 10 === 0) ? "\u00a0" : String(k % 10);
          strip.appendChild(cell);
        }
        col.appendChild(strip);
        el.appendChild(col);
        el._cols[i] = { col: col, strip: strip };
      }
      // the strips hold every digit; screen readers and copy get the final value
      var sr = document.createElement("span");
      sr.className = "roll-sr";
      sr.textContent = fmt(c.to, 0);
      el.appendChild(sr);
    }
    function setRoll(el, v) {
      el._cols.forEach(function (c, i) {
        var p = Math.pow(10, i);
        var base = Math.floor(v / p);
        // a digit only turns while every digit below it rolls through its
        // last unit, as on a mechanical odometer
        var d = (base % 10 + Math.max(0, (v - base * p) - (p - 1))) % 10;
        c.strip.style.transform = "translateY(" + (-d) + "em)";
      });
    }
    function show(c, v) {
      if (c.el.hasAttribute("data-roll")) {
        if (!c.el._cols) buildRoll(c);
        setRoll(c.el, v);
      } else {
        c.el.textContent = fmt(v, c.dec);
      }
    }
    // pin each counter to its final text width, in em so it follows the
    // responsive font size, so the row does not jitter while counting
    // (odometers keep fixed digit slots and need no pinning)
    function pin(cs) {
      cs.forEach(function (c) {
        if (c.el.hasAttribute("data-roll")) return;
        var fs = parseFloat(getComputedStyle(c.el).fontSize);
        c.el.textContent = fmt(c.to, c.dec);
        c.el.style.minWidth = (c.el.getBoundingClientRect().width / fs) + "em";
        c.el.textContent = fmt(c.from, c.dec);
      });
    }
    function run(row) {
      var cs = counters(row);
      var t0 = null;
      function frame(now) {
        if (t0 === null) t0 = now;
        var t = Math.min(1, (now - t0) / DURATION);
        // e = 1 - (1 - t^2)^6: zero slope at the start (ease in), peak speed
        // around a third of the way, then a long tail into exactly 1 at t = 1
        var e = 1 - Math.pow(1 - t * t, 6);
        cs.forEach(function (c) { show(c, c.from + (c.to - c.from) * e); });
        if (t < 1) requestAnimationFrame(frame);
      }
      setTimeout(function () { requestAnimationFrame(frame); }, START_DELAY);
      // odometers stay blank until ROLL_FADE_DELAY after the trigger, then
      // fade in over 3 s (CSS) while they keep rolling
      setTimeout(function () {
        Array.prototype.forEach.call(row.querySelectorAll(".count-roll"), function (el) { el.classList.add("is-in"); });
      }, ROLL_FADE_DELAY);
    }
    // Trigger: the row's last counter (the "XXXX yrs" number) has any part
    // inside the visible viewport; the count then starts START_DELAY later.
    // visualViewport excludes iOS Safari's toolbars. A plain rect check on
    // scroll is used instead of IntersectionObserver for predictable behaviour
    // on iPhone touch scrolling.
    var pending = rows.slice();
    function anchor(row) {
      var cs = row.querySelectorAll(".count[data-to]");
      return cs.length ? cs[cs.length - 1] : null;
    }
    function visible(el) {
      var r = el.getBoundingClientRect();
      var vv = window.visualViewport;
      var top = vv ? vv.offsetTop : 0;
      var bottom = top + (vv ? vv.height : window.innerHeight);
      return r.height > 0 && r.bottom > top && r.top < bottom;
    }
    var ticking = false;
    function check() {
      ticking = false;
      pending = pending.filter(function (row) {
        var a = anchor(row);
        if (!a || !visible(a)) return true;
        run(row);
        return false;
      });
      if (!pending.length) {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
        if (window.visualViewport) window.visualViewport.removeEventListener("resize", onScroll);
      }
    }
    function onScroll() {
      if (!ticking) { ticking = true; requestAnimationFrame(check); }
    }
    rows.forEach(function (r) {
      counters(r).forEach(function (c) { show(c, c.from); });
    });
    // pin widths once fonts are in (capped at 2 s so a stalled fonts.ready
    // cannot leave the counters stuck at 0), then start watching the scroll
    var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    var capped = Promise.race([fontsReady, new Promise(function (res) { setTimeout(res, 2000); })]);
    capped.then(function () {
      rows.forEach(function (r) { pin(counters(r)); });
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
      if (window.visualViewport) window.visualViewport.addEventListener("resize", onScroll);
      check();
    });
  }

  // ---- boot ----------------------------------------------------------------
  function boot() {
    initNav();
    initReveal();
    initTimeline();
    initAmbientVideos();
    initPlayInView();
    initCountUp();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
