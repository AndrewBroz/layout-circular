# Docs style

The one copy of the documentation rules for the circular layout family:
layout-circular, mermaid-layout-circular, pele-layout-circular and
obsidian-mermaid-circular. Each repo's CLAUDE.md points here. The rules
apply to every README, doc, caption, alt text and `package.json`
description in the four repos.

They were set on 2026-11-25, when the four READMEs were rewritten.

## Language

These come from the owner. They apply to every line written in the
docs, including alt text, captions, table cells and `package.json`
descriptions.

1. Plain language. Everyday words.
2. Short sentences, one idea each. A person or the program is the
   subject. Use the passive only where the actor doesn't matter.
3. State what something does, precisely. Describe scope by what it
   covers.
4. Assume nothing. Where mermaid, Pele or Obsidian first appear in a
   README, say what each is in a few words. Show frontmatter, and say
   what it is, the first time. Give a plain gloss for any term the
   first time it appears: layout, chord, hub, branch, satellite, band,
   subgraph, dagre.
5. No LLM structures:
   - no "Whether you're X or Y";
   - no rule-of-three flourishes ("fast, simple and beautiful");
   - no "it's not just X, it's Y";
   - no rhetorical questions as headings ("Why circular?");
   - no stacked bold labels ("**Fast.** … **Small.** …");
   - no em-dash rhythm (prefer a full stop; at most one em dash per
     section, and none in headings or `package.json`);
   - no filler: "seamlessly", "powerful", "effortless", "robust",
     "simply", "just", "easily", "beautiful", "out of the box",
     "under the hood".
