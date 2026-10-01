# MBC Hub

Every internal tool drawn as a transit map of the company's own cycle.

The map has two axes. A **row** is a step of the cycle
(`develop → source → produce → distribute → sell → listen`, then back to the
top). A **lane** is what a tool moves: Material, Money, Information or Process
(`people` in the code). A lane is decided by what comes out of the tool, not
by whether it has an approval step inside - purchasing and production end in
goods, so they are Material. A tool sits where its row meets its lane, so its position states both
what it does and where in the cycle it does it.

Two bands sit under the ring, for tools that are not a step of the cycle.
**Company Systems** is run for the whole company rather than for one step —
Timesheet, Finance. **Shared Tools**, at the very bottom, is a tool another tool
calls to do one job — Invoice AI reads an invoice for whoever asks, and no line
reaches it, because a call like that is a question, not work moving on. Each
band says what its tools are, not how much they matter; the map does not rank
its tools.

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
  stage: 'produce',             // a stage id, or a band id: 'shared' | 'company'
  flow: 'information',
  status: 'live',               // 'live' | 'planned'
  origin: 'external',           // omit it for a tool we write ourselves
  keywords: ['qc', 'batch'],    // extra search terms
}
```

A `planned` tool renders as a hollow station with dashed lines and no open
button — which is how Production, Supply Chain and Finance are already on the
map. A tool marked `origin: 'external'` carries a second badge: MISA CRM,
MISA Warehouse and Cosmetri are other companies' products the work runs
through, and the badge answers "can we change this ourselves?" — not how much
the tool matters, and not whether it belongs to the cycle, because it does.

To connect it to another tool, add one entry to `EDGES` in
[`src/data/flows.js`](src/data/flows.js). The `note` is shown in the detail
panel, so write it as a sentence explaining what actually travels the link.

Then run `npm run check`. Routes are searched afresh every time, so adding a
tool can reshape lines far from it; the check says whether the result is still
honest.

## Master data: the third axis

A row says where in the cycle a tool sits; a lane says what it moves. Neither
answers the question every integration turns on: when two tools both show the
same raw material, which one is allowed to change it?

[`src/data/masters.js`](src/data/masters.js) answers it. Each record has exactly
one `owner` — the tool it is created, changed and withdrawn in — and any number
of `copies`, fed from the owner and never the other way round. A copy that can
be edited is not a copy, it is a second owner, and two owners is how one
material ends up with two names.

The **Master data** button in the top bar turns the map into that view: the
tools that own or copy a record stay lit, every other tool dims, each label
swaps its tagline for what it owns, and the only line left drawn is a record
reaching its copy — today, Raw Material Procurement App feeding Cosmetri.

Labels are measured for the taller of their two bottom lines in **both** modes,
so toggling the view never moves a station. A record nobody owns yet is left
out rather than guessed at: this list is what somebody will trust when they
wire two tools together.

## Where things live

| Path | What it holds |
| --- | --- |
| `src/data/` | The registry, the stages, the flows and links, and the master records. All content lives here. |
| `src/map/layout.js` | Rows, lanes, station coordinates on the routing grid, and the estimated size of every label. The only place positions are decided. |
| `src/map/routes.js` | The octilinear route search, and the line that closes the cycle. |
| `scripts/check-map.mjs` | Fails if a line passes through a station it does not serve, two lines share a stretch, a forward line climbs, or a line ends too short for its arrowhead. |
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
- **Every label carries its own backdrop, and routes keep out from under it.**
  On a transit map the name always wins over the route. Label sizes are
  predicted from the copy in `labelBox` in `layout.js`, because routes are built
  before the labels are laid out and the map check runs in Node; if the label
  type changes, change the glyph widths there too.
- **Links are octilinear.** Every segment is vertical, horizontal or exactly 45
  degrees. That constraint is what makes the map readable — the eye follows a
  line it can predict — so keep it if you touch `routes.js`.
- **Routes are searched, not drawn.** Every station sits on a 12px grid and
  each link is a shortest path over it (A*), with prices on bends, crossings,
  running under a label and crowding another line. Links are laid one at a
  time, each one becoming terrain for the next, in several orders. Then any
  route that went well out of its way has the routes blocking it lifted and
  laid again after it, kept only if the group comes out cheaper. The cheapest
  whole map wins. That is why station spacing in `layout.js` is written in grid
  steps — a station off the grid cannot be routed to.
- **A line must never pass through a station it does not serve.** On a transit
  map that reads as calling there, so the map would be asserting a relationship
  the data does not contain. Nor may two lines print on top of each other,
  except in the last stretch into a station they both arrive at (or out of one
  they both leave). Both are hard rules in the search rather than prices, and
  `npm run check` fails if anything slips through.
- **Some links run backwards, and there are two kinds.** A short climb — up
  inside one step, as Cosmetri feeding MBc360, or back into the step just
  before, as an order in MISA CRM raising the goods issue that draws stock down
  in MISA Warehouse — is searched and drawn like any other line; only its arrow
  points up the page. A link reaching further back
  would have to cut up through the whole map, so it sweeps out to the right
  margin instead and is drawn thinner: customer reviews re-entering product
  development, the link that makes the cycle a cycle. The swept line leaves from
  below and arrives from above, higher than any other route may run, so it never
  passes under a label or lines up with another line.
- **An empty step is information.** A step whose only tool is still planned keeps
  its "no tool yet" note. That is deliberate, not a gap to paper over.
- **The accessible list is not a duplicate.** `src/ui/appIndex.js` renders every
  tool as real links, visually hidden, built from the same registry.
- **Only two things animate**, and both say something: the map draws itself in
  cycle order on load, and a selected tool sends a pulse down each link it
  touches. A link to a planned tool pulses dimmer and slower than a live one —
  what will flow once it is built, next to what flows today. It still pulses,
  because every link a planned tool has is one of these, and a tool you select
  that moves nothing at all reads as broken rather than as "not yet".
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
