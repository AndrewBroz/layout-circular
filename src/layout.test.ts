import { describe, expect, it } from 'vitest';
import { circularLayout } from './layout.js';
import type { LayoutEdgeInput, LayoutNodeInput } from './layout.js';

const box = (id: string, width = 80, height = 40): LayoutNodeInput => ({ id, width, height });

const edge = (start: string, end: string): LayoutEdgeInput => ({
  id: `${start}-${end}`,
  start,
  end,
});

const cycle = (...ids: string[]): LayoutEdgeInput[] =>
  ids.map((id, i) => edge(id, ids[(i + 1) % ids.length]!));

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

/** Largest distance of any path point from the line through its ends. */
const bend = (points: { x: number; y: number }[]): number => {
  const a = points[0]!;
  const b = points[points.length - 1]!;
  const len = dist(a, b);
  return Math.max(
    ...points.map((p) => Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / len)
  );
};

/** Unit direction from a path's first point to its last. */
const heading = (points: { x: number; y: number }[]) => {
  const a = points[0]!;
  const b = points[points.length - 1]!;
  return { x: (b.x - a.x) / dist(a, b), y: (b.y - a.y) / dist(a, b) };
};

/** On the border of an 80×40 box centered at n, within eps. */
const onBoxBorder = (
  p: { x: number; y: number },
  n: { x: number; y: number },
  eps = 0.01
) => {
  const dx = Math.abs(p.x - n.x);
  const dy = Math.abs(p.y - n.y);
  return (
    (Math.abs(dx - 40) < eps && dy <= 20 + eps) || (Math.abs(dy - 20) < eps && dx <= 40 + eps)
  );
};

describe('placement', () => {
  it('puts every node at the same distance from the origin', () => {
    const { nodes, radius } = circularLayout(
      ['A', 'B', 'C', 'D', 'E'].map((id) => box(id)),
      cycle('A', 'B', 'C', 'D', 'E')
    );
    expect(nodes).toHaveLength(5);
    for (const n of nodes) {
      expect(Math.hypot(n.x, n.y)).toBeCloseTo(radius, 6);
    }
  });

  it('never lets two boxes touch, whatever their sizes', () => {
    const sized = [
      box('A', 200, 60),
      box('B', 40, 40),
      box('C', 120, 50),
      box('D', 40, 40),
      box('E', 90, 45),
    ];
    const { nodes } = circularLayout(sized, cycle('A', 'B', 'C', 'D', 'E'));
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const sizeOf = new Map(sized.map((n) => [n.id, n]));
    for (let i = 0; i < sized.length; i++) {
      for (let j = i + 1; j < sized.length; j++) {
        const p = byId.get(sized[i]!.id)!;
        const q = byId.get(sized[j]!.id)!;
        const overlapX =
          Math.abs(p.x - q.x) < (sizeOf.get(sized[i]!.id)!.width + sizeOf.get(sized[j]!.id)!.width) / 2;
        const overlapY =
          Math.abs(p.y - q.y) <
          (sizeOf.get(sized[i]!.id)!.height + sizeOf.get(sized[j]!.id)!.height) / 2;
        expect(overlapX && overlapY, `${sized[i]!.id} overlaps ${sized[j]!.id}`).toBe(false);
      }
    }
  });

  it('mirrors side pairs at identical heights, first node centered on top', () => {
    const { nodes, order } = circularLayout(
      ['A', 'B', 'C', 'D', 'E'].map((id) => box(id)),
      cycle('A', 'B', 'C', 'D', 'E')
    );
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const top = byId.get(order[0]!)!;
    expect(top.x).toBeCloseTo(0, 6);
    expect(top.y).toBeLessThan(0);
    // order[1]/order[4] and order[2]/order[3] are mirror pairs.
    expect(byId.get(order[1]!)!.y).toBeCloseTo(byId.get(order[4]!)!.y, 6);
    expect(byId.get(order[1]!)!.x).toBeCloseTo(-byId.get(order[4]!)!.x, 6);
    expect(byId.get(order[2]!)!.y).toBeCloseTo(byId.get(order[3]!)!.y, 6);
    expect(byId.get(order[2]!)!.x).toBeCloseTo(-byId.get(order[3]!)!.x, 6);
  });

  it('separates adjacent boxes along the line between them, plus real daylight on the rim', () => {
    const spacing = 30;
    const sized = [box('A', 200, 60), box('B', 40, 40), box('C', 120, 50), box('D', 40, 40)];
    const { nodes: placed, order } = circularLayout(sized, cycle('A', 'B', 'C', 'D'), {
      spacing,
    });
    const byId = new Map(placed.map((n) => [n.id, n]));
    const sizeOf = new Map(sized.map((n) => [n.id, n]));
    for (let i = 0; i < order.length; i++) {
      const here = byId.get(order[i]!)!;
      const next = byId.get(order[(i + 1) % order.length]!)!;
      const a = sizeOf.get(order[i]!)!;
      const b = sizeOf.get(order[(i + 1) % order.length]!)!;
      const d = dist(here, next);
      const dir = { x: (next.x - here.x) / d, y: (next.y - here.y) / d };
      const support =
        (Math.abs(dir.x) * a.width + Math.abs(dir.y) * a.height) / 2 +
        (Math.abs(dir.x) * b.width + Math.abs(dir.y) * b.height) / 2;
      expect(d, `${order[i]} to ${order[(i + 1) % order.length]}`).toBeGreaterThan(support);
    }
  });

  it('gives one node the center and two nodes an opposed pair', () => {
    const one = circularLayout([box('A')], []);
    expect(one.nodes[0]!.x).toBeCloseTo(0, 6);
    expect(one.nodes[0]!.y).toBeCloseTo(0, 6);

    const two = circularLayout([box('A'), box('B')], [edge('A', 'B')]);
    const [a, b] = two.nodes;
    expect(a!.x).toBeCloseTo(-b!.x, 6);
    expect(a!.y).toBeCloseTo(-b!.y, 6);
  });

  it('places every node even when the graph is not a cycle', () => {
    const { nodes } = circularLayout(
      ['A', 'B', 'C', 'lone'].map((id) => box(id)),
      [edge('A', 'B')]
    );
    expect(new Set(nodes.map((n) => n.id))).toEqual(new Set(['A', 'B', 'C', 'lone']));
  });
});

const tangentialExtent = (w: number, h: number, angle: number) =>
  (Math.abs(Math.sin(angle)) * w) / 2 + (Math.abs(Math.cos(angle)) * h) / 2;

describe('uniform gaps', () => {
  it('equalizes the visible arrows: free arcs between wide boxes stay within a fifth of each other', () => {
    // The water-cycle shape that showed a stubby bottom arrow: five
    // wide boxes whose tangential claims differ by position.
    const ids = ['A', 'B', 'C', 'D', 'E'];
    const { nodes, order, radius } = circularLayout(
      ids.map((id) => box(id, 150, 50)),
      cycle(...ids)
    );
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const gaps: number[] = [];
    for (let i = 0; i < order.length; i++) {
      const here = byId.get(order[i]!)!;
      const next = byId.get(order[(i + 1) % order.length]!)!;
      let delta = next.angle - here.angle;
      while (delta <= 0) {
        delta += 2 * Math.PI;
      }
      gaps.push(
        radius * delta -
          tangentialExtent(150, 50, here.angle) -
          tangentialExtent(150, 50, next.angle)
      );
    }
    const widest = Math.max(...gaps);
    const slimmest = Math.min(...gaps);
    expect(slimmest).toBeGreaterThan(0);
    expect(widest / slimmest).toBeLessThan(1.2);
  });

  it('still mirrors side pairs after equalization', () => {
    const { nodes, order } = circularLayout(
      ['A', 'B', 'C', 'D', 'E'].map((id) => box(id, 150, 50)),
      cycle('A', 'B', 'C', 'D', 'E')
    );
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const top = byId.get(order[0]!)!;
    expect(top.x).toBeCloseTo(0, 4);
    expect(byId.get(order[1]!)!.y).toBeCloseTo(byId.get(order[4]!)!.y, 4);
    expect(byId.get(order[1]!)!.x).toBeCloseTo(-byId.get(order[4]!)!.x, 4);
    expect(byId.get(order[2]!)!.y).toBeCloseTo(byId.get(order[3]!)!.y, 4);
    expect(byId.get(order[2]!)!.x).toBeCloseTo(-byId.get(order[3]!)!.x, 4);
  });
});

describe('shape-aware extents', () => {
  const circle = (id: string, d = 60): LayoutNodeInput => ({
    id,
    width: d,
    height: d,
    shape: 'ellipse',
  });

  it('spaces equal circles at exactly equal angles — a circle claims the same from every seat', () => {
    const ids = ['A', 'B', 'C', 'D', 'E'];
    const { nodes, order } = circularLayout(
      ids.map((id) => circle(id)),
      cycle(...ids)
    );
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const angles = order.map((id) => {
      const n = byId.get(id)!;
      return Math.atan2(n.y, n.x);
    });
    for (let i = 0; i < angles.length; i++) {
      let d = angles[(i + 1) % angles.length]! - angles[i]!;
      while (d <= 0) {
        d += 2 * Math.PI;
      }
      expect(d).toBeCloseTo((2 * Math.PI) / ids.length, 6);
    }
  });

  it('solves a tighter ring for circles than for boxes of the same bounding size', () => {
    const ids = ['A', 'B', 'C', 'D', 'E'];
    const asBoxes = circularLayout(ids.map((id) => box(id, 60, 60)), cycle(...ids));
    const asCircles = circularLayout(ids.map((id) => circle(id)), cycle(...ids));
    // A 60px circle's worst-case reach is 30px; the box corner's is
    // 30·√2. The three-ring gap equation feels the difference.
    expect(asCircles.radius).toBeLessThan(asBoxes.radius);
  });

  it('keeps true circle borders apart, not just bounding boxes', () => {
    const sized = [circle('A', 120), circle('B', 40), circle('C', 90), circle('D', 40)];
    const spacing = 30;
    const { nodes } = circularLayout(sized, cycle('A', 'B', 'C', 'D'), { spacing });
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const sizeOf = new Map(sized.map((n) => [n.id, n.width]));
    for (let i = 0; i < sized.length; i++) {
      for (let j = i + 1; j < sized.length; j++) {
        const p = byId.get(sized[i]!.id)!;
        const q = byId.get(sized[j]!.id)!;
        const clearance =
          dist(p, q) - sizeOf.get(sized[i]!.id)! / 2 - sizeOf.get(sized[j]!.id)! / 2;
        expect(clearance, `${sized[i]!.id} vs ${sized[j]!.id}`).toBeGreaterThan(0);
      }
    }
  });

  it('lands arrows on the true edges of diamonds and stadiums too', () => {
    const diamond = (id: string): LayoutNodeInput => ({
      id,
      width: 80,
      height: 80,
      shape: 'diamond',
    });
    const { edges, nodes } = circularLayout(
      ['A', 'B', 'C', 'D'].map((id) => diamond(id)),
      cycle('A', 'B', 'C', 'D')
    );
    const byId = new Map(nodes.map((n) => [n.id, n]));
    for (const e of edges) {
      const first = e.points[0]!;
      const last = e.points[e.points.length - 1]!;
      for (const [p, id] of [
        [first, e.start],
        [last, e.end],
      ] as const) {
        const n = byId.get(id)!;
        // On the rhombus edge: |dx|/(w/2) + |dy|/(h/2) = 1.
        const level = Math.abs(p.x - n.x) / 40 + Math.abs(p.y - n.y) / 40;
        expect(level, `${e.id} endpoint on diamond edge`).toBeCloseTo(1, 2);
      }
    }
  });

  it('hangs a spur off a circle at the circle distance, not the corner distance', () => {
    // A ring of circles with one leaf: the leaf's parent claims its
    // radial extent as a circle (d/2), so the leaf sits nearer than
    // the box math would put it, but still clear of the border.
    const ids = ['A', 'B', 'C'];
    const spacing = 40;
    const { nodes, radius } = circularLayout(
      [...ids.map((id) => circle(id, 60)), circle('Leaf', 60)],
      [...cycle(...ids), edge('A', 'Leaf')],
      { spacing }
    );
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const leaf = byId.get('Leaf')!;
    const a = byId.get('A')!;
    const clearance = dist(leaf, a) - 60;
    expect(clearance).toBeGreaterThan(0);
    // The box model reserved parent corner + child corner ≈ 30·√2·2;
    // the circle model needs only 60 + breathing room. The leaf must
    // sit within the circle-model band, proving the box slack is gone.
    expect(Math.hypot(leaf.x, leaf.y)).toBeLessThan(radius + 30 + spacing * 0.8 + 30 + 1);
  });
});