6. A magic value gets a reason ("8px apart, the width of mermaid's
   arrowhead"), or it moves to a deeper doc.

Headings are plain noun phrases or imperatives: "Install", "Straight
edges", "Groups", "Which package to use".

### Checklist

Run this on every changed file before committing. Each item is yes/no.

- [ ] Each sentence holds one idea. No sentence is over about 25 words.
- [ ] mermaid, Pele and Obsidian are each explained in a few words at
      their first mention in this file.
- [ ] Frontmatter is shown, and named, before it's used.
- [ ] Every term in rule 4 is glossed at its first use in this file.
- [ ] No heading is a question. No heading uses an em dash.
- [ ] No list of bold labels followed by sentences.
- [ ] No "whether you're", "not just", or three-adjective flourish.
- [ ] `grep -niE "seamless|powerful|effortless|robust|simply|just |easily|beautiful|out of the box|under the hood"`
      finds nothing.
- [ ] `grep -c "—"` is no more than the number of `##` sections.
- [ ] Every number has a reason next to it, or lives in a deeper doc.
- [ ] Every code sample runs as written against the current release
      (no removed options such as `bow` or `swerve`).
- [ ] No code fence uses the `mermaid` info string (see [Other rules](#other-rules)).
- [ ] Every image has `width` and `alt`, and the alt follows [Image format, size and alt text](#image-format-size-and-alt-text).
- [ ] Links resolve: run `npx markdown-link-check` on the file, or click
      each one on the GitHub preview.

## How the family is introduced

Every README has a section titled **Which package to use**, placed right
after the opening picture and example (mermaid, Pele, plugin) or right
after the opening paragraph (layout-circular). The table is the same in
all four. Only the row for the current package changes: it reads "this
package" and is not a link.

Sample, as it appears in the mermaid README:

```markdown
## Which package to use

The same circular layout comes in four packages. Pick the one that
matches how you draw diagrams.

| You draw diagrams with | Use |
| --- | --- |
| mermaid, in a web page or app | this package |
| Pele, in a web page or app | [pele-layout-circular](https://github.com/AndrewBroz/pele-layout-circular) |
| Obsidian, in your notes | [obsidian-mermaid-circular](https://github.com/AndrewBroz/obsidian-mermaid-circular), a plugin |
| your own code | [layout-circular](https://github.com/AndrewBroz/layout-circular), the shared placement math |

The first three use layout-circular to decide where each node goes.
They place nodes the same way. They differ in how boxes and text are drawn.
```

Use full GitHub URLs, never relative links between repos. Link to the
GitHub repo, not npm, so the plugin row works too.

Each README also mentions its relatives once in its opening, in one
sentence, for readers who never reach the table. In the mermaid and Pele
READMEs, that sentence is: "In Obsidian, use the
[obsidian-mermaid-circular](…) plugin instead." Don't phrase it as a
question ("Using Obsidian?").

## Shared terms

Use these words, with these glosses, in every README. Define each at
first use, in the sentence or right after it. In user READMEs, say
"branch", never "spur". "Spur" stays in code and in DECISIONS.

| Term | Plain gloss |
| --- | --- |
| layout | where each box goes, and the path each arrow takes |
| ring | the circle the nodes sit on |
| arc | an arrow drawn along the circle, between two nodes next to each other |
| chord | an arrow between two nodes that are not next to each other; a straight line across the circle |
| hub | one node linked to most of the others; it goes in the middle |
| branch | a node that sits outside the ring, beyond the one ring node it links to |
| satellite | a second, smaller cycle hanging off the ring; it gets its own circle |
| figure-eight | two cycles that share one node |
| group | a mermaid subgraph: a set of nodes drawn inside one shape |
| box / band | the two shapes a group can take: a rectangle, or a curved strip that follows the ring |

The "anatomy" picture in the layout-circular README shows ring, arc, chord, branch and
satellite in one diagram. layout-circular uses it to teach the terms.

## Image URLs: relative in npm packages, absolute in the plugin

**Evidence.** npm resolves relative image paths in a README for a
package whose `repository` points at GitHub. It rewrites them to
`https://raw.githubusercontent.com/<owner>/<repo>/HEAD/<path>`.

- On 2026-11-25, the npm page for mermaid-layout-circular 0.10.0
  showed all 14 of its images.
  Each `src` is, for example,
  `https://raw.githubusercontent.com/AndrewBroz/mermaid-layout-circular/HEAD/docs/media/krebs-cycle.png`.
  Every image loaded (checked in a browser: `naturalWidth > 0`).
- The same holds for raw HTML `<img>` tags with a `width` attribute.
  `ora`'s README has `<img src="screenshot.svg" width="500">`. npm
  serves it as `…/sindresorhus/ora/HEAD/screenshot.svg` and keeps
  `width="500"`. The SVG renders.
- `raw.githubusercontent.com` serves `.svg` as `image/svg+xml` and
  `.png` as `image/png`, both with `nosniff`, so `<img>` displays them.
- The registry's `readme` field for mermaid-layout-circular is the
  README as published in 0.10.0. The npm page changes only when a new
  version is published.

**Decision.** In the three npm packages, write image paths relative to
the repo root: `<img src="docs/media/water-cycle.svg" width="480" alt="…">`.
GitHub and npm both resolve them.

**The consequence to respect.** npm shows images from `HEAD` of
`main`, not from the published version. So:

- Never rename or delete an image that the latest published README
  references. Add a new file instead, and delete the old one only after
  the next publish.
- When a picture's content changes (the layout draws it differently),
  re-render it under the same name. That is intended: npm then shows
  the current drawing.

**The plugin uses absolute URLs**:
`https://raw.githubusercontent.com/AndrewBroz/obsidian-mermaid-circular/main/docs/media/<file>`.
Reason: the plugin's README is also shown inside Obsidian's community
plugin browser once it is listed. Whether that browser resolves
relative paths is not documented, and absolute URLs work everywhere.

## Image format, size and alt text

**Format.**

- Pele renders: SVG, as Pele writes it, plus the card (see [The white card](#the-white-card)). Pele
  renders in Node with no DOM, so these are exact and scriptable.
- mermaid renders: PNG at device scale factor 2. mermaid needs a
  browser. Its flowchart SVG uses HTML labels inside `foreignObject`
  and depends on page CSS and installed fonts, so a saved mermaid SVG
  does not display reliably as an `<img>`.
- Obsidian: PNG, a Retina screenshot (2x).

**Natural width.** For an SVG, its `width` attribute after the card is
added. For a PNG, its pixel width divided by 2. The render scripts print
it for every file.

**Display width.** Set `width` on every `<img>`. Never set `height`.

**One scale per README.** Within one README, every picture's display
width is its natural width times one shared factor, rounded to a whole
pixel. Node text is 16 px at natural size, so the shared factor makes
it read at the same size in every picture. Pick the factor once for the
whole README. A separate doc, such as `docs/GALLERY.md`, picks its own.

- Inside a table, the factor is at least 0.65, so node text stays at
  about 10 px or more.
- No table row is over about 600 px wide, pictures and cell padding
  together. npm shrinks a wider table to fit its column, and that
  breaks the shared scale.

A diagram that can't meet both moves to the gallery. It doesn't get
squeezed. The widths in the examples on this page are only examples:
compute real ones from the factor.

**Alt text.**

- One sentence, under 150 characters.
- Say what the picture shows: the shape, the main nodes, where they sit.
- Don't start with "Image of", "Diagram of" or "Screenshot of".
- Name the feature being shown, in plain words.

Examples:

- "Five boxes on a circle, Evaporation at the top, joined clockwise by
  curved arrows."
- "The same five boxes in a row, with one long arrow looping back from
  Collection to Evaporation."
- "Eight boxes on a circle. Build and Test sit inside a gray box
  titled Make."

**Captions.** In a pair, the table header row is the caption ("Curved
arrows (the default)" | "`curve: linear`"). In a grid, a short plain
phrase under each image ("A hub in the middle"). No caption repeats
the alt text word for word.

## The white card

Every picture is a white card:

- background `#ffffff`;
- 16 px padding around the diagram;
- 1 px border `#d0d7de` (GitHub's own light border color);
- 8 px corner radius, with transparent corners.

Why: GitHub's dark theme puts a dark page behind images. A transparent
diagram drawn in dark ink disappears there. A white card stays readable
in both themes. The thin border keeps the card's edge visible on
GitHub's white light theme and on npm. GitHub's `#gh-dark-mode-only`
and `<picture>` tricks don't work on npm, so one light picture is the
only choice that works everywhere.

How:

- **Pele SVG.** Grow the `viewBox` and the `width`/`height` by 16 on
  each side, then insert as the first child of `<svg>`:
  `<rect x="{minX-16+0.5}" y="{minY-16+0.5}" width="{W-1}" height="{H-1}" rx="8" fill="#ffffff" stroke="#d0d7de"/>`.
  Also add `--pele-font:Helvetica,Arial,"Liberation Sans",sans-serif;`
  to the root `style`. Pele measures text with sans-serif metrics.
  Those three fonts share Arial's metrics and cover macOS, Windows and
  Linux, so labels fit their boxes on every system. This recipe was
  tried on several diagrams, and they rendered correctly.
- **mermaid PNG.** Render the diagram inside `<div id="shot">` with
  `display:inline-block; padding:16px; background:#fff;
  border:1px solid #d0d7de; border-radius:8px`, on a transparent page.
  Screenshot the element with `omitBackground: true`, so the corners
  outside the radius stay transparent.
- **Obsidian PNG.** Use the default theme in light mode. Crop to the
  note's content and add the same border, with square corners.

Colors inside the diagrams stay at each renderer's defaults: Pele's
light theme, and mermaid's `neutral` theme (the demo already uses it).
Both are gray boxes and dark ink, so the family looks alike.

## Pairs and grids

**Pairs** show a choice side by side. Two pairs exist: curved versus
straight arrows, and box versus band. Use a Markdown table. The header
row holds the captions:

```markdown
| Curved arrows (the default) | `curve: linear` |
| --- | --- |
| <img src="docs/media/daily-arcs.svg" width="360" alt="…"> | <img src="docs/media/daily-straight.svg" width="360" alt="…"> |
```

Both sides of a pair use the same diagram text, except for the one
setting being compared. The box/band pair is the exception: the
difference is how much of the ring the group covers, so the group
changes and the ring stays the same.

**Grids** show the showcase. Use an HTML table, two cells per row, the
caption under each image:

```html
<table>
<tr>
<td align="center"><img src="docs/media/hub.svg" width="380" alt="…"><br>A hub in the middle</td>
<td align="center"><img src="docs/media/wheel.svg" width="380" alt="…"><br>A wheel: a ring and a hub</td>
</tr>
</table>
```

Leave a blank line before and after the table, and don't indent it, or
GitHub renders it as code.

## Other rules

- **Never fence diagram source as ` ```mermaid `.** GitHub renders
  mermaid fences with its own mermaid, which doesn't have this layout.
  The reader would see a dagre drawing next to a claim that it's
  circular. Use a plain ` ``` ` fence. (The plugin README shows a
  ` ```mermaid ` block inside a four-backtick fence, as literal text. That
  is fine and stays.)
- **Source for every picture.** A README picture either has its source
  next to it, or its source is in `docs/GALLERY.md` under the same
  heading, and the README says so once.
- **GitHub "About" box.** Set the description to match `package.json`,
  add topics, and set a homepage.

## Making the pictures

- Pele pictures come from pele-layout-circular's
  `scripts/render-docs.ts`, which reads the demo case list. Its `--out`
  and `--only` flags write a repo's own copies, so each package's npm
  page depends only on its own repo.
- mermaid pictures come from mermaid-layout-circular's
  `scripts/render-docs.mjs`, in headless Chrome.
- Each script prints every file's natural width. Check the legibility
  floor with those widths.

## Checking

Before committing:

- Look at the README on GitHub, or in a GitHub-style render, in the
  light and the dark theme.
- Check that SVG labels fit their boxes in Safari, Chrome and Firefox.
- Check that every image has `width` and `alt`.
- Run the language checklist.

After publishing, open the npm page and check that every image loads.
