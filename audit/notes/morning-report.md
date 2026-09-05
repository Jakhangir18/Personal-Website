# Overnight audit report - 2026-09-05/06

Repository: github.com/Jakhangir18/Personal-Website. `main` untouched. All work on branches, all pushed.

## What to look at (tailnet only, laptop browser or iPhone Safari)

| URL | Branch | What it is |
|---|---|---|
| https://vps-worker.taild24189.ts.net | `audit/perf-bugs` (e0b62f9) | safe fixes only, no visual change intended |
| https://vps-worker.taild24189.ts.net:8443 | `audit/visual-risky` (67f2085) | perf-bugs + 9 riskier commits, biggest speed gain |
| https://vps-worker.taild24189.ts.net:8444 | `proto/work-a` | Work section prototype A "Index" (large-type list, hover video) |
| https://vps-worker.taild24189.ts.net:8445 | `proto/work-b` | prototype B "Stack" (full-bleed sticky panels) |
| https://vps-worker.taild24189.ts.net:8446 | `proto/work-c` | prototype C "Strip" (horizontal filmstrip + title ticker) |

Screenshots: `audit/out/baseline`, `audit/out/after-lcp` (perf-bugs), `audit/out/risky-v3`, `audit/out/proto/work-{a,b,c}`
(Chromium + WebKit, 1440x900 and 390x844, at 0/25/50/75/100 % of the page).

## Numbers (headless Chromium/WebKit on the 4-core VPS, no GPU - relative, not user FPS)

Work section scroll, Chromium 390x844 (closest to a phone):

| build | FPS avg | 1 % low | frames > 50 ms | style recalc during scroll |
|---|---|---|---|---|
| baseline | 44.6 | 13.9 | 50 | - |
| perf-bugs (safe) | 47.1 | 17.9 | 46 | 14.5 s |
| visual-risky | **59.7** | **39.9** | **1** | 9.6 s |

Work section, WebKit 390x844 (Safari engine): 11.8 -> 16.5 (perf-bugs) -> **26.7** FPS (risky); frames > 50 ms 939 -> 773 -> **106**.
Work section, Chromium 1440x900: 12.8 -> 12.5 -> **27.8** FPS; frames > 50 ms 2712 -> 2695 -> **174**; style recalc 23.3 s -> 12.7 s.

Lighthouse (production build): mobile Performance 64 -> 90 (risky), TBT 881 -> 194 ms; desktop 69 -> 70.
Accessibility 95 -> 100 (axe: 0 critical/serious). Console errors 0, failed requests 0 (both engines).

## Root causes found and fixed

Safe branch `audit/perf-bugs`:
1. `Ticker.js` callback queue grew for the whole session (delete instead of clear) - the "works, then breaks" symptom.
2. Videos: pause only fired at progress exactly 1/-1, so ~45 videos decoded at once; Safari caps decoders hardest. Now pause at >= 0.98, play() promise tracked, eager load capped at 6, rest on demand.
3. `SWork` scrub timeline never killed on resize (`this.tl` never assigned) - leaked ScrollTriggers.
4. Per-frame work: two `getBoundingClientRect` + CSS var write + 5184 stroked rects every frame; now cached, deduped, filled.
5. Scrollbar forced layout per scroll tick (`scrollHeight`) - cached.
6. Hero `SplitText` ran before fonts loaded; aria-label on plain spans (axe); two unused font preloads.
7. Hero init waited for `window.load` (delayed by videos); listeners now attach immediately; Work setup deferred to idle time.
8. Repo: `node_modules` was committed (10 230 files) - removed and ignored; `astro check` clean; `init.sh`, `features.json`, `claude-progress.txt` added.

Risky branch `audit/visual-risky` (on top of the above):
- `will-change` only while the Work section is on screen (was permanent on ~130 elements).
- Contrast-mask overlay (`mix-blend-mode: darken`, full viewport) mounted only during its wipe.
- Canvas dot grid gap 24 -> 36 and pre-rendered to an offscreen buffer (visibly sparser field - check).
- Per-frame CSS custom property writes on `.s-work` / `.s__scene` / 45 `<a-work>` replaced by direct inline transforms (biggest win; parallax math transcribed 1:1, review found no visual delta in code).
- Static `clip-path` on `.s__outer` removed (no-op). The animated clip-path on `.s__inner` is left as is (needs a redesign to remove).

## Decisions needed from you

1. Merge `audit/visual-risky` into `audit/perf-bugs`? Compare :443 vs :8443 in Safari; the dot field is sparser, everything else should look identical.
2. Work section direction: A, B or C (or a mix). Then send the real works (video/image + title + year + role + link) and I wire them into one array in the component.
3. LCP / desktop Lighthouse (70): the intro overlay hides everything for ~3 s and the hero letters are drawn by pseudo-elements, so the browser has no LCP candidate until the 48 px star icon. Options: (a) shorten the intro, (b) make the hero title real text under the pseudo layer, (c) accept the score. Design call.
4. 21st.dev key passed through chat - rotate it when convenient; file `~/.config/21st/env` (600) is the only place it is stored.

## Safari gate (only you can run it - real iPhone, real Safari)

Open :443 and :8443 on the phone. Scroll the Work section down and back up several times, fast and slow. Let the address bar collapse and return at least twice while the section is on screen. Watch for: a band at the top or bottom, the pinned scene tearing away, the fixed layer bleeding into the next section, the area going black or blank. Also: videos start at all (muted + playsinline), and the contrast toggle wipe still looks right on :8443. Report symptom + where + what you were doing; a screen recording beats words.

## Still open / next

- F1/F2 wait for your Safari gate; headless numbers cannot prove smoothness on a real device.
- `SMyWay` section has the same CSS-var-per-frame pattern (`--scroll-progress` on `.s-my-way`, per-object `--x/--y/--z/--r*`) - same fix applies, not done.
- Remaining style recalc in Work (12.7 s desktop): ghost-letter `--state`/`--progress` per span (36 spans, feeds `::before`), scrub tween attrs - next candidates.
- Prototype B: previous panel's meta text shows through during the overlap (needs a solid panel background or meta fade).
- Prototype C: title ticker may run out of width on very wide screens with short titles.
- 21st.dev: reachable via `node audit/mcp-call.mjs list|call` (35 tools); catalog is React/shadcn, use as technique reference; integration notes in `audit/notes/21st-integration.md`.

## Files

`features.json` (F1-F11 status), `claude-progress.txt` (timeline), `init.sh` (env check), `audit/` (measure.mjs, compare.mjs, lighthouse.sh, run-all.sh, measure-worktree.sh, shoot-protos.sh, serve-protos.sh, keyboard.mjs, mcp-call.mjs).
Worktrees: `../Personal-Website-risky` (audit/visual-risky), `../Personal-Website-proto` (proto/*).
