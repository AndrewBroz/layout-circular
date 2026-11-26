import { describe, expect, it } from 'vitest';
import { circularLayout, groupBounds, outlinePath } from './layout.js';
import type {
  CircularLayoutOptions,
  CircularLayoutResult,
  GroupBand,
  GroupBox,
  GroupShape,
  LayoutEdgeInput,
  LayoutGroupInput,
  LayoutNodeInput,
  Point,
} from './layout.js';

const TAU = 2 * Math.PI;

// A node sized the way Pele sizes a one-line label.
const node = (id: string, label = id, group?: string): LayoutNodeInput => ({
  id,
  width: 9 * label.length + 32,
  height: 42,
  ...(group !== undefined && { group }),
});
const edge = (start: string, end: string): LayoutEdgeInput => ({
  id: `${start}-${end}`,
  start,
  end,
});
const chain = (...ids: string[]): LayoutEdgeInput[] =>
  ids.slice(1).map((id, i) => edge(ids[i]!, id));
const cycle = (...ids: string[]): LayoutEdgeInput[] => chain(...ids, ids[0]!);

// The prototype gallery's tight padding: 12px at the sides, a title
// line on top.
const tight = { top: 36, right: 12, bottom: 12, left: 12 };
const group = (id: string, parent?: string): LayoutGroupInput => ({
  id,
  ...(parent !== undefined && { parent }),
  padding: tight,
  title: { width: 9 * id.length, height: 20 },
});

interface Case {
  name: string;
  nodes: LayoutNodeInput[];
  edges: LayoutEdgeInput[];
  groups: LayoutGroupInput[];
  bands: string[];
}

