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
