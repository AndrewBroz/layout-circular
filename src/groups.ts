/**
 * Group shapes, placed the way a book designer would place them.
 *
 * A designer keeps the regular polygon and moves the frame, not the
 * pieces. So the ring keeps its equal gaps, its one radius and its
 * mirror symmetry, and no gap is ever widened for a group. Four
 * cheap moves make room instead:
 *
 * 1. Tight shapes. A box hugs its members, and the arcs between them,
 *    with the renderer's own padding: side room, and title room on top.
 * 2. Title room below. A box whose top would meet an outside node may
 *    carry its title room at the bottom instead.
 * 3. Turn the ring. Any node may take the top, or the half-step
 *    between two nodes may, which is still mirror-symmetric. A group
 *    then sits balanced about an axis, where an axis-aligned box fits
 *    snugly: a two-node group becomes one flat side of the polygon.
 * 4. Grow the radius uniformly, only as far as clearance needs.
 *
 * Every group starts as a box. Among the turns that clear, the ones
 * whose shapes are tight win, then the least turned. A group becomes a
 * band that follows the ring only when no box around it clears at any
 * turn. The shape is chosen by fit alone, never by how much of the ring
 * a group covers.
 */
import type { CircularLayoutResult, LayoutNodeInput, Point } from './layout.js';

/** Room between a group's wall and what it wraps, per side, px. The
 *  top usually carries the title as well. */
export interface GroupPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface LayoutGroupInput {
  id: string;
  /** The group this one sits inside. Its shape wraps this one's. */
  parent?: string;
  /** How the renderer pads the group's wall. Default 0 on every side.
   *  A negative side counts as 0. */
  padding?: GroupPadding;
  /** The measured size of the group's title, px. A band's title sits
   *  outside the band, so the band needs it to seat the title. Without
   *  it, a band keeps the top padding's excess over the bottom as the
   *  title's height. */
  title?: { width: number; height: number };
}

/** A group drawn as an axis-aligned box. */
export interface GroupBox {
  kind: 'box';
  id: string;
  /** Center of the box. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Which edge holds the title room. The top, unless an edge cutting
   *  across the ring (a spoke, chord or spur, not a rim arc) crosses the
   *  top's title strip, the line the title runs along between the side
   *  paddings, while no edge would cross the bottom's. Then the bottom,
   *  and the top padding trades places with the bottom's. */
  titleSide: 'top' | 'bottom';
  /** Center of the title: the middle of the title room's height, at
   *  the spot along it nearest the middle that no edge crosses, or the
   *  middle when every spot is crossed. */
  title: Point;
}

/** A group drawn as a band along the ring. Its wall is `outline`. The
 *  radii and angles give the slice of the annulus the outline lies in,
 *  swept clockwise from `startAngle` to `endAngle`. Angles are in the
 *  nodes' frame, as `PlacedNode.angle` is. */
export interface GroupBand {
  kind: 'band';
  id: string;
  /** Center of the ring the band follows. */
  center: Point;
  /** The outline's least distance from `center`. */
  innerRadius: number;
  /** The outline's greatest distance from `center`. */
  outerRadius: number;
  startAngle: number;
  /** Greater than `startAngle`, by less than a full turn. */
  endAngle: number;
  /** Center of the title, which reads horizontally: just outside the
   *  band's outer edge, on the ray through its middle. */
  title: Point;
  /** The band's wall, a closed polygon: the outer wall from
   *  `startAngle` to `endAngle`, then the inner wall back. Each wall
   *  keeps the padding from every member and from the paths between
   *  members, and bends gently between them. The ends round onto the
   *  end members. `outlinePath` turns it into an SVG path. */
  outline: Point[];
}

export type GroupShape = GroupBox | GroupBand;

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * How the top ring is turned and grown to fit the group shapes. It is
 * the fitting's own state, passed beside the options rather than on
 * them, and satellites receive it with no turn and no growth.
 */
export interface RingFit {
  /** Each grouped node's groups, outermost first. */
  chains: Map<string, string[]>;
  /** Seats turned: the walk's seat `turn` takes the top. */
  turn: number;
  /** Put the gap before that seat on top instead of the seat. */
  halfStep: boolean;
  /** Pixels added to every rim gap alike. */
  grow: number;
  /** Filled by the solve with each spur node's parent. */
  spurParents: Map<string, string>;
}

/** The groups as one tree: who sits inside whom, and how each pads. */
export interface GroupTree {
  /** Every group, the input's first, then any named only by members. */
  ids: string[];
  parent: Map<string, string | undefined>;
  padding: Map<string, GroupPadding>;
  title: Map<string, { width: number; height: number }>;
  /** Each grouped node's groups, outermost first. */
  chains: Map<string, string[]>;
}

const TAU = 2 * Math.PI;

/** The least daylight between a group's wall and anything outside
 *  it, px: enough that the wall and its neighbor read as two shapes. */
const CLEARANCE = 8;

/** The most the radius may grow for groups, against the unfitted
 *  ring. The prototype gallery needed at most 1.09. */
const GROW_CAP = 1.5;

/** Daylight between a band's outer edge and its title, px: about half
 *  a line, so the title reads as the band's caption. */
const TITLE_GAP = 6;

/** The growth a turn may spend and still count as clearing cheaply:
 *  15%. The prototype gallery needed at most 9% at the turn it kept,
 *  and 15% is about where a grown ring starts to read as roomier than
 *  its neighbors' spacing. Within it, the least turn wins. */
const CHEAP_GROWTH = 1.15;

/** Among the turns that clear, how much more area than the tightest
 *  turn's shapes still counts as tight: 30%. In the prototype gallery
 *  a 30% margin kept the snug turns and dropped the boxes that sprawl
 *  diagonally over empty space. */
const AREA_SLACK = 1.3;

/** When only grown turns clear, how far past the least grown radius
 *  still counts as least grown: 5%, so a turn that is tighter or turns
 *  less is not lost to a few pixels of growth. */