describe('spurs', () => {
  const ring = cycle('A', 'B', 'C', 'D');
  const spurEdges = [
    ...ring,
    edge('Sun', 'A'), // an input spur
    edge('C', 'Flood'), // an output spur
    edge('Flood', 'Damage'), // depth two
  ];
  const spurNodes = ['A', 'B', 'C', 'D', 'Sun', 'Flood', 'Damage'].map((id) => box(id));

  it('keeps only the cycle on the rim', () => {
    const { order } = circularLayout(spurNodes, spurEdges);
    expect(new Set(order)).toEqual(new Set(['A', 'B', 'C', 'D']));
  });

  it('hangs each spur outside the ring, near its attachment', () => {
    const { nodes, radius } = circularLayout(spurNodes, spurEdges);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const a = byId.get('A')!;
    const sun = byId.get('Sun')!;
    const flood = byId.get('Flood')!;
    const damage = byId.get('Damage')!;
    expect(Math.hypot(sun.x, sun.y)).toBeGreaterThan(radius);
    expect(Math.hypot(flood.x, flood.y)).toBeGreaterThan(radius);
    // Depth two reaches further out than depth one.
    expect(Math.hypot(damage.x, damage.y)).toBeGreaterThan(Math.hypot(flood.x, flood.y));
    // The spur stays in its parent's neighborhood.
    const angleGap = Math.abs(Math.atan2(sun.y, sun.x) - Math.atan2(a.y, a.x));
    expect(Math.min(angleGap, 2 * Math.PI - angleGap)).toBeLessThan(Math.PI / 3);
  });

  it('routes spur edges border to border with clean terminal segments', () => {
    const { edges, nodes } = circularLayout(spurNodes, spurEdges);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const spurEdge = edges.find((e) => e.id === 'Sun-A')!;
    expect(spurEdge.points.length).toBeGreaterThanOrEqual(3);
    const first = spurEdge.points[0]!;
    const last = spurEdge.points[spurEdge.points.length - 1]!;
    expect(onBoxBorder(first, byId.get('Sun')!), 'starts on Sun border').toBe(true);
    expect(onBoxBorder(last, byId.get('A')!), 'ends on A border').toBe(true);
    // The default 10px tail outreaches marker handling within ~5px of
    // each end.
    expect(dist(first, spurEdge.points[1]!)).toBeGreaterThan(6);
    expect(dist(last, spurEdge.points[spurEdge.points.length - 2]!)).toBeGreaterThan(6);
  });

  it('keeps everything on the ring when the graph has no cycle', () => {
    const { order } = circularLayout(
      ['A', 'B', 'C', 'D'].map((id) => box(id)),
      [edge('A', 'B'), edge('B', 'C'), edge('C', 'D')]
    );
    expect(order).toHaveLength(4);
  });
});

describe('labeled spurs', () => {
  it('widens a spur gap to hold its label', () => {
    const ids = ['Earth', 'Fire', 'Water'];
    const { nodes } = circularLayout(
      [...ids, 'Lava', 'Plasma', 'Vapor'].map((id) => box(id, 70, 40)),
      [
        ...cycle(...ids),
        { id: 'l1', start: 'Earth', end: 'Lava', labelWidth: 120, labelHeight: 24 },
        { id: 'l2', start: 'Fire', end: 'Plasma', labelWidth: 90, labelHeight: 24 },
        { id: 'l3', start: 'Water', end: 'Vapor', labelWidth: 80, labelHeight: 24 },
      ]
    );
    const byId = new Map(nodes.map((n) => [n.id, n]));
    for (const [parent, kid, w] of [
      ['Earth', 'Lava', 120],
      ['Fire', 'Plasma', 90],
      ['Water', 'Vapor', 80],
    ] as const) {
      const p = byId.get(parent)!;
      const q = byId.get(kid)!;
      // Daylight between the two borders along the spur direction
      // must hold the label's projection onto that direction, plus
      // breathing room.
      const d = dist(p, q);
      const dir = { x: (q.x - p.x) / d, y: (q.y - p.y) / d };
      const borders =
        (Math.abs(dir.x) * 70 + Math.abs(dir.y) * 40) / 2 +
        (Math.abs(dir.x) * 70 + Math.abs(dir.y) * 40) / 2;
      const need = Math.abs(dir.x) * w + Math.abs(dir.y) * 24 + 24;
      expect(d - borders, `${parent}->${kid} daylight`).toBeGreaterThanOrEqual(need - 1e-6);
    }
  });

  it('separates opposite spur siblings into distinct curves', () => {
    // Two spokes between the hub and one ring member must not draw
    // as one line: the sideways spread has to live in a canonical
    // pair frame, not each edge's own travel frame.
    const spokes = ['A', 'B', 'C', 'D', 'E', 'F'];
    const { edges, nodes } = circularLayout(
      ['Hub', ...spokes].map((id) => box(id)),
      [...spokes.map((id) => edge('Hub', id)), { id: 'back', start: 'A', end: 'Hub' }]
    );
    const a = nodes.find((n) => n.id === 'A')!;
    const axis = unit({ x: a.x, y: a.y });
    // Signed sideways offset of a path's midpoint from the Hub–A axis.
    const sideOf = (e: (typeof edges)[number]) => {
      const mid = e.points[Math.floor(e.points.length / 2)]!;
      return mid.x * -axis.y + mid.y * axis.x;
    };
    const there = sideOf(edges.find((e) => e.id === 'Hub-A')!);
    const back = sideOf(edges.find((e) => e.id === 'back')!);
    expect(Math.abs(there - back)).toBeGreaterThan(8);
    expect(there * back, 'the two spokes bow to opposite sides').toBeLessThan(0);
  });
});

const unit = (v: { x: number; y: number }) => {
  const len = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / len, y: v.y / len };
};

describe('pendant two-cycles', () => {
  const ring = ['Earth', 'Fire', 'Water'];
  const pendant = [
    ...cycle(...ring),
    edge('Earth', 'Lava'),
    { id: 'back', start: 'Lava', end: 'Earth' },
  ];

  it('draws a pendant two-cycle as a tangent satellite lens, not a flattened spur', () => {
    const { satellites, order, nodes, radius } = circularLayout(
      [...ring, 'Lava'].map((id) => box(id)),
      pendant
    );
    expect(new Set(order)).toEqual(new Set(ring));
    expect(satellites).toHaveLength(1);
    const sat = satellites![0]!;
    expect(sat.anchor).toBe('Earth');
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const earth = byId.get('Earth')!;
    const lava = byId.get('Lava')!;
    // Both nodes ride the lens circle; Lava sits outside the main ring.
    expect(dist(earth, sat.center)).toBeCloseTo(sat.radius, 4);
    expect(dist(lava, sat.center)).toBeCloseTo(sat.radius, 4);
    expect(Math.hypot(lava.x, lava.y)).toBeGreaterThan(radius);
  });

  it('keeps the two lens arcs apart, one on each side', () => {
    const { edges } = circularLayout([...ring, 'Lava'].map((id) => box(id)), pendant);
    const midOf = (e: (typeof edges)[number]) => e.points[Math.floor(e.points.length / 2)]!;
    const there = midOf(edges.find((e) => e.id === 'Earth-Lava')!);
    const back = midOf(edges.find((e) => e.id === 'back')!);
    expect(dist(there, back)).toBeGreaterThan(20);
  });

  it('leaves a single pendant edge alone: still a plain spur', () => {
    const { satellites, nodes, radius } = circularLayout(
      [...ring, 'Lava'].map((id) => box(id)),
      [...cycle(...ring), edge('Earth', 'Lava')]
    );
    expect(satellites ?? []).toHaveLength(0);
    const lava = nodes.find((n) => n.id === 'Lava')!;
    expect(Math.hypot(lava.x, lava.y)).toBeGreaterThan(radius);
  });
});

describe('option hygiene', () => {
  it('ignores an explicitly undefined option instead of clobbering the default', () => {
    const { radius, nodes } = circularLayout(
      ['A', 'B', 'C'].map((id) => box(id)),
      cycle('A', 'B', 'C'),
      { spacing: undefined }
    );
    expect(Number.isFinite(radius)).toBe(true);
    for (const n of nodes) {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
    }
  });
});

describe('retired options', () => {
  it('has no bow or swerve: chords no longer bend, so neither changes the output', () => {
    const ids = ['A', 'B', 'C', 'D', 'E', 'F'];
    const nodes = ids.map((id) => box(id));
    const edges = [...cycle(...ids), edge('A', 'C'), edge('A', 'D'), edge('D', 'A')];
    const plain = circularLayout(nodes, edges);
    // @ts-expect-error bow was removed in 0.2.0
    expect(circularLayout(nodes, edges, { bow: 0.8 })).toEqual(plain);
    // @ts-expect-error swerve was removed in 0.2.0
    expect(circularLayout(nodes, edges, { swerve: 0.5 })).toEqual(plain);
  });
});

