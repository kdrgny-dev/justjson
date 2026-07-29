/**
 * Preset'e özel, içerik-sürücülü tek sayfa Astro tasarımları. `init <preset> --astro`
 * bu tasarımı üretir; içerik yine content/*.json'da yaşar, kullanıcı düzenler.
 * Jenerik scaffold (scaffold.ts) buradan bir şey bulamazsa devreye girer.
 */

const BADGE = 'Just&#123;JSON&#125;'
const JJ = 'https://justjson.vercel.app'

type ThemePreset = Record<string, unknown>

interface SiteTemplate {
  index: string
  theme: ThemePreset
}

const portfolio: SiteTemplate = {
  theme: { palette: 'ink', accent: '#FF2E88', font: 'sans', radius: 2, density: 'normal' },
  index: `---
import { getCollection, getEntry } from 'astro:content'

const projects = await getCollection('projects')
const about = await getEntry('about', 'about')
const name = String(about?.data.name ?? 'Your Name')
const parts = name.trim().split(/\\s+/)
const first = parts[0]
const surname = parts.slice(1).join(' ')
const initials = parts.map((p) => p[0]).join('').slice(0, 2).toUpperCase()
const bio = about?.data.bio
const arts = ['cv-aurora', 'cv-field', 'cv-loop', 'cv-prism']
const mediaSrc = (p: unknown) => \`/media/\${String(p).split('/').pop()}\`
---
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>{name} — Portfolio</title>
<style>
  :root{
    --ink:#0A0A0D;--ink-2:#111116;--line:#26262E;--fog:#8A8A96;--paper:#F2F2EC;
    --accent:#FF2E88;--accent-dim:#B31E60;
    --display:"Helvetica Neue",Helvetica,Arial,"Arial Narrow",sans-serif;
    --body:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
    --mono:ui-monospace,"SF Mono","SFMono-Regular",Menlo,Consolas,monospace;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html{scroll-behavior:smooth}
  body{background:var(--ink);color:var(--paper);font-family:var(--body);-webkit-font-smoothing:antialiased;overflow-x:hidden;line-height:1.4}
  a{color:inherit;text-decoration:none}
  :focus-visible{outline:2px solid var(--accent);outline-offset:4px;border-radius:1px}
  .wrap{max-width:1400px;margin:0 auto;padding:0 clamp(20px,5vw,72px)}
  .label{font-family:var(--mono);font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:var(--fog)}
  header{position:sticky;top:0;z-index:50;backdrop-filter:blur(10px);background:color-mix(in srgb,var(--ink) 78%,transparent);border-bottom:1px solid var(--line)}
  .bar{display:flex;align-items:center;justify-content:space-between;height:64px}
  .mark{font-family:var(--display);font-weight:800;font-size:20px;letter-spacing:-.04em;display:flex;align-items:baseline;gap:2px}
  .mark .slash{color:var(--accent)}
  nav{display:flex;gap:clamp(14px,2.4vw,34px);align-items:center}
  nav a{font-family:var(--mono);font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--fog);transition:color .25s ease}
  nav a:hover{color:var(--paper)}
  .hero{padding-top:clamp(56px,11vw,150px);padding-bottom:clamp(40px,7vw,90px);position:relative}
  .hero-index{display:flex;gap:18px;align-items:center;margin-bottom:clamp(20px,3vw,40px)}
  .hero-index .line{height:1px;flex:1;max-width:120px;background:var(--line)}
  .giant{font-family:var(--display);font-weight:800;line-height:.82;letter-spacing:-.045em;text-transform:uppercase;font-size:clamp(74px,20vw,340px);margin-left:-.02em}
  .giant .row2{color:transparent;-webkit-text-stroke:1.4px var(--paper);position:relative}
  .giant .row2::after{content:"";position:absolute;left:-.5vw;bottom:.1em;width:calc(100% + 1vw);height:.16em;background:var(--accent);z-index:-1;transform-origin:left center;animation:sweep 1.1s cubic-bezier(.16,1,.3,1) .25s both}
  @keyframes sweep{from{transform:scaleX(0)}to{transform:scaleX(1)}}
  .hero-foot{display:grid;grid-template-columns:1fr;gap:clamp(26px,4vw,48px);margin-top:clamp(34px,5vw,70px);align-items:end}
  @media(min-width:820px){.hero-foot{grid-template-columns:1fr auto}}
  .blurb{max-width:44ch;color:#C9C9D2;font-size:clamp(15px,1.4vw,18px);line-height:1.55}
  .cta{display:inline-flex;align-items:center;gap:14px;font-family:var(--mono);font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink);background:var(--accent);padding:16px 22px;border:1px solid var(--accent);white-space:nowrap;transition:background .25s ease,color .25s ease,transform .25s ease}
  .cta .dot{width:8px;height:8px;background:var(--ink);border-radius:50%;transition:transform .25s ease}
  .cta:hover{background:transparent;color:var(--accent);transform:translateY(-2px)}
  .cta:hover .dot{background:var(--accent);transform:translateX(4px)}
  section{padding-block:clamp(60px,9vw,130px)}
  .sec-head{display:flex;align-items:baseline;justify-content:space-between;gap:20px;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:22px;margin-bottom:clamp(30px,5vw,58px)}
  .sec-head h2{font-family:var(--display);font-weight:800;letter-spacing:-.03em;text-transform:uppercase;font-size:clamp(26px,4vw,52px);line-height:.95}
  .grid{display:grid;grid-template-columns:1fr;gap:clamp(22px,2.4vw,30px)}
  @media(min-width:760px){
    .grid{grid-template-columns:repeat(12,1fr);grid-auto-flow:dense}
    .card{grid-column:span 6}
    .card:nth-child(1){grid-column:1 / span 7}
    .card:nth-child(2){grid-column:8 / span 5;margin-top:64px}
    .card:nth-child(3){grid-column:1 / span 5}
    .card:nth-child(4){grid-column:6 / span 7;margin-top:-40px}
  }
  .card{display:block;position:relative;border:1px solid var(--line);background:var(--ink-2);overflow:hidden;transition:border-color .35s ease,transform .35s cubic-bezier(.16,1,.3,1)}
  .card:hover{border-color:var(--accent);transform:translateY(-6px)}
  .cover{position:relative;aspect-ratio:16/11;overflow:hidden}
  .card:nth-child(2) .cover,.card:nth-child(3) .cover{aspect-ratio:4/5}
  .cover .fill{position:absolute;inset:0;transition:transform .6s cubic-bezier(.16,1,.3,1),filter .5s ease}
  img.fill{width:100%;height:100%;object-fit:cover}
  .card:hover .fill{transform:scale(1.06)}
  .cv-aurora{background:radial-gradient(120% 90% at 15% 15%,rgba(255,46,136,.55),transparent 55%),radial-gradient(120% 90% at 85% 30%,rgba(52,120,255,.5),transparent 55%),conic-gradient(from 200deg at 60% 80%,#12122a,#201038,#3a1030,#12122a)}
  .cv-field{background:repeating-linear-gradient(0deg,transparent 0 22px,rgba(255,255,255,.05) 22px 23px),linear-gradient(135deg,#1a1712,#0e0d0b)}
  .cv-field::before{content:"";position:absolute;left:12%;top:14%;width:44%;height:6px;background:var(--accent);box-shadow:0 26px 0 rgba(242,242,236,.9),0 52px 0 rgba(242,242,236,.55),0 78px 0 rgba(242,242,236,.3)}
  .cv-loop{background:radial-gradient(circle at 50% 50%,transparent 0 14%,var(--accent) 14% 15%,transparent 15% 26%,rgba(242,242,236,.85) 26% 27%,transparent 27% 40%,var(--accent) 40% 41%,transparent 41% 56%,rgba(242,242,236,.4) 56% 57%,transparent 57%),#0e0d14}
  .cv-prism{background:linear-gradient(90deg,transparent 0 62%,rgba(255,46,136,.9) 62% 66%,transparent 66% 70%,rgba(242,242,236,.85) 70% 73%,transparent 73%),conic-gradient(from 90deg at 30% 50%,#2a0d1c,#0c0c12,#171029,#2a0d1c)}
  .card-meta{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:20px 22px 24px}
  .card-title{font-family:var(--display);font-weight:800;letter-spacing:-.02em;font-size:clamp(24px,3vw,38px);line-height:.95;text-transform:uppercase}
  .card-sub{color:var(--fog);font-size:14px;margin-top:8px;max-width:30ch}
  .card-kind{font-family:var(--mono);font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--fog);white-space:nowrap;padding-top:6px;transition:color .3s ease}
  .card:hover .card-kind{color:var(--accent)}
  .card-idx{position:absolute;top:14px;left:16px;z-index:2;font-family:var(--mono);font-size:12px;letter-spacing:.2em;color:var(--paper);mix-blend-mode:difference}
  .card-arrow{position:absolute;top:14px;right:16px;z-index:2;width:34px;height:34px;display:grid;place-items:center;border:1px solid rgba(242,242,236,.6);border-radius:50%;font-size:15px;color:var(--paper);transition:background .3s ease,color .3s ease,border-color .3s ease,transform .3s ease}
  .card:hover .card-arrow{background:var(--accent);border-color:var(--accent);color:var(--ink);transform:rotate(-45deg)}
  .about{display:grid;grid-template-columns:1fr;gap:clamp(24px,4vw,60px);border-top:1px solid var(--line);padding-top:clamp(40px,6vw,72px)}
  @media(min-width:860px){.about{grid-template-columns:auto 1fr}}
  .about .label{white-space:nowrap}
  .about p{font-family:var(--display);font-weight:600;font-size:clamp(22px,3.2vw,42px);line-height:1.14;letter-spacing:-.02em;max-width:24ch}
  footer{border-top:1px solid var(--line);padding-block:clamp(50px,7vw,90px)}
  .foot-cta{margin-bottom:clamp(34px,5vw,60px)}
  .foot-cta .label{margin-bottom:18px}
  .mailto{font-family:var(--display);font-weight:800;letter-spacing:-.03em;font-size:clamp(30px,7vw,96px);line-height:.9;display:inline-block;position:relative}
  .mailto::after{content:"";position:absolute;left:0;bottom:.06em;height:.06em;width:100%;background:var(--accent);transform:scaleX(0);transform-origin:left;transition:transform .4s cubic-bezier(.16,1,.3,1)}
  .mailto:hover::after{transform:scaleX(1)}
  .foot-row{display:flex;flex-wrap:wrap;gap:20px 40px;align-items:center;justify-content:space-between;border-top:1px solid var(--line);padding-top:26px}
  .colophon{font-family:var(--mono);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--fog)}
  .colophon a{color:var(--accent)}
  @media(prefers-reduced-motion:reduce){*{animation:none !important;transition:none !important;scroll-behavior:auto !important}.giant .row2::after{transform:scaleX(1)}}
</style>
</head>
<body>
<header>
  <div class="wrap bar">
    <a href="#top" class="mark">{initials}<span class="slash">/</span></a>
    <nav aria-label="Primary">
      <a href="#work">Work</a>
      <a href="#about">About</a>
      <a href="#contact">Contact</a>
    </nav>
  </div>
</header>
<main id="top">
  <section class="hero wrap">
    <div class="hero-index">
      <span class="label">Portfolio — Selected</span>
      <span class="line" aria-hidden="true"></span>
    </div>
    <h1 class="giant">
      <span class="row1">{first}</span>
      {surname && (<Fragment><br /><span class="row2">{surname}</span></Fragment>)}
    </h1>
    <div class="hero-foot">
      {bio && <p class="blurb">{bio}</p>}
      <a class="cta" href="#work">See selected work <span class="dot" aria-hidden="true"></span></a>
    </div>
  </section>

  <section id="work" class="wrap">
    <div class="sec-head">
      <h2>Selected<br />Work</h2>
      <span class="label">{projects.length} projects</span>
    </div>
    <div class="grid">
      {projects.map((p, i) => (
        <a class="card" href={p.data.url ?? '#contact'}>
          <div class="cover">
            {p.data.cover
              ? <img class="fill" src={mediaSrc(p.data.cover)} alt={String(p.data.title ?? '')} />
              : <div class={\`fill \${arts[i % arts.length]}\`}></div>}
          </div>
          <span class="card-idx">{String(i + 1).padStart(2, '0')}</span>
          <span class="card-arrow" aria-hidden="true">↗</span>
          <div class="card-meta">
            <div>
              <h3 class="card-title">{p.data.title ?? p.id}</h3>
              {p.data.summary && <p class="card-sub">{p.data.summary}</p>}
            </div>
            {p.data.kind && <span class="card-kind">{p.data.kind}</span>}
          </div>
        </a>
      ))}
    </div>
  </section>

  {bio && (
    <section id="about" class="wrap">
      <div class="about">
        <span class="label">About</span>
        <p>{bio}</p>
      </div>
    </section>
  )}
</main>

<footer id="contact" class="wrap">
  <div class="foot-cta">
    <p class="label">${BADGE}</p>
    <a class="mailto" href="${JJ}">{name}</a>
  </div>
  <div class="foot-row">
    <p class="colophon">{name}</p>
    <p class="colophon">Made with <a href="${JJ}">${BADGE}</a></p>
  </div>
</footer>
</body>
</html>
`,
}