const GROWTH_SLACK = 1.05;

/** How sharply a band's wall may bend between its members: the radius
 *  of the curve it hangs on, px. At 1500 the walls read as arcs near
 *  the ring's own; the prototype's 100 kept the padding exactly but
 *  pinched between nodes like a blob. */
const BEND = 1500;

/** Angular steps a band's wall is traced in, around the whole circle:
 *  half a degree each, fine enough that the outline reads as a curve. */
const BAND_STEPS = 720;

/** How many times a box that will not clear is redrawn as a band,
 *  with everything above and below it, before giving up. */
const BAND_TRIES = 3;

/** Solves one fitting may spend across every turn, growth round and
 *  band retry. A ring that clears takes a handful; one that cannot
 *  clear would otherwise try every turn at every growth, about 800
 *  solves for 32 nodes and a second or more. Past the budget the best
 *  turn found so far stands, and the flag says whether it clears. */
const SOLVE_BUDGET = 400;

/** Growth rounds per turn, a guard: the cap ends the loop first. */
const GROW_ROUNDS = 50;

/** Spacing of the points a wall is sampled at when measuring clashes,
 *  px. Corners are always sampled, so boxes measure exactly. */
const SAMPLE = 4;

const NO_PADDING: GroupPadding = { top: 0, right: 0, bottom: 0, left: 0 };

const nonNegative = (v: number | undefined): number =>
  v !== undefined && v > 0 && Number.isFinite(v) ? v : 0;

/** The group tree, or undefined when no node belongs to a group. A
 *  parent the input does not describe, or one that would close a
 *  loop, is dropped: that group sits at the top level. */
export const groupTreeOf = (
  nodes: LayoutNodeInput[],
  groups: LayoutGroupInput[]
): GroupTree | undefined => {
  if (!nodes.some((n) => n.group !== undefined)) {
    return undefined;
  }
  const described = new Map(groups.map((g) => [g.id, g]));
  const ids = [...new Set([...groups.map((g) => g.id), ...nodes.flatMap((n) => n.group ?? [])])];
  const parent = new Map<string, string | undefined>();
  for (const id of ids) {
    const p = described.get(id)?.parent;
    parent.set(id, p !== undefined && described.has(p) ? p : undefined);
  }
  for (const id of ids) {
    const seen = new Set([id]);
    for (let at = parent.get(id); at !== undefined; at = parent.get(at)) {
      if (seen.has(at)) {
        parent.set(id, undefined);
        break;
      }
      seen.add(at);
    }
  }
  const lineage = (id: string): string[] => {
    const up = parent.get(id);
    return up === undefined ? [id] : [...lineage(up), id];
  };
  const chains = new Map<string, string[]>();
  for (const n of nodes) {
    if (n.group !== undefined) {
      chains.set(n.id, lineage(n.group));
    }
  }
  const padding = new Map<string, GroupPadding>();
  const title = new Map<string, { width: number; height: number }>();
  for (const id of ids) {
    const g = described.get(id);
    const p = g?.padding ?? NO_PADDING;
    const pad = {
      top: nonNegative(p.top),
      right: nonNegative(p.right),
      bottom: nonNegative(p.bottom),
      left: nonNegative(p.left),
    };
    padding.set(id, pad);
    title.set(
      id,
      g?.title
        ? { width: nonNegative(g.title.width), height: nonNegative(g.title.height) }
        : { width: 0, height: Math.max(0, pad.top - pad.bottom) }
    );
  }
  return { ids, parent, padding, title, chains };
};

/** The angle a in (−π, π]. */
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

/** The axis-aligned bounds of a group's shape. */
export const groupBounds = (g: GroupShape): Bounds =>
  g.kind === 'box'
    ? {
        minX: g.x - g.width / 2,
        minY: g.y - g.height / 2,
        maxX: g.x + g.width / 2,
        maxY: g.y + g.height / 2,
      }
    : boundsOf(g.outline);

/** An SVG path through a band's outline, closed, moved by (dx, dy).
 *  Coordinates are rounded to 0.01px. */
export const outlinePath = (outline: Point[], dx = 0, dy = 0): string => {
  const f = (v: number) => (Math.round(v * 100) / 100 || 0).toString();
  return outline.map((p, i) => `${i === 0 ? 'M' : 'L'}${f(p.x + dx)},${f(p.y + dy)}`).join('') + 'Z';
};

/** The area a shape covers, px². Turns are ranked by it. */
const areaOf = (g: GroupShape): number => {
  if (g.kind === 'box') {
    return g.width * g.height;
  }
  let twice = 0;
  g.outline.forEach((p, i) => {
    const q = g.outline[(i + 1) % g.outline.length]!;
    twice += p.x * q.y - q.x * p.y;
  });
  return Math.abs(twice) / 2;
};

const boundsOf = (points: Point[]): Bounds => ({
  minX: Math.min(...points.map((p) => p.x)),
  minY: Math.min(...points.map((p) => p.y)),
  maxX: Math.max(...points.map((p) => p.x)),
  maxY: Math.max(...points.map((p) => p.y)),
});

/** A shape as the clash test sees it: its bounds, points along its
 *  wall, and a signed distance, negative inside. */
interface Region {
  bounds: Bounds;
  /** Computed on first use, then kept: a region meets many others. */
  wall: () => Point[];
  distance: (p: Point) => number;
}

/** The region with its wall worked out once, on first use. */
const cached = (r: Region): Region => {
  let wall: Point[] | undefined;
  return { ...r, wall: () => (wall ??= r.wall()) };
};

/** Points every SAMPLE px or closer from a to b, a included. */
const along = (a: Point, b: Point, out: Point[]): void => {
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / SAMPLE));
  for (let i = 0; i < steps; i++) {
    out.push({ x: a.x + ((b.x - a.x) * i) / steps, y: a.y + ((b.y - a.y) * i) / steps });
  }
};

