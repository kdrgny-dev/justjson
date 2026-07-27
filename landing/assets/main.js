(function () {
  "use strict";

  var root = document.documentElement;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- theme ---------- */
  var stored = null;
  try {
    stored = localStorage.getItem("jj-theme");
  } catch (e) {}
  if (stored) root.setAttribute("data-theme", stored);

  document.getElementById("theme").addEventListener("click", function () {
    var cur = root.getAttribute("data-theme");
    var dark = cur === "dark" || (!cur && matchMedia("(prefers-color-scheme: dark)").matches);
    var next = dark ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem("jj-theme", next);
    } catch (e) {}
  });

  /* ---------- copy ---------- */
  Array.prototype.forEach.call(document.querySelectorAll("[data-copy]"), function (btn) {
    btn.addEventListener("click", function () {
      var text = btn.getAttribute("data-copy");
      if (navigator.clipboard) navigator.clipboard.writeText(text);
      var prev = btn.textContent;
      btn.textContent = "Copied";
      setTimeout(function () {
        btn.textContent = prev;
      }, 1400);
    });
  });

  /* ---------- scroll progress ---------- */
  var bar = document.getElementById("progress");
  var ticking = false;
  function drawProgress() {
    var max = document.body.scrollHeight - innerHeight;
    var p = max > 0 ? Math.min(1, scrollY / max) : 0;
    bar.style.transform = "scaleX(" + p + ")";
    ticking = false;
  }
  addEventListener(
    "scroll",
    function () {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(drawProgress);
      }
    },
    { passive: true }
  );
  drawProgress();

  /* ---------- reveal ---------- */
  var revealables = document.querySelectorAll(".reveal");
  Array.prototype.forEach.call(document.querySelectorAll(".stagger"), function (g) {
    Array.prototype.forEach.call(g.children, function (child, i) {
      child.style.setProperty("--i", i);
    });
  });

  if ("IntersectionObserver" in window && !reduce) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("shown");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.14 }
    );
    Array.prototype.forEach.call(revealables, function (el) {
      io.observe(el);
    });
  } else {
    Array.prototype.forEach.call(revealables, function (el) {
      el.classList.add("shown");
    });
  }

  requestAnimationFrame(function () {
    document.getElementById("hero").classList.add("in");
  });

  /* ---------- card pointer glow ---------- */
  if (matchMedia("(pointer: fine)").matches && !reduce) {
    Array.prototype.forEach.call(document.querySelectorAll(".card"), function (card) {
      card.addEventListener("pointermove", function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty("--mx", ((e.clientX - r.left) / r.width) * 100 + "%");
        card.style.setProperty("--my", ((e.clientY - r.top) / r.height) * 100 + "%");
      });
    });
  }

  /* ---------- dataflow packet geometry ---------- */
  function layoutPackets() {
    Array.prototype.forEach.call(document.querySelectorAll(".flow"), function (flow) {
      var nodes = flow.querySelectorAll(".node .pin");
      var packet = flow.querySelector(".packet");
      if (!packet || nodes.length < 2) return;
      var base = nodes[0].getBoundingClientRect();
      var origin = base.left + base.width / 2;
      packet.style.left = origin - flow.querySelector(".nodes").getBoundingClientRect().left - 5.5 + "px";
      for (var i = 1; i < nodes.length; i++) {
        var r = nodes[i].getBoundingClientRect();
        packet.style.setProperty("--p" + i, r.left + r.width / 2 - origin + "px");
      }
    });
  }
  layoutPackets();
  addEventListener("resize", layoutPackets, { passive: true });

  /* ---------- segments ---------- */
  var SEGMENTS = [
    {
      id: "blog",
      label: "Blog",
      collection: "posts",
      path: "content/posts/hello-world.json",
      caption: "Posts with rich text, slugs and dates — one file per entry.",
      fields: [
        { key: "title", type: "text", value: "Hello world" },
        { key: "slug", type: "text", value: "hello-world" },
        { key: "date", type: "date", value: "2026-07-27" },
        { key: "body", type: "richtext", value: "Own your content." }
      ],
      live: { key: "body", mode: "type", values: ["Own your content.", "It is just files on disk."] }
    },
    {
      id: "cv",
      label: "CV",
      collection: "experience",
      path: "content/experience/senior-engineer.json",
      caption: "Roles, companies and summaries — plus a profile singleton.",
      fields: [
        { key: "role", type: "text", value: "Senior Engineer" },
        { key: "company", type: "text", value: "Acme Inc." },
        { key: "start", type: "date", value: "2023-04-01" },
        { key: "summary", type: "richtext", value: "Led the design system." }
      ],
      live: { key: "company", mode: "type", values: ["Acme Inc.", "Northwind Labs"] }
    },
    {
      id: "portfolio",
      label: "Portfolio",
      collection: "projects",
      path: "content/projects/aurora.json",
      caption: "Projects with covers, links and a category you pick from a list.",
      fields: [
        { key: "title", type: "text", value: "Aurora" },
        { key: "slug", type: "text", value: "aurora" },
        { key: "kind", type: "select", value: "Web" },
        { key: "cover", type: "image", value: "media/aurora.webp" }
      ],
      live: { key: "kind", mode: "select", values: ["Web", "Mobile", "Design"] }
    },
    {
      id: "docs",
      label: "Docs",
      collection: "pages",
      path: "content/pages/getting-started.json",
      caption: "Pages ordered by a number field — your sidebar writes itself.",
      fields: [
        { key: "title", type: "text", value: "Getting started" },
        { key: "slug", type: "text", value: "getting-started" },
        { key: "order", type: "number", value: 1 },
        { key: "body", type: "richtext", value: "Install and run." }
      ],
      live: { key: "order", mode: "number", values: [1, 2, 3] }
    },
    {
      id: "changelog",
      label: "Changelog",
      collection: "releases",
      path: "content/releases/1-2-0.json",
      caption: "Releases tagged by type — the same JSON feeds your site and your RSS.",
      fields: [
        { key: "version", type: "text", value: "1.2.0" },
        { key: "date", type: "date", value: "2026-07-27" },
        { key: "type", type: "select", value: "Added" },
        { key: "body", type: "richtext", value: "Drag and drop in the schema." }
      ],
      live: { key: "type", mode: "select", values: ["Added", "Fixed", "Changed"] }
    }
  ];

  var DWELL = 9000;
  var tabsEl = document.getElementById("tabs");
  var rowsEl = document.getElementById("rows");
  var jsonEl = document.getElementById("json");
  var pathEl = document.getElementById("wirePath");
  var capEl = document.getElementById("segCaption");
  var collEl = document.getElementById("segCollection");
  var index = 0;
  var auto = true;
  var advanceTimer = null;
  var liveTimers = [];

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function clearLive() {
    liveTimers.forEach(clearTimeout);
    liveTimers = [];
  }
  function later(fn, ms) {
    var t = setTimeout(fn, ms);
    liveTimers.push(t);
    return t;
  }

  function buildTabs() {
    SEGMENTS.forEach(function (seg, i) {
      var b = document.createElement("button");
      b.className = "tab";
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", i === 0 ? "true" : "false");
      b.innerHTML = esc(seg.label) + '<span class="bar"></span>';
      b.addEventListener("click", function () {
        auto = false;
        select(i);
      });
      tabsEl.appendChild(b);
    });
  }

  function renderRows(seg) {
    rowsEl.innerHTML = "";
    seg.fields.forEach(function (f) {
      var row = document.createElement("div");
      row.className = "row-field" + (f.key === seg.live.key ? " live" : "");
      row.setAttribute("data-key", f.key);
      var value = f.type === "select" ? '<span class="chip">' + esc(f.value) + "</span>" : esc(f.value);
      row.innerHTML =
        '<span class="k">' +
        esc(f.key) +
        '</span><span class="ty">' +
        esc(f.type) +
        '</span><span class="v">' +
        value +
        "</span>";
      rowsEl.appendChild(row);
    });
  }

  function jsonValue(f) {
    if (f.type === "number") return '<span class="num">' + esc(f.value) + "</span>";
    return '<span class="str">"' + esc(f.value) + '"</span>';
  }

  function renderJson(seg) {
    var pad = Math.max.apply(
      null,
      seg.fields.map(function (f) {
        return f.key.length;
      })
    );
    var lines = ['<span class="ln"><span class="pun">{</span></span>'];
    seg.fields.forEach(function (f, i) {
      var gap = new Array(pad - f.key.length + 1).join(" ");
      lines.push(
        '<span class="ln" data-key="' +
          esc(f.key) +
          '">  <span class="key">"' +
          esc(f.key) +
          '"</span><span class="pun">:</span>' +
          gap +
          " " +
          jsonValue(f) +
          (i < seg.fields.length - 1 ? '<span class="pun">,</span>' : "") +
          "</span>"
      );
    });
    lines.push('<span class="ln"><span class="pun">}</span></span>');
    jsonEl.innerHTML = lines.join("");
  }

  function stagger(seg) {
    var rows = rowsEl.querySelectorAll(".row-field");
    var lines = jsonEl.querySelectorAll(".ln");
    var step = reduce ? 0 : 60;
    Array.prototype.forEach.call(rows, function (r, i) {
      later(function () {
        r.classList.add("on");
      }, i * step);
    });
    Array.prototype.forEach.call(lines, function (l, i) {
      later(function () {
        l.classList.add("on");
      }, i * step);
    });
    return rows.length * step + 220;
  }

  function liveTargets(key) {
    return {
      row: rowsEl.querySelector('.row-field[data-key="' + key + '"] .v'),
      line: jsonEl.querySelector('.ln[data-key="' + key + '"] .str, .ln[data-key="' + key + '"] .num')
    };
  }

  function pulse(el) {
    if (!el || reduce) return;
    el.classList.remove("flash");
    void el.offsetWidth;
    el.classList.add("flash");
  }

  function runType(seg, startAt) {
    var t = liveTargets(seg.live.key);
    if (!t.row || !t.line) return;
    var values = seg.live.values;
    var vi = 0;

    function write(text, caret) {
      t.row.innerHTML = esc(text) + (caret ? '<span class="tcaret"></span>' : "");
      t.line.textContent = '"' + text + '"';
    }

    function erase(text, done) {
      if (!text.length) return later(done, 160);
      write(text.slice(0, -1), true);
      later(function () {
        erase(text.slice(0, -1), done);
      }, 26);
    }

    function type(target, i, done) {
      if (i > target.length) {
        write(target, false);
        return later(done, 2600);
      }
      write(target.slice(0, i), true);
      later(function () {
        type(target, i + 1, done);
      }, 46);
    }

    function cycle() {
      vi = (vi + 1) % values.length;
      erase(values[(vi + values.length - 1) % values.length], function () {
        type(values[vi], 0, cycle);
      });
    }

    later(function () {
      erase(values[0], function () {
        type(values[0], 0, cycle);
      });
    }, startAt);
  }

  function runSwap(seg, startAt) {
    var t = liveTargets(seg.live.key);
    if (!t.row || !t.line) return;
    var values = seg.live.values;
    var vi = 0;
    var isNum = seg.live.mode === "number";

    function tick() {
      vi = (vi + 1) % values.length;
      var v = values[vi];
      t.row.innerHTML = isNum ? esc(v) : '<span class="chip">' + esc(v) + "</span>";
      t.line.textContent = isNum ? String(v) : '"' + v + '"';
      pulse(isNum ? t.row : t.row.firstChild);
      pulse(t.line);
      later(tick, 1900);
    }
    later(tick, startAt + 1300);
  }

  function select(i) {
    index = i;
    var seg = SEGMENTS[i];
    clearLive();

    Array.prototype.forEach.call(tabsEl.children, function (b, k) {
      b.setAttribute("aria-selected", k === i ? "true" : "false");
      b.classList.remove("timing");
    });

    renderRows(seg);
    renderJson(seg);
    pathEl.textContent = seg.path;
    capEl.textContent = seg.caption;
    collEl.textContent = seg.collection;

    var after = stagger(seg);
    if (!reduce) {
      if (seg.live.mode === "type") runType(seg, after);
      else runSwap(seg, after);
    }

    if (auto && !reduce) {
      var tab = tabsEl.children[i];
      tab.style.setProperty("--dwell", DWELL + "ms");
      void tab.offsetWidth;
      tab.classList.add("timing");
      clearTimeout(advanceTimer);
      advanceTimer = setTimeout(function () {
        select((index + 1) % SEGMENTS.length);
      }, DWELL);
    } else {
      clearTimeout(advanceTimer);
    }
  }

  buildTabs();
  select(0);
})();
