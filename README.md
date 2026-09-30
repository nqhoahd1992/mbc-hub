# MBC Hub

Every internal tool drawn as a transit map of the company's own cycle.

The map has two axes. A **row** is a step of the cycle
(`develop → source → produce → distribute → sell → listen`, then back to the
top). A **lane** is what a tool moves: `material`, `money`, `information` or
`people`. A tool sits where its row meets its lane, so its position states both
what it does and where in the cycle it does it.

Tools that serve every step rather than sitting inside one — Invoice AI,
Timesheet, Finance — live in the **Backbone** band at the bottom.

Because a new tool only makes its row taller, the map gets longer rather than
denser: at 30 tools every name is still readable and nothing overlaps.

Below 880px the four lanes cannot sit side by side at a readable size, so the
map straightens into a **strip view** - the diagram transit systems print inside
a carriage. Same cycle order, one column, connections moved into the detail
panel. It is a different layout, not a scaled-down map, because scaling one down
only produces small text and scrolling in two directions.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # -> dist/, drop it on any host
npm run preview  # serve the build locally
npm run check    # assert no line passes through a station it does not serve
npm run standalone  # one self-contained HTML file that opens straight from disk
```

No framework. Plain ES modules, SVG and CSS, plus GSAP for the two animations.
The production bundle is about 106 kB (40 kB gzipped). `vite.config.js` sets `base: './'`, so `dist/`
works from a subpath as well as from the root of a domain.

## Adding a tool

Add one object to [`src/data/apps.js`](src/data/apps.js). Nothing else needs to
change — the station, its position, its label, the search index, the accessible
list and the tool count all come from that entry.

```js
{
  id: 'quality-lab',            // stable key, also used by the link list
  name: 'Quality Lab',
  tagline: 'Batch testing and release',
  summary: 'One or two sentences, shown in the detail panel.',
  url: 'https://qa.mbcstaging.com',   // null for a tool that does not exist yet
  stage: 'produce',             // a stage id, or 'backbone' for a shared service
  flow: 'information',
  status: 'live',               // 'live' | 'planned'
  keywords: ['qc', 'batch'],    // extra search terms
}
```

A `planned` tool renders as a hollow station with dashed lines and no open
button — which is how Production, Supply Chain and Finance are already on the
map.

To connect it to another tool, add one entry to `EDGES` in
[`src/data/flows.js`](src/data/flows.js). The `note` is shown in the detail
panel, so write it as a sentence explaining what actually travels the link.

Then run `npm run check`. Adding a tool moves stations, and a route that used to
be clear can end up running straight through one.

## Where things live

| Path | What it holds |
| --- | --- |
| `src/data/` | The registry, the stages, the flows and links. All content lives here. |
| `src/map/layout.js` | Rows, lanes and station coordinates. The only place positions are decided. |
| `src/map/routes.js` | Octilinear routing, the detour around unrelated stations, and the line that closes the cycle. |
| `scripts/check-map.mjs` | Fails if any line passes through a station it does not serve. |
| `scripts/build-standalone.mjs` | Inlines the build into one HTML file for opening without a server. |
| `src/map/render.js` | Builds the SVG geometry and the HTML text that sits over it. |
| `src/map/strip.js` | The narrow-screen strip view, mounted in place of the map below 880px. |
| `src/map/animate.js` | The two animations: the map drawing itself, and the pulse on a selected tool. |
| `src/map/interactions.js` | Highlighting, filtering, scroll-into-view, and the fit control. |
| `src/ui/` | Top bar, detail panel, search, tooltip, and the accessible list. |
| `src/state.js` | The one shared store. The UI writes to it, the map reads from it. |
| `src/utils/color.js` | The palette, published once as hex values and as CSS custom properties. |

## Things worth knowing before changing it

- **Geometry is SVG, text is HTML.** SVG cannot wrap text and these names are
  long, so every label is an HTML element positioned over the drawing. One
  transform on the container scales both together.
- **Every label carries its own backdrop.** Lines run underneath them, and on a
  transit map the name always wins over the route.
- **Links are octilinear.** Every segment is vertical, horizontal or exactly 45
  degrees. That constraint is what makes the map readable — the eye follows a
  line it can predict — so keep it if you touch `routes.js`.
- **A line must never pass through a station it does not serve.** On a transit
  map that reads as calling there, so the map would be asserting a relationship
  the data does not contain. When the direct route would do that, `routes.js`
  detours through a *gutter* — the empty corridor between two lanes — and
  `npm run check` fails if anything slips through.
- **One link runs backwards.** Customer reviews re-entering product development
  is what makes the cycle a cycle, so it sweeps out to the right margin instead
  of cutting through the map, and is drawn thinner.
- **An empty step is information.** A step whose only tool is still planned keeps
  its "no tool yet" note. That is deliberate, not a gap to paper over.
- **The accessible list is not a duplicate.** `src/ui/appIndex.js` renders every
  tool as real links, visually hidden, built from the same registry.
- **Only two things animate**, and both say something: the map draws itself in
  cycle order on load, and a selected tool sends a pulse down each link it
  touches. Planned links never pulse, because nothing flows through them yet.
- **The draw animation borrows `stroke-dasharray`** and must hand it back when
  it finishes, or the inline value it needs leaves planned links looking solid —
  and solid is what "already built" means on this map.
- **All of it is skipped under `prefers-reduced-motion`.** The map is complete
  and readable without a single tween.
- **`dist/index.html` will not open by double-clicking it.** A browser treats
  every `file://` URL as its own opaque origin and refuses to fetch the module
  and stylesheet beside it, so you get CORS errors and a blank page. That is the
  rule working, not a broken build — serve it over HTTP, or run
  `npm run standalone` for a single self-contained file that does open from disk.
- **The top bar's height is measured, not declared.** It wraps to a different
  number of rows depending on width, so `--bar-height` is written by a
  ResizeObserver. Hardcoding it hides the first row behind the bar.
- **Both views are mounted and torn down** as the breakpoint changes, so every
  subscription either one creates has to be released in its `destroy()`.

## Keyboard

`/` search · `↑`/`↓` move through results · `Enter` focus · `Ctrl`/`Cmd`+`Enter`
open · `Esc` clear selection and filters · `Tab` walks the stations as ordinary
buttons.