const rectRegion = (b: Bounds): Region => cached({
  bounds: b,
  wall: () => {
    const out: Point[] = [];
    const corners = [
      { x: b.minX, y: b.minY },
      { x: b.maxX, y: b.minY },
      { x: b.maxX, y: b.maxY },
      { x: b.minX, y: b.maxY },
    ];
    corners.forEach((c, i) => along(c, corners[(i + 1) % 4]!, out));
    return out;
  },
  distance: (p) => {
    const dx = Math.max(b.minX - p.x, p.x - b.maxX);
    const dy = Math.max(b.minY - p.y, p.y - b.maxY);
    return dx > 0 || dy > 0 ? Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) : Math.max(dx, dy);
  },
});

const toSegment = (p: Point, a: Point, b: Point): number => {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len2 = vx * vx + vy * vy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2));
  return Math.hypot(p.x - a.x - t * vx, p.y - a.y - t * vy);
};

/** A band as a region: its outline, a closed polygon. */
const bandRegion = (g: GroupBand): Region => {
  const pts = g.outline;
  return cached({
    bounds: boundsOf(pts),
    wall: () => {
      const out: Point[] = [];
      pts.forEach((p, i) => along(p, pts[(i + 1) % pts.length]!, out));
      return out;
    },
    distance: (p) => {
      // Squared distance to the nearest wall segment, rooted once.
      let d2 = Infinity;
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const a = pts[i]!;
        const b = pts[j]!;
        const vx = b.x - a.x;
        const vy = b.y - a.y;
        const len2 = vx * vx + vy * vy;
        const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2));
        d2 = Math.min(d2, (p.x - a.x - t * vx) ** 2 + (p.y - a.y - t * vy) ** 2);
        // Even-odd: a ray to the right crosses the wall an odd number
        // of times from inside.
        if (a.y > p.y !== b.y > p.y && p.x < (vx * (p.y - a.y)) / vy + a.x) {
          inside = !inside;
        }
      }
      return inside ? -Math.sqrt(d2) : Math.sqrt(d2);
    },
  });
};

/** How far two regions come inside `gap` of each other, px: 0 when
 *  they keep the gap, more the deeper they meet. */
const clash = (a: Region, b: Region, gap: number): number => {
  if (
    a.bounds.minX - gap >= b.bounds.maxX ||
    b.bounds.minX - gap >= a.bounds.maxX ||
    a.bounds.minY - gap >= b.bounds.maxY ||
    b.bounds.minY - gap >= a.bounds.maxY
  ) {
    return 0;
  }
  let depth = 0;
  for (const p of a.wall()) {
    depth = Math.max(depth, gap - b.distance(p));
  }
  for (const p of b.wall()) {
    depth = Math.max(depth, gap - a.distance(p));
  }
  return depth;
};

interface Fitted {
  result: CircularLayoutResult;
  shapes: Map<string, GroupShape>;
  /** Total depth of every clash, px. 0 when everything is clear. */
  residual: number;
  /** The deepest single clash, px. */
  worst: number;
  /** The box groups in a clash. */
  clashing: Set<string>;
  /** Pixels added to every gap. */
  grow: number;
  /** Boxes whose title room is at the bottom, to clear an outside node. */
  bottom: Set<string>;
}

/**
 * Lay the graph out with every group's shape clear of the nodes
 * outside it and of its sibling shapes, keeping the ring's circle. See
 * the file's header for the three moves. `solve` lays the ring out
 * under a fit; without groups this never runs.
 */
