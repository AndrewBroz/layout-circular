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
 *    carry its title room at the bottom, instead of a further turn.
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
  /** Which edge holds the title room. The top, with two exceptions,
   *  where the top padding trades places with the bottom's:
   *  - The box's top would meet an outside node at the least turn that
   *    clears with titles on top, and with its title room at the
   *    bottom a smaller turn clears.
   *  - An edge cutting across the ring (a spoke, chord or spur, not a
   *    rim arc) crosses the top's title strip, the line the title runs
   *    along between the side paddings, while no edge would cross the
   *    bottom's. */
  titleSide: 'top' | 'bottom';
  /** Center of the title: the middle of the title room's height, at
   *  the spot along it nearest the middle that no edge crosses, or the
   *  middle when every spot is crossed. */
  title: Point;
}

/** A group drawn as a band along the ring: the part of the annulus
 *  between two radii, swept clockwise from `startAngle` to `endAngle`.
 *  Angles are in the nodes' frame, as `PlacedNode.angle` is. */
export interface GroupBand {
  kind: 'band';
  id: string;
  /** Center of the ring the band follows. */
  center: Point;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  /** Greater than `startAngle`, by less than a full turn. */
  endAngle: number;
  /** Center of the title, which reads horizontally: just outside the
   *  band's outer edge, on the ray through its middle. */
  title: Point;
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

/** How many times a box that will not clear is redrawn as a band,
 *  with everything above and below it, before giving up. */
const BAND_TRIES = 3;

/** Solves one fitting may spend across every turn, growth round and
 *  band retry. Every turn is tried, so a ring that clears at once
 *  takes one solve a turn: 64 for 32 nodes, two turns a seat. A
 *  32-node ring whose group only clears as a band, round a hub, takes
 *  448, about half a second; 500 leaves it room. One that cannot clear
 *  at all would try every turn at every growth, about 770 solves and a
 *  second; the budget stops it at about 0.4s. Past the budget the best
 *  turn found so far stands, and the flag says whether it clears. */
const SOLVE_BUDGET = 500;

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
export const groupBounds = (g: GroupShape): Bounds => {
  if (g.kind === 'box') {
    return {
      minX: g.x - g.width / 2,
      minY: g.y - g.height / 2,
      maxX: g.x + g.width / 2,
      maxY: g.y + g.height / 2,
    };
  }
  // The extremes are at the four corners, or where the outer arc
  // crosses an axis inside the sweep.
  const points: Point[] = [];
  const at = (r: number, a: number) =>
    points.push({ x: g.center.x + r * Math.cos(a), y: g.center.y + r * Math.sin(a) });
  for (const a of [g.startAngle, g.endAngle]) {
    at(g.innerRadius, a);
    at(g.outerRadius, a);
  }
  const first = Math.ceil(g.startAngle / (Math.PI / 2));
  for (let k = first; k * (Math.PI / 2) <= g.endAngle; k++) {
    at(g.outerRadius, k * (Math.PI / 2));
  }
  return boundsOf(points);
};

/** The area a shape covers, px². Turns are ranked by it. */
const areaOf = (g: GroupShape): number =>
  g.kind === 'box'
    ? g.width * g.height
    : ((g.endAngle - g.startAngle) / 2) * (g.outerRadius ** 2 - g.innerRadius ** 2);

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

const bandRegion = (g: GroupBand): Region => {
  const { center, innerRadius: rIn, outerRadius: rOut, startAngle, endAngle } = g;
  const sweep = endAngle - startAngle;
  const at = (r: number, a: number): Point => ({
    x: center.x + r * Math.cos(a),
    y: center.y + r * Math.sin(a),
  });
  return cached({
    bounds: groupBounds(g),
    wall: () => {
      const out: Point[] = [];
      for (const r of rIn > 0 ? [rIn, rOut] : [rOut]) {
        const steps = Math.max(1, Math.ceil((r * sweep) / SAMPLE));
        for (let i = 0; i <= steps; i++) {
          out.push(at(r, startAngle + (sweep * i) / steps));
        }
      }
      along(at(rIn, startAngle), at(rOut, startAngle), out);
      along(at(rIn, endAngle), at(rOut, endAngle), out);
      return out;
    },
    distance: (p) => {
      const rho = Math.hypot(p.x - center.x, p.y - center.y);
      const into = (((Math.atan2(p.y - center.y, p.x - center.x) - startAngle) % TAU) + TAU) % TAU;
      if (into <= sweep) {
        const radial = Math.max(rIn - rho, rho - rOut);
        if (radial > 0) {
          return radial;
        }
        // Inside: the nearest wall, an arc or an end ray.
        const toStart = rho * Math.sin(Math.min(into, Math.PI / 2));
        const toEnd = rho * Math.sin(Math.min(sweep - into, Math.PI / 2));
        return -Math.min(rho - rIn, rOut - rho, toStart, toEnd);
      }
      // Outside the sweep the nearest point lies on an end.
      return Math.min(
        toSegment(p, at(rIn, startAngle), at(rOut, startAngle)),
        toSegment(p, at(rIn, endAngle), at(rOut, endAngle))
      );
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

/** A turn that clears, and how far it turns the ring, in seats. */
interface Clear {
  fitted: Fitted;
  amount: number;
}

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
 * the file's header for the four moves. `solve` lays the ring out
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
   * The shapes for one solve. With `lower`, each clashing box has its
   * title room moved to the bottom where that clashes less. Boxes are
   * tried one at a time, in input order, so a box whose top is clear
   * keeps its title on top.
   */
  const shapesFor = (result: CircularLayoutResult, bandSet: Set<string>, lower: boolean) => {
    let bottom = new Set<string>();
    let shapes = shapesOf(result, bandSet);
    let clashes = clashesOf(result, shapes, bandSet);
    for (const g of lower ? tree.ids : []) {
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
   *  unfitted radius, from `grow` pixels a gap. With `lower`, boxes may
   *  carry their title room at the bottom. */
  const grown = (
    turn: number,
    halfStep: boolean,
    bandSet: Set<string>,
    limit: number,
    lower: boolean,
    from = 0
  ): Fitted => {
    const cap = limit * base;
    let grow = from;
    let capped = false;
    for (let round = 0; ; round++) {
      solves++;
      const result = solve(fit(turn, halfStep, grow));
      const done = { result, grow, ...shapesFor(result, bandSet, lower) };
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
  const tightest = (clear: Clear[], grown: boolean): Clear => {
    let pool = clear;
    if (grown) {
      const least = Math.min(...pool.map((c) => c.fitted.result.radius));
      pool = pool.filter((c) => c.fitted.result.radius <= least * GROWTH_SLACK);
    }
    const least = Math.min(...pool.map((c) => areaIn(c.fitted)));
    pool = pool.filter((c) => areaIn(c.fitted) <= least * AREA_SLACK);
    pool.sort((a, b) => a.amount - b.amount || a.fitted.result.radius - b.fitted.result.radius);
    return pool[0]!;
  };

  /**
   * The turn. Every turn is first grown up to CHEAP_GROWTH with its
   * titles on top. Then each turn smaller than the smallest that
   * cleared is tried again with title room allowed at the bottom, so a
   * title goes below instead of turning the ring further, never instead
   * of growing it. The tightest of the turns that clear either way
   * wins. When none clears, the same two steps run again up to
   * GROW_CAP, and the tightest wins, the least grown first. When none
   * clears at all, the shallowest clash with titles on top wins, so the
   * flag goes up on the best there is and the band retry works from
   * it. Past the solve budget, the turns already tried are ranked as
   * they stand.
   */
  const search = (bandSet: Set<string>): Fitted => {
    // Each turn's latest result, titles on top and titles allowed
    // below, kept apart: a lowered result counts only when it clears.
    const upright = new Map<string, Fitted>();
    const lowered = new Map<string, Fitted>();
    const clear: Clear[] = [];
    const pass = (limit: number) => {
      for (const { turn, halfStep } of turns) {
        const key = `${turn} ${halfStep}`;
        const before = upright.get(key);
        if (before?.residual === 0 || (solves >= SOLVE_BUDGET && upright.size > 0)) {
          continue;
        }
        const fitted = grown(turn, halfStep, bandSet, limit, false, before?.grow ?? 0);
        upright.set(key, fitted);
        if (fitted.residual === 0) {
          clear.push({ fitted, amount: turned(turn, halfStep) });
        }
      }
      const smallest = Math.min(...clear.map((c) => c.amount));
      for (const { turn, halfStep } of turns) {
        const key = `${turn} ${halfStep}`;
        const amount = turned(turn, halfStep);
        const before = lowered.get(key);
        if (amount >= smallest - 1e-9 || before?.residual === 0 || solves >= SOLVE_BUDGET) {
          continue;
        }
        // Grow this turn with titles below only if that clears at the
        // growth the upright try reached. Checking costs no solve, and
        // where titles below cannot help, as round a hub, it saves a
        // whole pass of growing every turn.
        const top = upright.get(key);
        if (top && shapesFor(top.result, bandSet, true).residual > 0) {
          continue;
        }
        const fitted = grown(turn, halfStep, bandSet, limit, true, before?.grow ?? 0);
        lowered.set(key, fitted);
        if (fitted.residual === 0) {
          clear.push({ fitted, amount });
        }
      }
    };
    pass(CHEAP_GROWTH);
    if (clear.length > 0) {
      return tightest(clear, false).fitted;
    }
    pass(GROW_CAP);
    if (clear.length > 0) {
      return tightest(clear, true).fitted;
    }
    return [...upright.values()].reduce((a, b) => (b.residual < a.residual ? b : a));
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
 * padded. A band is the slice of
 * the annulus that holds its members, its child bands and their
 * titles, padded: its ends keep the side padding, its arcs the bottom.
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

    // The band's middle: opposite the widest empty arc between its
    // nodes, so the sweep is measured around the members, not across
    // the gap.
    const angles = subtree
      .get(g)!
      .filter((n) => !seatless.has(n.id))
      .map((n) => Math.atan2(at.get(n.id)!.y, at.get(n.id)!.x))
      .sort((a, b) => a - b);
    let middle = angles[0]!;
    if (angles.length > 1) {
      let gapAt = angles[angles.length - 1]!;
      let widest = TAU - (angles[angles.length - 1]! - angles[0]!);
      for (let i = 1; i < angles.length; i++) {
        if (angles[i]! - angles[i - 1]! > widest) {
          widest = angles[i]! - angles[i - 1]!;
          gapAt = angles[i - 1]!;
        }
      }
      middle = wrap(gapAt + widest / 2 + Math.PI);
    }

    // What the band holds: member corners, child band corners, and
    // child titles' corners.
    const corners: Point[] = [];
    let near = Infinity;
    let far = 0;
    for (const r of own) {
      corners.push(
        { x: r.minX, y: r.minY },
        { x: r.maxX, y: r.minY },
        { x: r.minX, y: r.maxY },
        { x: r.maxX, y: r.maxY }
      );
      // The nearest point of the rect to the center.
      near = Math.min(
        near,
        Math.hypot(Math.min(Math.max(0, r.minX), r.maxX), Math.min(Math.max(0, r.minY), r.maxY))
      );
    }
    for (const k of kids) {
      if (k.kind !== 'band') {
        continue;
      }
      for (const a of [k.startAngle, k.endAngle]) {
        for (const r of [k.innerRadius, k.outerRadius]) {
          corners.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
        }
      }
      near = Math.min(near, k.innerRadius);
      far = Math.max(far, k.outerRadius);
      const t = titleBounds(k, tree.title.get(k.id)!);
      corners.push(
        { x: t.minX, y: t.minY },
        { x: t.maxX, y: t.minY },
        { x: t.minX, y: t.maxY },
        { x: t.maxX, y: t.maxY }
      );
    }
    // Each end keeps the side padding from every corner: a corner ρ
    // from the center clears the end's ray by ρ·sin(Δ).
    const side = Math.max(pad.left, pad.right);
    let from = Infinity;
    let to = -Infinity;
    for (const c of corners) {
      const rho = Math.hypot(c.x, c.y);
      const rel = wrap(Math.atan2(c.y, c.x) - middle);
      const room = rho > 0 ? Math.asin(Math.min(1, side / rho)) : Math.PI / 2;
      from = Math.min(from, rel - room);
      to = Math.max(to, rel + room);
      far = Math.max(far, rho);
    }
    // A sweep can't close the circle; past that the band clashes with
    // whatever it would have wrapped, and the clash test says so.
    const most = TAU - 1e-6;
    if (to - from > most) {
      const mid = (from + to) / 2;
      from = mid - most / 2;
      to = mid + most / 2;
    }
    const startAngle = wrap(middle + from);
    const endAngle = startAngle + (to - from);
    const innerRadius = Math.max(0, near - pad.bottom);
    const outerRadius = far + pad.bottom;
    const size = tree.title.get(g)!;
    const titleAt = (startAngle + endAngle) / 2;
    const dx = Math.cos(titleAt);
    const dy = Math.sin(titleAt);
    // The title box's half-depth along the ray, so its nearest side
    // keeps TITLE_GAP from the band's outer edge.
    const reach = (Math.abs(dx) * size.width + Math.abs(dy) * size.height) / 2;
    const rho = outerRadius + TITLE_GAP + reach;
    shapes.set(g, {
      kind: 'band',
      id: g,
      center: { x: 0, y: 0 },
      innerRadius,
      outerRadius,
      startAngle,
      endAngle,
      title: { x: rho * dx, y: rho * dy },
    });
  }
  return shapes;
};