describe('hub and spoke', () => {
  const spokes = ['A', 'B', 'C', 'D', 'E', 'F'];
  const starEdges = spokes.map((id) => edge('Hub', id));
  const wheelEdges = [...cycle(...spokes), ...spokes.map((id) => edge(id, 'Hub'))];
  const starNodes = ['Hub', ...spokes].map((id) => box(id));

  it('pulls the center of a star into the middle and rings the spokes', () => {
    const { nodes, radius, hub, order } = circularLayout(starNodes, starEdges);
    expect(hub).toBe('Hub');
    expect(order).not.toContain('Hub');
    const byId = new Map(nodes.map((n) => [n.id, n]));
    expect(byId.get('Hub')!.x).toBeCloseTo(0, 6);
    expect(byId.get('Hub')!.y).toBeCloseTo(0, 6);
    for (const id of spokes) {
      expect(Math.hypot(byId.get(id)!.x, byId.get(id)!.y), id).toBeCloseTo(radius, 6);
    }
  });

  it('centers the axle of a wheel and keeps the ring a ring', () => {
    const { nodes, radius, hub, order } = circularLayout(
      ['Hub', ...spokes].map((id) => box(id)),
      wheelEdges
    );
    expect(hub).toBe('Hub');
    expect(new Set(order)).toEqual(new Set(spokes));
    const byId = new Map(nodes.map((n) => [n.id, n]));
    expect(Math.hypot(byId.get('Hub')!.x, byId.get('Hub')!.y)).toBeCloseTo(0, 6);
    for (const id of spokes) {
      expect(Math.hypot(byId.get(id)!.x, byId.get(id)!.y), id).toBeCloseTo(radius, 6);
    }
  });

  it('routes every spoke straight, border to border, well clear of both boxes', () => {
    const { edges: routed, radius } = circularLayout(starNodes, starEdges);
    for (const e of routed) {
      expect(e.points.length).toBeGreaterThanOrEqual(3);
      const first = e.points[0]!;
      const last = e.points[e.points.length - 1]!;
      // Leaves the hub's border, not its center; arrives at the ring, not beyond.
      expect(Math.hypot(first.x, first.y)).toBeGreaterThan(10);
      expect(Math.hypot(last.x, last.y)).toBeLessThan(radius);
      // Straight: every point sits on the segment from first to last.
      const len = Math.hypot(last.x - first.x, last.y - first.y);
      for (const p of e.points) {
        const cross =
          ((last.x - first.x) * (p.y - first.y) - (last.y - first.y) * (p.x - first.x)) / len;
        expect(Math.abs(cross)).toBeLessThan(0.5);
      }
    }
  });

  it('grows the radius until the spokes have daylight past a huge hub', () => {
    const bigHub = [box('Hub', 400, 120), ...spokes.map((id) => box(id))];
    const { nodes, radius } = circularLayout(bigHub, starEdges, { spacing: 30 });
    const byId = new Map(nodes.map((n) => [n.id, n]));
    for (const id of spokes) {
      const p = byId.get(id)!;
      const dir = { x: p.x / radius, y: p.y / radius };
      const need =
        (Math.abs(dir.x) * (400 + 80)) / 2 + (Math.abs(dir.y) * (120 + 40)) / 2 + 30;
      expect(Math.hypot(p.x, p.y), id).toBeGreaterThanOrEqual(need - 1e-6);
    }
  });

  it('never mistakes a path, a plain ring, or a ring with a few chords for a hub', () => {
    const path = circularLayout(
      ['A', 'B', 'C'].map((id) => box(id)),
      [edge('A', 'B'), edge('B', 'C')]
    );
    expect(path.hub).toBeUndefined();

    const ring = circularLayout(spokes.map((id) => box(id)), cycle(...spokes));
    expect(ring.hub).toBeUndefined();

    // A busy ring member with two shortcuts is still a ring member —
    // it does not reach everyone.
    const chorded = circularLayout(
      spokes.map((id) => box(id)),
      [...cycle(...spokes), edge('A', 'C'), edge('A', 'E')]
    );
    expect(chorded.hub).toBeUndefined();
  });

  describe('the dominant fan — spokes have special status', () => {
    const elements = ['Earth', 'Fire', 'Wind', 'Water', 'Heart'];
    const planetNodes = ['P', ...elements].map((id) => box(id));
    const planetSpokes = elements.map((id) => edge(id, 'P'));
    const planetRing = [
      edge('Heart', 'Wind'),
      edge('Heart', 'Earth'),
      edge('Earth', 'Fire'),
      edge('Fire', 'Water'),
      edge('Water', 'Wind'),
    ];

    it('centers the full wheel', () => {
      const { hub } = circularLayout(planetNodes, [...planetSpokes, ...planetRing]);
      expect(hub).toBe('P');
    });

    it('keeps the axle when a rim arc goes missing', () => {
      const { hub, nodes, order } = circularLayout(planetNodes, [
        ...planetSpokes,
        ...planetRing.slice(0, 4),
      ]);
      expect(hub).toBe('P');
      expect(new Set(order)).toEqual(new Set(elements));
      const p = nodes.find((n) => n.id === 'P')!;
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(0, 6);
    });

    it('keeps the axle when two rim arcs go missing', () => {
      const { hub } = circularLayout(planetNodes, [
        ...planetSpokes,
        ...planetRing.slice(0, 3),
      ]);
      expect(hub).toBe('P');
    });

    it('keeps the axle when one spoke goes missing but the rim is whole', () => {
      const { hub } = circularLayout(planetNodes, [
        ...planetSpokes.slice(0, 4),
        ...planetRing,
      ]);
      expect(hub).toBe('P');
    });

    it('keeps the axle when a gear meshes off a rim member', () => {
      const { hub, satellites, nodes, order, radius } = circularLayout(
        [...planetNodes, box('Vapor'), box('Ice')],
        [
          ...planetSpokes,
          ...planetRing,
          edge('Water', 'Vapor'),
          edge('Vapor', 'Ice'),
          edge('Ice', 'Water'),
        ]
      );
      expect(hub).toBe('P');
      expect(new Set(order)).toEqual(new Set(elements));
      expect(satellites).toHaveLength(1);
      expect(satellites![0]!.anchor).toBe('Water');
      const byId = new Map(nodes.map((n) => [n.id, n]));
      expect(Math.hypot(byId.get('P')!.x, byId.get('P')!.y)).toBeCloseTo(0, 6);
      for (const id of ['Vapor', 'Ice']) {
        expect(Math.hypot(byId.get(id)!.x, byId.get(id)!.y), id).toBeGreaterThan(radius);
      }
    });

    const gearAndLava = [
      edge('Water', 'Vapor'),
      edge('Vapor', 'Ice'),
      edge('Ice', 'Water'),
      edge('Earth', 'Lava'),
    ];
    const fullNodes = [...planetNodes, box('Vapor'), box('Ice'), box('Lava')];

    it('hangs a leaf off a rim member while the axle holds and the gear meshes', () => {
      const { hub, satellites, nodes, order, radius } = circularLayout(fullNodes, [
        ...planetSpokes,
        ...planetRing,
        ...gearAndLava,
      ]);
      expect(hub).toBe('P');
      expect(new Set(order)).toEqual(new Set(elements));
      expect(satellites![0]!.anchor).toBe('Water');
      const lava = nodes.find((n) => n.id === 'Lava')!;
      expect(Math.hypot(lava.x, lava.y)).toBeGreaterThan(radius);
    });

    it("seats a spoke with no rim arcs on the ring anyway — it is the hub's, not the origin's", () => {
      // Earth keeps only its spoke and its leaf: the peel hangs it
      // off the hub, but a spoke belongs on the ring.
      const { hub, satellites, nodes, order, radius } = circularLayout(fullNodes, [
        ...planetSpokes,
        edge('Water', 'Heart'),
        edge('Fire', 'Wind'),
        edge('Wind', 'Water'),
        ...gearAndLava,
      ]);
      expect(hub).toBe('P');
      expect(satellites![0]!.anchor).toBe('Water');
      expect(new Set(order)).toEqual(new Set(elements));
      const byId = new Map(nodes.map((n) => [n.id, n]));
      expect(Math.hypot(byId.get('Earth')!.x, byId.get('Earth')!.y)).toBeCloseTo(radius, 6);
      expect(Math.hypot(byId.get('Lava')!.x, byId.get('Lava')!.y)).toBeGreaterThan(radius);
      // Nothing but the hub may sit at the center.
      for (const n of nodes) {
        if (n.id !== 'P') {
          expect(Math.hypot(n.x, n.y), `${n.id} escaped the origin`).toBeGreaterThan(1);
        }
      }
    });

    it('declines the truly ambiguous case: a spoke and a rim arc both gone', () => {
      const { hub } = circularLayout(planetNodes, [
        ...planetSpokes.slice(0, 4),
        ...planetRing.slice(0, 4),
      ]);
      expect(hub).toBeUndefined();
    });
  });

  it('leaves the Krebs shape alone: ring plus spurs is not a wheel', () => {
    const { hub, order } = circularLayout(
      [...spokes, 'In', 'Out'].map((id) => box(id)),
      [...cycle(...spokes), edge('In', 'A'), edge('C', 'Out')]
    );
    expect(hub).toBeUndefined();
    expect(new Set(order)).toEqual(new Set(spokes));
  });

  it("honors hub: 'none' and an explicit hub id", () => {
    const off = circularLayout(starNodes, starEdges, { hub: 'none' });
    expect(off.hub).toBeUndefined();

    const forced = circularLayout(
      ['A', 'B', 'C'].map((id) => box(id)),
      [edge('A', 'B'), edge('B', 'C')],
      { hub: 'B' }
    );
    expect(forced.hub).toBe('B');
    const b = forced.nodes.find((n) => n.id === 'B')!;
    expect(Math.hypot(b.x, b.y)).toBeCloseTo(0, 6);
  });

  it('hangs deeper branches of a star outward, beyond the ring', () => {
    const { nodes, radius, hub } = circularLayout(
      ['Hub', ...spokes, 'Leaf'].map((id) => box(id)),
      [...starEdges, edge('B', 'Leaf')]
    );
    expect(hub).toBe('Hub');
    const leaf = nodes.find((n) => n.id === 'Leaf')!;
    expect(Math.hypot(leaf.x, leaf.y)).toBeGreaterThan(radius);
  });

  it('keeps the hub pinned at the origin through the ccw mirror', () => {
    const { nodes, hub } = circularLayout(starNodes, starEdges, {
      direction: 'counterclockwise',
    });
    expect(hub).toBe('Hub');
    const center = nodes.find((n) => n.id === 'Hub')!;
    expect(center.x).toBeCloseTo(0, 6);
    expect(center.y).toBeCloseTo(0, 6);
  });
});

describe('subgraph contiguity', () => {
  const ids = ['A', 'B', 'C', 'D', 'E'];
  const grouped = (id: string, group?: string): LayoutNodeInput => ({ ...box(id), group });

  const adjacentInOrder = (order: string[], a: string, b: string) => {
    const i = order.indexOf(a);
    const j = order.indexOf(b);
    const gap = Math.abs(i - j);
    return Math.min(gap, order.length - gap) === 1;
  };

  it('seats a subgraph side by side even when the cycle scatters its members', () => {
    const { order } = circularLayout(
      ids.map((id) => grouped(id, id === 'B' || id === 'D' ? 'g' : undefined)),
      cycle(...ids)
    );
    expect(adjacentInOrder(order, 'B', 'D'), order.join(',')).toBe(true);
  });

  it('costs nothing when the members already sit together', () => {
    const plain = circularLayout(ids.map((id) => box(id)), cycle(...ids));
    const boxed = circularLayout(
      ids.map((id) => grouped(id, id === 'B' || id === 'C' ? 'g' : undefined)),
      cycle(...ids)
    );
    expect(adjacentInOrder(boxed.order, 'B', 'C')).toBe(true);
    // Every cycle edge still joins rim neighbors, exactly as ungrouped.
    for (const e of cycle(...ids)) {
      expect(adjacentInOrder(boxed.order, e.start, e.end), e.id).toBe(true);
    }
    expect(new Set(boxed.order)).toEqual(new Set(plain.order));
  });

  it('keeps the run reading forward through the group', () => {
    // Group C,D in a five-cycle: entry from B must land on C, so the
    // written run B → C → D → E survives as rim neighbors.
    const { order } = circularLayout(
      ids.map((id) => grouped(id, id === 'C' || id === 'D' ? 'g' : undefined)),
      cycle(...ids)
    );
    for (const e of cycle(...ids)) {
      expect(adjacentInOrder(order, e.start, e.end), e.id).toBe(true);
    }
  });

  it('widens the ring to make room for the box walls', () => {
    const plain = circularLayout(ids.map((id) => box(id)), cycle(...ids));
    const boxed = circularLayout(
      ids.map((id) => grouped(id, id === 'B' || id === 'C' ? 'g' : undefined)),
      cycle(...ids)
    );
    expect(boxed.radius).toBeGreaterThan(plain.radius);
  });

  it('groups ride into satellites untouched', () => {
    const { satellites, order } = circularLayout(
      [...ids, 'X', 'Y', 'Z'].map((id) =>
        grouped(id, ['X', 'Y', 'Z'].includes(id) ? 'sat' : undefined)
      ),
      [...cycle(...ids), edge('C', 'X'), ...cycle('X', 'Y', 'Z')]
    );
    expect(new Set(order)).toEqual(new Set(ids));
    expect(satellites).toHaveLength(1);
    expect(new Set(satellites![0]!.members)).toEqual(new Set(['X', 'Y', 'Z']));
  });
});