export const fitGroups = (
  nodes: LayoutNodeInput[],
  tree: GroupTree,
  solve: (fit: RingFit) => CircularLayoutResult
): CircularLayoutResult => {
  const inGroup = (id: string, g: string) => tree.chains.get(id)?.includes(g) ?? false;
  const subtree = new Map(tree.ids.map((g) => [g, nodes.filter((n) => inGroup(n.id, g))]));
  const children = new Map(tree.ids.map((g) => [g, tree.ids.filter((c) => tree.parent.get(c) === g)]));
  const depthOf = (g: string): number => {
    const up = tree.parent.get(g);
    return up === undefined ? 0 : depthOf(up) + 1;
  };
  const deepFirst = [...tree.ids].sort((a, b) => depthOf(b) - depthOf(a));
  const fit = (turn: number, halfStep: boolean, grow: number): RingFit => ({
    chains: tree.chains,
    turn,
    halfStep,
    grow,
    spurParents: new Map(),
  });

  // The unturned, ungrown ring: its seats and radius are what every
  // turn and growth is measured against.
  const probeFit = fit(0, false, 0);
  const probe = solve(probeFit);
  const n = probe.order.length;
  const seatOf = seatsOf(probe, probeFit.spurParents);
  // Every group starts as a box.
  let bands = new Set<string>();

  const seatless = new Set(nodes.filter((m) => seatOf(m.id) === undefined).map((m) => m.id));
  const shapesOf = (result: CircularLayoutResult, bandSet: Set<string>, bottom?: Set<string>) =>
    placeShapes(nodes, tree, subtree, children, deepFirst, result, bandSet, seatless, bottom);

  const clashesOf = (result: CircularLayoutResult, shapes: Map<string, GroupShape>, bandSet: Set<string>) => {
    const size = new Map(nodes.map((q) => [q.id, q]));
    const nodeRegion = new Map(
      result.nodes.map((p) => {
        const q = size.get(p.id)!;
        return [
          p.id,
          rectRegion({
            minX: p.x - q.width / 2,
            minY: p.y - q.height / 2,
            maxX: p.x + q.width / 2,
            maxY: p.y + q.height / 2,
          }),
        ];
      })
    );
    const regions = new Map(
      [...shapes].map(([g, s]) => [g, s.kind === 'box' ? rectRegion(groupBounds(s)) : bandRegion(s)])
    );
    let residual = 0;
    let worst = 0;
    const clashing = new Set<string>();
    const add = (depth: number, ...gs: string[]) => {
      if (depth > 0) {
        residual += depth;
        worst = Math.max(worst, depth);
        for (const g of gs) {
          if (!bandSet.has(g)) {
            clashing.add(g);
          }
        }
      }
    };
    for (const [g, region] of regions) {
      const shape = shapes.get(g)!;
      // A band's title sits outside the band, so it must clear too.
      const title =
        shape.kind === 'band' ? rectRegion(titleBounds(shape, tree.title.get(g)!)) : undefined;
      for (const p of result.nodes) {
        if (!inGroup(p.id, g)) {
          add(clash(region, nodeRegion.get(p.id)!, CLEARANCE), g);
          if (title) {
            add(clash(title, nodeRegion.get(p.id)!, CLEARANCE), g);
          }
        }
      }
      for (const [h, other] of regions) {
        if (h !== g && tree.parent.get(h) === tree.parent.get(g)) {
          if (h > g) {
            add(clash(region, other, CLEARANCE), g, h);
          }
          if (title) {
            add(clash(title, other, CLEARANCE), g, h);
          }
        }
      }
    }
    return { residual, worst, clashing };
  };

  /**
   * The shapes for one solve, each clashing box with its title room
   * moved to the bottom where that clashes less. Boxes are tried one
   * at a time, in input order, so a box whose top is clear keeps its
   * title on top.
   */
  const titlesLowered = (result: CircularLayoutResult, bandSet: Set<string>) => {
    let bottom = new Set<string>();
    let shapes = shapesOf(result, bandSet);
    let clashes = clashesOf(result, shapes, bandSet);
    for (const g of tree.ids) {
      if (clashes.residual === 0) {
        break;
      }
      if (!clashes.clashing.has(g)) {
        continue;
      }
      const tried = new Set([...bottom, g]);
      const low = shapesOf(result, bandSet, tried);
      const lowClashes = clashesOf(result, low, bandSet);
      if (lowClashes.residual < clashes.residual) {
        bottom = tried;
        shapes = low;
        clashes = lowClashes;
      }
    }
    return { shapes, bottom, ...clashes };
  };

  const base = probe.radius;
  let solves = 0;

  /** One turn, grown uniformly until clear or until `limit` times the
   *  unfitted radius, from `grow` pixels a gap. */
  const grown = (
    turn: number,
    halfStep: boolean,
    bandSet: Set<string>,
    limit: number,
    from = 0
  ): Fitted => {
    const cap = limit * base;
    let grow = from;
    let capped = false;
    for (let round = 0; ; round++) {
      solves++;
      const result = solve(fit(turn, halfStep, grow));
      const done = { result, grow, ...titlesLowered(result, bandSet) };
      if (done.residual === 0 || capped || round >= GROW_ROUNDS || solves >= SOLVE_BUDGET) {
        return done;
      }
      if (result.radius > cap) {
        // One step too far: back off to the cap exactly, and stop
        // there. 2πR = n·gap + Σclaims, so R moves n/2π per pixel.
        grow = Math.max(0, grow - ((result.radius - cap) * TAU) / Math.max(n, 1));
        capped = true;
        continue;
      }
      if (result.radius >= cap) {
        return done;
      }
      // Most of the deepest clash, at least 4px a gap: the next solve
      // usually clears it without overshooting by much.
      grow += Math.max(4, done.worst * 0.6);
    }
  };

  /** How far a turn moves the top, in seats. */
  const turned = (turn: number, halfStep: boolean): number => {
    const x = halfStep ? (turn - 0.5 + n) % n : turn;
    return Math.min(x, n - x);
  };
  const turns: { turn: number; halfStep: boolean }[] = [];
  for (const halfStep of [false, true]) {
    for (let turn = 0; turn < n; turn++) {
      turns.push({ turn, halfStep });
    }
  }
  // Least turned first, so a tie keeps the smaller turn.
  turns.sort((a, b) => turned(a.turn, a.halfStep) - turned(b.turn, b.halfStep));

  const areaIn = (f: Fitted) => [...f.shapes.values()].reduce((sum, g) => sum + areaOf(g), 0);

  /**
   * The best of the turns that clear. When `grown` is set, only turns
   * within GROWTH_SLACK of the least radius are kept first. Then the
   * turns whose shapes cover at most AREA_SLACK times the least area,
   * and of those the least turned, then the least grown.
   */
  const tightest = (clear: { fitted: Fitted; amount: number }[], grown: boolean): Fitted => {
    let pool = clear;
    if (grown) {
      const least = Math.min(...pool.map((c) => c.fitted.result.radius));
      pool = pool.filter((c) => c.fitted.result.radius <= least * GROWTH_SLACK);
    }
    const least = Math.min(...pool.map((c) => areaIn(c.fitted)));
    pool = pool.filter((c) => areaIn(c.fitted) <= least * AREA_SLACK);
    pool.sort((a, b) => a.amount - b.amount || a.fitted.result.radius - b.fitted.result.radius);
    return pool[0]!.fitted;
  };

  /**
   * The turn. Every turn is grown up to CHEAP_GROWTH, and the tightest
   * of those that clear wins. When none clears, every turn is grown on
   * up to GROW_CAP, and the tightest of those that clear wins, the
   * least grown first. When none clears at all, the shallowest clash
   * wins, so the flag goes up on the best there is. Past the solve
   * budget, the turns already tried are ranked as they stand.
   */
  const search = (bandSet: Set<string>): Fitted => {
    const cheap = new Map<string, Fitted>();
    const clear: { fitted: Fitted; amount: number }[] = [];
    for (const { turn, halfStep } of turns) {
      if (solves >= SOLVE_BUDGET && cheap.size > 0) {
        break;
      }
      const fitted = grown(turn, halfStep, bandSet, CHEAP_GROWTH);
      cheap.set(`${turn} ${halfStep}`, fitted);
      if (fitted.residual === 0) {
        clear.push({ fitted, amount: turned(turn, halfStep) });
      }
    }
    if (clear.length > 0) {
      return tightest(clear, false);
    }
    let shallowest: Fitted | undefined;
    for (const { turn, halfStep } of turns) {
      const first = cheap.get(`${turn} ${halfStep}`);
      if (!first) {
        continue;
      }
      const fitted = solves >= SOLVE_BUDGET ? first : grown(turn, halfStep, bandSet, GROW_CAP, first.grow);
      if (fitted.residual === 0) {
        clear.push({ fitted, amount: turned(turn, halfStep) });
      } else if (!shallowest || fitted.residual < shallowest.residual) {
        shallowest = fitted;
      }
    }
    return clear.length > 0 ? tightest(clear, true) : shallowest!;
  };

  /**
   * Each box's title, on top unless an edge cutting across the ring
   * crosses the top's title strip while no edge at all would cross the
   * bottom's. A box whose title moves down is
   * redrawn with its title room at the bottom, and kept there only if
   * nothing new clashes. Each title then takes the spot along its strip
   * nearest the middle that no edge crosses, tried every 2px.
   */
  const titlesPlaced = (fitted: Fitted, bandSet: Set<string>): Map<string, GroupShape> => {
    const lines = fitted.result.edges.map((e) => e.points);
    const spotOf = (box: GroupBox, g: string): number | undefined => {
      const pad = tree.padding.get(g)!;
      const { width, height } = tree.title.get(g)!;
      const b = groupBounds(box);
      // The title's own line, centered in its room.
      const top = (box.titleSide === 'top' ? b.minY : b.maxY - pad.top) + Math.max(0, pad.top - height) / 2;
      const strip = (x: number, half: number): Bounds => ({
        minX: x - half,
        minY: top,
        maxX: x + half,
        maxY: top + Math.min(height, pad.top),
      });
      // Spots every 2px along the room, nearest the middle first. A
      // title may reach halfway into the side padding, as Pele lets its
      // titles reach 6px into its own.
      const span = Math.max(0, (b.maxX - b.minX - (pad.left + pad.right) / 2 - width) / 2);
      const spots = [box.x];
      for (let d = 2; width > 0 && d <= span; d += 2) {
        spots.push(box.x - d, box.x + d);
      }
      // The title's own box: a line may pass right beside it.
      const half = width > 0 ? width / 2 : (b.maxX - b.minX - pad.left - pad.right) / 2;
      return spots.find((x) => !lines.some((line) => crosses(line, strip(x, half))));
    };
    // Whether an edge crosses the strip a title's line runs along,
    // between the side paddings: the whole strip, wherever the title
    // would sit in it. `cutting` counts only the edges that cut across
    // the ring, such as spokes, chords and spurs. The ring's own arcs
    // into and out of a box are the ring itself: a title over a rim
    // member always meets them, and a single arrow reaching its member
    // past the title reads as ordinary.
    const cutting = fitted.result.edges.filter((e) => !e.onRim).map((e) => e.points);
    const stripCrossed = (box: GroupBox, g: string, among: Point[][]): boolean => {
      const pad = tree.padding.get(g)!;
      const height = Math.min(tree.title.get(g)!.height, pad.top);
      const b = groupBounds(box);
      const top = (box.titleSide === 'top' ? b.minY : b.maxY - pad.top) + (pad.top - height) / 2;
      const strip = { minX: b.minX + pad.left, minY: top, maxX: b.maxX - pad.right, maxY: top + height };
      return among.some((line) => crosses(line, strip));
    };
    let bottom = fitted.bottom;
    let shapes = fitted.shapes;
    for (const g of tree.ids) {
      const shape = shapes.get(g);
      if (
        !shape ||
        shape.kind !== 'box' ||
        shape.titleSide === 'bottom' ||
        tree.padding.get(g)!.top <= 0 ||
        !stripCrossed(shape, g, cutting)
      ) {
        continue;
      }
      const tried = new Set([...bottom, g]);
      const moved = shapesOf(fitted.result, bandSet, tried);
      if (stripCrossed(moved.get(g) as GroupBox, g, lines)) {
        continue;
      }
      if (clashesOf(fitted.result, moved, bandSet).residual <= fitted.residual) {
        bottom = tried;
        shapes = moved;
      }
    }
    for (const [g, shape] of shapes) {
      if (shape.kind === 'box') {
        const x = spotOf(shape, g);
        if (x !== undefined) {
          shape.title = { x, y: shape.title.y };
        }
      }
    }
    return shapes;
  };

  let pick = search(bands);
  // A box that clears at no turn becomes a band, with everything above
  // and below it. A retry stands only if it clashes less, and none
  // starts once the budget is spent.
  let pickBands = bands;
  for (let tries = 0; pick.residual > 0 && tries < BAND_TRIES && solves < SOLVE_BUDGET; tries++) {
    const more = closed(new Set([...bands, ...pick.clashing]), tree, children);
    if (more.size === bands.size) {
      break;
    }
    bands = more;
    const retry = search(bands);
    if (retry.residual < pick.residual) {
      pick = retry;
      pickBands = bands;
    }
  }

  const { result } = pick;
  const shapes = titlesPlaced(pick, pickBands);
  result.groups = tree.ids.filter((g) => shapes.has(g)).map((g) => shapes.get(g)!);
  result.groupsClear = pick.residual === 0;
  return result;
};

