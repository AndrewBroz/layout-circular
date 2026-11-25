# layout-circular

A circular graph layout. Nodes sit at equal angles on one circle, and
an edge between neighbors is an arc of that same circle. Chords bow
toward the center. A clear hub moves to the center, side branches hang
off radially, and a cycle hanging off the ring becomes its own smaller
circle.

The package computes positions and edge paths. It draws nothing, and it
works with any renderer. It has no runtime dependencies and doesn't use
the DOM. The same input always gives the same output.

It is the shared core of two renderer packages:

- [mermaid-layout-circular](https://github.com/AndrewBroz/mermaid-layout-circular),
  for the mermaid codebase.
- [pele-layout-circular](https://github.com/AndrewBroz/pele-layout-circular),
  for [Pele](https://pele.run).

## Usage

```ts
import { circularLayout } from 'layout-circular';

const { nodes, edges } = circularLayout(
  [
    { id: 'A', width: 90, height: 40 },
    { id: 'B', width: 90, height: 40 },
    { id: 'C', width: 90, height: 40 },
  ],
  [
    { id: 'A-B', start: 'A', end: 'B' },
    { id: 'B-C', start: 'B', end: 'C' },
    { id: 'C-A', start: 'C', end: 'A' },
  ]
);
```

Each placed node has a center `x`, `y` and its `angle` on the circle.
Each edge has `points`, a sampled path that starts and ends exactly on
the node outlines. Draw the paths as given. Trimming them to node
boundaries again moves the arrowheads off the curve.

The options and their defaults are `CircularLayoutOptions` and
`defaults` in `src/layout.ts`. The visual trials behind each default
are recorded in mermaid-layout-circular's `docs/DECISIONS.md`, where
the math was developed.

## Straight edges

The `edges` option picks the shape of edges between ring nodes. The
default, `'arc'`, draws a neighbor edge as an arc of the ring and bows
chords toward the center. `'straight'` draws both as straight segments
from border to border:

```ts
circularLayout(nodes, edges, { edges: 'straight' });
```

A three-cycle then reads as a triangle, and every ring, satellites
included, as a polygon. Two opposite edges between one pair become two
parallel lines a few pixels apart. Placement is the same either way.
So are hub spokes, spurs and self-loops. A label sits at its segment's
midpoint, and slides outward when it crowds the boxes beside it. The
labels of parallel lines step off sideways, each beside its own line
and clear of its siblings' labels.

The `parallelGap` option sets the distance between parallel lines, in
pixels. Its default, 10, is sized for mermaid's 8px point marker. A
renderer with smaller arrowheads can pass less.

Known limits:

- A straight chord across a ring with a hub runs through the hub.
  Arcs swerve around the center; straight lines don't.
- In a fan of three or more, the middle line's label stays on its
  line, so the label's background covers the lines beside it.

## Bundling, not depending

Renderer packages compile this package into their own bundle at build
time. They don't list it as a runtime dependency. A host project can go
further and copy `src/` into its own tree, with the license notice, the
way mermaid took in a layered layout engine from Pele. `src/` imports
only from itself, and lint enforces that.

## Development

Three gates, all green before committing:

```sh
npm test        # vitest, the placement math
npm run lint    # eslint, then tsc with no DOM types
npm run build   # vite library build plus type declarations
```

## License

MIT
