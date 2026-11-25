# layout-circular

The renderer-neutral circular placement math shared by
mermaid-layout-circular and pele-layout-circular. Read `README.md`
and `docs/DECISIONS.md` first.

## Rules for `src/`

`src/` is the folder a host project may copy into its own tree, so:

- No runtime dependencies, and no imports from outside `src/`. Lint
  enforces this for everything except tests.
- No DOM. The type check runs with `lib: ["ES2022"]` and no DOM types.
- Synchronous and deterministic: the same input gives the same output.
- Nothing renderer-specific is hardcoded. A value one renderer needs
  becomes an option, with a comment on its default saying why.

## Where work belongs

Changes to the math, its options and its tests go here. Drawing, and
anything about mermaid's or Pele's APIs, goes in the renderer
packages. Record each decision in the repo where the change is made,
when it is made.

## Docs

`docs/DOCS-STYLE.md` holds the documentation rules for this repo and
its three siblings: language, pictures, and the shared "Which package
to use" table. It is the one copy of those rules. Read it before
changing a README or anything under `docs/`. Options are explained in
`docs/OPTIONS.md` and the placement rules in `docs/HOW-IT-WORKS.md`.
Keep both in step with `src/`.

## Gates

`npm test`, `npm run lint` and `npm run build`, all green before
committing.
