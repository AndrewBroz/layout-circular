# Options

`circularLayout(nodes, edges, options, groups)` takes its options as the
third argument. Every option is optional. This page is the one place
they are explained. The defaults live in `defaults` in `src/layout.ts`,
and the types in `CircularLayoutOptions`.

```ts
import { circularLayout } from 'layout-circular';

circularLayout(nodes, edges, { spacing: 60, direction: 'counterclockwise' });
```

A ring neighbor is the node next to another on the circle. A chord is an
edge between two ring nodes that are not neighbors. A hub is a node
linked to most of the others, placed in the middle.

| Option | Default | What it does |
| --- | --- | --- |
| `spacing` | `40` | The smallest gap, in pixels, between two neighboring nodes along the circle. The radius grows until every gap is at least this wide. |
| `startAngle` | `-Math.PI / 2` | Where the first node sits, as an angle in radians. The default is the top of the circle. |
| `ordering` | `'follow-edges'` | How the nodes are ordered around the circle. `'follow-edges'` walks the edges, so nodes joined by an edge sit side by side. `'input'` keeps the order you gave. |
| `samples` | `24` | How many points each edge path is sampled at. More points give a smoother curve. |
| `tail` | `10` | The length, in pixels, of the straight piece at each end of a path. A renderer points the arrowhead along that piece. 10 pixels reaches past the 5 pixels near the end that mermaid moves while fitting its arrowhead. Keep `spacing` above twice `tail`, or short paths lose their tails. |
| `direction` | `'clockwise'` | Which way the cycle runs from the top node. `'counterclockwise'` mirrors the whole layout left to right. |
| `hub` | `'auto'` | Which node goes in the middle. `'auto'` picks one only when the shape is clear: the center of a star, or the axle of a wheel. `'none'` keeps every node on the circle. A node id names the hub yourself. |
| `edges` | `'arc'` | The shape of edges between ring neighbors. `'arc'` draws them along the circle. `'straight'` draws straight lines, so the ring reads as a polygon. Chords are straight either way. Node positions are the same either way. |
| `parallelGap` | `10` | The distance, in pixels, between two straight edges that join the same two nodes. Each arrowhead must clear the other line. 10 pixels clears mermaid's 8 pixel arrowhead. A renderer with smaller arrowheads can pass less. |

How the hub is chosen is in [HOW-IT-WORKS.md](HOW-IT-WORKS.md#hubs).

## In mermaid-layout-circular

[mermaid-layout-circular](https://github.com/AndrewBroz/mermaid-layout-circular)
renders this layout in mermaid, a tool that turns diagram text into
pictures. It sets options in this order, each one over the last:

1. `tail: 10`, for mermaid's arrowheads.
2. `spacing` from mermaid's own `flowchart.nodeSpacing` setting, when
   it is set.
3. Anything you pass to `setCircularLayoutOptions`.
4. The diagram's own frontmatter, the settings block at the top of the
   diagram text. `layout: circular-ccw` sets `direction:
   'counterclockwise'`. `flowchart.curve: linear` sets `edges:
   'straight'`.

## In pele-layout-circular

[pele-layout-circular](https://github.com/AndrewBroz/pele-layout-circular)
renders this layout in Pele, another tool that turns diagram text into
pictures. It sets options in this order, each one over the last:

1. `spacing` from Pele's `flowchart.nodeSpacing` setting, when it is
   set.
2. `parallelGap: 8`. Pele's arrowhead is smaller than mermaid's, and 8
   pixels clears it by about 4.
3. Anything you pass as the second argument of `withCircularLayout`.
4. The diagram's own config: `layout: circular-ccw` and
   `flowchart.curve: linear`, as in mermaid.

## Removed

`bow` and `swerve` were removed in 0.2.0. They curved chords inward and
moved them to one side. Chords became straight lines in that release,
so the two options had nothing left to shape. TypeScript rejects
them, and at run time the layout ignores them.
