;(() => {
  const root = document.documentElement
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches

  /* ---------- theme ---------- */
  let stored = null
  try {
    stored = localStorage.getItem('jj-theme')
  } catch (e) {}
  if (stored) root.setAttribute('data-theme', stored)

  document.getElementById('theme').addEventListener('click', () => {
    const cur = root.getAttribute('data-theme')
    const dark = cur === 'dark' || (!cur && matchMedia('(prefers-color-scheme: dark)').matches)
    const next = dark ? 'light' : 'dark'
    root.setAttribute('data-theme', next)
    try {
      localStorage.setItem('jj-theme', next)
    } catch (e) {}
  })

  /* ---------- copy ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('[data-copy]'), (btn) => {
    btn.addEventListener('click', () => {
      const text = btn.getAttribute('data-copy')
      if (navigator.clipboard) navigator.clipboard.writeText(text)
      const prev = btn.textContent
      btn.textContent = 'Copied'
      setTimeout(() => {
        btn.textContent = prev
      }, 1400)
    })
  })

  /* ---------- scroll progress ---------- */
  const bar = document.getElementById('progress')
  let ticking = false
  function drawProgress() {
    const max = document.body.scrollHeight - innerHeight
    const p = max > 0 ? Math.min(1, scrollY / max) : 0
    bar.style.transform = `scaleX(${p})`
    ticking = false
  }
  addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(drawProgress)
      }
    },
    { passive: true },
  )
  drawProgress()

  /* ---------- reveal ---------- */
  const revealables = document.querySelectorAll('.reveal')
  Array.prototype.forEach.call(document.querySelectorAll('.stagger'), (g) => {
    Array.prototype.forEach.call(g.children, (child, i) => {
      child.style.setProperty('--i', i)
    })
  })

  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('shown')
            io.unobserve(e.target)
          }
        }
      },
      { threshold: 0.14 },
    )
    Array.prototype.forEach.call(revealables, (el) => {
      io.observe(el)
    })
  } else {
    Array.prototype.forEach.call(revealables, (el) => {
      el.classList.add('shown')
    })
  }

  requestAnimationFrame(() => {
    document.getElementById('hero').classList.add('in')
  })

  /* ---------- card pointer glow ---------- */
  if (matchMedia('(pointer: fine)').matches && !reduce) {
    Array.prototype.forEach.call(document.querySelectorAll('.card'), (card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect()
        card.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`)
        card.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`)
      })
    })
  }

  /* ---------- dataflow packet geometry ---------- */
  function layoutPackets() {
    Array.prototype.forEach.call(document.querySelectorAll('.flow'), (flow) => {
      const nodes = flow.querySelectorAll('.node .pin')
      const packet = flow.querySelector('.packet')
      if (!packet || nodes.length < 2) return
      const base = nodes[0].getBoundingClientRect()
      const origin = base.left + base.width / 2
      packet.style.left = `${origin - flow.querySelector('.nodes').getBoundingClientRect().left - 5.5}px`
      for (let i = 1; i < nodes.length; i++) {
        const r = nodes[i].getBoundingClientRect()
        packet.style.setProperty(`--p${i}`, `${r.left + r.width / 2 - origin}px`)
      }
    })
  }
  layoutPackets()
  addEventListener('resize', layoutPackets, { passive: true })

  /* ---------- live stats (count-up) ---------- */
  const REPO = 'kdrgny-dev/justjson'
  const PKG = '@kdrgny/justjson'

  function fmt(n) {
    return n.toLocaleString('en-US')
  }

  function countUp(el, target) {
    if (reduce) {
      el.textContent = fmt(target)
      return
    }
    const dur = 1100
    let start = null
    function step(ts) {
      if (start === null) start = ts
      const t = Math.min(1, (ts - start) / dur)
      const eased = 1 - (1 - t) ** 3
      el.textContent = fmt(Math.round(target * eased))
      if (t < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }

  function initStats() {
    const els = document.querySelectorAll('.stat-num[data-source]')
    if (!els.length) return

    // Scoped packages return 0 from the downloads point/range API (a known npm
    // limitation); the per-version endpoint reports real counts, so we sum it.
    const PKG_ENC = PKG.replace('/', '%2F')
    function json(url) {
      return fetch(url)
        .then((r) => (r.ok ? r.json() : {}))
        .catch(() => ({}))
    }
    function sumVersions(body) {
      const d = body?.downloads
      if (!d || typeof d !== 'object') return undefined
      let t = 0
      for (const k in d) t += d[k]
      return t
    }

    let valuesReady = null
    function loadValues() {
      if (valuesReady) return valuesReady
      valuesReady = Promise.all([
        json(`https://api.github.com/repos/${REPO}`),
        json(`https://api.npmjs.org/versions/${PKG_ENC}/last-week`),
        json(`https://api.npmjs.org/versions/${PKG_ENC}/last-month`),
      ]).then((res) => {
        const g = res[0] || {}
        return {
          'github-stars': g.stargazers_count,
          'github-forks': g.forks_count,
          'npm-downloads-week': sumVersions(res[1]),
          'npm-downloads-month': sumVersions(res[2]),
        }
      })
      return valuesReady
    }

    function reveal() {
      loadValues().then((values) => {
        Array.prototype.forEach.call(els, (el) => {
          const v = values[el.getAttribute('data-source')]
          if (typeof v === 'number') countUp(el, v)
          else el.textContent = '—'
        })
      })
    }

    const band = els[0].closest('.band') || els[0]
    if ('IntersectionObserver' in window) {
      const so = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              so.unobserve(e.target)
              reveal()
            }
          }
        },
        { threshold: 0.3 },
      )
      so.observe(band)
    } else {
      reveal()
    }
  }
  initStats()

  /* ---------- segments ---------- */
  const SEGMENTS = [
    {
      id: 'blog',
      label: 'Blog',
      collection: 'posts',
      path: 'content/posts/hello-world.json',
      caption: 'Posts with rich text, slugs and dates — one file per entry.',
      fields: [
        { key: 'title', type: 'text', value: 'Hello world' },
        { key: 'slug', type: 'text', value: 'hello-world' },
        { key: 'date', type: 'date', value: '2026-07-27' },
        { key: 'body', type: 'richtext', value: 'Own your content.' },
      ],
      live: {
        key: 'body',
        mode: 'type',
        values: ['Own your content.', 'It is just files on disk.'],
      },
    },
    {
      id: 'cv',
      label: 'CV',
      collection: 'experience',
      path: 'content/experience/senior-engineer.json',
      caption: 'Roles, companies and summaries — plus a profile singleton.',
      fields: [
        { key: 'role', type: 'text', value: 'Senior Engineer' },
        { key: 'company', type: 'text', value: 'Acme Inc.' },
        { key: 'start', type: 'date', value: '2023-04-01' },
        { key: 'summary', type: 'richtext', value: 'Led the design system.' },
      ],
      live: { key: 'company', mode: 'type', values: ['Acme Inc.', 'Northwind Labs'] },
    },
    {
      id: 'portfolio',
      label: 'Portfolio',
      collection: 'projects',
      path: 'content/projects/aurora.json',
      caption: 'Projects with covers, links and a category you pick from a list.',
      fields: [
        { key: 'title', type: 'text', value: 'Aurora' },
        { key: 'slug', type: 'text', value: 'aurora' },
        { key: 'kind', type: 'select', value: 'Web' },
        { key: 'cover', type: 'image', value: 'media/aurora.webp' },
      ],
      live: { key: 'kind', mode: 'select', values: ['Web', 'Mobile', 'Design'] },
    },
    {
      id: 'docs',
      label: 'Docs',
      collection: 'pages',
      path: 'content/pages/getting-started.json',
      caption: 'Pages ordered by a number field — your sidebar writes itself.',
      fields: [
        { key: 'title', type: 'text', value: 'Getting started' },
        { key: 'slug', type: 'text', value: 'getting-started' },
        { key: 'order', type: 'number', value: 1 },
        { key: 'body', type: 'richtext', value: 'Install and run.' },
      ],
      live: { key: 'order', mode: 'number', values: [1, 2, 3] },
    },
    {
      id: 'changelog',
      label: 'Changelog',
      collection: 'releases',
      path: 'content/releases/1-2-0.json',
      caption: 'Releases tagged by type — the same JSON feeds your site and your RSS.',
      fields: [
        { key: 'version', type: 'text', value: '1.2.0' },
        { key: 'date', type: 'date', value: '2026-07-27' },
        { key: 'type', type: 'select', value: 'Added' },
        { key: 'body', type: 'richtext', value: 'Drag and drop in the schema.' },
      ],
      live: { key: 'type', mode: 'select', values: ['Added', 'Fixed', 'Changed'] },
    },
    {
      id: 'recipe',
      label: 'Recipe box',
      collection: 'recipes',
      path: 'content/recipes/weeknight-pasta.json',
      caption: 'Recipes with ingredients, steps and a cover — a cookbook on disk.',
      fields: [
        { key: 'title', type: 'text', value: 'Weeknight pasta' },
        { key: 'time', type: 'text', value: '20 min' },
        { key: 'servings', type: 'number', value: 2 },
        { key: 'steps', type: 'richtext', value: 'Boil. Toss. Eat.' },
      ],
      live: { key: 'servings', mode: 'number', values: [2, 4, 6] },
    },
    {
      id: 'event',
      label: 'Event',
      collection: 'sessions',
      path: 'content/sessions/opening-keynote.json',
      caption: 'Sessions with date, time and speaker — an agenda that writes itself.',
      fields: [
        { key: 'title', type: 'text', value: 'Opening keynote' },
        { key: 'time', type: 'text', value: '09:00' },
        { key: 'speaker', type: 'text', value: 'Ada Lovelace' },
        { key: 'room', type: 'text', value: 'Main hall' },
      ],
      live: { key: 'speaker', mode: 'type', values: ['Ada Lovelace', 'Grace Hopper'] },
    },
    {
      id: 'catalog',
      label: 'Catalog',
      collection: 'products',
      path: 'content/products/ceramic-mug.json',
      caption: 'Products with price, category and image — your store, as files.',
      fields: [
        { key: 'title', type: 'text', value: 'Ceramic mug' },
        { key: 'price', type: 'number', value: 18 },
        { key: 'category', type: 'select', value: 'Home' },
        { key: 'cover', type: 'image', value: 'media/mug.webp' },
      ],
      live: { key: 'category', mode: 'select', values: ['Home', 'Apparel', 'Accessory'] },
    },
  ]

  const DWELL = 9000
  const tabsEl = document.getElementById('tabs')
  const rowsEl = document.getElementById('rows')
  const jsonEl = document.getElementById('json')
  const pathEl = document.getElementById('wirePath')
  const capEl = document.getElementById('segCaption')
  const collEl = document.getElementById('segCollection')
  let index = 0
  let auto = true
  let advanceTimer = null
  let liveTimers = []

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  function clearLive() {
    liveTimers.forEach(clearTimeout)
    liveTimers = []
  }
  function later(fn, ms) {
    const t = setTimeout(fn, ms)
    liveTimers.push(t)
    return t
  }

  function buildTabs() {
    SEGMENTS.forEach((seg, i) => {
      const b = document.createElement('button')
      b.className = 'tab'
      b.type = 'button'
      b.setAttribute('role', 'tab')
      b.setAttribute('aria-selected', i === 0 ? 'true' : 'false')
      b.innerHTML = `${esc(seg.label)}<span class="bar"></span>`
      b.addEventListener('click', () => {
        auto = false
        select(i)
      })
      tabsEl.appendChild(b)
    })
  }

  function renderRows(seg) {
    rowsEl.innerHTML = ''
    for (const f of seg.fields) {
      const row = document.createElement('div')
      row.className = `row-field${f.key === seg.live.key ? ' live' : ''}`
      row.setAttribute('data-key', f.key)
      const value = f.type === 'select' ? `<span class="chip">${esc(f.value)}</span>` : esc(f.value)
      row.innerHTML = `<span class="k">${esc(f.key)}</span><span class="ty">${esc(f.type)}</span><span class="v">${value}</span>`
      rowsEl.appendChild(row)
    }
  }

  function jsonValue(f) {
    if (f.type === 'number') return `<span class="num">${esc(f.value)}</span>`
    return `<span class="str">"${esc(f.value)}"</span>`
  }

  function renderJson(seg) {
    const pad = Math.max.apply(
      null,
      seg.fields.map((f) => f.key.length),
    )
    const lines = ['<span class="ln"><span class="pun">{</span></span>']
    seg.fields.forEach((f, i) => {
      const gap = new Array(pad - f.key.length + 1).join(' ')
      lines.push(
        `<span class="ln" data-key="${esc(f.key)}">  <span class="key">"${esc(f.key)}"</span><span class="pun">:</span>${gap} ${jsonValue(f)}${i < seg.fields.length - 1 ? '<span class="pun">,</span>' : ''}</span>`,
      )
    })
    lines.push('<span class="ln"><span class="pun">}</span></span>')
    jsonEl.innerHTML = lines.join('')
  }

  function stagger(seg) {
    const rows = rowsEl.querySelectorAll('.row-field')
    const lines = jsonEl.querySelectorAll('.ln')
    const step = reduce ? 0 : 60
    Array.prototype.forEach.call(rows, (r, i) => {
      later(() => {
        r.classList.add('on')
      }, i * step)
    })
    Array.prototype.forEach.call(lines, (l, i) => {
      later(() => {
        l.classList.add('on')
      }, i * step)
    })
    return rows.length * step + 220
  }

  function liveTargets(key) {
    return {
      row: rowsEl.querySelector(`.row-field[data-key="${key}"] .v`),
      line: jsonEl.querySelector(`.ln[data-key="${key}"] .str, .ln[data-key="${key}"] .num`),
    }
  }

  function pulse(el) {
    if (!el || reduce) return
    el.classList.remove('flash')
    void el.offsetWidth
    el.classList.add('flash')
  }

  function runType(seg, startAt) {
    const t = liveTargets(seg.live.key)
    if (!t.row || !t.line) return
    const values = seg.live.values
    let vi = 0

    function write(text, caret) {
      t.row.innerHTML = esc(text) + (caret ? '<span class="tcaret"></span>' : '')
      t.line.textContent = `"${text}"`
    }

    function erase(text, done) {
      if (!text.length) return later(done, 160)
      write(text.slice(0, -1), true)
      later(() => {
        erase(text.slice(0, -1), done)
      }, 26)
    }

    function type(target, i, done) {
      if (i > target.length) {
        write(target, false)
        return later(done, 2600)
      }
      write(target.slice(0, i), true)
      later(() => {
        type(target, i + 1, done)
      }, 46)
    }

    function cycle() {
      vi = (vi + 1) % values.length
      erase(values[(vi + values.length - 1) % values.length], () => {
        type(values[vi], 0, cycle)
      })
    }

    later(() => {
      erase(values[0], () => {
        type(values[0], 0, cycle)
      })
    }, startAt)
  }

  function runSwap(seg, startAt) {
    const t = liveTargets(seg.live.key)
    if (!t.row || !t.line) return
    const values = seg.live.values
    let vi = 0
    const isNum = seg.live.mode === 'number'

    function tick() {
      vi = (vi + 1) % values.length
      const v = values[vi]
      t.row.innerHTML = isNum ? esc(v) : `<span class="chip">${esc(v)}</span>`
      t.line.textContent = isNum ? String(v) : `"${v}"`
      pulse(isNum ? t.row : t.row.firstChild)
      pulse(t.line)
      later(tick, 1900)
    }
    later(tick, startAt + 1300)
  }

  function select(i) {
    index = i
    const seg = SEGMENTS[i]
    clearLive()

    Array.prototype.forEach.call(tabsEl.children, (b, k) => {
      b.setAttribute('aria-selected', k === i ? 'true' : 'false')
      b.classList.remove('timing')
    })

    renderRows(seg)
    renderJson(seg)
    pathEl.textContent = seg.path
    capEl.textContent = seg.caption
    collEl.textContent = seg.collection

    const after = stagger(seg)
    if (!reduce) {
      if (seg.live.mode === 'type') runType(seg, after)
      else runSwap(seg, after)
    }

    if (auto && !reduce) {
      const tab = tabsEl.children[i]
      tab.style.setProperty('--dwell', `${DWELL}ms`)
      void tab.offsetWidth
      tab.classList.add('timing')
      clearTimeout(advanceTimer)
      advanceTimer = setTimeout(() => {
        select((index + 1) % SEGMENTS.length)
      }, DWELL)
    } else {
      clearTimeout(advanceTimer)
    }
  }

  buildTabs()
  select(0)
})()
