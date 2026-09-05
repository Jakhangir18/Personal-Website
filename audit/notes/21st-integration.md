# Using 21st.dev components in this site without breaking it

Site facts that constrain any import: Astro 5 static build, no React runtime, GSAP + Lenis own the
scroll (Lenis ticks from gsap.ticker; ScrollTrigger is updated from Lenis), SCSS with global
tokens, custom elements (`<a-work>`, section classes) drive behaviour via attributes.
21st.dev facts: registry is React + Tailwind + shadcn, many items use Framer Motion; Magic MCP
`generate` returns React too. Nothing there ships as plain HTML/CSS.

## Option A - React island (fast to try, highest risk)
`npx astro add react tailwind`, render one component with `client:visible` inside the Work section.
Breakage risks, each with the guard:
1. Tailwind preflight resets global styles (h1 margins, buttons, media display) - disable
   `preflight` in the Tailwind config and scope utilities with a `prefix` or `important: '#work'`.
2. Framer Motion or React `useScroll` reads native scroll, not Lenis - use `lenis.on('scroll')`
   bridge or strip motion and animate the island's DOM with the existing GSAP timeline.
3. Two animation loops (Framer rAF + gsap.ticker) on a 4-core budget - keep Framer out; motion in
   GSAP only.
4. Hydration timing: island mounts after `siteLoaded`, so SWork measurements (points, letters,
   masks) run before the island exists - call `SWork.onResize()` after hydration or render the
   island outside the measured `.s__scene`.
5. Bundle: React + ReactDOM ~45 KB gz plus component deps, loaded only when the island is
   visible; acceptable for one component, not for the whole section.
Verdict: only for a self-contained widget (e.g. a marquee ticker or a filter bar), never for the
scroll-driven grid itself.

## Option B - port markup + CSS to `.astro` (recommended)
Fetch the component source with `get_component` (metered), keep the markup structure and the
design tokens, rewrite: Tailwind classes -> SCSS using the site's tokens; Framer variants ->
GSAP tweens attached to the existing SWork timeline; React state -> attributes on a custom
element (same pattern as `<a-work progress="...">`). No new runtime, Lenis and ScrollTrigger keep
ownership of scroll, Safari behaviour stays predictable.
Guards: one component per commit, before/after screenshots at 1440 and 390, FPS run through the
Work section, `astro check` and build green, no new `will-change`, no `backdrop-filter`
(Safari), videos keep `muted playsinline preload="none"`.

## Option C - use 21st.dev only as reference (zero risk)
Take colour tokens (e.g. "Vintage Paper", "Zen Linen" themes), spacing rhythm and interaction
ideas; write the Work section natively. This is what the F11 prototypes do.

## Rollout that cannot break production
- Prototype in `works-only-project/` (same SWork, no Lenis) on `proto/work-*` branches.
- Promote a chosen variant to `audit/perf-bugs` behind a build-time flag
  (`PUBLIC_WORK_VARIANT=a|b|c` read in SWork.astro) so the old layout stays one env var away.
- Gate: audit/measure.mjs numbers not worse than baseline, Safari gate by the owner on the phone.
