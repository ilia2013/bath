import * as THREE from "three";

export interface NavNode {
  id: string;
  position: THREE.Vector3;
  neighbors: string[];
}

/**
 * Hand-authored waypoint graph standing in for a full navmesh. Nodes are
 * placed so any two connected nodes have an unobstructed straight line
 * between them - good enough for a single house's vertical slice without
 * pulling in a navmesh library.
 */
export class NavGraph {
  private nodes = new Map<string, NavNode>();

  addNode(id: string, position: THREE.Vector3): void {
    this.nodes.set(id, { id, position, neighbors: [] });
  }

  connect(a: string, b: string): void {
    const na = this.nodes.get(a);
    const nb = this.nodes.get(b);
    if (!na || !nb) throw new Error(`NavGraph.connect: missing node ${a} or ${b}`);
    if (!na.neighbors.includes(b)) na.neighbors.push(b);
    if (!nb.neighbors.includes(a)) nb.neighbors.push(a);
  }

  get(id: string): NavNode | undefined {
    return this.nodes.get(id);
  }

  nearestNode(position: THREE.Vector3): NavNode {
    let best: NavNode | null = null;
    let bestDist = Infinity;
    for (const node of this.nodes.values()) {
      const d = node.position.distanceToSquared(position);
      if (d < bestDist) {
        bestDist = d;
        best = node;
      }
    }
    if (!best) throw new Error("NavGraph.nearestNode: graph is empty");
    return best;
  }

  /** Dijkstra shortest path between two node ids, returning ordered positions. */
  findPath(fromId: string, toId: string): THREE.Vector3[] {
    if (fromId === toId) {
      const n = this.nodes.get(fromId);
      return n ? [n.position.clone()] : [];
    }
    const dist = new Map<string, number>();
    const prev = new Map<string, string>();
    const visited = new Set<string>();
    for (const id of this.nodes.keys()) dist.set(id, Infinity);
    dist.set(fromId, 0);

    while (visited.size < this.nodes.size) {
      let currentId: string | null = null;
      let currentDist = Infinity;
      for (const [id, d] of dist) {
        if (!visited.has(id) && d < currentDist) {
          currentDist = d;
          currentId = id;
        }
      }
      if (currentId === null) break;
      if (currentId === toId) break;
      visited.add(currentId);
      const node = this.nodes.get(currentId)!;
      for (const neighborId of node.neighbors) {
        if (visited.has(neighborId)) continue;
        const neighbor = this.nodes.get(neighborId)!;
        const edgeLen = node.position.distanceTo(neighbor.position);
        const alt = currentDist + edgeLen;
        if (alt < (dist.get(neighborId) ?? Infinity)) {
          dist.set(neighborId, alt);
          prev.set(neighborId, currentId);
        }
      }
    }

    const path: string[] = [];
    let cur: string | undefined = toId;
    if (!prev.has(toId) && fromId !== toId) return [];
    while (cur) {
      path.unshift(cur);
      cur = prev.get(cur);
    }
    return path.map((id) => this.nodes.get(id)!.position.clone());
  }

  /** BFS from `fromId`, restricted to its connected component. */
  private reachableFrom(fromId: string): Set<string> {
    const seen = new Set<string>([fromId]);
    const queue = [fromId];
    while (queue.length > 0) {
      const current = this.nodes.get(queue.shift()!)!;
      for (const neighborId of current.neighbors) {
        if (!seen.has(neighborId)) {
          seen.add(neighborId);
          queue.push(neighborId);
        }
      }
    }
    return seen;
  }

  /**
   * Paths from `from` toward `to`. If the nearest node to `to` sits in a
   * different connected component (e.g. a noise came from a room with no
   * modeled interior doorway, like the garage), this walks toward the
   * closest *reachable* node instead of the raw point - the AI should never
   * cut a straight line through walls just because a target is technically
   * unreachable by its nav graph.
   */
  pathBetweenPositions(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] {
    const fromNode = this.nearestNode(from);
    const toNode = this.nearestNode(to);

    if (fromNode.id === toNode.id) return [toNode.position.clone()];

    const reachable = this.reachableFrom(fromNode.id);
    if (reachable.has(toNode.id)) {
      const path = this.findPath(fromNode.id, toNode.id);
      path.push(to.clone());
      return path;
    }

    let bestId = fromNode.id;
    let bestDist = Infinity;
    for (const id of reachable) {
      const d = this.nodes.get(id)!.position.distanceToSquared(to);
      if (d < bestDist) {
        bestDist = d;
        bestId = id;
      }
    }
    return this.findPath(fromNode.id, bestId);
  }
}