const cv: SiteTemplate = {
  theme: { palette: 'paper', accent: '#7A2E2E', font: 'serif', radius: 2, density: 'normal' },
  index: `---
import { getCollection, getEntry } from 'astro:content'

const experience = await getCollection('experience')
const profile = await getEntry('profile', 'profile')
const name = String(profile?.data.name ?? 'Your Name')
const headline = profile?.data.headline
---
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{name}{headline ? \` — \${headline}\` : ''}</title>
<style>
  :root{
    --paper:#FAF8F3;--ink:#1B1A17;--muted:#6C685E;--faint:#928D80;--rule:#D9D3C6;--rule-strong:#B7AF9E;--accent:#7A2E2E;
    --serif:"Palatino Linotype","Book Antiqua",Palatino,"Iowan Old Style",Georgia,serif;
    --sans:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    --mono:ui-monospace,"SFMono-Regular",Menlo,Consolas,monospace;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--sans);font-size:16px;line-height:1.55;-webkit-font-smoothing:antialiased}
  .sheet{max-width:820px;margin:0 auto;padding:48px 40px 72px}
  .label{font-family:var(--mono);font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--faint)}
  header.masthead{border-top:2px solid var(--ink);padding-top:16px}
  .masthead .filing{display:flex;justify-content:space-between;align-items:baseline;gap:16px;flex-wrap:wrap}
  .masthead .filing .ref{color:var(--accent)}
  .name{font-family:var(--serif);font-weight:600;font-size:clamp(2.6rem,7vw,4.4rem);line-height:.98;letter-spacing:-.01em;margin:.28em 0 .12em}
  .role{font-family:var(--serif);font-style:italic;font-size:clamp(1.05rem,2.4vw,1.35rem);color:var(--muted);margin:0}
  main{margin-top:40px}
  section{margin-bottom:34px}
  .sectitle{font-family:var(--mono);font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:var(--faint);margin:0 0 14px;display:flex;align-items:center;gap:10px}
  .sectitle::after{content:"";flex:1;height:1px;background:var(--rule)}
  .entry{padding:22px 0 26px;border-top:1px solid var(--rule)}
  .entry:first-of-type{border-top:1px solid var(--rule-strong)}
  .entry h3{font-family:var(--serif);font-size:1.32rem;font-weight:600;margin:0 0 2px;letter-spacing:-.005em}
  .entry .org{font-size:14px;color:var(--muted);margin:0 0 9px}
  .entry .line{margin:0;font-size:15px;color:#33302a;max-width:60ch}
  footer{margin-top:52px;padding-top:14px;border-top:2px solid var(--ink);display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px}
  footer a{color:var(--accent);text-decoration:none;border-bottom:1px solid var(--rule-strong)}
  a:focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:2px}
  @media(max-width:680px){.sheet{padding:32px 22px 56px}}
  @media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
  @media print{:root{--paper:#fff}body{font-size:11pt;color:#000}.sheet{max-width:none;padding:0}.entry,section{break-inside:avoid}footer a{color:#000;border:0}}
</style>
</head>
<body>
<div class="sheet">
  <header class="masthead">
    <div class="filing label">
      <span>Curriculum Vitae — Dossier</span>
      {headline && <span class="ref">{headline}</span>}
    </div>
    <h1 class="name">{name}</h1>
    {headline && <p class="role">{headline}</p>}
  </header>

  <main>
    <section>
      <h2 class="sectitle">Experience</h2>
      {experience.map((e) => (
        <article class="entry">
          <h3>{e.data.role ?? e.id}</h3>
          {e.data.company && <p class="org">{e.data.company}</p>}
          {e.data.summary && <p class="line">{e.data.summary}</p>}
        </article>
      ))}
    </section>
  </main>

  <footer class="label">
    <span>{name}{headline ? \` · \${headline}\` : ''}</span>
    <span>Made with <a href="${JJ}">${BADGE}</a></span>
  </footer>
</div>
</body>
</html>
`,
}

