# Decisions

Append-only, dated. When a decision changes the shape of the code,
update the README beside it.

This repo's history starts with the math's history in
mermaid-layout-circular: the commits that touched `src/layout.ts` and
`src/layout.test.ts`, filtered out of that repo. Decisions made there
before the move are recorded in its `docs/DECISIONS.md`.

- **2026-11-25 — Founded: the placement math, on its own.** Decided
  in pele-layout-circular (decision point B): the circular placement
  math moves into its own renderer-neutral package, the one source of
  truth for both the mermaid and the Pele layouts. Named
  `layout-circular`, the family name with the renderer removed. Its
  own repo, so decisions about the math are recorded beside it.
- **2026-11-25 — Built to be copied.** Both possible upstreams take in
  outside layout code as source, not as a runtime dependency. Pele's
  rules forbid runtime dependencies. Mermaid copied a Pele-derived
  layered engine into core as a self-contained folder, with the MIT
  notice and the original style. So `src/` is that folder: no runtime
  dependencies, no imports from outside it (lint enforces both), no
  DOM (the type check runs without DOM types), and the same input
  always gives the same output. Renderer packages compile it into
  their bundles.
- **2026-11-25 — The arrowhead tail is an option.** The straight run
  each path keeps before its ends was a constant of 10px, chosen to
  outreach mermaid's marker handling. It is now the `tail` option,
  default 10, so a renderer that handles markers differently can set
  its own. A path keeps both tails only when its gap is longer than
  two of them. Prose that described mermaid as the only renderer now
  speaks of renderers in general. With default options, the output
  is identical to mermaid-layout-circular 0.9.3.
- **2026-11-25 — Labels are placed here.** Each routed edge now
  carries `label`, the center of its label, when the input gave the
  edge a `labelWidth`. The placement moved from mermaid-layout-circular's
  render seam, unchanged: the path's middle sample, and for a rim
  label that crowds the boxes beside it, a radial slide outward until
  it clears. It is pure geometry and the Pele layout needs the same
  thing, so it belongs with the math. Group boxes stay in each
  renderer, because their padding and title room depend on how the
  renderer draws a group.
- **2026-11-25 — Straight edges are an option.** The `edges` option,
  `'arc'` or `'straight'`, default `'arc'`. Arcs emphasize the cycle.
  Straight lines make a three-cycle a triangle. The owner chose how a
  diagram selects the variant: mermaid's existing `flowchart.curve:
  linear`, mapped by each renderer to `edges: 'straight'`. Not a new
  layout name, because names would multiply (circular × ccw ×
  straight). `layout` chooses the placement engine, while `curve`
  already means edge shape. Both renderers already read
  `flowchart.curve` from frontmatter. And it combines with
  `circular-ccw` for free. Only `linear` selects straight edges; every
  other curve keeps the arcs. The core stays renderer-neutral: it
  knows `edges`, not `curve`.
  With `'straight'`, rim neighbors and chords run center to center,
  cut at the true outlines by the same bisection, with a point `tail`
  in from each end. Chords lose their bow and swerve. Siblings split
  into parallel lines 6px apart (`STRAIGHT_STEP`). At two rim nodes
  an opposite pair splits the same way, since a line has no diameter
  tie to mirror it. Placement, spokes, spurs and self-loops are
  untouched, and satellites follow the option, so they become
  polygons too. The path's middle sample is the segment's midpoint, so
  the existing label placement seats a label there unchanged. With
  the default, the output is byte-identical to 0.1.1 on every call the
  existing tests make.
- **2026-11-25 — The parallel gap is an option.** Review found the
  6px `STRAIGHT_STEP` too tight. Each line of an opposite pair sat
  3px off center, so mermaid's 8px point marker overran the sibling
  line, and Pele's 8px head cleared it by about 1px. A gap needs the
  head's half-width, half the stroke and about 2px of daylight. That
  depends on the renderer's arrowheads, not on node size, so it
  became the `parallelGap` option, the way `tail` is. The default, 10,
  suits mermaid. Pele passes 8. An explicit `edges: undefined` means
  arcs everywhere, including the two-node pair key. Exact snapshots of
  four arc layouts now guard the default output in the tests.
- **2026-11-25 — Labels of parallel straight lines step aside.** Both
  labels of a straight opposite pair sat at their lines' middles,
  only `parallelGap` apart, and overprinted. "next" and "prev" read
  as "n prev" in Pele. Now each label of a parallel group leaves its
  line perpendicular to it, away from the group's center line. The
  distance is the label's width and height projected onto that
  perpendicular, plus 4px of clearance. Labels further out stack on
  the ones nearer the center, so no two overlap and none crosses a
  sibling line. The middle label of an odd fan stays on its line. A
  rim label that still crowds a box slides on in the direction it
  stepped, not radially, so it never crosses back over its sibling.
  The middle label keeps the radial slide. Only truly straight paths
  group, so bowed spur siblings keep the old placement. A lone edge's
  label is unchanged, and the arcs are byte-identical.
- **2026-11-25 — An inner label stops at the center.** Review found
  that an inner label of a rim pair could slide inward past the
  center, onto the far side of a small ring. Now the inward slide
  stops at the center. If no seat on the way clears the boxes, the
  label takes the first modestly clear seat, or else its stepped seat
  beside its own line. An overlap there stays local and legible. A
  label on the far side of the ring is not. On a four-ring with a hub
  and big labels, the inner label may still touch the hub. The three
  copies of the slide loop became one `slideClear` helper. The arc
  labels keep their own scale arithmetic, so they stay byte-identical.
- **2026-11-25 — Chords are always straight.** The owner decided that
  a chord, an edge between ring nodes that aren't neighbors, is a
  straight line whatever `edges` says. The rim edges carry the cycle,
  and a chord is a shortcut across it. So `edges` now picks the shape
  of rim edges only. A chord takes the straight path in both modes,
  through the same `straightBetween` as before: border to border on
  the center line, cut at the true outlines, with straight tails.
  Opposite chord pairs and fans become parallel lines `parallelGap`
  apart, and their labels step aside as straight mode's already did.
  The `bow` and `swerve` options are removed, not kept as opt-in, at
  the owner's choice. This supersedes the trial verdicts on chord bow
  (inward 0.35) and swerve (0.2), recorded in mermaid-layout-circular's
  `docs/DECISIONS.md`. Swerve kept a diameter's label off a hub. Now a
  chord label that crowds a box slides across its own line, toward the
  side the sorted pair names, so two crossing diameters' labels part
  along their own normals. The line itself still runs through the
  hub, in both modes. Arc output changes for chords only. Rim arcs,
  spurs, spokes, petals and satellite rims are byte-identical, which a
  comparison of every call the tests make against the previous main
  confirmed. In straight mode only a chord label that crowded a box
  moves. Removing two options is a breaking change, so the next
  release is 0.2.0.
