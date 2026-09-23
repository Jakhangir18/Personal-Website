# Personal site — state and what it needs

Audited 2026-09-23 from a clean clone, `npm ci && npm run build` green,
previewed at 1440x900 and read section by section.

## What the site is right now

It is an unmodified copy of a published portfolio template, and the template's
own content is still in it:

- The hero separator spells **Antoine Wodniack** letter by letter
  (`src/components/SHero.astro`, `strings={['Ant','oi','ne','Wo','dn','ia','ck']}`).
- The header reads **"Coding globally from France."** and
  **"Available for freelance work → Hire me"** (`src/components/SiteHead.astro`).
- The about section carries that developer's real award record — Awwwards
  "SOTD x 16", FWA, CSSDA, and a "2025 Webby Awards Winner, Best Home Page"
  (`src/components/SAbout.astro`).
- The work section shows **"DUMMY PROJECT 1"** and **"DUMMY PROJECT 2"** over
  placeholder videos (`src/assets/works/Dummy.mp4`, `Pen-4.mp4` … `Pen-8.mp4`).
- The page title is "Jack Portfolio" and there is no description, no Open Graph
  image, no favicon of his own.

**This cannot go online as it stands.** Published under his name it claims
another person's identity and another person's awards. Everything above is
replaced before the site is deployed anywhere, not after.

## What it does well

Worth keeping: the scroll choreography (Lenis + GSAP ScrollTrigger), the wave
canvas in the hero, the contrast theme toggle, and the section structure
(hero → about → work → "my way" → CTA). The build is clean and fast, and the
layout is responsive.

## What has to be written

1. **Identity.** Name, one-line role, location (Corvallis, Oregon), the
   separator letters, the tab title, a real favicon, a description, and an
   Open Graph image.
2. **About.** Replace the award block with what is true: Computer Science
   Applied Option at Oregon State with a physics minor, Co-President of GDG on
   Campus at OSU, what he builds and what he is looking for (Summer 2027
   internship).
3. **Work — four real projects**, each with a screen capture in place of the
   dummy videos:
   - the GDG on Campus club website (Astro, gdgc-osu.com, live, he rebuilt the
     officers page and the deploy),
   - the private portal built for his father's business (FastAPI, local
     transcription, an agent answering in Russian),
   - the agent work on this host (iMessage bridge, research pipelines),
   - one hackathon project — QuackHacks, BeaverHacks or SafeKeylab, whichever
     demos best.
4. **Contact and proof.** Real LinkedIn (`linkedin.com/in/tynshimov`), GitHub
   (`github.com/Jakhangir18`), OSU email, and a resume PDF served from
   `public/`. The current header links point at the template author's socials.
5. **Deploy.** Decide GitHub Pages (same pattern as the club site, free) or
   Vercel, then add the workflow and a custom domain if he wants one.

## Content pass done in this branch (2026-09-23, overnight)

The template's identity is out of the built page — `dist/index.html` no longer
contains "Antoine", "Wodniack", "Awwwards", "Webby" or "France":

- Header: "Building from Corvallis, Oregon." and "Open to a Summer 2027
  internship → Email me" pointing at `tynshimj@oregonstate.edu`; socials now go to
  `github.com/Jakhangir18` and `linkedin.com/in/tynshimov`; the QR code in the
  corner was regenerated and encodes his LinkedIn instead of the template
  author's contact.
- Hero: the letter separator spells **Jakhangir Tynshimov**.
- About: four paragraphs in his own voice — OSU, the work at Automated Monitoring
  Solutions, co-leading GDG on Campus, and what he is looking for.
- The **Awards** block is now **Highlights**, carrying only things with a source:
  GDG on Campus Co-President, CS Applied Option at Oregon State, URSA Engage
  research 2026, the AMS role, the club website rebuild, Rowerlab, Eco-Chain.
- Page title and description are his.

Removed as well: the "My Way" section. It was the template author's own life in
photographs — his desk setups from 2006, 2016 and 2020, his first FWA award from
2012, his studio "Waaark" — under the giant line "remember not to steal this".
None of it could be his, so the component and `src/assets/frames` are gone.

The **work** section now shows one real project: the GDG on Campus club website,
as two screen recordings of gdgc-osu.com captured for this branch. The ten
"Dummy Project" entries and the template's CodePen clips are deleted. With one
project the scene is sparse — it is built for a dozen — so the next captures
(the father's portal, the agent work, a hackathon project) fill it out.

Still template, still to do:

1. **The logo** is now a plain geometric **JT** in the template's own bar style,
   drawn as two paths in `SiteHead.astro`. It is a placeholder with his initials,
   not a designed mark — replace it when he has one.
2. **The work section holds one project.** The club website is in; the father's
   portal, the agent work and a hackathon project still need captures.
3. **No resume PDF in `public/`.** A reduced-motion path now exists — Lenis is
   skipped and CSS animation is cut when the system asks for it — but the
   scroll-driven scenes still play as they are scrolled; turning those off is a
   rebuild, not a media query.
4. The page carries `<meta name="robots" content="noindex, nofollow">`, so nothing
   is indexed while this is half-finished. Remove that line on the day it ships.

## A test that keeps the identity out

`npm test` runs three Playwright checks against the production build:

1. The built page contains none of the template author's words — Antoine,
   Wodniack, Awwwards, Webby, "Coding globally from France", the dummy project
   labels, the CodePen handle, `hello@example.com` — and does contain his title,
   his location line, his GitHub, his LinkedIn and his address. This check is
   what found `hello@example.com` still sitting in the contact section and
   "Jack Portfolio" in the Apple web-app title after the first content pass.
2. A reduced-motion visitor gets the page at once: no intro element, scrolling
   released, `is-reduced-motion` set, Lenis absent, the menu still navigating,
   and no page error.
3. No horizontal overflow at 390px.

## Repository hygiene, done in this branch

`node_modules` (168 MB, 10 236 files) and `.astro` were committed in the first
"Install project dependencies" commit; both are now untracked and ignored, and
`.DS_Store` with them. The clone drops from 43 MB to a normal size for anyone
who forks it later.

## Risks to check before publishing

- **Template licence.** Find where the template came from and what its licence
  allows. If it is a commercial or personal-use-only theme, either buy the
  licence or rebuild the sections. Publishing a themed site is fine; publishing
  the author's name and awards is not.
- **Weight.** The page scrolls 27 710 px and ships several MP4s. Replace the
  dummy videos with compressed captures rather than adding more.
- **Motion.** `prefers-reduced-motion` now skips the five-second intro curtain,
  the smooth-scroll hijack and every CSS animation, and marks the document with
  `is-reduced-motion`. Verified in a reduced-motion browser context: the intro
  element is gone and the page scrolls 1.5 s after load, while a normal visitor
  still gets the full intro. The pinned, scroll-driven scenes still run under the
  visitor's own scrolling.