/** The bands, with everything nested in a band and everything a band
 *  is nested in: a box cannot wrap a band, nor sit in one. */
const closed = (
  bands: Set<string>,
  tree: GroupTree,
  children: Map<string, string[]>
): Set<string> => {
  const out = new Set<string>();
  const down = (g: string) => {
    out.add(g);
    for (const c of children.get(g) ?? []) {
      down(c);
    }
  };
  for (const g of bands) {
    down(g);
    for (let up = tree.parent.get(g); up !== undefined; up = tree.parent.get(up)) {
      out.add(up);
    }
  }
  return out;
};

/** Each node's seat on the main ring: its own, its spur parent's, or
 *  its satellite's anchor's. The hub has none. */
const seatsOf = (
  result: CircularLayoutResult,
  spurParents: Map<string, string>
): ((id: string) => number | undefined) => {
  const seat = new Map(result.order.map((id, i) => [id, i]));
  const anchorOf = new Map<string, string>();
  for (const s of result.satellites ?? []) {
    for (const m of s.members) {
      if (m !== s.anchor) {
        anchorOf.set(m, s.anchor);
      }
    }
  }
  return (id) => {
    const seen = new Set<string>();
    for (let at: string | undefined = id; at !== undefined && !seen.has(at); ) {
      if (seat.has(at)) {
        return seat.get(at);
      }
      seen.add(at);
      at = spurParents.get(at) ?? anchorOf.get(at);
    }
    return undefined;
  };
};

