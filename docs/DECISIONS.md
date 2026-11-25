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
