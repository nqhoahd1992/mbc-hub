# MBC Hub

One entry point to every internal tool, drawn as the company's own value cycle.

The model has two axes. **Where** a tool sits in the manufacturing cycle
(`develop → source → produce → distribute → sell → listen`) gives it a position on
the ring. **What** it moves (`material`, `money`, `information`, `people`) gives it
a colour, a silhouette and the particle streams that flow through it. Tools that
serve every stage — Finance, Timesheet — hang off the vertical backbone instead
of sitting inside one step of the cycle.

Because those two axes cover any tool the company might build, a new one has a
place waiting for it.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # -> dist/, drop it on any host
npm run preview  # serve the build locally
```

`vite.config.js` sets `base: './'`, so `dist/` works from a subpath as well as
from the root of a domain.

## Adding a tool

Add one object to [`src/data/apps.js`](src/data/apps.js). Nothing else needs to
change — the node, its position, its shape, its label, the search index, the
accessible list and the tool count all come from that entry.

```js
{
  id: 'quality-lab',            // stable key, also used by the edge list
  name: 'Quality Lab',
  tagline: 'Batch testing and release',
  summary: 'One or two sentences, shown in the detail panel.',
  url: 'https://qa.mbcstaging.com',   // null for a tool that does not exist yet
  stage: 'produce',             // a stage id, or 'backbone' for a cross-cutting tool
  flow: 'information',
  status: 'live',               // 'live' | 'planned'
  keywords: ['qc', 'batch'],    // extra search terms
}
```

A `planned` tool renders as a dim wireframe with dashed links and no open
button — which is how Finance and Supply Chain are already on the map.

To connect it to another tool, add one entry to `EDGES` in
[`src/data/flows.js`](src/data/flows.js). The `note` is shown in the detail
panel, so write it as a sentence explaining what actually travels the link.

## Where things live

| Path | What it holds |
| --- | --- |
| `src/data/` | The registry, the stages, the flows and edges. All content lives here. |
| `src/scene/layout.js` | Turns the data into world coordinates. The only place positions are decided. |
| `src/scene/` | Core, ring, nodes, backbone, particle streams, picking, bloom, camera. |
| `src/ui/` | HUD, detail panel, search, tooltip, and the accessible list that doubles as the no-WebGL view. |
| `src/utils/color.js` | The palette, published once as `THREE.Color` values and as CSS custom properties. |

## Things worth knowing before changing it

- **The accessible list is not a duplicate.** `src/ui/appIndex.js` renders every
  tool as real links, visually hidden behind the scene. It is the screen reader
  path and the fallback when WebGL is missing, built from the same registry.
- **Motion means real traffic.** A link only carries particles when both ends are
  live; a planned tool gets a dashed, still line. Do not animate ghost links.
- **An empty stage is information.** Produce currently has no tool and says so on
  the ring. That is deliberate, not a gap to paper over.
- **The scene degrades on its own.** No WebGL2 → the list view. Reduced motion →
  a static scene. A slow device → fewer particles, and bloom switches itself off
  if frame times stay bad.

## Keyboard

`/` search · `↑`/`↓` move through results · `Enter` focus · `Ctrl`/`Cmd`+`Enter`
open · `←`/`→` step between tools · `Esc` clear selection and filters · `Tab`
walks the labels as ordinary buttons.