describe('satellite rings', () => {
  const ring = ['A', 'B', 'C', 'D', 'E'];
  const bridge = {
    nodes: [...ring, 'X', 'Y', 'Z'].map((id) => box(id)),
    edges: [...cycle(...ring), edge('C', 'X'), ...cycle('X', 'Y', 'Z')],
  };
  const eight = {
    nodes: [...ring, 'X', 'Y'].map((id) => box(id)),
    edges: [...cycle(...ring), edge('C', 'X'), edge('X', 'Y'), edge('Y', 'C')],
  };

  it('keeps the main cycle a true ring when a pendant cycle hangs off a bridge', () => {
    const { nodes, radius, order, satellites } = circularLayout(bridge.nodes, bridge.edges);
    expect(new Set(order)).toEqual(new Set(ring));
    const byId = new Map(nodes.map((n) => [n.id, n]));
    for (const id of ring) {
      expect(Math.hypot(byId.get(id)!.x, byId.get(id)!.y), id).toBeCloseTo(radius, 6);
    }
    expect(satellites).toHaveLength(1);
    expect(satellites![0]!.anchor).toBe('C');
    expect(new Set(satellites![0]!.members)).toEqual(new Set(['X', 'Y', 'Z']));
  });

  it('draws the pendant as its own circle, wholly outside the main ring', () => {
    const { nodes, radius, satellites } = circularLayout(bridge.nodes, bridge.edges);
    const sat = satellites![0]!;
    const byId = new Map(nodes.map((n) => [n.id, n]));
    for (const id of ['X', 'Y', 'Z']) {
      const n = byId.get(id)!;
      expect(dist(n, sat.center), `${id} on satellite circle`).toBeCloseTo(sat.radius, 4);
      expect(Math.hypot(n.x, n.y), `${id} outside main ring`).toBeGreaterThan(radius);
    }
  });

  it('meets the figure-eight at the shared node: both circles pass exactly through C', () => {
    const { nodes, radius, satellites } = circularLayout(eight.nodes, eight.edges);
    expect(satellites).toHaveLength(1);
    const sat = satellites![0]!;
    expect(sat.anchor).toBe('C');
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const c = byId.get('C')!;
    expect(Math.hypot(c.x, c.y)).toBeCloseTo(radius, 6);
    expect(dist(c, sat.center)).toBeCloseTo(sat.radius, 4);
    for (const id of ['X', 'Y']) {
      const n = byId.get(id)!;
      expect(dist(n, sat.center), id).toBeCloseTo(sat.radius, 4);
      expect(Math.hypot(n.x, n.y), id).toBeGreaterThan(radius);
    }
    // Tangency: the satellite's center lies on the ray from the origin
    // through C, one satellite-radius beyond the rim.
    const cross = c.x * sat.center.y - c.y * sat.center.x;
    expect(Math.abs(cross) / (radius * Math.hypot(sat.center.x, sat.center.y))).toBeLessThan(1e-4);
    expect(Math.hypot(sat.center.x, sat.center.y)).toBeCloseTo(radius + sat.radius, 4);
  });

  it('gives the middle to the bigger cycle, whatever the writing order', () => {
    const { order, satellites } = circularLayout(
      bridge.nodes,
      [...cycle('X', 'Y', 'Z'), edge('C', 'X'), ...cycle(...ring)]
    );
    expect(new Set(order)).toEqual(new Set(ring));
    expect(satellites![0]!.anchor).toBe('C');
  });

  it('reaches a circle off a circle off a circle', () => {
    const ids = [...ring, 'X', 'Y', 'Z', 'U', 'V', 'W'];
    const { nodes, satellites } = circularLayout(
      ids.map((id) => box(id)),
      [
        ...cycle(...ring),
        edge('C', 'X'),
        ...cycle('X', 'Y', 'Z'),
        edge('Z', 'U'),
        ...cycle('U', 'V', 'W'),
      ]
    );
    expect(satellites).toHaveLength(2);
    const byAnchor = new Map(satellites!.map((s) => [s.anchor, s]));
    expect(new Set(byAnchor.get('C')!.members)).toEqual(new Set(['X', 'Y', 'Z']));
    expect(new Set(byAnchor.get('Z')!.members)).toEqual(new Set(['U', 'V', 'W']));
    const inner = byAnchor.get('C')!.center;
    const outer = byAnchor.get('Z')!.center;
    expect(Math.hypot(outer.x, outer.y)).toBeGreaterThan(Math.hypot(inner.x, inner.y));
    const byId = new Map(nodes.map((n) => [n.id, n]));
    for (const id of ['U', 'V', 'W']) {
      const n = byId.get(id)!;
      expect(dist(n, outer), id).toBeCloseTo(byAnchor.get('Z')!.radius, 4);
    }
  });

  it('never lets any two boxes collide, ring and satellites together', () => {
    for (const graph of [bridge, eight]) {
      const { nodes } = circularLayout(graph.nodes, graph.edges);
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const p = nodes[i]!;
          const q = nodes[j]!;
          const overlap = Math.abs(p.x - q.x) < 80 && Math.abs(p.y - q.y) < 40;
          expect(overlap, `${p.id} overlaps ${q.id}`).toBe(false);
        }
      }
    }
  });

  it('hangs a spur and a satellite off one anchor side by side, never on top of each other', () => {
    for (const graph of [bridge, eight]) {
      const { nodes, satellites } = circularLayout(
        [...graph.nodes, box('Leaf')],
        [...graph.edges, edge('C', 'Leaf')]
      );
      const leaf = nodes.find((n) => n.id === 'Leaf')!;
      const sat = satellites![0]!;
      // Clear of the satellite's circle by more than half a box.
      expect(dist(leaf, sat.center) - sat.radius).toBeGreaterThan(40);
    }
  });

  it('mirrors satellites along with everything else under ccw', () => {
    const cw = circularLayout(eight.nodes, eight.edges);
    const ccw = circularLayout(eight.nodes, eight.edges, { direction: 'counterclockwise' });
    const sat = ccw.satellites![0]!;
    expect(sat.center.x).toBeCloseTo(-cw.satellites![0]!.center.x, 4);
    expect(sat.center.y).toBeCloseTo(cw.satellites![0]!.center.y, 4);
    const byId = new Map(ccw.nodes.map((n) => [n.id, n]));
    for (const id of ['X', 'Y']) {
      expect(dist(byId.get(id)!, sat.center), id).toBeCloseTo(sat.radius, 4);
    }
  });

  it('lands every arrow on a border, satellite arcs included', () => {
    for (const graph of [bridge, eight]) {
      const { nodes, edges: routed } = circularLayout(graph.nodes, graph.edges);
      const byId = new Map(nodes.map((n) => [n.id, n]));
      for (const e of routed) {
        const first = e.points[0]!;
        const last = e.points[e.points.length - 1]!;
        expect(onBoxBorder(first, byId.get(e.start)!), `${e.id} start`).toBe(true);
        expect(onBoxBorder(last, byId.get(e.end)!), `${e.id} end`).toBe(true);
      }
    }
  });

  describe('gear flow', () => {
    // The signed short-way step of a directed edge about a center:
    // positive reads clockwise on screen, negative counter-clockwise.
    const stepSign = (
      center: { x: number; y: number },
      from: { x: number; y: number },
      to: { x: number; y: number }
    ) => {
      let delta =
        Math.atan2(to.y - center.y, to.x - center.x) -
        Math.atan2(from.y - center.y, from.x - center.x);
      while (delta > Math.PI) {
        delta -= 2 * Math.PI;
      }
      while (delta < -Math.PI) {
        delta += 2 * Math.PI;
      }
      return Math.sign(delta);
    };

    it('spins a figure-eight satellite against its main ring, like meshing gears', () => {
      const { nodes, satellites } = circularLayout(eight.nodes, eight.edges);
      const byId = new Map(nodes.map((n) => [n.id, n]));
      const origin = { x: 0, y: 0 };
      const mainSpin = stepSign(origin, byId.get('A')!, byId.get('B')!);
      const satSpin = stepSign(satellites![0]!.center, byId.get('C')!, byId.get('X')!);
      expect(mainSpin).not.toBe(0);
      expect(satSpin).toBe(-mainSpin);
    });

    it('keeps the opposition through the ccw mirror', () => {
      const { nodes, satellites } = circularLayout(eight.nodes, eight.edges, {
        direction: 'counterclockwise',
      });
      const byId = new Map(nodes.map((n) => [n.id, n]));
      const mainSpin = stepSign({ x: 0, y: 0 }, byId.get('A')!, byId.get('B')!);
      const satSpin = stepSign(satellites![0]!.center, byId.get('C')!, byId.get('X')!);
      expect(satSpin).toBe(-mainSpin);
    });

    it('alternates through a chain of three meshing loops', () => {
      const ids = ['A1', 'A2', 'A3', 'A4', 'A5', 'B1', 'B2', 'C1', 'C2'];
      const { nodes, satellites } = circularLayout(
        ids.map((id) => box(id)),
        [
          ...cycle('A1', 'A2', 'A3', 'A4', 'A5'),
          edge('A2', 'B1'),
          edge('B1', 'B2'),
          edge('B2', 'A2'),
          edge('B1', 'C1'),
          edge('C1', 'C2'),
          edge('C2', 'B1'),
        ]
      );
      expect(satellites).toHaveLength(2);
      const byId = new Map(nodes.map((n) => [n.id, n]));
      const first = satellites!.find((s) => s.anchor === 'A2')!;
      const second = satellites!.find((s) => s.anchor === 'B1')!;
      const mainSpin = stepSign({ x: 0, y: 0 }, byId.get('A1')!, byId.get('A2')!);
      const firstSpin = stepSign(first.center, byId.get('A2')!, byId.get('B1')!);
      const secondSpin = stepSign(second.center, byId.get('B1')!, byId.get('C1')!);
      expect(firstSpin).toBe(-mainSpin);
      expect(secondSpin).toBe(mainSpin);
    });

    it('leaves a bridge satellite spinning with its parent — a shaft, not a tooth', () => {
      const { nodes, satellites } = circularLayout(bridge.nodes, bridge.edges);
      const byId = new Map(nodes.map((n) => [n.id, n]));
      const mainSpin = stepSign({ x: 0, y: 0 }, byId.get('A')!, byId.get('B')!);
      const satSpin = stepSign(satellites![0]!.center, byId.get('X')!, byId.get('Y')!);
      expect(satSpin).toBe(mainSpin);
    });
  });

  describe('satellite claims', () => {
    const gears = {
      nodes: ['A1', 'A2', 'A3', 'A4', 'A5', 'B1', 'B2', 'C1', 'C2'].map((id) => box(id)),
      edges: [
        ...cycle('A1', 'A2', 'A3', 'A4', 'A5'),
        edge('A2', 'B1'),
        edge('B1', 'B2'),
        edge('B2', 'A2'),
        edge('B1', 'C1'),
        edge('C1', 'C2'),
        edge('C2', 'B1'),
      ],
    };

    it('a meshed gear train no longer starves the big ring of its evenness', () => {
      const { nodes, order } = circularLayout(gears.nodes, gears.edges);
      const byId = new Map(nodes.map((n) => [n.id, n]));
      const angles = order.map((id) => {
        const n = byId.get(id)!;
        return Math.atan2(n.y, n.x);
      });
      const gaps = angles.map((a, i) => {
        let d = angles[(i + 1) % angles.length]! - a;
        while (d <= 0) {
          d += 2 * Math.PI;
        }
        while (d > 2 * Math.PI) {
          d -= 2 * Math.PI;
        }
        return d;
      });
      const ratio = Math.max(...gaps) / Math.min(...gaps);
      // A satellite touches the ring; it does not sit on it. Equal
      // boxes should keep near-equal gaps — the anchor's may breathe
      // a little, not swallow the circle.
      expect(ratio, gaps.map((g) => g.toFixed(2)).join(',')).toBeLessThan(1.25);
    });

    it('still keeps every box clear of every other, gears included', () => {
      const { nodes } = circularLayout(gears.nodes, gears.edges);
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const p = nodes[i]!;
          const q = nodes[j]!;
          const overlap = Math.abs(p.x - q.x) < 80 && Math.abs(p.y - q.y) < 40;
          expect(overlap, `${p.id} overlaps ${q.id}`).toBe(false);
        }
      }
    });
  });

  it('leaves single-cycle graphs without satellites', () => {
    const plain = circularLayout(
      ring.map((id) => box(id)),
      cycle(...ring)
    );
    expect(plain.satellites ?? []).toHaveLength(0);
  });
});

