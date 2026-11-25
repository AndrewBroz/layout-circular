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
- **2026-11-25 — Group shapes are placed here, the book designer's
  way.** This supersedes the last sentence of "Labels are placed
  here": group boxes no longer stay in each renderer. Each renderer
  drew a box as the padded union of where its members landed, and
  nothing kept it off other nodes or boxes. In Pele the water cycle's
  two boxes met, and a ring neighbor sat on a title. Padding is now an
  input, so the reason for keeping boxes in the renderers is gone.
  `circularLayout` takes a fourth argument, the groups: padding per
  side, the title's measured size, and the parent. It returns a shape
  per group and `groupsClear`.
  The owner chose the strategy, D2, from a prototype gallery of eight
  cases rendered through real Pele. The rejected ones moved nodes:
  - C widened the rim gap nearest each clash. It cleared every case,
    but lost mirror symmetry in all eight (up to 396px off) and even
    gaps in all eight (up to 898px widened). Nested groups squeezed
    into one quadrant.
  - A grew the radius up to 1.5 times, then widened like C. It grew
    1.14 to 2.43 times and still widened six cases.
  - B widened each gap with its mirror. It kept symmetry, but grew up
    to 7.55 times and left clashes in two cases.
  D2 moves the frame, not the pieces. It cleared all eight with even
  gaps, mirror symmetry and growth of 1.09 times at most. The ring
  keeps one radius and its equalized gaps. Boxes hug their members
  with the renderer's padding. The ring may turn: any node, or the
  half-step between two, takes the top, and each turn grows the radius
  uniformly until clear. Turns rank rotation first. Among the turns
  that clear within 1.15 times the unfitted radius, the least turned
  wins, then the least grown. Otherwise the least grown turn that
  clears within 1.5 times wins, then the least turned; otherwise the
  shallowest clash. The prototype's flat 0.12 per turn made a
  half-turn cost no more than one seat, so in real Pele the water
  cycle turned half-way round to save 7% growth; review asked for
  the least turn instead. The owner accepted that the first node can
  leave the top when a turn is needed. A group
  whose first and last seats span half the ring's steps or more is a
  band, an annular sector, and so is everything nested in it. Case 4
  of the gallery, four of eight nodes, spans three steps and stays a
  box, as the owner saw it. A group holding every seat stays a box,
  since nothing on the ring lies outside it. A box that clears at no
  turn becomes a band, with everything above and below it, up to
  three times, and the retry stands only if it clashes less. A band
  follows the ring, so a seatless member, the
  hub, neither sets its angles nor is wrapped by it. A band's title
  sits outside it on the ray through its middle, and a nested band's
  title sits in the strip between it and its parent, from the
  renderer's measured title size. A box's title goes on top, unless
  an edge cutting across the ring (a spoke, chord or spur) crosses the
  top's title strip while no edge would cross the bottom's: then the
  title room moves to the bottom, if nothing new clashes. The owner
  chose this for the wheel, where the spokes ran through "Delivery".
  Rim arcs don't count, since a title over a rim member always meets
  the ring's own arrow into it, as in the water cycle. Each box title
  then takes the spot along its strip nearest the middle that no edge
  crosses; `titleSide` and `title` report both. Edge labels slide off
  group titles as they do off nodes. Shapes keep 8px of clearance,
  measured on walls sampled every 4px. When no turn clears,
  `groupsClear` is false rather than silent. A fitting spends at most
  400 solves, so a 32-node ring that cannot clear takes about 0.4s
  instead of over a second. Past the budget, the turns already tried
  are ranked as they stand and no retry starts. Without the fourth argument nothing is
  fitted, so a caller that sets `group` alone keeps its layout.
  Negative padding counts as 0. The fitting's state rides beside the
  options, not on them. Every call the tests make without the fourth
  argument returns output byte-identical to main at c7df17f, 162 of
  162, grouped nodes included. Known limits: a band sweeping nearly
  the whole ring is clamped short of a full turn, and its corners can
  then meet what it would have wrapped (the clash test flags it); a
  nested band's title is checked against nodes and sibling shapes,
  not against other titles.
- **2026-11-25 — The docs are rewritten for readers.** The README
  leads with what the package does and one picture, the "anatomy"
  diagram, which names ring, arc, chord, branch and satellite. Install
  and the shared "Which package to use" table follow, the same table in
  all four family READMEs. The box/band and arc/straight pairs show
  what `kind` and `edges` mean. Options moved to `docs/OPTIONS.md`,
  with each default and its reason. The placement rules, with their
  numbers, and the known limits moved to `docs/HOW-IT-WORKS.md`, in
  plain words for users. The family's documentation rules live in
  `docs/DOCS-STYLE.md`, and the other repos point here. The pictures
  are Pele SVGs on a white card, so they read on GitHub's dark theme
  and on npm.
- **2026-11-25 — A box holds the arcs between its members.** A box
  was fitted to its member nodes alone. The arc between two members
  follows the ring, so it can curve out past both of them. In
  mermaid's "Make" picture, Build and Test sit side by side at the
  bottom of a small ring, and the arc from Build to Test dipped below
  the box and came back. The owner judged that a defect: a group's
  shape must hold what the group draws. Now a box also holds every
  point of every path between two of its members, then takes its
  padding as before. That covers the ring arcs, a satellite's arcs,
  and a member's loop back to itself. Paths into the group from
  outside still cross its wall, as they must. Bands already held their
  arcs, since a band follows the ring. Clearance, turning and growth
  work as before, on the larger box. Ungrouped layouts don't run this
  code. A test checks every box in the prototype gallery, and two
  rings of mermaid-sized nodes, for the arcs plus padding. The Pele
  pictures in `docs/media` were drawn before this change; they show it
  after Pele picks up a release with it.