/**
 * Where every titled shape's title lies, for keeping edge labels off
 * them. A box's title is centered on its title point; without a
 * measured width it spans the box between its side paddings.
 */
export const titleRects = (
  shapes: GroupShape[],
  tree: GroupTree
): { id: string; x: number; y: number; width: number; height: number }[] =>
  shapes.flatMap((g) => {
    const pad = tree.padding.get(g.id)!;
    const size = tree.title.get(g.id)!;
    const width =
      size.width > 0 || g.kind === 'band' ? size.width : Math.max(0, g.width - pad.left - pad.right);
    const height = Math.min(size.height, g.kind === 'box' ? pad.top : size.height);
    return width > 0 && height > 0 ? [{ id: `title:${g.id}`, x: g.title.x, y: g.title.y, width, height }] : [];
  });

/** Where a band's title lies: its box, centered on the title point. */
const titleBounds = (band: GroupBand, size: { width: number; height: number }): Bounds => ({
  minX: band.title.x - size.width / 2,
  minY: band.title.y - size.height / 2,
  maxX: band.title.x + size.width / 2,
  maxY: band.title.y + size.height / 2,
});

/** Whether a path runs through a rect: any of its segments, clipped
 *  to the rect by Liang-Barsky, keeps some length. */
const crosses = (line: Point[], r: Bounds): boolean => {
  for (let k = 0; k + 1 < line.length; k++) {
    const a = line[k]!;
    const b = line[k + 1]!;
    let lo = 0;
    let hi = 1;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    for (const [p, q] of [
      [-dx, a.x - r.minX],
      [dx, r.maxX - a.x],
      [-dy, a.y - r.minY],
      [dy, r.maxY - a.y],
    ] as const) {
      if (p === 0) {
        if (q < 0) {
          hi = -1;
        }
      } else if (p < 0) {
        lo = Math.max(lo, q / p);
      } else {
        hi = Math.min(hi, q / p);
      }
    }
    if (lo < hi) {
      return true;
    }
  }
  return false;
};

/**
 * Every group's shape, deepest first, so a parent wraps its children.
 * A box is its members, the paths between them and its child boxes,
 * padded. A band is drawn by `bandOf`.
 */
const placeShapes = (
  nodes: LayoutNodeInput[],
  tree: GroupTree,
  subtree: Map<string, LayoutNodeInput[]>,
  children: Map<string, string[]>,
  deepFirst: string[],
  result: CircularLayoutResult,
  bands: Set<string>,
  /** Nodes with no seat on the main ring: the hub. A band follows the
   *  ring, so it neither wraps them nor takes its angles from them. */
  seatless: Set<string>,
  /** Boxes whose title room is at the bottom. */
  bottom: Set<string> = new Set()
): Map<string, GroupShape> => {
  const at = new Map(result.nodes.map((p) => [p.id, p]));
  const rectOf = (n: LayoutNodeInput): Bounds => {
    const p = at.get(n.id)!;
    return {
      minX: p.x - n.width / 2,
      minY: p.y - n.height / 2,
      maxX: p.x + n.width / 2,
      maxY: p.y + n.height / 2,
    };
  };
  const shapes = new Map<string, GroupShape>();
  for (const g of deepFirst) {
    const own = nodes
      .filter((n) => n.group === g && !(bands.has(g) && seatless.has(n.id)))
      .map(rectOf);
    const kids = children.get(g)!.filter((c) => shapes.has(c)).map((c) => shapes.get(c)!);
    if (own.length === 0 && kids.length === 0) {
      continue;
    }
    const pad = tree.padding.get(g)!;
    if (!bands.has(g)) {
      // The box holds the paths between its members too: an arc
      // between two members sags past both, a loop reaches out.
      const inside = new Set(subtree.get(g)!.map((n) => n.id));
      const paths = result.edges
        .filter((e) => inside.has(e.start) && inside.has(e.end))
        .flatMap((e) => e.points);
      const inner = boundsOf([
        ...[...own, ...kids.map(groupBounds)].flatMap((b) => [
          { x: b.minX, y: b.minY },
          { x: b.maxX, y: b.maxY },
        ]),
        ...paths,
      ]);
      const low = bottom.has(g);
      const box = {
        minX: inner.minX - pad.left,
        minY: inner.minY - (low ? pad.bottom : pad.top),
        maxX: inner.maxX + pad.right,
        maxY: inner.maxY + (low ? pad.top : pad.bottom),
      };
      shapes.set(g, {
        kind: 'box',
        id: g,
        x: (box.minX + box.maxX) / 2,
        y: (box.minY + box.maxY) / 2,
        width: box.maxX - box.minX,
        height: box.maxY - box.minY,
        titleSide: low ? 'bottom' : 'top',
        title: { x: (box.minX + box.maxX) / 2, y: low ? box.maxY - pad.top / 2 : box.minY + pad.top / 2 },
      });
      continue;
    }

    const band = bandOf(g, tree, subtree, kids, own, result, seatless, at);
    if (band) {
      shapes.set(g, band);
    }
  }
  return shapes;
};

/** Where a ray from the center along the unit vector (ux, uy) meets a
 *  rect grown by a disc of radius p, as [near, far] distances, or
 *  undefined when it misses. The grown rect is the rect's two
 *  crosswise slabs plus a disc at each corner. */
