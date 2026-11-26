# How it works

This page explains, in plain words, how layout-circular decides where
things go. It is for a curious user, not for someone changing the code.
For the reasons behind each choice, with dates, see
[DECISIONS.md](DECISIONS.md).

This page has no pictures. For pictures of each case, see the galleries
of the two renderers:
[mermaid-layout-circular](https://github.com/AndrewBroz/mermaid-layout-circular/blob/main/docs/GALLERY.md)
and
[pele-layout-circular](https://github.com/AndrewBroz/pele-layout-circular/blob/main/docs/GALLERY.md).

A few words used below:

- The **ring** is the circle the nodes sit on.
- An **arc** is an edge drawn along the circle, between two nodes next
  to each other. Those two nodes are **ring neighbors**.
- A **chord** is an edge between two ring nodes that are not neighbors.
  It is a straight line across the circle.

## The ring

The layout first finds the cycle. It removes every node that has only
one neighbor, and repeats until none is left. What remains is the cycle,
with any chords across it. The removed nodes become branches (see
[Branches](#branches)).

Then it orders the cycle. With the default `ordering: 'follow-edges'`,
it walks the graph from a start node. From each node, it follows the
edge written soonest after the edge it arrived by. People write a cycle
as a run of lines, so this walk follows what they wrote. The layout
tries every start node. It keeps the walk that puts the most edges
between ring neighbors. With `ordering: 'input'`, it keeps your order.

Then it places the nodes. The first node sits at the top. The gaps
between the borders of neighboring nodes are all equal, so every arc
has the same length. Wide boxes take more of the circle than narrow
ones. Nodes on the left and the right mirror each other, so the ring is
symmetric. The radius is the smallest that keeps every gap at least
`spacing` wide.

An edge label between ring neighbors needs room in its gap. The widest
such label sets the gap for the whole ring, so the arcs stay equal.

## Hubs

A hub is one node linked to most of the others. It goes in the middle,
and the rest form the ring around it. An edge from the hub to a ring
node is a spoke. With the default `hub: 'auto'`,
the layout picks a hub only when the shape is clear. Two shapes qualify.

A wheel is a ring with an axle. The candidate is the ring node with the
most ring neighbors, and no other node may tie with it. It becomes the
hub if it links to every other ring node. It also becomes the hub if
the ring stays whole once it is gone. So a hub still qualifies when a
few spokes or a few arcs of the ring are missing.

A star has no cycle at all. Its center is the node with the most
neighbors, at least three, and no other node may tie with it. The
center's neighbors form the ring. Nodes further out hang off them as
branches. A tie keeps everything on the ring, so a plain path or an
even tree is not mistaken for a star.

`hub: 'none'` keeps every node on the ring. `hub: '<node id>'` names the
hub yourself.

## Branches

A branch is a node that hangs off the ring, pointing outward. Branches
are the nodes removed while finding the cycle. Each one remembers the
node it hung from.

A branch sits on the line from the center of the circle through its
parent, further out. The gap between them is 80% of `spacing`.
Several branches on one parent fan out side by side. A ring node with a
wide fan of branches claims more of the circle, so its neighbors make
room.

## Satellites and figure-eights

A satellite is a second, smaller cycle hanging off the ring. It gets its
own circle. The layout finds the separate cycles in the graph. The
largest one is the main ring. Each other cycle is laid out as its own
small ring, by the same rules. It sits outside the main ring, on the
line from the center through the node it hangs from.

A figure-eight is two cycles that share one node. The shared node sits
on both circles, so the two circles touch there. The smaller circle runs
the other way round, like two gears meshing. A third cycle meshing with
the second turns the other way again.

Some satellites are joined to the ring by an edge, not by a shared
node. Such a satellite turns the same way as the ring, like two wheels
on one shaft.

## Groups

A group is a set of nodes drawn inside one shape. In mermaid it is a
subgraph. The layout seats a group's members side by side. To do that,
it treats each group as one node while ordering the ring, then puts the
members back in its place.

When you pass the groups, the layout also places a shape for each one.
It keeps the ring as it is: equal gaps, one radius, and symmetry. It
never widens one gap to make room. Instead it makes room in four ways:

1. Each box hugs its members, with the padding your renderer gave.
   It also holds the arrows between its members. An arc between two
   members can curve out past both of them, and the box holds it.
2. A box whose top would meet a node outside it may put its title
   room at the bottom, instead of the ring turning further. Each box
   is tried on its own, so one box can move its title while its
   neighbor keeps its title on top.
3. The ring may turn. Any node, or the gap between two nodes, may take
   the top. The ring stays symmetric either way. A group then often
   sits level, where a rectangle fits it snugly.
4. The radius may grow, by the same amount for every gap, until each
   shape is clear.

Clear means 8 pixels of space between a shape and every node outside
it, and between sibling shapes. That is enough for the wall and its
neighbor to read as two separate things.

Every group starts as a box. The layout tries each turn with titles
on top, growing it up to 1.15 times the radius. 15% is about where a
grown ring starts to look roomier than its spacing. Among the turns
that clear, it keeps those whose shapes cover at most 1.3 times the
area of the tightest, so a box never sprawls over empty space to save
a turn. Of those it picks the least turned, then the least grown.
Then it tries the smaller turns again with titles allowed at the
bottom. A smaller turn that clears that way wins, if its shapes are as
tight. So a title goes below instead of a turn, but never instead of a
little growth. If no turn clears that cheaply, it grows each turn up
to 1.5 times the radius, the same two ways. That cap keeps the diagram
from swelling for one group. It then keeps the turns within 5% of the
least growth and ranks them the same way.

The shape follows from fit alone, not from how much of the ring a
group covers. A box that clears at no turn and no growth is redrawn
as a band: a curved strip that follows the ring. The groups it sits
in, and the groups inside it, become bands too. The layout tries this
up to three times, and keeps the band only if it clashes less than
the box did. A hub in the middle is never wrapped by a band.

Sometimes an edge across the ring, such as a spoke, chord or branch,
crosses the strip where a box's title would go. If no edge crosses
the bottom strip, the title moves there. Arcs don't count, since an
arc always enters a box on the ring. Along its strip, the title takes
the spot nearest the middle that no edge crosses.

A band's title reads level. It sits outside the band, 6 pixels beyond
its outer edge, about half a line, on the line through the band's
middle. A band inside a band puts its title in the strip between the
two.

If no turn and no growth clears every shape, `groupsClear` is `false`.
The shapes still come back. The search stops after 400 tries, so a
32-node ring that cannot clear takes about 0.4 seconds instead of more
than one.

## Labels

An edge label sits at the middle of its edge's path.

A label on an arc first tries to stay in its gap. If it would cover the
boxes beside it, it slides outward, away from the center, until it
clears them. Outside the ring there is always room.

A label on a chord sits at the chord's middle. If it covers a box, such
as a hub, it slides sideways off the chord.

Two or more straight edges between the same two nodes become parallel
lines (see `parallelGap` in [OPTIONS.md](OPTIONS.md)). Their labels step
off sideways, each beside its own line, 4 pixels clear of it. That is
about the space below a line of text, so the label reads as beside its
line, not touching it. Labels further out stack beyond the nearer ones,
so none overlap.

Edge labels also slide off group titles, as they do off boxes.

## Limits

- A band that covers nearly the whole ring stops short of a full turn.
  Its ends can then touch what it would have wrapped. `groupsClear`
  says so.
- The title of a band inside a band is checked against nodes and
  sibling shapes, but not against other titles.
- A chord across a ring with a hub runs straight through the hub. Its
  label slides off the hub.
- In a fan of three or more parallel lines, the middle line's label
  stays on its line. Its background covers the lines beside it.
- On a small ring with a hub and large labels, a label inside the ring
  may touch the hub.