describe('direction', () => {
  const ids = ['A', 'B', 'C', 'D', 'E'];
  const sized = [box('A', 200, 60), box('B', 40, 40), box('C', 120, 50), box('D', 40, 40), box('E', 90, 45)];

  it('is the exact mirror of the clockwise layout across the vertical axis', () => {
    const cw = circularLayout(sized, cycle(...ids));
    const ccw = circularLayout(sized, cycle(...ids), { direction: 'counterclockwise' });
    const cwById = new Map(cw.nodes.map((n) => [n.id, n]));
    for (const n of ccw.nodes) {
      const twin = cwById.get(n.id)!;
      expect(n.x, `${n.id} x`).toBeCloseTo(-twin.x, 6);
      expect(n.y, `${n.id} y`).toBeCloseTo(twin.y, 6);
    }
    const cwEdges = new Map(cw.edges.map((e) => [e.id, e]));
    for (const e of ccw.edges) {
      const twin = cwEdges.get(e.id)!;
      expect(e.points.length).toBe(twin.points.length);
      for (const [i, p] of e.points.entries()) {
        expect(p.x, `${e.id} point ${i} x`).toBeCloseTo(-twin.points[i]!.x, 6);
        expect(p.y, `${e.id} point ${i} y`).toBeCloseTo(twin.points[i]!.y, 6);
      }
    }
  });

  it('sends the walk leftward from the top: the successor sits on the left', () => {
    const { nodes, order } = circularLayout(
      ids.map((id) => box(id)),
      cycle(...ids),
      { direction: 'counterclockwise' }
    );
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const top = byId.get(order[0]!)!;
    expect(top.x).toBeCloseTo(0, 6);
    expect(top.y).toBeLessThan(0);
    expect(byId.get(order[1]!)!.x).toBeLessThan(0);
    expect(byId.get(order[order.length - 1]!)!.x).toBeGreaterThan(0);
  });

  it('keeps the first node on a custom startAngle', () => {
    const ids = ['A', 'B', 'C', 'D'];
    for (const direction of ['clockwise', 'counterclockwise'] as const) {
      const { nodes, order } = circularLayout(ids.map((id) => box(id)), cycle(...ids), {
        startAngle: 0,
        direction,
      });
      const first = nodes.find((n) => n.id === order[0])!;
      expect(first.angle, direction).toBeCloseTo(0, 6);
    }
  });

  it('keeps a lone node centered, its angle untouched by the mirror', () => {
    const { nodes } = circularLayout([box('A')], [], { direction: 'counterclockwise' });
    expect(nodes[0]!.x).toBeCloseTo(0, 6);
    expect(nodes[0]!.y).toBeCloseTo(0, 6);
    expect(nodes[0]!.angle).toBeCloseTo(0, 6);
  });
});

describe('degenerate graphs', () => {
  it('draws a self-loop on a lone node as a petal, not a point', () => {
    const { edges } = circularLayout([box('A')], [edge('A', 'A')]);
    const loop = edges[0]!;
    expect(loop.points.length).toBeGreaterThanOrEqual(5);
    const apex = Math.max(...loop.points.map((p) => Math.hypot(p.x, p.y)));
    expect(apex).toBeGreaterThan(Math.hypot(40, 20));
  });

  it('separates same-direction duplicate edges between two nodes', () => {
    const { edges } = circularLayout(
      [box('A'), box('B')],
      [edge('A', 'B'), { id: 'again', start: 'A', end: 'B' }]
    );
    const midOf = (e: (typeof edges)[number]) => e.points[Math.floor(e.points.length / 2)]!;
    const [a, b] = edges.map(midOf);
    expect(dist(a!, b!)).toBeGreaterThan(8);
  });

  it('never doubles back: every segment advances along the path', () => {
    const ids = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const { edges } = circularLayout(
      ids.map((id) => box(id)),
      [...cycle(...ids), edge('A', 'C'), edge('B', 'D'), edge('A', 'E')]
    );
    for (const e of edges) {
      for (let i = 2; i < e.points.length; i++) {
        const prev = {
          x: e.points[i - 1]!.x - e.points[i - 2]!.x,
          y: e.points[i - 1]!.y - e.points[i - 2]!.y,
        };
        const here = {
          x: e.points[i]!.x - e.points[i - 1]!.x,
          y: e.points[i]!.y - e.points[i - 1]!.y,
        };
        const dot = prev.x * here.x + prev.y * here.y;
        // A real double-back is strongly negative (segments are ~10px,
        // so reversal reads in the hundreds); -1 tolerates the
        // sub-pixel sagitta where a straight tail rejoins its arc.
        expect(dot, `${e.id} reverses at point ${i}`).toBeGreaterThan(-1);
      }
    }
  });
});

describe('ordering', () => {
  it('follows edges so cycle neighbors sit beside each other, whatever the input order', () => {
    const { order } = circularLayout(
      ['A', 'C', 'E', 'B', 'D'].map((id) => box(id)),
      cycle('A', 'B', 'C', 'D', 'E')
    );
    const pos = new Map(order.map((id, i) => [id, i]));
    const n = order.length;
    for (const e of cycle('A', 'B', 'C', 'D', 'E')) {
      const gap = Math.abs(pos.get(e.start)! - pos.get(e.end)!);
      expect(Math.min(gap, n - gap)).toBe(1);
    }
  });

  it('saves a chord for last — declaration continuity from the best start', () => {
    const { order } = circularLayout(
      ['A', 'C', 'B', 'D', 'E'].map((id) => box(id)),
      [edge('A', 'C'), ...cycle('A', 'B', 'C', 'D', 'E')]
    );
    const pos = new Map(order.map((id, i) => [id, i]));
    const n = order.length;
    for (const e of cycle('A', 'B', 'C', 'D', 'E')) {
      const gap = Math.abs(pos.get(e.start)! - pos.get(e.end)!);
      expect(Math.min(gap, n - gap)).toBe(1);
    }
  });

  it('honors input order when asked', () => {
    const { order } = circularLayout(
      ['A', 'C', 'E', 'B', 'D'].map((id) => box(id)),
      cycle('A', 'B', 'C', 'D', 'E'),
      { ordering: 'input' }
    );
    expect(order).toEqual(['A', 'C', 'E', 'B', 'D']);
  });
});