const rayHitsPadded = (ux: number, uy: number, r: Bounds, p: number): [number, number] | undefined => {
  let lo = Infinity;
  let hi = -Infinity;
  const slab = (b: Bounds) => {
    let t0 = -Infinity;
    let t1 = Infinity;
    for (const [u, min, max] of [
      [ux, b.minX, b.maxX],
      [uy, b.minY, b.maxY],
    ] as const) {
      if (Math.abs(u) < 1e-12) {
        if (min > 0 || max < 0) {
          return;
        }
      } else {
        t0 = Math.max(t0, Math.min(min / u, max / u));
        t1 = Math.min(t1, Math.max(min / u, max / u));
      }
    }
    if (t1 >= Math.max(t0, 0)) {
      lo = Math.min(lo, Math.max(t0, 0));
      hi = Math.max(hi, t1);
    }
  };
  slab({ minX: r.minX - p, minY: r.minY, maxX: r.maxX + p, maxY: r.maxY });
  slab({ minX: r.minX, minY: r.minY - p, maxX: r.maxX, maxY: r.maxY + p });
  for (const c of [
    { x: r.minX, y: r.minY },
    { x: r.maxX, y: r.minY },
    { x: r.minX, y: r.maxY },
    { x: r.maxX, y: r.maxY },
  ]) {
    const hit = rayHitsDisc(ux, uy, c, p);
    if (hit) {
      lo = Math.min(lo, hit[0]);
      hi = Math.max(hi, hit[1]);
    }
  }
  return hi >= lo ? [lo, hi] : undefined;
};

/** Where a ray from the center along (ux, uy) meets the disc of radius
 *  p around c, as [near, far], or undefined when it misses. */
const rayHitsDisc = (ux: number, uy: number, c: Point, p: number): [number, number] | undefined => {
  const along = c.x * ux + c.y * uy;
  const disc = p * p - (c.x * c.x + c.y * c.y) + along * along;
  if (disc < 0 || along + Math.sqrt(disc) < 0) {
    return undefined;
  }
  return [Math.max(0, along - Math.sqrt(disc)), along + Math.sqrt(disc)];
};

/**
 * A band that follows the ring and keeps one padding, the largest of
 * the side and bottom paddings, from everything it holds: its members,
 * the paths between them, its child bands and their titles. Its walls
 * are traced ray by ray from the center. Between the end members each
 * wall hangs on a curve of radius BEND drawn over everything it holds,
 * so it bends gently instead of pinching between nodes. Past each end
 * member's middle the wall eases from that curve onto the member's
 * padding, so the end is round, with no horn. Undefined when the group
 * has nothing on the ring.
 */