/** The eight cases of the prototype gallery the owner chose D2 from. */
const gallery: Case[] = [
  {
    name: '1. water cycle, two adjacent two-node groups',
    nodes: [
      node('E', 'Evaporation'),
      node('C', 'Condensation', 'Atmosphere'),
      node('P', 'Precipitation', 'Atmosphere'),
      node('R', 'Runoff', 'Land'),
      node('O', 'Collection', 'Land'),
    ],
    edges: cycle('E', 'C', 'P', 'R', 'O'),
    groups: [group('Atmosphere'), group('Land')],
    bands: [],
  },
  {
    name: '2. ring of four, a group of the second and third',
    nodes: [node('P', 'Plan'), node('D', 'Do', 'Execution'), node('C', 'Check', 'Execution'), node('A', 'Act')],
    edges: cycle('P', 'D', 'C', 'A'),
    groups: [group('Execution')],
    bands: [],
  },
  {
    name: '3. ring of six, CI nested in Engineering',
    nodes: [
      node('P', 'Plan'),
      node('D', 'Design', 'Engineering'),
      node('C', 'Code', 'CI'),
      node('T', 'Test', 'CI'),
      node('R', 'Release', 'Engineering'),
      node('V', 'Review'),
    ],
    edges: cycle('P', 'D', 'C', 'T', 'R', 'V'),
    groups: [group('Engineering'), group('CI', 'Engineering')],
    bands: [],
  },
  {
    name: '4. a group of exactly half the ring, four of eight',
    nodes: [
      node('A', 'Awareness'),
      node('I', 'Interest'),
      node('T', 'Trial'),
      node('B', 'Purchase'),
      node('O', 'Onboarding', 'Post-sale'),
      node('U', 'Adoption', 'Post-sale'),
      node('N', 'Renewal', 'Post-sale'),
      node('V', 'Advocacy', 'Post-sale'),
    ],
    edges: cycle('A', 'I', 'T', 'B', 'O', 'U', 'N', 'V'),
    groups: [group('Post-sale')],
    bands: [],
  },
  {
    name: '5. a group of three quarters, six of eight',
    nodes: [
      node('I', 'Idea'),
      ...(['Spec', 'Design', 'Build', 'Test', 'Deploy', 'Monitor'] as const).map((l, i) =>
        node('SDBTPM'[i]!, l, 'Funded')
      ),
      node('R', 'Retire'),
    ],
    edges: cycle('I', 'S', 'D', 'B', 'T', 'P', 'M', 'R'),
    groups: [group('Funded')],
    bands: [],
  },
  {
    name: '6. three groups around a ring of nine',
    nodes: [
      node('Pl', 'Plow', 'Spring'),
      node('So', 'Sow', 'Spring'),
      node('Wa', 'Water', 'Spring'),
      node('We', 'Weed', 'Summer'),
      node('Pr', 'Prune', 'Summer'),
      node('Ha', 'Harvest', 'Summer'),
      node('Th', 'Thresh', 'Autumn'),
      node('St', 'Store', 'Autumn'),
      node('Se', 'Sell', 'Autumn'),
    ],
    edges: cycle('Pl', 'So', 'Wa', 'We', 'Pr', 'Ha', 'Th', 'St', 'Se'),
    groups: [group('Spring'), group('Summer'), group('Autumn')],
    bands: [],
  },
  {
    name: '7. a wheel, its hub and one group',
    nodes: [
      node('A', 'Plan'),
      node('C', 'Test', 'Delivery'),
      node('D', 'Ship', 'Delivery'),
      node('B', 'Build'),
      node('E', 'Watch'),
      node('F', 'Learn'),
      node('Hub', 'Vision'),
    ],
    edges: [...cycle('A', 'B', 'C', 'D', 'E', 'F'), ...['A', 'B', 'C', 'D', 'E', 'F'].map((id) => edge(id, 'Hub'))],
    groups: [group('Delivery')],
    bands: [],
  },
  {
    name: '8. the Krebs cycle, a group around two adjacent nodes',
    nodes: [
      node('A', 'Citrate'),
      node('B', 'Isocitrate'),
      node('C', 'Ketoglutarate'),
      node('D', 'Succinyl-CoA'),
      node('E', 'Succinate', 'CII'),
      node('F', 'Fumarate', 'CII'),
      node('G', 'Malate'),
      node('H', 'Oxaloacetate'),
      node('AcCoA', 'Acetyl-CoA'),
      node('CO2a', 'CO2'),
      node('CO2b', 'CO2 again'),
      node('NADH'),
    ],
    edges: [
      ...chain('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'A'),
      edge('AcCoA', 'A'),
      edge('C', 'CO2a'),
      edge('D', 'CO2b'),
      edge('G', 'NADH'),
    ],
    groups: [group('CII')],
    bands: [],
  },
];

interface Rect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const rectOf = (r: CircularLayoutResult, n: LayoutNodeInput, grow = 0): Rect => {
  const p = r.nodes.find((q) => q.id === n.id)!;
  return {
    minX: p.x - n.width / 2 - grow,
    minY: p.y - n.height / 2 - grow,
    maxX: p.x + n.width / 2 + grow,
    maxY: p.y + n.height / 2 + grow,
  };
};

/** Whether a band covers a point: inside its outline, even-odd. */
const inBand = (b: GroupBand, p: Point): boolean => {
  let inside = false;
  const o = b.outline;
  for (let i = 0, j = o.length - 1; i < o.length; j = i++) {
    const a = o[i]!;
    const c = o[j]!;
    if (a.y > p.y !== c.y > p.y && p.x < ((c.x - a.x) * (p.y - a.y)) / (c.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
};

/** The distance from a point to a band's wall. */
const toWall = (b: GroupBand, p: Point): number => {
  let d = Infinity;
  const o = b.outline;
  for (let i = 0, j = o.length - 1; i < o.length; j = i++) {
    const a = o[i]!;
    const c = o[j]!;
    const vx = c.x - a.x;
    const vy = c.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / (vx * vx + vy * vy || 1)));
    d = Math.min(d, Math.hypot(p.x - a.x - t * vx, p.y - a.y - t * vy));
  }
  return d;
};

/** Whether a shape covers any point of a rect, sampled every 2px. */
const covers = (g: GroupShape, r: Rect): boolean => {
  if (g.kind === 'box') {
    return (
      g.x - g.width / 2 < r.maxX &&
      r.minX < g.x + g.width / 2 &&
      g.y - g.height / 2 < r.maxY &&
      r.minY < g.y + g.height / 2
    );
  }
  for (let x = r.minX; x <= r.maxX; x += 2) {
    for (let y = r.minY; y <= r.maxY; y += 2) {
      if (inBand(g, { x, y })) {
        return true;
      }
    }
  }
  return false;
};

const boundsRect = (g: GroupShape): Rect => groupBounds(g);

/** Whether one shape wraps another: every sampled point of the inner
 *  one's bounds that the inner shape covers, the outer covers too. */
const wraps = (outer: GroupShape, inner: GroupShape): boolean => {
  const b = boundsRect(inner);
  const coveredBy = (g: GroupShape, p: Point) =>
    g.kind === 'box'
      ? Math.abs(p.x - g.x) <= g.width / 2 + 1e-6 && Math.abs(p.y - g.y) <= g.height / 2 + 1e-6
      : inBand(g, p);
  for (let x = b.minX; x <= b.maxX; x += 2) {
    for (let y = b.minY; y <= b.maxY; y += 2) {
      if (coveredBy(inner, { x, y }) && !coveredBy(outer, { x, y })) {
        return false;
      }
    }
  }
  return true;
};

const membersOf = (c: { nodes: LayoutNodeInput[]; groups: LayoutGroupInput[] }, g: string) => {
  const parent = new Map(c.groups.map((q) => [q.id, q.parent]));
  return c.nodes.filter((n) => {
    for (let at = n.group; at !== undefined; at = parent.get(at)) {
      if (at === g) {
        return true;
      }
    }
    return false;
  });
};

/** Every shape wraps its members and its children, and leaves at
 *  least 4px of daylight to every other node and sibling shape. */
const expectClear = (
  r: CircularLayoutResult,
  c: { nodes: LayoutNodeInput[]; groups: LayoutGroupInput[] }
) => {
  expect(r.groupsClear).toBe(true);
  const shapeOf = new Map(r.groups!.map((g) => [g.id, g]));
  for (const g of c.groups) {
    const shape = shapeOf.get(g.id)!;
    const inside = new Set(membersOf(c, g.id).map((n) => n.id));
    for (const n of c.nodes) {
      if (inside.has(n.id)) {
        const rect = rectOf(r, n);
        const corners = [
          { x: rect.minX, y: rect.minY },
          { x: rect.maxX, y: rect.minY },
          { x: rect.minX, y: rect.maxY },
          { x: rect.maxX, y: rect.maxY },
        ];
        const box = { kind: 'box', titleSide: 'top', id: n.id, x: (rect.minX + rect.maxX) / 2, y: (rect.minY + rect.maxY) / 2, width: n.width, height: n.height, title: corners[0]! } as const;
        expect(wraps(shape, box), `${g.id} wraps ${n.id}`).toBe(true);
      } else {
        expect(covers(shape, rectOf(r, n, 4)), `${g.id} covers ${n.id}`).toBe(false);
      }
    }
    for (const h of c.groups) {
      if (h.id === g.id) {
        continue;
      }
      if (h.parent === g.id) {
        expect(wraps(shape, shapeOf.get(h.id)!), `${g.id} wraps ${h.id}`).toBe(true);
      } else if (h.parent === g.parent && h.id > g.id) {
        const other = shapeOf.get(h.id)!;
        const b = boundsRect(other);
        const near = { minX: b.minX - 4, minY: b.minY - 4, maxX: b.maxX + 4, maxY: b.maxY + 4 };
        const meets = other.kind === 'box' ? covers(shape, near) : covers(other, boundsRect(shape)) && covers(shape, near);
        expect(meets, `${g.id} meets ${h.id}`).toBe(false);
      }
    }
  }
};

/** Free arc between the borders of rim neighbors, as the solver
 *  equalizes it: a grouped node also claims its wall's 16px. */
const rimGaps = (r: CircularLayoutResult, nodes: LayoutNodeInput[]): number[] => {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const at = new Map(r.nodes.map((p) => [p.id, p]));
  const claim = (id: string) => {
    const n = byId.get(id)!;
    const a = at.get(id)!.angle;
    return (Math.abs(Math.sin(a)) * n.width + Math.abs(Math.cos(a)) * n.height) / 2 + (n.group ? 16 : 0);
  };
  return r.order.map((id, i) => {
    const next = r.order[(i + 1) % r.order.length]!;
    let delta = at.get(next)!.angle - at.get(id)!.angle;
    while (delta <= 0) {
      delta += TAU;
    }
    return r.radius * delta - claim(id) - claim(next);
  });
};

/** The largest distance from a rim node to its mirror image's nearest
 *  rim node, across the vertical axis. */
const mirrorError = (r: CircularLayoutResult): number => {
  const rim = r.order.map((id) => r.nodes.find((p) => p.id === id)!);
  return Math.max(...rim.map((p) => Math.min(...rim.map((q) => Math.hypot(q.x + p.x, q.y - p.y)))));
};

describe('group shapes, the book designer\'s way', () => {
  for (const c of gallery) {
    describe(c.name, () => {
      const r = circularLayout(c.nodes, c.edges, {}, c.groups);
      const plain = circularLayout(c.nodes, c.edges);

      it('clears every node and sibling', () => {
        expectClear(r, c);
      });

      it('keeps the gaps even: none is widened past the unfitted ring\'s spread', () => {
        // The solver evens free arc, then mirrors pairs, so a ring of
        // mixed widths is never perfectly even, and a turn changes which
        // widths meet. Widening gaps for a group, the rejected
        // strategies, added 38 to 900px; 16px is room for a turn.
        const spread = (gaps: number[]) => Math.max(...gaps) - Math.min(...gaps);
        const gaps = rimGaps(r, c.nodes);
        expect(Math.min(...gaps)).toBeGreaterThan(0);
        expect(spread(gaps)).toBeLessThan(spread(rimGaps(plain, c.nodes)) + 16);
      });

      it('keeps the ring mirror-symmetric', () => {
        expect(mirrorError(r)).toBeLessThan(0.01);
      });

      it('grows the radius by 15% at most', () => {
        expect(r.radius / plain.radius).toBeLessThan(1.15);
        expect(r.radius / plain.radius).toBeGreaterThan(0.95);
      });

      it(`draws ${c.bands.length ? c.bands.join(' and ') + ' as bands' : 'every group as a box'}`, () => {
        expect(r.groups!.filter((g) => g.kind === 'band').map((g) => g.id).sort()).toEqual(
          [...c.bands].sort()
        );
      });
    });
  }

  it('turns the ring when that makes a box tight: two members lie flat', () => {
    // Krebs: the unturned ring clears, but CII's box lies diagonally
    // over empty space there. A turn that puts its two members level
    // gives a box much less than 1.3 times the area, so it wins.
    const c = gallery[7]!;
    const r = circularLayout(c.nodes, c.edges, {}, c.groups);
    const at = new Map(r.nodes.map((p) => [p.id, p]));
    expect(at.get('E')!.y).toBeCloseTo(at.get('F')!.y, 6);
    expectClear(r, c);
  });

  it('turns the ring as little as clears: a half-step beside the first node', () => {
    // At the default turn Do sits right and Check at the bottom, and a
    // box around them covers the middle. Half a seat is the least turn
    // that clears, so Plan stays one of the two nodes on top.
    const c = gallery[1]!;
    const r = circularLayout(c.nodes, c.edges, {}, c.groups);
    const at = new Map(r.nodes.map((p) => [p.id, p]));
    const plan = at.get('P')!;
    expect(Math.abs(plan.x)).toBeGreaterThan(1);
    const top = Math.min(...r.nodes.map((p) => p.y));
    expect(plan.y).toBeCloseTo(top, 6);
    expectClear(r, c);
  });

  it('keeps the first node on top over a cheaper growth elsewhere', () => {
    // The water cycle clears with the author's Evaporation on top; a
    // half-turn that needs no growth must not win.
    const c = gallery[0]!;
    const r = circularLayout(c.nodes, c.edges, {}, c.groups);
    const e = r.nodes.find((p) => p.id === 'E')!;
    expect(e.x).toBeCloseTo(0, 6);
    expect(e.y).toBeLessThan(0);
  });

  it('may put the half-step on top: an edge, not a node', () => {
    // Case 4: the gap between Advocacy and Awareness takes the top.
    const c = gallery[3]!;
    const r = circularLayout(c.nodes, c.edges, {}, c.groups);
    const at = new Map(r.nodes.map((p) => [p.id, p]));
    expect(at.get('A')!.y).toBeCloseTo(at.get('V')!.y, 6);
    expect(at.get('A')!.x).toBeCloseTo(-at.get('V')!.x, 6);
    expect(at.get('A')!.y).toBeLessThan(0);
  });
});

describe('shape by fit', () => {
  const ring = (n: number, members: number) => {
    const ids = Array.from({ length: n }, (_, i) => `N${i}`);
    return {
      nodes: ids.map((id, i) => node(id, 'Node', i >= 1 && i <= members ? 'G' : undefined)),
      edges: cycle(...ids),
      groups: [group('G')],
    };
  };
  const kindOf = (c: ReturnType<typeof ring>) =>
    circularLayout(c.nodes, c.edges, {}, c.groups).groups![0]!.kind;

  it('boxes four of five: a box fits', () => {
    const c = ring(5, 4);
    const r = circularLayout(c.nodes, c.edges, {}, c.groups);
    expect(r.groups![0]!.kind).toBe('box');
    expectClear(r, c);
  });

  it('boxes a group whatever share of the ring it covers, when a box clears', () => {
    // Five of eight and four of six span half the ring: once bands.
    expect(kindOf(ring(8, 5))).toBe('box');
    expect(kindOf(ring(6, 4))).toBe('box');
  });

  it('boxes a group holding the whole ring: nothing on it lies outside', () => {
    const c = ring(5, 4);
    c.nodes[0] = { ...c.nodes[0]!, group: 'G' };
    expect(kindOf(c)).toBe('box');
  });
});

describe('bands', () => {
  // A hub outside a group of four of six: any box around the four
  // covers the middle, where the hub sits, at every turn and growth.
  const ids = ['A', 'B', 'C', 'D', 'E', 'F'];
  const hubCase = (groups: LayoutGroupInput[] = [group('G')], inner?: string[]) => ({
    nodes: [
      ...ids.map((id) => node(id, 'Node', inner?.includes(id) ? 'I' : id <= 'D' ? 'G' : undefined)),
      node('Hub', 'Hub'),
    ],
    edges: [...cycle(...ids), ...ids.map((id) => edge(id, 'Hub'))],
    groups,
  });
  const bandOf = (r: CircularLayoutResult, id = 'G') => {
    const g = r.groups!.find((q) => q.id === id)!;
    if (g.kind !== 'band') throw new Error(`${id} is not a band`);
    return g;
  };

  it('draws a group as a band when no box around it clears', () => {
    const c = hubCase();
    const r = circularLayout(c.nodes, c.edges, {}, c.groups);
    expect(r.hub).toBe('Hub');
    expect(r.groups!.map((g) => g.kind)).toEqual(['band']);
    expectClear(r, c);
  });

  it('keeps the padding from every member and every path between them', () => {
    const c = hubCase();
    const r = circularLayout(c.nodes, c.edges, {}, c.groups);
    const b = bandOf(r);
    // The wall is traced every half degree and simplified to a quarter
    // pixel, so it may come up to 1px inside the padding.
    const pad = Math.max(tight.left, tight.right, tight.bottom) - 1;
    const members = c.nodes.filter((n) => n.group === 'G');
    for (const n of members) {
      const m = rectOf(r, n);
      for (let x = m.minX; x <= m.maxX; x += 2) {
        for (const y of [m.minY, m.maxY]) {
          expect(inBand(b, { x, y }), n.id).toBe(true);
          expect(toWall(b, { x, y }), n.id).toBeGreaterThanOrEqual(pad);
        }
      }
      for (let y = m.minY; y <= m.maxY; y += 2) {
        for (const x of [m.minX, m.maxX]) {
          expect(toWall(b, { x, y }), n.id).toBeGreaterThanOrEqual(pad);
        }
      }
    }
    const inside = new Set(members.map((n) => n.id));
    for (const e of r.edges.filter((q) => inside.has(q.start) && inside.has(q.end))) {
      for (const p of e.points) {
        expect(inBand(b, p), e.id).toBe(true);
        expect(toWall(b, p), e.id).toBeGreaterThanOrEqual(pad);
      }
    }
  });

  it('follows the ring and leaves the hub, with no seat, outside', () => {
    const c = hubCase();
    const r = circularLayout(c.nodes, c.edges, {}, c.groups);
    const b = bandOf(r);
    expect(b.center).toEqual({ x: 0, y: 0 });
    expect(b.innerRadius).toBeLessThan(r.radius);
    expect(b.outerRadius).toBeGreaterThan(r.radius);
    expect(b.endAngle).toBeGreaterThan(b.startAngle);
    // The radii and sweep bound the outline.
    for (const p of b.outline) {
      const rho = Math.hypot(p.x, p.y);
      expect(rho).toBeGreaterThanOrEqual(b.innerRadius - 1e-6);
      expect(rho).toBeLessThanOrEqual(b.outerRadius + 1e-6);
    }
    for (const id of ['Hub', 'E', 'F']) {
      expect(covers(b, rectOf(r, c.nodes.find((n) => n.id === id)!, 4)), id).toBe(false);
    }
  });

  it('seats the title outside the band, on the ray through its middle', () => {
    const c = hubCase();
    const r = circularLayout(c.nodes, c.edges, {}, c.groups);
    const b = bandOf(r);
    const mid = (b.startAngle + b.endAngle) / 2;
    // The middle ray is the traced ray nearest it, within a quarter degree.
    expect(Math.abs(Math.atan2(b.title.y, b.title.x) - Math.atan2(Math.sin(mid), Math.cos(mid)))).toBeLessThan(0.005);
    const { width, height } = c.groups[0]!.title!;
    const title = {
      minX: b.title.x - width / 2,
      minY: b.title.y - height / 2,
      maxX: b.title.x + width / 2,
      maxY: b.title.y + height / 2,
    };
    expect(covers(b, title)).toBe(false);
    // Close to the band: its nearest corner within 12px of the wall.
    const near = Math.min(
      ...[
        { x: title.minX, y: title.minY },
        { x: title.maxX, y: title.minY },
        { x: title.minX, y: title.maxY },
        { x: title.maxX, y: title.maxY },
      ].map((p) => toWall(b, p))
    );
    expect(near).toBeLessThan(12);
  });

  it('keeps the title room the top padding leaves, when no title size is given', () => {
    const c = hubCase([{ id: 'G', padding: tight }]);
    const b = bandOf(circularLayout(c.nodes, c.edges, {}, c.groups));
    expect(Math.hypot(b.title.x, b.title.y)).toBeGreaterThan(b.outerRadius);
  });

  it('mirrors a band counter-clockwise', () => {
    const c = hubCase();
    const cw = bandOf(circularLayout(c.nodes, c.edges, {}, c.groups));
    const ccw = bandOf(circularLayout(c.nodes, c.edges, { direction: 'counterclockwise' }, c.groups));
    const norm = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
    // Within the half-degree step the wall is traced at.
    expect(Math.abs(norm(ccw.startAngle - (Math.PI - cw.endAngle)))).toBeLessThan(TAU / 720 + 1e-9);
    expect(ccw.endAngle - ccw.startAngle).toBeCloseTo(cw.endAngle - cw.startAngle, 6);
    expect(ccw.title.x).toBeCloseTo(-cw.title.x, 0);
    expect(ccw.title.y).toBeCloseTo(cw.title.y, 0);
  });

  it('draws everything nested in a band as a band, its title in the strip between them', () => {
    // Inner, B and C, would be a box on its own; its parent is a band.
    const c = hubCase([group('G'), group('I', 'G')], ['B', 'C']);
    const r = circularLayout(c.nodes, c.edges, {}, c.groups);
    expect(r.groups!.map((g) => g.kind)).toEqual(['band', 'band']);
    expectClear(r, c);
    const outer = bandOf(r, 'G');
    const inner = bandOf(r, 'I');
    for (const p of inner.outline) {
      expect(inBand(outer, p)).toBe(true);
    }
    const { width, height } = c.groups[1]!.title!;
    const title = {
      minX: inner.title.x - width / 2,
      minY: inner.title.y - height / 2,
      maxX: inner.title.x + width / 2,
      maxY: inner.title.y + height / 2,
    };
    expect(covers(inner, title)).toBe(false);
    for (const corner of [
      { x: title.minX, y: title.minY },
      { x: title.maxX, y: title.minY },
      { x: title.minX, y: title.maxY },
      { x: title.maxX, y: title.maxY },
    ]) {
      expect(inBand(outer, corner)).toBe(true);
    }
  });
});

describe('nesting', () => {
  it('nests a box inside a box', () => {
    const c = {
      nodes: [
        node('A', 'Alpha'),
        node('B', 'Bravo', 'outer'),
        node('C', 'Charlie', 'inner'),
        node('D', 'Delta'),
        node('E', 'Echo'),
        node('F', 'Foxtrot'),
        node('G', 'Golf'),
        node('H', 'Hotel'),
      ],
      edges: cycle('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'),
      groups: [group('outer'), group('inner', 'outer')],
    };
    const r = circularLayout(c.nodes, c.edges, {}, c.groups);
    expect(r.groups!.map((g) => g.kind)).toEqual(['box', 'box']);
    expectClear(r, c);
  });
});

describe('box titles', () => {
  const boxOf = (r: CircularLayoutResult, id: string) => {
    const g = r.groups!.find((q) => q.id === id)!;
    if (g.kind !== 'box') throw new Error(`${id} is not a box`);
    return g;
  };

  it('moves a title to the bottom when edges cross the top and the bottom is clear', () => {
    // The wheel: the spokes into the hub cross Delivery's top strip.
    const c = gallery[6]!;
    const r = circularLayout(c.nodes, c.edges, {}, c.groups);
    const g = boxOf(r, 'Delivery');
    expect(g.titleSide).toBe('bottom');
    // The title room moves with it: the box's bottom holds the title,
    // its top only the side padding. What the box holds is its members
    // and the arc between them, which sags below them.
    const inside = new Set(c.nodes.filter((n) => n.group === 'Delivery').map((n) => n.id));
    const held = [
      ...c.nodes.filter((n) => inside.has(n.id)).map((n) => rectOf(r, n)),
      ...r.edges
        .filter((e) => inside.has(e.start) && inside.has(e.end))
        .flatMap((e) => e.points.map((p) => ({ minX: p.x, minY: p.y, maxX: p.x, maxY: p.y }))),
    ];
    const b = groupBounds(g);
    expect(Math.min(...held.map((m) => m.minY)) - b.minY).toBeCloseTo(tight.bottom, 6);
    expect(b.maxY - Math.max(...held.map((m) => m.maxY))).toBeCloseTo(tight.top, 6);
    expect(g.title.y).toBeCloseTo(b.maxY - tight.top / 2, 6);
    expectClear(r, c);
  });

  it('puts the title room below rather than turning the ring, when the top would meet an outside node', () => {
    // Four of five in Funded, with Pele's 35px title room: on top, it
    // would meet Idea. Below, the ring keeps Idea on top, unturned.
    const pele = { top: 35, right: 12, bottom: 12, left: 12 };
    const nodes = [
      node('I', 'Idea'),
      ...(['Spec', 'Build', 'Test', 'Ship'] as const).map((l) => node(l[0]!, l, 'Funded')),
    ];
    const c = { nodes, edges: cycle('I', 'S', 'B', 'T', 'P'), groups: [{ id: 'Funded', padding: pele, title: { width: 54, height: 20 } }] };
    const r = circularLayout(c.nodes, c.edges, {}, c.groups);
    const idea = r.nodes.find((p) => p.id === 'I')!;
    expect(idea.x).toBeCloseTo(0, 6);
    expect(idea.y).toBeLessThan(0);
    const g = boxOf(r, 'Funded');
    expect(g.titleSide).toBe('bottom');
    expect(g.title.y).toBeCloseTo(groupBounds(g).maxY - pele.top / 2, 6);
    expectClear(r, c);
  });

  it('grows the ring before it puts a title below: titles go below only instead of a turn', () => {
    // The water cycle as Pele measures it. Unturned, both tops meet
    // Evaporation; a little growth clears them, so both titles stay on
    // top and Evaporation stays on top.
    const box = (id: string, width: number, group?: string): LayoutNodeInput => ({
      id,
      width,
      height: 48,
      ...(group !== undefined && { group }),
    });
    const nodes = [box('E', 121.38), box('C', 134.72, 'Atmosphere'), box('P', 124.04, 'Atmosphere'), box('R', 83.14, 'Land'), box('O', 106.24, 'Land')];
    const pele = { top: 40, right: 12, bottom: 12, left: 12 };
    const groups = [
      { id: 'Land', padding: pele, title: { width: 35.58, height: 24 } },
      { id: 'Atmosphere', padding: pele, title: { width: 86.24, height: 24 } },
    ];
    const c = { nodes, edges: cycle('E', 'C', 'P', 'R', 'O'), groups };
    const r = circularLayout(c.nodes, c.edges, {}, c.groups);
    expect(boxOf(r, 'Atmosphere').titleSide).toBe('top');
    expect(boxOf(r, 'Land').titleSide).toBe('top');
    const e = r.nodes.find((p) => p.id === 'E')!;
    expect(e.x).toBeCloseTo(0, 6);
    expect(e.y).toBeLessThan(0);
    expectClear(r, c);
  });

  it('keeps titles on top when nothing crosses them', () => {
    const c = gallery[0]!;
    const r = circularLayout(c.nodes, c.edges, {}, c.groups);
    expect(boxOf(r, 'Atmosphere').titleSide).toBe('top');
    expect(boxOf(r, 'Land').titleSide).toBe('top');
  });
});

describe('labels and titles', () => {
  it('slides a rim label off a box title', () => {
    // Two grouped nodes on top: the arc between them, and its label,
    // run through the title room above them.
    const ids = ['A', 'B', 'C', 'D', 'E', 'F'];
    const nodes = ids.map((id) => node(id, 'Node', id === 'A' || id === 'B' ? 'G' : undefined));
    const edges = cycle(...ids).map((e) => (e.id === 'A-B' ? { ...e, labelWidth: 40, labelHeight: 20 } : e));
    const groups = [group('G')];
    const r = circularLayout(nodes, edges, {}, groups);
    const box = r.groups![0]!;
    const { width, height } = groups[0]!.title!;
    const label = r.edges.find((e) => e.id === 'A-B')!.label!;
    const apart =
      Math.abs(label.x - box.title.x) >= (40 + width) / 2 || Math.abs(label.y - box.title.y) >= (20 + height) / 2;
    expect(apart).toBe(true);
  });
});

describe('clearance that cannot be reached', () => {
  it('says so on the result instead of failing silently', () => {
    const ids = ['A', 'B', 'C', 'D', 'E', 'F'];
    const nodes = ids.map((id) => node(id, 'Node', id === 'B' || id === 'C' ? 'G' : undefined));
    const huge = { top: 400, right: 400, bottom: 400, left: 400 };
    const r = circularLayout(nodes, cycle(...ids), {}, [{ id: 'G', padding: huge }]);
    expect(r.groupsClear).toBe(false);
    expect(r.groups).toHaveLength(1);
  });

  it('keeps boxes when redrawing them as bands only clashes deeper', () => {
    // Twelve nodes, two groups padded far past any ring: no turn clears
    // the boxes, and bands that wide reach further still. The retry as
    // bands must not replace the shallower clash.
    const ids = Array.from({ length: 12 }, (_, i) => `N${i}`);
    const nodes = ids.map((id, i) => ({
      id,
      width: 90,
      height: 42,
      ...(i % 8 < 3 && { group: `G${Math.floor(i / 8)}` }),
    }));
    const huge = { top: 400, right: 400, bottom: 400, left: 400 };
    const groups = ['G0', 'G1'].map((id) => ({ id, padding: huge, title: { width: 60, height: 20 } }));
    const r = circularLayout(nodes, cycle(...ids), {}, groups);
    expect(r.groupsClear).toBe(false);
    expect(r.groups!.map((g) => g.kind)).toEqual(['box', 'box']);
  });

  it('reports a clear layout as clear', () => {
    const c = gallery[0]!;
    expect(circularLayout(c.nodes, c.edges, {}, c.groups).groupsClear).toBe(true);
  });
});

describe('group input hygiene', () => {
  const ids = ['A', 'B', 'C', 'D', 'E', 'F'];
  const nodes = ids.map((id) => node(id, 'Node', id === 'B' || id === 'C' ? 'G' : undefined));

  it('treats negative padding as none', () => {
    const negative = { top: -30, right: -5, bottom: -5, left: -5 };
    const zero = { top: 0, right: 0, bottom: 0, left: 0 };
    const a = circularLayout(nodes, cycle(...ids), {}, [{ id: 'G', padding: negative }]);
    const b = circularLayout(nodes, cycle(...ids), {}, [{ id: 'G', padding: zero }]);
    expect(a).toEqual(b);
  });

  it('leaves a grouped layout alone when no groups are passed', () => {
    // Without the fourth argument the layout is the one a grouped node
    // has always had: no turn, no growth, no shapes.
    const r = circularLayout(nodes, cycle(...ids));
    expect(r.groups).toBeUndefined();
    expect(r.groupsClear).toBeUndefined();
    expect(r.order[0]).toBe('A');
  });

  it('adds nothing when no node is grouped', () => {
    const plain = ids.map((id) => node(id));
    const r = circularLayout(plain, cycle(...ids), {}, [group('G')]);
    expect(r).toEqual(circularLayout(plain, cycle(...ids)));
  });

  it('boxes a group named only by its members, with no padding', () => {
    const r = circularLayout(nodes, cycle(...ids), {}, []);
    expect(r.groups!.map((g) => g.id)).toEqual(['G']);
    const g = r.groups![0]!;
    expect(g.kind).toBe('box');
    const b = boundsRect(g);
    const members = nodes.filter((n) => n.group === 'G').map((n) => rectOf(r, n));
    expect(b.minX).toBeCloseTo(Math.min(...members.map((m) => m.minX)), 6);
    expect(b.maxY).toBeCloseTo(Math.max(...members.map((m) => m.maxY)), 6);
  });
});

describe('boxes', () => {
  it('hugs its members with exactly the padding given', () => {
    const ids = ['A', 'B', 'C', 'D', 'E', 'F'];
    const nodes = ids.map((id) => node(id, 'Node', id === 'B' || id === 'C' ? 'G' : undefined));
    const padding = { top: 30, right: 5, bottom: 7, left: 11 };
    const r = circularLayout(nodes, cycle(...ids), {}, [{ id: 'G', padding }]);
    const g = r.groups![0]!;
    expect(g.kind).toBe('box');
    const b = boundsRect(g);
    const members = nodes.filter((n) => n.group === 'G').map((n) => rectOf(r, n));
    expect(b.minX).toBeCloseTo(Math.min(...members.map((m) => m.minX)) - 11, 6);
    expect(b.maxX).toBeCloseTo(Math.max(...members.map((m) => m.maxX)) + 5, 6);
    expect(b.minY).toBeCloseTo(Math.min(...members.map((m) => m.minY)) - 30, 6);
    expect(b.maxY).toBeCloseTo(Math.max(...members.map((m) => m.maxY)) + 7, 6);
    // The title's anchor is the middle of the room above the members.
    expect(g.title.x).toBeCloseTo((b.minX + b.maxX) / 2, 6);
    expect(g.title.y).toBeCloseTo(b.minY + 15, 6);
  });

  // mermaid 12 draws every node at least 120px wide. Two wide members
  // side by side at the bottom of a small ring: the arc between them
  // sags below both, and the box must hold it.
  const wide = (id: string, group?: string): LayoutNodeInput => ({
    id,
    width: 152,
    height: 48,
    ...(group !== undefined && { group }),
  });
  const mermaidPad = { top: 38, right: 12, bottom: 12, left: 12 };
  const arcCases: { name: string; nodes: LayoutNodeInput[]; edges: LayoutEdgeInput[]; groups: LayoutGroupInput[] }[] = [
    {
      name: 'five wide nodes, Build and Test in Make',
      nodes: [wide('I'), wide('S'), wide('B', 'Make'), wide('T', 'Make'), wide('P')],
      edges: cycle('I', 'S', 'B', 'T', 'P'),
      groups: [{ id: 'Make', padding: mermaidPad }],
    },
    {
      name: 'eight wide nodes, Build and Test in Make',
      nodes: [
        wide('I'), wide('S'), wide('D'), wide('B', 'Make'), wide('T', 'Make'), wide('P'), wide('M'), wide('R'),
      ],
      edges: cycle('I', 'S', 'D', 'B', 'T', 'P', 'M', 'R'),
      groups: [{ id: 'Make', padding: mermaidPad }],
    },
    ...gallery,
  ];

  for (const c of arcCases) {
    it(`holds the arcs between its members, padded: ${c.name}`, () => {
      const r = circularLayout(c.nodes, c.edges, {}, c.groups);
      for (const g of r.groups!.filter((s): s is GroupBox => s.kind === 'box')) {
        const pad = c.groups.find((q) => q.id === g.id)!.padding ?? { top: 0, right: 0, bottom: 0, left: 0 };
        const b = boundsRect(g);
        const top = g.titleSide === 'top' ? pad.top : pad.bottom;
        const bottom = g.titleSide === 'top' ? pad.bottom : pad.top;
        const inside = new Set(membersOf(c, g.id).map((n) => n.id));
        const arcs = r.edges.filter((e) => e.onRim && inside.has(e.start) && inside.has(e.end));
        expect(arcs.length, `${g.id} has member arcs`).toBeGreaterThan(0);
        for (const e of arcs) {
          for (const p of e.points) {
            expect(p.x, `${e.id} left`).toBeGreaterThanOrEqual(b.minX + pad.left - 1e-6);
            expect(p.x, `${e.id} right`).toBeLessThanOrEqual(b.maxX - pad.right + 1e-6);
            expect(p.y, `${e.id} top`).toBeGreaterThanOrEqual(b.minY + top - 1e-6);
            expect(p.y, `${e.id} bottom`).toBeLessThanOrEqual(b.maxY - bottom + 1e-6);
          }
        }
      }
      expectClear(r, c);
    });
  }

  it('keeps the boxes clear counter-clockwise too', () => {
    const c = gallery[0]!;
    expectClear(circularLayout(c.nodes, c.edges, { direction: 'counterclockwise' }, c.groups), c);
  });
});

describe('straight edges with groups', () => {
  for (const i of [0, 2]) {
    const c = gallery[i]!;
    it(`places ${c.name} as the arcs do, and clears it`, () => {
      const options: CircularLayoutOptions = { edges: 'straight' };
      const straight = circularLayout(c.nodes, c.edges, options, c.groups);
      const arcs = circularLayout(c.nodes, c.edges, {}, c.groups);
      expect(straight.nodes).toEqual(arcs.nodes);
      // The same kinds of shape, titled on the same side. A box holds
      // its members' paths, so it is a little smaller around straight
      // lines than around arcs that sag past their nodes.
      const kinds = (r: CircularLayoutResult) => r.groups!.map((g) => [g.kind, g.kind === 'box' && g.titleSide]);
      expect(kinds(straight)).toEqual(kinds(arcs));
      expectClear(straight, c);
      for (const e of straight.edges.filter((q) => q.onRim)) {
        const [a, b] = [e.points[0]!, e.points[e.points.length - 1]!];
        for (const p of e.points) {
          const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
          expect(Math.abs(cross) / Math.hypot(b.x - a.x, b.y - a.y), e.id).toBeLessThan(1e-6);
        }
      }
    });
  }
});

describe('groupBounds', () => {
  it('bounds a box by its own rect', () => {
    expect(groupBounds({ kind: 'box', titleSide: 'top', id: 'g', x: 10, y: 20, width: 40, height: 30, title: { x: 0, y: 0 } })).toEqual({
      minX: -10,
      minY: 5,
      maxX: 30,
      maxY: 35,
    });
  });

  it('bounds a band by its outline', () => {
    const b = groupBounds({
      kind: 'band',
      id: 'g',
      center: { x: 0, y: 0 },
      innerRadius: 50,
      outerRadius: 100,
      startAngle: 0,
      endAngle: Math.PI,
      title: { x: 0, y: 0 },
      outline: [{ x: 100, y: 0 }, { x: 0, y: 100 }, { x: -100, y: 0 }, { x: -50, y: 0 }, { x: 0, y: 50 }, { x: 50, y: 0 }],
    });
    expect(b).toEqual({ minX: -100, minY: 0, maxX: 100, maxY: 100 });
  });
});

describe('outlinePath', () => {
  it('draws a closed path through the outline, moved and rounded to 0.01px', () => {
    const d = outlinePath([{ x: 0, y: 0 }, { x: 10.123, y: -0.001 }, { x: 5, y: 8 }], 2, 3);
    expect(d).toBe('M2,3L12.12,3L7,11Z');
  });
});