describe('edge routing', () => {
  it('starts and ends every path on the node border, never at the center', () => {
    const { edges, nodes } = circularLayout(
      ['A', 'B', 'C', 'D', 'E'].map((id) => box(id)),
      [...cycle('A', 'B', 'C', 'D', 'E'), edge('A', 'C'), edge('A', 'A')]
    );
    const byId = new Map(nodes.map((n) => [n.id, n]));
    for (const e of edges) {
      const first = e.points[0]!;
      const last = e.points[e.points.length - 1]!;
      expect(onBoxBorder(first, byId.get(e.start)!), `${e.id} start`).toBe(true);
      expect(onBoxBorder(last, byId.get(e.end)!), `${e.id} end`).toBe(true);
      // And every interior sample stays clear of both end boxes.
      for (const p of e.points.slice(1, -1)) {
        for (const id of [e.start, e.end]) {
          const n = byId.get(id)!;
          const inside = Math.abs(p.x - n.x) < 40 && Math.abs(p.y - n.y) < 20;
          expect(inside, `${e.id} interior point inside ${id}`).toBe(false);
        }
      }
    }
  });

  it('draws every neighbor edge as a true arc of the one circle', () => {
    const { edges, radius } = circularLayout(
      ['A', 'B', 'C', 'D', 'E'].map((id) => box(id)),
      cycle('A', 'B', 'C', 'D', 'E')
    );
    for (const e of edges) {
      expect(e.onRim).toBe(true);
      // Every point of the path — the bisected border crossings
      // included — lies on the one circle, within the sub-pixel
      // sagitta of a bisection bracket.
      for (const p of e.points) {
        expect(Math.abs(Math.hypot(p.x, p.y) - radius)).toBeLessThan(0.5);
      }
    }
  });

  it('gives every path a straight terminal segment longer than marker handling reaches', () => {
    const ids = ['A', 'B', 'C', 'D', 'E'];
    const { edges } = circularLayout(
      ids.map((id) => box(id)),
      [...cycle(...ids), edge('A', 'C'), edge('A', 'A')]
    );
    for (const e of edges) {
      const last = e.points[e.points.length - 1]!;
      const prev = e.points[e.points.length - 2]!;
      const first = e.points[0]!;
      const second = e.points[1]!;
      // Mermaid moves points within ~5px of the ends; the terminal
      // segments must outreach that window or the marker orients
      // along a kink.
      expect(dist(last, prev), `${e.id} end tail`).toBeGreaterThan(6);
      expect(dist(first, second), `${e.id} start tail`).toBeGreaterThan(6);
    }
  });

  it('keeps a terminal segment as long as the tail option asks', () => {
    const ids = ['A', 'B', 'C', 'D', 'E'];
    const { edges } = circularLayout(
      ids.map((id) => box(id)),
      [...cycle(...ids), edge('A', 'C'), edge('A', 'A')],
      // Both ends of a rim arc need their tail, so the gap is wider
      // than two of them.
      { tail: 24, spacing: 60 }
    );
    for (const e of edges) {
      const n = e.points.length;
      expect(dist(e.points[n - 1]!, e.points[n - 2]!), `${e.id} end tail`).toBeGreaterThanOrEqual(24);
      expect(dist(e.points[0]!, e.points[1]!), `${e.id} start tail`).toBeGreaterThanOrEqual(24);
    }
  });

  it('seats a label on its path and leaves unlabeled edges without one', () => {
    const ids = ['A', 'B', 'C', 'D'];
    const { edges } = circularLayout(ids.map((id) => box(id)), [
      { ...edge('A', 'B'), labelWidth: 30, labelHeight: 18 },
      ...cycle(...ids).slice(1),
    ]);
    const labeled = edges.find((e) => e.id === 'A-B')!;
    expect(labeled.label).toEqual(labeled.points[Math.floor(labeled.points.length / 2)]);
    for (const e of edges.filter((x) => x.id !== 'A-B')) {
      expect(e.label, e.id).toBeUndefined();
    }
  });

  it('slides a rim label that crowds its neighbors outward until it clears every box', () => {
    // The rim widens a gap for a label's width, so a tall label is the
    // one that still crowds the boxes beside it.
    const ids = ['A', 'B', 'C', 'D', 'E', 'F'];
    const w = 40;
    const h = 120;
    const wide = (id: string) => box(id, 120, 50);
    const { edges, nodes } = circularLayout(ids.map(wide), [
      { ...edge('A', 'B'), labelWidth: w, labelHeight: h },
      ...cycle(...ids).slice(1),
    ], { spacing: 10 });
    const labeled = edges.find((e) => e.id === 'A-B')!;
    const mid = labeled.points[Math.floor(labeled.points.length / 2)]!;
    const at = labeled.label!;
    expect(Math.hypot(at.x, at.y)).toBeGreaterThan(Math.hypot(mid.x, mid.y));
    const sizes = new Map(ids.map((id) => [id, wide(id)]));
    for (const n of nodes) {
      const s = sizes.get(n.id)!;
      const overlaps =
        Math.abs(at.x - n.x) < (w + s.width) / 2 && Math.abs(at.y - n.y) < (h + s.height) / 2;
      expect(overlaps, `label clear of ${n.id}`).toBe(false);
    }
  });

  it('never wanders inside a node box on its way', () => {
    const wide = ['A', 'B', 'C', 'D', 'E'].map((id) => box(id, 180, 60));
    const { edges, nodes } = circularLayout(wide, [
      ...cycle('A', 'B', 'C', 'D', 'E'),
      edge('B', 'E'),
    ]);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    for (const e of edges) {
      for (const p of e.points.slice(1, -1)) {
        for (const n of nodes) {
          const owner = byId.get(n.id)!;
          const inside =
            Math.abs(p.x - owner.x) < 180 / 2 - 0.5 && Math.abs(p.y - owner.y) < 60 / 2 - 0.5;
          expect(inside, `edge ${e.id} point inside ${n.id}`).toBe(false);
        }
      }
    }
  });

  it('takes the short way: a neighbor path is barely longer than its chord', () => {
    const { edges, nodes } = circularLayout(
      ['A', 'B', 'C', 'D', 'E', 'F'].map((id) => box(id)),
      cycle('A', 'B', 'C', 'D', 'E', 'F')
    );
    const byId = new Map(nodes.map((n) => [n.id, n]));
    for (const e of edges) {
      const a = byId.get(e.start)!;
      const b = byId.get(e.end)!;
      const straight = dist(a, b);
      let length = 0;
      for (let i = 1; i < e.points.length; i++) {
        length += dist(e.points[i - 1]!, e.points[i]!);
      }
      expect(length).toBeLessThan(straight * 1.5);
    }
  });

  it('lands the arrow flush: the final segment points into the border it meets', () => {
    const { edges, nodes } = circularLayout(
      ['A', 'B', 'C', 'D', 'E'].map((id) => box(id)),
      cycle('A', 'B', 'C', 'D', 'E')
    );
    const byId = new Map(nodes.map((n) => [n.id, n]));
    for (const e of edges) {
      const last = e.points[e.points.length - 1]!;
      const prev = e.points[e.points.length - 2]!;
      const target = byId.get(e.end)!;
      // Walking the final segment direction from the endpoint must
      // enter the box, not skim along its border.
      const dir = { x: last.x - prev.x, y: last.y - prev.y };
      const len = Math.hypot(dir.x, dir.y);
      const probe = { x: last.x + (dir.x / len) * 3, y: last.y + (dir.y / len) * 3 };
      const inside =
        Math.abs(probe.x - target.x) < 80 / 2 && Math.abs(probe.y - target.y) < 40 / 2;
      expect(inside, `edge ${e.id} arrow does not enter its target`).toBe(true);
    }
  });

  it('draws a self-loop as a petal outside the rim, anchored on its node border', () => {
    const { edges, nodes, radius } = circularLayout(
      ['A', 'B', 'C'].map((id) => box(id)),
      [...cycle('A', 'B', 'C'), edge('A', 'A')]
    );
    const loop = edges.find((e) => e.id === 'A-A')!;
    const a = nodes.find((n) => n.id === 'A')!;
    expect(loop.points.length).toBeGreaterThanOrEqual(5);
    expect(onBoxBorder(loop.points[0]!, a), 'petal starts on the border').toBe(true);
    expect(
      onBoxBorder(loop.points[loop.points.length - 1]!, a),
      'petal ends on the border'
    ).toBe(true);
    const apex = Math.max(...loop.points.map((p) => Math.hypot(p.x, p.y)));
    expect(apex).toBeGreaterThan(radius * 1.05);
  });

  it('fans out parallel and opposite edges so they never overlap', () => {
    const ids = ['A', 'B', 'C', 'D'];
    const { edges } = circularLayout(
      ids.map((id) => box(id)),
      [...cycle(...ids), { id: 'back', start: 'B', end: 'A' }]
    );
    const midOf = (e: (typeof edges)[number]) => e.points[Math.floor(e.points.length / 2)]!;
    const there = midOf(edges.find((e) => e.id === 'A-B')!);
    const back = midOf(edges.find((e) => e.id === 'back')!);
    expect(dist(there, back)).toBeGreaterThan(8);
  });

  it('mirrors the two-node pair into a lens, one arc each side, same size', () => {
    const { edges } = circularLayout(
      [box('Ping'), box('Pong')],
      [edge('Ping', 'Pong'), edge('Pong', 'Ping')]
    );
    const midOf = (e: (typeof edges)[number]) => e.points[Math.floor(e.points.length / 2)]!;
    const [a, b] = edges.map(midOf);
    expect(Math.sign(a!.x)).not.toBe(Math.sign(b!.x));
    // The lens is symmetric: both arcs the same distance out.
    expect(Math.hypot(a!.x, a!.y)).toBeCloseTo(Math.hypot(b!.x, b!.y), 4);
  });

  it("lands the arrow exactly on a circle node's rim, axis along the arc's tangent", () => {
    const d = 60;
    const circle = (id: string): LayoutNodeInput => ({
      id,
      width: d,
      height: d,
      shape: 'ellipse',
    });
    const { edges, nodes, radius } = circularLayout(
      ['A', 'B', 'C', 'D', 'E'].map((id) => circle(id)),
      cycle('A', 'B', 'C', 'D', 'E')
    );
    const byId = new Map(nodes.map((n) => [n.id, n]));
    for (const e of edges) {
      const target = byId.get(e.end)!;
      const last = e.points[e.points.length - 1]!;
      const prev = e.points[e.points.length - 2]!;
      // The endpoint sits on the node's true circular border…
      expect(dist(last, target), `${e.id} end on circle border`).toBeCloseTo(d / 2, 1);
      // …and on the rim, where the arc crosses that circle.
      expect(Math.abs(Math.hypot(last.x, last.y) - radius)).toBeLessThan(0.5);
      // The marker's axis is the final segment; it runs along the
      // rim's tangent at the crossing, clockwise travel.
      const axis = Math.atan2(last.y - prev.y, last.x - prev.x);
      const tangent = Math.atan2(last.x, -last.y);
      let diff = Math.abs(axis - tangent) % (2 * Math.PI);
      diff = Math.min(diff, 2 * Math.PI - diff);
      expect(diff, `${e.id} marker angle off tangent by ${(diff * 180) / Math.PI}°`).toBeLessThan(
        (8 * Math.PI) / 180
      );
    }
  });
});