const bandOf = (
  g: string,
  tree: GroupTree,
  subtree: Map<string, LayoutNodeInput[]>,
  kids: GroupShape[],
  own: Bounds[],
  result: CircularLayoutResult,
  seatless: Set<string>,
  at: Map<string, Point>
): GroupBand | undefined => {
  const pad = tree.padding.get(g)!;
  const p = Math.max(pad.left, pad.right, pad.bottom);
  const members = subtree.get(g)!.filter((n) => !seatless.has(n.id) && at.has(n.id));
  if (members.length === 0) {
    return undefined;
  }
  // The band's middle: opposite the widest empty arc between its
  // members, so the sweep is measured around them, not across the gap.
  const angles = members.map((n) => Math.atan2(at.get(n.id)!.y, at.get(n.id)!.x)).sort((a, b) => a - b);
  let gapAt = angles[angles.length - 1]!;
  let widest = TAU - (angles[angles.length - 1]! - angles[0]!);
  for (let i = 1; i < angles.length; i++) {
    if (angles[i]! - angles[i - 1]! > widest) {
      widest = angles[i]! - angles[i - 1]!;
      gapAt = angles[i - 1]!;
    }
  }
  const middle = wrap(gapAt + widest / 2 + Math.PI);
  const rel = (q: Point) => wrap(Math.atan2(q.y, q.x) - middle);

  // What the band holds: rects and points, each padded by p. The end
  // members' middles bound the hung part of the walls.
  const rects: Bounds[] = [...own];
  const points: Point[] = [];
  let c0 = Infinity;
  let c1 = -Infinity;
  for (const n of members) {
    c0 = Math.min(c0, rel(at.get(n.id)!));
    c1 = Math.max(c1, rel(at.get(n.id)!));
  }
  for (const k of kids) {
    if (k.kind !== 'band') {
      continue;
    }
    for (const q of k.outline) {
      points.push(q);
      c0 = Math.min(c0, rel(q));
      c1 = Math.max(c1, rel(q));
    }
    rects.push(titleBounds(k, tree.title.get(k.id)!));
  }
  const inside = new Set(members.map((n) => n.id));
  for (const e of result.edges) {
    if (inside.has(e.start) && inside.has(e.end)) {
      points.push(...e.points);
    }
  }
  // The members' mean distance from the center turns an angle into an
  // arc length along the ring, for the hung curve's sag.
  const ring = members.reduce((sum, n) => sum + Math.hypot(at.get(n.id)!.x, at.get(n.id)!.y), 0) / members.length;

  // On each ray, the nearest and farthest padded point the band holds.
  const phi = (k: number) => -Math.PI + (TAU * k) / BAND_STEPS;
  const hugIn: number[] = [];
  const hugOut: number[] = [];
  for (let k = 0; k < BAND_STEPS; k++) {
    const ux = Math.cos(middle + phi(k));
    const uy = Math.sin(middle + phi(k));
    let lo = Infinity;
    let hi = -Infinity;
    for (const hit of [
      ...rects.map((r) => rayHitsPadded(ux, uy, r, p)),
      ...points.map((q) => rayHitsDisc(ux, uy, q, p)),
    ]) {
      if (hit) {
        lo = Math.min(lo, hit[0]);
        hi = Math.max(hi, hit[1]);
      }
    }
    hugIn.push(lo);
    hugOut.push(hi);
  }

  // Each wall at each ray: the hung curve over every padded point
  // between the end members' middles, never inside the padding. The
  // curve sags a·(k − j)² from the point on ray j at ray k.
  const k0 = Math.ceil(((c0 + Math.PI) / TAU) * BAND_STEPS);
  const k1 = Math.floor(((c1 + Math.PI) / TAU) * BAND_STEPS);
  const a = (ring * (TAU / BAND_STEPS)) ** 2 / (2 * BEND);
  const hung: number[] = [];
  for (let j = k0; j <= k1; j++) {
    if (Number.isFinite(hugOut[j]!)) {
      hung.push(j);
    }
  }
  const outEnvelope = lowestParabolas(hung, (j) => -hugOut[j]! / a, BAND_STEPS);
  const inEnvelope = lowestParabolas(hung, (j) => hugIn[j]! / a, BAND_STEPS);
  const inR: number[] = [];
  const outR: number[] = [];
  for (let k = 0; k < BAND_STEPS; k++) {
    const hungOut = -a * outEnvelope[k]!;
    const hungIn = a * inEnvelope[k]!;
    if (k >= k0 && k <= k1) {
      outR.push(Math.max(hugOut[k]!, hungOut));
      inR.push(Math.min(hugIn[k]!, hungIn));
    } else if (Number.isFinite(hugOut[k]!)) {
      // Past an end member's middle: a half-cosine from the hung curve
      // at the middle down to the padding at the end.
      const dir = k < k0 ? -1 : 1;
      let end = k;
      while (Number.isFinite(hugOut[end + dir] ?? NaN)) {
        end += dir;
      }
      const from = k < k0 ? k0 : k1;
      const t = Math.min(1, Math.abs(k - from) / Math.max(1, Math.abs(end - from)));
      const w = Number.isFinite(hungOut) ? (1 + Math.cos(Math.PI * t)) / 2 : 0;
      outR.push(Math.max(hugOut[k]!, hugOut[k]! + (hungOut - hugOut[k]!) * w));
      inR.push(Math.min(hugIn[k]!, hugIn[k]! + (hungIn - hugIn[k]!) * w));
    } else {
      outR.push(NaN);
      inR.push(NaN);
    }
  }
  let first = k0;
  while (first > 0 && Number.isFinite(outR[first - 1]!)) {
    first--;
  }
  let last = k1;
  while (last < BAND_STEPS - 1 && Number.isFinite(outR[last + 1]!)) {
    last++;
  }
  const outer: Point[] = [];
  const inner: Point[] = [];
  for (let k = first; k <= last; k++) {
    const a = middle + phi(k);
    outer.push({ x: outR[k]! * Math.cos(a), y: outR[k]! * Math.sin(a) });
    const r = Math.max(0, inR[k]!);
    inner.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
  }
  const startAngle = wrap(middle + phi(first));
  const endAngle = startAngle + (phi(last) - phi(first));
  // The title on the ray through the band's middle, its nearest side
  // TITLE_GAP beyond the outer wall there.
  const mid = Math.round((first + last) / 2);
  const size = tree.title.get(g)!;
  const titleAt = middle + phi(mid);
  const dx = Math.cos(titleAt);
  const dy = Math.sin(titleAt);
  const reach = (Math.abs(dx) * size.width + Math.abs(dy) * size.height) / 2;
  const rho = outR[mid]! + TITLE_GAP + reach;
  return {
    kind: 'band',
    id: g,
    center: { x: 0, y: 0 },
    innerRadius: Math.max(0, Math.min(...inR.slice(first, last + 1))),
    outerRadius: Math.max(...outR.slice(first, last + 1)),
    startAngle,
    endAngle,
    title: { x: rho * dx, y: rho * dy },
    outline: simplified([...outer, ...inner.reverse()]),
  };
};

/**
 * For each k from 0 to n − 1, the least of (k − j)² + f(j) over the
 * given js, in ascending order: the lower envelope of parabolas, in one
 * pass (Felzenszwalb and Huttenlocher's distance transform). Infinity
 * everywhere when js is empty.
 */
const lowestParabolas = (js: number[], f: (j: number) => number, n: number): number[] => {
  const out = new Array<number>(n).fill(Infinity);
  if (js.length === 0) {
    return out;
  }
  // The parabolas on the envelope, and where each starts to be lowest.
  const v: number[] = [js[0]!];
  const z: number[] = [-Infinity];
  for (const q of js.slice(1)) {
    for (;;) {
      const p = v[v.length - 1]!;
      const cross = (f(q) + q * q - (f(p) + p * p)) / (2 * (q - p));
      if (cross <= z[z.length - 1]!) {
        v.pop();
        z.pop();
        continue;
      }
      v.push(q);
      z.push(cross);
      break;
    }
  }
  let i = 0;
  for (let k = 0; k < n; k++) {
    while (i + 1 < v.length && z[i + 1]! < k) {
      i++;
    }
    out[k] = (k - v[i]!) ** 2 + f(v[i]!);
  }
  return out;
};

/** How far a simplified outline may stray from the traced one, px: a
 *  quarter pixel, below what a renderer draws. */
const OUTLINE_TOLERANCE = 0.25;

/** An outline with the points dropped that lie within
 *  OUTLINE_TOLERANCE of the line between the points kept around them,
 *  by Douglas and Peucker's method. The first and last points stay. */
const simplified = (pts: Point[]): Point[] => {
  const keep = new Array<boolean>(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const spans: [number, number][] = [[0, pts.length - 1]];
  for (let span = spans.pop(); span; span = spans.pop()) {
    const [from, to] = span;
    let far = -1;
    let most = OUTLINE_TOLERANCE;
    for (let i = from + 1; i < to; i++) {
      const d = toSegment(pts[i]!, pts[from]!, pts[to]!);
      if (d > most) {
        most = d;
        far = i;
      }
    }
    if (far >= 0) {
      keep[far] = true;
      spans.push([from, far], [far, to]);
    }
  }
  return pts.filter((_, i) => keep[i]);
};