const event: SiteTemplate = {
  theme: { palette: 'ink', accent: '#FF6A1A', font: 'sans', radius: 16, density: 'normal' },
  index: `---
import { getCollection, getEntry } from 'astro:content'

const sessions = await getCollection('sessions')
const ev = await getEntry('event', 'event')
const title = String(ev?.data.title ?? 'My Event')
const tagline = ev?.data.tagline
const rooms = ['main', 'a', 'b']
const strip = [title, tagline].filter(Boolean) as string[]
const track = strip.length ? [...strip, ...strip, ...strip, ...strip] : [title, title, title, title]
const speakers = sessions.filter((s) => s.data.speaker)
---
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>{title}</title>
<style>
  :root{
    --plum:#2A0A3C;--plum-800:#360F4C;--plum-700:#451763;--plum-line:#5A2B7A;
    --tangerine:#FF6A1A;--pink:#FF2E7E;--lilac:#C79BE6;--paper:#FFF1E4;--paper-dim:#E4CDDF;
    --sans:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    --mono:ui-monospace,"SF Mono",SFMono-Regular,Menlo,Consolas,monospace;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html{scroll-behavior:smooth}
  @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
  body{background:var(--plum);color:var(--paper);font-family:var(--sans);line-height:1.5;-webkit-font-smoothing:antialiased;overflow-x:hidden}
  a{color:inherit}
  :focus-visible{outline:3px solid var(--tangerine);outline-offset:3px;border-radius:2px}
  .wrap{max-width:1080px;margin:0 auto;padding:0 24px}
  .marquee{background:var(--tangerine);color:var(--plum);border-top:3px solid var(--plum);border-bottom:3px solid var(--plum);overflow:hidden;white-space:nowrap;position:relative}
  .marquee::before,.marquee::after{content:"";position:absolute;top:0;bottom:0;width:64px;z-index:2;pointer-events:none}
  .marquee::before{left:0;background:linear-gradient(90deg,var(--tangerine),transparent)}
  .marquee::after{right:0;background:linear-gradient(270deg,var(--tangerine),transparent)}
  .marquee__track{display:inline-block;padding:11px 0;font-family:var(--mono);font-weight:700;font-size:.82rem;letter-spacing:.14em;text-transform:uppercase;animation:slide 26s linear infinite}
  .marquee__track span{padding:0 22px}
  .marquee__track .dot{color:var(--pink)}
  @keyframes slide{from{transform:translateX(0)}to{transform:translateX(-50%)}}
  @media(prefers-reduced-motion:reduce){.marquee__track{animation:none;padding-left:24px}}
  .nav{position:sticky;top:0;z-index:20;background:rgba(42,10,60,.86);backdrop-filter:saturate(140%) blur(10px);border-bottom:1px solid var(--plum-line)}
  .nav__in{display:flex;align-items:center;gap:20px;height:60px}
  .brand{font-weight:800;letter-spacing:-.02em;font-size:1.05rem;display:flex;align-items:center;gap:9px;text-decoration:none;white-space:nowrap}
  .brand .bulb{width:12px;height:12px;border-radius:50%;background:var(--tangerine);box-shadow:0 0 0 3px rgba(255,106,26,.25),0 0 14px var(--tangerine)}
  .nav__links{margin-left:auto;display:flex;gap:6px;align-items:center}
  .nav__links a{text-decoration:none;font-size:.86rem;font-weight:600;color:var(--paper-dim);padding:8px 12px;border-radius:999px}
  .nav__links a:hover{color:var(--paper);background:var(--plum-700)}
  .hero{padding:72px 0 64px;position:relative}
  .eyebrow{font-family:var(--mono);font-size:.78rem;letter-spacing:.28em;text-transform:uppercase;color:var(--tangerine);font-weight:700;display:flex;align-items:center;gap:12px;margin-bottom:26px}
  .eyebrow::after{content:"";flex:1;height:1px;background:var(--plum-line);max-width:180px}
  .hero h1{font-size:clamp(3.2rem,11vw,7.5rem);line-height:.9;font-weight:800;letter-spacing:-.035em;text-transform:uppercase}
  .hero .tagline{margin-top:28px;font-size:clamp(1.15rem,2.6vw,1.6rem);max-width:34ch;color:var(--paper);font-weight:500}
  .sec-head{display:flex;align-items:baseline;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:8px}
  .sec-head h2{font-size:clamp(1.8rem,5vw,2.8rem);font-weight:800;letter-spacing:-.03em;text-transform:uppercase;line-height:1}
  .sec-head .num{font-family:var(--mono);color:var(--tangerine);font-size:.8rem;letter-spacing:.2em;font-weight:700}
  .schedule{padding:26px 0 30px}
  .slot{display:grid;grid-template-columns:132px 1fr auto;gap:8px 28px;align-items:center;padding:22px 20px 22px 0;border-top:1px solid var(--plum-line);position:relative}
  .slot:last-child{border-bottom:1px solid var(--plum-line)}
  .slot:hover{background:var(--plum-800)}
  .slot .time{font-family:var(--mono);font-weight:700;font-size:2.5rem;letter-spacing:-.03em;line-height:1;color:var(--paper);font-variant-numeric:tabular-nums}
  .slot:hover .time{color:var(--tangerine)}
  .slot .body h3{font-size:1.28rem;font-weight:700;letter-spacing:-.01em;line-height:1.2}
  .slot .body .who{margin-top:6px;font-size:.95rem;color:var(--paper-dim);font-family:var(--mono);letter-spacing:.01em}
  .slot .body .who b{color:var(--paper);font-weight:700}
  .room{justify-self:end;white-space:nowrap;font-family:var(--mono);font-size:.74rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;padding:6px 12px;border-radius:999px;border:1.5px solid currentColor}
  .room.main{color:var(--tangerine)}
  .room.a{color:var(--pink)}
  .room.b{color:var(--lilac)}
  @media(max-width:680px){
    .slot{grid-template-columns:1fr auto;gap:4px 16px;padding:20px 0}
    .slot .time{grid-column:1;font-size:2.1rem}
    .room{grid-column:2;grid-row:1;align-self:start}
    .slot .body{grid-column:1 / -1;margin-top:10px}
  }
  .speakers{padding:56px 0 20px}
  .spk-grid{margin-top:26px;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));border-top:1px solid var(--plum-line)}
  .spk{padding:24px 20px 24px 0;border-bottom:1px solid var(--plum-line);display:flex;align-items:baseline;gap:14px}
  .spk .idx{font-family:var(--mono);font-size:.78rem;color:var(--tangerine);font-weight:700;min-width:24px}
  .spk .nm{font-size:1.25rem;font-weight:700;letter-spacing:-.01em}
  .spk .role{display:block;margin-top:3px;font-size:.82rem;color:var(--paper-dim);font-family:var(--mono);letter-spacing:.02em}
  footer{padding:64px 0 72px;margin-top:56px;border-top:1px solid var(--plum-line)}
  .foot-grid{display:flex;flex-wrap:wrap;justify-content:space-between;gap:32px}
  .foot-venue .k{font-family:var(--mono);font-size:.72rem;letter-spacing:.2em;text-transform:uppercase;color:var(--lilac);font-weight:700}
  .foot-venue .v{margin-top:8px;font-size:1.15rem;font-weight:700}
  .foot-venue .addr{margin-top:4px;color:var(--paper-dim);font-size:.95rem}
  .see-you{font-size:clamp(2rem,7vw,3.6rem);font-weight:800;letter-spacing:-.03em;text-transform:uppercase;line-height:.9;text-align:right}
  .see-you span{color:var(--tangerine)}
  .foot-fine{margin-top:44px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;font-family:var(--mono);font-size:.78rem;color:var(--paper-dim);letter-spacing:.04em}
  .foot-fine a{color:var(--tangerine)}
  @media(max-width:560px){.see-you{text-align:left}}
</style>
</head>
<body>
  <div class="marquee" aria-hidden="true">
    <div class="marquee__track">
      {track.map((s) => (<Fragment><span>{s}</span><span class="dot">●</span></Fragment>))}
    </div>
  </div>

  <nav class="nav">
    <div class="wrap nav__in">
      <a href="#top" class="brand"><span class="bulb"></span>{title}</a>
      <div class="nav__links">
        <a href="#schedule">Schedule</a>
        <a href="#speakers">Speakers</a>
      </div>
    </div>
  </nav>

  <header class="hero" id="top">
    <div class="wrap">
      {tagline && <p class="eyebrow">{tagline}</p>}
      <h1>{title}</h1>
      {tagline && <p class="tagline">{tagline}</p>}
    </div>
  </header>

  <main>
  <section class="schedule" id="schedule">
    <div class="wrap">
      <div class="sec-head">
        <h2>The running order</h2>
        <span class="num">{sessions.length} SESSIONS</span>
      </div>
      {sessions.map((s, i) => (
        <article class="slot">
          <div class="time">{s.data.time ?? ''}</div>
          <div class="body">
            <h3>{s.data.title ?? s.id}</h3>
            {s.data.speaker && <p class="who">with <b>{s.data.speaker}</b></p>}
          </div>
          {s.data.room && <span class={\`room \${rooms[i % rooms.length]}\`}>{s.data.room}</span>}
        </article>
      ))}
    </div>
  </section>

  {speakers.length > 0 && (
    <section class="speakers" id="speakers">
      <div class="wrap">
        <div class="sec-head"><h2>Who's talking</h2></div>
        <div class="spk-grid">
          {speakers.map((s, i) => (
            <div class="spk">
              <span class="idx">{String(i + 1).padStart(2, '0')}</span>
              <span><span class="nm">{s.data.speaker}</span><span class="role">{s.data.title ?? ''}</span></span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )}
  </main>

  <footer id="venue">
    <div class="wrap">
      <div class="foot-grid">
        <div class="foot-venue">
          <p class="k">Event</p>
          <p class="v">{title}</p>
          {tagline && <p class="addr">{tagline}</p>}
        </div>
        <p class="see-you">See you<br /><span>there.</span></p>
      </div>
      <div class="foot-fine">
        <span>{title}</span>
        <span>Made with <a href="${JJ}">${BADGE}</a></span>
      </div>
    </div>
  </footer>
</body>
</html>
`,
}

const templates: Record<string, SiteTemplate> = { portfolio, cv, event }

export function siteTemplateIds(): string[] {
  return Object.keys(templates)
}

/**
 * Preset'in styled dosyalarını döner (index.astro + _theme.json), yoksa null.
 * Ortak dosyaları (package.json vb.) scaffold.ts üretir.
 */
export function siteTemplateFiles(
  preset: string,
  _projectName: string,
): Record<string, string> | null {
  const t = templates[preset]
  if (!t) return null
  return {
    'src/pages/index.astro': t.index,
    'content/_theme.json': `${JSON.stringify(t.theme, null, 2)}\n`,
  }
}