describe('straight edges', () => {
  const straight = { edges: 'straight' as const };
  const ids = ['A', 'B', 'C', 'D', 'E'];
  const byIdOf = (nodes: { id: string; x: number; y: number }[]) =>
    new Map(nodes.map((n) => [n.id, n]));

  it('draws a three-cycle as a triangle: three straight edges, border to border', () => {
    const tri = ['A', 'B', 'C'];
    const { edges, nodes } = circularLayout(tri.map((id) => box(id)), cycle(...tri), straight);
    const byId = byIdOf(nodes);
    expect(edges).toHaveLength(3);
    for (const e of edges) {
      expect(e.onRim, e.id).toBe(true);
      expect(bend(e.points), `${e.id} bends`).toBeLessThan(1e-6);
      expect(onBoxBorder(e.points[0]!, byId.get(e.start)!), `${e.id} start`).toBe(true);
      expect(onBoxBorder(e.points.at(-1)!, byId.get(e.end)!), `${e.id} end`).toBe(true);
    }
  });

  it('runs every rim edge along the line between the two centers', () => {
    const { edges, nodes } = circularLayout(ids.map((id) => box(id)), cycle(...ids), straight);
    const byId = byIdOf(nodes);
    for (const e of edges) {
      const from = byId.get(e.start)!;
      const to = byId.get(e.end)!;
      expect(bend([from, ...e.points, to]), `${e.id} off the center line`).toBeLessThan(1e-6);
    }
  });

  it('keeps straight terminal segments as long as the tail asks', () => {
    const { edges } = circularLayout(
      ids.map((id) => box(id)),
      [...cycle(...ids), edge('A', 'C')],
      { ...straight, tail: 24, spacing: 60 }
    );
    for (const e of edges) {
      const n = e.points.length;
      // The tail point sits exactly `tail` in, so allow float error.
      expect(dist(e.points[n - 1]!, e.points[n - 2]!), `${e.id} end tail`).toBeGreaterThan(24 - 1e-9);
      expect(dist(e.points[0]!, e.points[1]!), `${e.id} start tail`).toBeGreaterThan(24 - 1e-9);
    }
  });

  it('draws chords straight', () => {
    const { edges, nodes } = circularLayout(
      ids.map((id) => box(id)),
      [...cycle(...ids), edge('A', 'C'), edge('B', 'E')],
      straight
    );
    const byId = byIdOf(nodes);
    for (const id of ['A-C', 'B-E']) {
      const e = edges.find((x) => x.id === id)!;
      expect(e.onRim).toBe(false);
      expect(bend([byId.get(e.start)!, ...e.points, byId.get(e.end)!]), id).toBeLessThan(1e-6);
    }
  });

  it('splits an opposite pair into two parallel lines a few pixels apart', () => {
    const { edges } = circularLayout(
      ids.map((id) => box(id)),
      [...cycle(...ids), edge('A', 'C'), edge('C', 'A'), edge('B', 'A')],
      straight
    );
    for (const [there, back] of [
      ['A-C', 'C-A'],
      ['A-B', 'B-A'],
    ] as const) {
      const p = edges.find((e) => e.id === there)!.points;
      const q = edges.find((e) => e.id === back)!.points;
      expect(bend(p), there).toBeLessThan(1e-6);
      expect(bend(q), back).toBeLessThan(1e-6);
      // Parallel, running opposite ways.
      const hp = heading(p);
      const hq = heading(q);
      expect(hp.x * hq.x + hp.y * hq.y).toBeCloseTo(-1, 6);
      // The gap between the two lines: the default parallelGap.
      const gap = Math.abs((q[0]!.x - p[0]!.x) * -hp.y + (q[0]!.y - p[0]!.y) * hp.x);
      expect(gap, `${there} vs ${back}`).toBeCloseTo(10, 6);
    }
  });

  it('splits an opposite pair between two lone nodes as well', () => {
    const { edges } = circularLayout(
      [box('A'), box('B')],
      [edge('A', 'B'), edge('B', 'A')],
      straight
    );
    const [p, q] = edges.map((e) => e.points);
    expect(bend(p!)).toBeLessThan(1e-6);
    expect(bend(q!)).toBeLessThan(1e-6);
    const hp = heading(p!);
    const gap = Math.abs((q![0]!.x - p![0]!.x) * -hp.y + (q![0]!.y - p![0]!.y) * hp.x);
    expect(gap).toBeCloseTo(10, 6);
  });

  /** Perpendicular distance between two parallel paths. */
  const between = (p: { x: number; y: number }[], q: { x: number; y: number }[]) => {
    const hp = heading(p);
    return (q[0]!.x - p[0]!.x) * -hp.y + (q[0]!.y - p[0]!.y) * hp.x;
  };

  it('widens the gap between parallel lines as parallelGap asks', () => {
    const pair = [edge('A', 'B'), edge('B', 'A')];
    for (const parallelGap of [4, 16]) {
      const { edges } = circularLayout([box('A'), box('B')], pair, { ...straight, parallelGap });
      expect(Math.abs(between(edges[0]!.points, edges[1]!.points)), `${parallelGap}`).toBeCloseTo(
        parallelGap,
        6
      );
    }
  });

  it('fans four same-way siblings onto evenly spaced lines that still fit the boxes', () => {
    // Four lines at the default 10px would span 30px; the 80×40 boxes
    // take a fan of 2·0.6·20 = 24px, so the fan is scaled to fit.
    const four = [1, 2, 3, 4].map((k) => ({ id: `AB${k}`, start: 'A', end: 'B' }));
    const { edges, nodes } = circularLayout(
      ['A', 'B', 'C'].map((id) => box(id)),
      [...four, edge('B', 'C'), edge('C', 'A')],
      straight
    );
    const byId = byIdOf(nodes);
    const lines = four.map((f) => edges.find((e) => e.id === f.id)!.points);
    const offsets = lines.map((l) => between(lines[0]!, l));
    for (const [k, l] of lines.entries()) {
      expect(bend(l), `line ${k}`).toBeLessThan(1e-6);
      expect(onBoxBorder(l[0]!, byId.get('A')!), `line ${k} start`).toBe(true);
      expect(onBoxBorder(l.at(-1)!, byId.get('B')!), `line ${k} end`).toBe(true);
      if (k > 0) {
        expect(Math.abs(offsets[k]! - offsets[k - 1]!), `step ${k}`).toBeCloseTo(8, 6);
      }
    }
  });

  it('ends straight edges on the true outlines of ellipses, diamonds and stadiums', () => {
    const shaped: LayoutNodeInput[] = [
      { id: 'E', width: 90, height: 50, shape: 'ellipse' },
      { id: 'D', width: 80, height: 60, shape: 'diamond' },
      { id: 'S', width: 120, height: 40, shape: 'stadium' },
    ];
    const { edges, nodes } = circularLayout(shaped, cycle('E', 'D', 'S'), straight);
    const byId = byIdOf(nodes);
    const size = new Map(shaped.map((n) => [n.id, n]));
    /** 1 on the outline, below 1 inside, above 1 outside. */
    const level = (p: { x: number; y: number }, id: string): number => {
      const n = size.get(id)!;
      const c = byId.get(id)!;
      const dx = Math.abs(p.x - c.x);
      const dy = Math.abs(p.y - c.y);
      const [hw, hh] = [n.width / 2, n.height / 2];
      if (n.shape === 'ellipse') return Math.hypot(dx / hw, dy / hh);
      if (n.shape === 'diamond') return dx / hw + dy / hh;
      return Math.hypot(Math.max(0, dx - (hw - hh)), dy) / hh;
    };
    for (const e of edges) {
      expect(bend(e.points), e.id).toBeLessThan(1e-6);
      expect(level(e.points[0]!, e.start), `${e.id} start`).toBeCloseTo(1, 4);
      expect(level(e.points.at(-1)!, e.end), `${e.id} end`).toBeCloseTo(1, 4);
    }
  });

  it('treats an explicitly undefined edges option as the arcs', () => {
    const nodes = [box('A'), box('B')];
    const pair = [edge('A', 'B'), edge('B', 'A')];
    expect(circularLayout(nodes, pair, { edges: undefined })).toEqual(circularLayout(nodes, pair));
  });

  it('leaves placement, spokes, spurs and self-loops exactly as the arcs have them', () => {
    const graphs: [LayoutNodeInput[], LayoutEdgeInput[]][] = [
      // A ring with a spur, a self-loop and a labeled spur.
      [
        [...ids, 'S', 'T'].map((id) => box(id)),
        [
          ...cycle(...ids),
          edge('A', 'S'),
          { ...edge('S', 'T'), labelWidth: 40 },
          edge('C', 'C'),
        ],
      ],
      // A wheel: spokes to the axle.
      [
        [...ids, 'H'].map((id) => box(id)),
        [...cycle(...ids), ...ids.map((id) => edge(id, 'H'))],
      ],
    ];
    for (const [nodes, edges] of graphs) {
      const arcs = circularLayout(nodes, edges);
      const lines = circularLayout(nodes, edges, straight);
      expect(lines.nodes).toEqual(arcs.nodes);
      expect(lines.radius).toEqual(arcs.radius);
      for (const e of lines.edges) {
        const twin = arcs.edges.find((x) => x.id === e.id)!;
        const riding = lines.order.includes(e.start) && lines.order.includes(e.end);
        if (!riding || e.start === e.end) {
          expect(e, e.id).toEqual(twin);
        }
      }
    }
  });

  it('turns satellite rings into polygons too', () => {
    const { edges, satellites, nodes } = circularLayout(
      [...ids, 'X', 'Y', 'Z'].map((id) => box(id)),
      [...cycle(...ids), edge('C', 'X'), ...cycle('X', 'Y', 'Z')],
      straight
    );
    expect(satellites).toHaveLength(1);
    const byId = byIdOf(nodes);
    for (const id of ['X-Y', 'Y-Z', 'Z-X']) {
      const e = edges.find((x) => x.id === id)!;
      expect(bend([byId.get(e.start)!, ...e.points, byId.get(e.end)!]), id).toBeLessThan(1e-6);
    }
  });

  it('seats a label at the midpoint of its segment', () => {
    const four = ['A', 'B', 'C', 'D'];
    const { edges } = circularLayout(
      four.map((id) => box(id)),
      [{ ...edge('A', 'B'), labelWidth: 30, labelHeight: 18 }, ...cycle(...four).slice(1)],
      straight
    );
    const labeled = edges.find((e) => e.id === 'A-B')!;
    const a = labeled.points[0]!;
    const b = labeled.points.at(-1)!;
    expect(labeled.label!.x).toBeCloseTo((a.x + b.x) / 2, 6);
    expect(labeled.label!.y).toBeCloseTo((a.y + b.y) / 2, 6);
  });

  it('still slides a crowded label outward until it clears every box', () => {
    const six = ['A', 'B', 'C', 'D', 'E', 'F'];
    const w = 40;
    const h = 120;
    const wide = (id: string) => box(id, 120, 50);
    const { edges, nodes } = circularLayout(
      six.map(wide),
      [{ ...edge('A', 'B'), labelWidth: w, labelHeight: h }, ...cycle(...six).slice(1)],
      { ...straight, spacing: 10 }
    );
    const labeled = edges.find((e) => e.id === 'A-B')!;
    const a = labeled.points[0]!;
    const b = labeled.points.at(-1)!;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const at = labeled.label!;
    expect(Math.hypot(at.x, at.y)).toBeGreaterThan(Math.hypot(mid.x, mid.y));
    for (const n of nodes) {
      const overlaps =
        Math.abs(at.x - n.x) < (w + 120) / 2 && Math.abs(at.y - n.y) < (h + 50) / 2;
      expect(overlaps, `label clear of ${n.id}`).toBe(false);
    }
  });

  it('mirrors under counterclockwise like everything else', () => {
    const graph = [...cycle(...ids), edge('A', 'C'), edge('C', 'A')];
    const cw = circularLayout(ids.map((id) => box(id)), graph, straight);
    const ccw = circularLayout(ids.map((id) => box(id)), graph, {
      ...straight,
      direction: 'counterclockwise',
    });
    for (const e of ccw.edges) {
      const twin = cw.edges.find((x) => x.id === e.id)!;
      expect(e.points.length, e.id).toBe(twin.points.length);
      e.points.forEach((p, i) => {
        expect(p.x, e.id).toBeCloseTo(-twin.points[i]!.x, 6);
        expect(p.y, e.id).toBeCloseTo(twin.points[i]!.y, 6);
      });
    }
  });

  it("keeps the arcs by default and for edges: 'arc'", () => {
    const graph = [...cycle(...ids), edge('A', 'C')];
    const plain = circularLayout(ids.map((id) => box(id)), graph);
    const arcs = circularLayout(ids.map((id) => box(id)), graph, { edges: 'arc' });
    expect(arcs).toEqual(plain);
    const rim = plain.edges.find((e) => e.id === 'A-B')!;
    expect(bend(rim.points)).toBeGreaterThan(1);
  });
});

describe('chords', () => {
  // A chord joins ring nodes that are not neighbors. It is straight
  // whatever `edges` says; only the rim edges follow the option.
  const ids = ['A', 'B', 'C', 'D', 'E', 'F'];
  const modes = [
    ['arcs', {}],
    ['straight edges', { edges: 'straight' as const }],
  ] as const;

  for (const [mode, options] of modes) {
    it(`runs a chord along the line between centers, border to border, with ${mode}`, () => {
      const { edges, nodes } = circularLayout(
        ids.map((id) => box(id)),
        [...cycle(...ids), edge('A', 'C'), edge('B', 'E')],
        { ...options, tail: 12 }
      );
      const byId = new Map(nodes.map((n) => [n.id, n]));
      for (const id of ['A-C', 'B-E']) {
        const e = edges.find((x) => x.id === id)!;
        const from = byId.get(e.start)!;
        const to = byId.get(e.end)!;
        expect(e.onRim, id).toBe(false);
        expect(bend([from, ...e.points, to]), `${id} off the center line`).toBeLessThan(1e-6);
        expect(onBoxBorder(e.points[0]!, from), `${id} start`).toBe(true);
        expect(onBoxBorder(e.points.at(-1)!, to), `${id} end`).toBe(true);
        // The tail point sits exactly `tail` in, so allow float error.
        expect(dist(e.points[0]!, e.points[1]!), `${id} start tail`).toBeGreaterThan(12 - 1e-9);
        expect(dist(e.points.at(-1)!, e.points.at(-2)!), `${id} end tail`).toBeGreaterThan(
          12 - 1e-9
        );
      }
    });

    it(`splits an opposite chord pair and a fan into lines parallelGap apart, with ${mode}`, () => {
      const { edges } = circularLayout(
        ids.map((id) => box(id)),
        [
          ...cycle(...ids),
          edge('A', 'D'),
          edge('D', 'A'),
          ...[1, 2, 3].map((k) => ({ ...edge('B', 'F'), id: `BF${k}` })),
        ],
        { ...options, parallelGap: 12 }
      );
      const pathOf = (id: string) => edges.find((e) => e.id === id)!.points;
      const across = (p: { x: number; y: number }[], q: { x: number; y: number }[]) => {
        const h = heading(p);
        return (q[0]!.x - p[0]!.x) * -h.y + (q[0]!.y - p[0]!.y) * h.x;
      };
      const [there, back] = [pathOf('A-D'), pathOf('D-A')];
      const [hp, hq] = [heading(there), heading(back)];
      expect(hp.x * hq.x + hp.y * hq.y, 'opposite and parallel').toBeCloseTo(-1, 6);
      expect(Math.abs(across(there, back)), 'opposite pair gap').toBeCloseTo(12, 6);
      const fan = ['BF1', 'BF2', 'BF3'].map(pathOf);
      for (const p of fan) {
        expect(bend(p)).toBeLessThan(1e-6);
      }
      expect(Math.abs(across(fan[0]!, fan[1]!)), 'fan gap 1-2').toBeCloseTo(12, 6);
      expect(Math.abs(across(fan[1]!, fan[2]!)), 'fan gap 2-3').toBeCloseTo(12, 6);
      expect(Math.abs(across(fan[0]!, fan[2]!)), 'fan gap 1-3').toBeCloseTo(24, 6);
    });
  }

  it('keeps rim edges as arcs of the ring by default', () => {
    const { edges, radius } = circularLayout(
      ids.map((id) => box(id)),
      [...cycle(...ids), edge('A', 'C')]
    );
    for (const e of edges.filter((x) => x.onRim)) {
      expect(bend(e.points), `${e.id} is an arc`).toBeGreaterThan(1);
      const mid = e.points[Math.floor(e.points.length / 2)]!;
      expect(Math.hypot(mid.x, mid.y)).toBeCloseTo(radius, 6);
    }
  });

  it('runs a diameter straight through a hub — a known limit', () => {
    const ring = ['A', 'B', 'C', 'D', 'E', 'F'];
    const { edges, hub } = circularLayout(
      [...ring, 'H'].map((id) => box(id)),
      [...cycle(...ring), ...ring.map((id) => edge(id, 'H')), edge('A', 'D')],
      { hub: 'H' }
    );
    expect(hub).toBe('H');
    const e = edges.find((x) => x.id === 'A-D')!;
    const mid = e.points[Math.floor(e.points.length / 2)]!;
    expect(Math.hypot(mid.x, mid.y)).toBeLessThan(1e-6);
  });
});

describe('straight labels on parallel edges', () => {
  const straight = { edges: 'straight' as const };
  type P = { x: number; y: number };
  interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
  }
  const overlap = (a: Rect, b: Rect): boolean =>
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2;
  /** Signed distance of p from the line through a and b. */
  const sideOf = (p: P, a: P, b: P): number => {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    return ((p.x - a.x) * (b.y - a.y) - (p.y - a.y) * (b.x - a.x)) / len;
  };
  /** The rectangle's half extent across a line running a to b. */
  const halfAcross = (r: Rect, a: P, b: P): number => {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    return (r.w * Math.abs(b.y - a.y) + r.h * Math.abs(b.x - a.x)) / (2 * len);
  };
  const pairOf = (e: { start: string; end: string }) => [e.start, e.end].sort().join(' ');
  /** Whether segment a–b passes through the rectangle's interior
   *  (Liang–Barsky clipping). */
  const crosses = (r: Rect, a: P, b: P): boolean => {
    const [dx, dy] = [b.x - a.x, b.y - a.y];
    let [t0, t1] = [0, 1];
    for (const [pk, qk] of [
      [-dx, a.x - (r.x - r.w / 2)],
      [dx, r.x + r.w / 2 - a.x],
      [-dy, a.y - (r.y - r.h / 2)],
      [dy, r.y + r.h / 2 - a.y],
    ] as const) {
      if (pk === 0) {
        if (qk <= 0) return false;
        continue;
      }
      const t = qk / pk;
      if (pk < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
    }
    return t1 - t0 > 1e-9;
  };
  const labeled = (start: string, end: string, w: number, h: number): LayoutEdgeInput => ({
    ...edge(start, end),
    labelWidth: w,
    labelHeight: h,
  });

  const check = (
    nodes: LayoutNodeInput[],
    edges: LayoutEdgeInput[],
    group: string[],
    options: Parameters<typeof circularLayout>[2] = straight
  ) => {
    const result = circularLayout(nodes, edges, options);
    const size = new Map(nodes.map((n) => [n.id, n]));
    const rects = group.map((id) => {
      const input = edges.find((e) => e.id === id)!;
      const e = result.edges.find((x) => x.id === id)!;
      return { e, r: { ...e.label!, w: input.labelWidth!, h: input.labelHeight! } };
    });
    for (const [i, { e, r }] of rects.entries()) {
      for (const n of result.nodes) {
        const box = { x: n.x, y: n.y, w: size.get(n.id)!.width, h: size.get(n.id)!.height };
        expect(overlap(r, box), `${e.id} label clear of ${n.id}`).toBe(false);
      }
      for (const { e: f, r: s } of rects.slice(i + 1)) {
        expect(overlap(r, s), `${e.id} label clear of ${f.id} label`).toBe(false);
      }
      // A side label crosses no line of its group, its own included.
      // The middle label of an odd fan stays on its line by design.
      const [p, q] = [e.start, e.end].sort().map((id) => result.nodes.find((n) => n.id === id)!);
      if (Math.abs(sideOf(e.points[Math.floor(e.points.length / 2)]!, p!, q!)) < 0.5) {
        continue;
      }
      for (const f of result.edges.filter((x) => pairOf(x) === pairOf(e))) {
        expect(crosses(r, f.points[0]!, f.points.at(-1)!), `${e.id} label off ${f.id} line`).toBe(
          false
        );
      }
    }
    return { result, rects };
  };

  it('seats each label of a labeled opposite pair beside its own line, apart', () => {
    const ring = ['A', 'B', 'C', 'D', 'E'];
    for (const [nodes, edges] of [
      [
        ring.map((id) => box(id)),
        [labeled('A', 'B', 40, 18), labeled('B', 'A', 40, 18), ...cycle(...ring).slice(1)],
      ],
      [[box('A'), box('B')], [labeled('A', 'B', 46, 18), labeled('B', 'A', 46, 18)]],
    ] as [LayoutNodeInput[], LayoutEdgeInput[]][]) {
      const { rects } = check(nodes, edges, ['A-B', 'B-A']);
      for (const { e, r } of rects) {
        // Measured from its own line, the label sits wholly to one
        // side, the far side from its sibling.
        const a = e.points[0]!;
        const b = e.points.at(-1)!;
        const sibling = rects.find((x) => x.e !== e)!.e.points;
        const siblingSide = Math.sign(sideOf(sibling[0]!, a, b));
        const own = sideOf(r, a, b);
        expect(Math.sign(own), `${e.id} on the far side`).toBe(-siblingSide);
        expect(Math.abs(own), `${e.id} off its own line`).toBeGreaterThan(halfAcross(r, a, b));
      }
    }
  });

  it('keeps the labels of a fan of three apart and off the boxes', () => {
    const three = [1, 2, 3].map((k) => ({ ...labeled('A', 'B', 36, 18), id: `AB${k}` }));
    check(
      ['A', 'B', 'C', 'D'].map((id) => box(id)),
      [...three, ...cycle('A', 'B', 'C', 'D').slice(1)],
      three.map((e) => e.id)
    );
    check([box('A'), box('B')], three, three.map((e) => e.id));
  });

  it('keeps an opposite pair apart under counterclockwise and a tight gap', () => {
    const ring = ['A', 'B', 'C', 'D', 'E'];
    check(
      ring.map((id) => box(id)),
      [labeled('A', 'C', 50, 18), labeled('C', 'A', 30, 30), ...cycle(...ring)],
      ['A-C', 'C-A'],
      { ...straight, direction: 'counterclockwise', parallelGap: 8 }
    );
  });

  /** A wheel of `n` rim nodes around hub H, with a labeled opposite
   *  pair on the A–B rim edge. */
  const wheel = (n: number, w: number, h: number): [LayoutNodeInput[], LayoutEdgeInput[]] => {
    const ring = ['A', 'B', 'C', 'D', 'E', 'F'].slice(0, n);
    return [
      [...ring, 'H'].map((id) => box(id)),
      [
        labeled('A', 'B', w, h),
        labeled('B', 'A', w, h),
        ...cycle(...ring).slice(1),
        ...ring.map((id) => edge(id, 'H')),
      ],
    ];
  };
  const tight = { ...straight, spacing: 20 };

  it('keeps a rim pair beside a hub off the hub and every box', () => {
    for (const [n, w, h] of [
      [5, 40, 18],
      [6, 50, 40],
    ] as const) {
      const [nodes, edges] = wheel(n, w, h);
      const { result } = check(nodes, edges, ['A-B', 'B-A'], tight);
      expect(result.hub, `${n}-ring hub`).toBe('H');
    }
  });

  it('never slides an inner label past the center of a small ring', () => {
    // A four-ring with a hub and big labels: the inner label steps
    // onto the hub and finds no clear seat before the center. It
    // settles back at its stepped seat, beside its own line, rather
    // than crossing to the far side of the ring.
    const [nodes, edges] = wheel(4, 60, 30);
    const result = circularLayout(nodes, edges, tight);
    expect(result.hub).toBe('H');
    const a = result.nodes.find((x) => x.id === 'A')!;
    const b = result.nodes.find((x) => x.id === 'B')!;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const rects = ['A-B', 'B-A'].map((id) => {
      const e = result.edges.find((x) => x.id === id)!;
      return { e, r: { ...e.label!, w: 60, h: 30 } };
    });
    expect(overlap(rects[0]!.r, rects[1]!.r), 'labels apart').toBe(false);
    for (const { e, r } of rects) {
      expect(r.x * mid.x + r.y * mid.y, `${e.id} short of center`).toBeGreaterThan(0);
      for (const f of result.edges.filter((x) => pairOf(x) === 'A B')) {
        expect(crosses(r, f.points[0]!, f.points.at(-1)!), `${e.id} off ${f.id}`).toBe(false);
      }
      for (const n of result.nodes.filter((x) => x.id !== 'H')) {
        expect(overlap(r, { x: n.x, y: n.y, w: 80, h: 40 }), `${e.id} clear of ${n.id}`).toBe(
          false
        );
      }
    }
  });

  it('still seats a lone straight label at its midpoint', () => {
    const ring = ['A', 'B', 'C', 'D', 'E'];
    const { edges } = circularLayout(
      ring.map((id) => box(id)),
      [...cycle(...ring), labeled('A', 'C', 30, 18)],
      straight
    );
    const e = edges.find((x) => x.id === 'A-C')!;
    const a = e.points[0]!;
    const b = e.points.at(-1)!;
    expect(e.label!.x).toBeCloseTo((a.x + b.x) / 2, 9);
    expect(e.label!.y).toBeCloseTo((a.y + b.y) / 2, 9);
  });

  it('steps the labels of an opposite chord pair aside with arcs as well', () => {
    const ring = ['A', 'B', 'C', 'D', 'E', 'F'];
    for (const direction of ['clockwise', 'counterclockwise'] as const) {
      const { rects } = check(
        ring.map((id) => box(id)),
        [labeled('A', 'D', 40, 18), labeled('D', 'A', 40, 18), ...cycle(...ring)],
        ['A-D', 'D-A'],
        { direction }
      );
      for (const { e } of rects) {
        expect(e.onRim, `${e.id} is a chord`).toBe(false);
      }
    }
  });

  it('leaves the labels of an opposite rim pair on their arcs', () => {
    const ring = ['A', 'B', 'C', 'D', 'E'];
    const { edges } = circularLayout(
      ring.map((id) => box(id)),
      [labeled('A', 'B', 30, 18), labeled('B', 'A', 30, 18), ...cycle(...ring).slice(1)]
    );
    for (const id of ['A-B', 'B-A']) {
      const e = edges.find((x) => x.id === id)!;
      expect(e.label, id).toEqual(e.points[Math.floor(e.points.length / 2)]);
    }
  });
});

describe('arc output guard', () => {
  // Exact snapshots of a few default layouts, every float in full.
  // They were written when the arcs matched 0.1.1 byte for byte, so
  // any change to the arcs — meant or not — shows up here first.
  // The first case's chords were rewritten on purpose when chords
  // became straight; its rim arcs, spur and petal were not.
  const ring = ['A', 'B', 'C', 'D', 'E'];
  type Options = Parameters<typeof circularLayout>[2];
  const cases: [string, LayoutNodeInput[], LayoutEdgeInput[], Options?][] = [
    [
      'ring with a chord, an opposite pair, a spur, a self-loop and labels',
      [...ring, 'S'].map((id) => box(id)),
      [
        { ...edge('A', 'B'), labelWidth: 40, labelHeight: 18 },
        ...cycle(...ring).slice(1),
        edge('A', 'C'),
        edge('C', 'A'),
        edge('B', 'S'),
        edge('D', 'D'),
      ],
    ],
    ['wheel', [...ring, 'H'].map((id) => box(id)), [...cycle(...ring), ...ring.map((id) => edge(id, 'H'))]],
    [
      'satellite, counter-clockwise',
      [...ring, 'X', 'Y', 'Z'].map((id) => box(id)),
      [...cycle(...ring), edge('C', 'X'), ...cycle('X', 'Y', 'Z')],
      { direction: 'counterclockwise' },
    ],
    ['two nodes, both ways', [box('A'), box('B')], [edge('A', 'B'), edge('B', 'A')]],
  ];
  for (const [name, nodes, edges, options] of cases) {
    it(`keeps ${name} exactly as it was`, () => {
      expect(circularLayout(nodes, edges, options)).toMatchSnapshot();
    });
  }
});
