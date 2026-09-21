export const SIZE = 9;
export const ACTIONS = [
  "north",
  "east",
  "south",
  "west",
  "eat",
  "rest",
] as const;
export type Action = (typeof ACTIONS)[number];
export type Tile = "grass" | "food" | "hazard" | "shelter" | "rock";
export type World = {
  seed: number;
  tiles: Tile[];
  turn: number;
  x: number;
  y: number;
  hp: number;
  energy: number;
  food: number;
  hazards: number;
  path: number[];
  ended: boolean;
};
export const LABELS: Record<Action, string> = {
  north: "위로 이동",
  east: "오른쪽 이동",
  south: "아래로 이동",
  west: "왼쪽 이동",
  eat: "먹이 먹기",
  rest: "잠시 쉬기",
};
const DELTAS: Partial<Record<Action, [number, number]>> = {
  north: [0, -1],
  east: [1, 0],
  south: [0, 1],
  west: [-1, 0],
};
export function random(seed: number) {
  let n = seed >>> 0;
  return () => {
    n += 0x6d2b79f5;
    let t = n;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function createWorld(seed = 42): World {
  const r = random(seed);
  const tiles: Tile[] = Array.from({ length: SIZE * SIZE }, () => {
    const n = r();
    return n < 0.12
      ? "rock"
      : n < 0.23
        ? "hazard"
        : n < 0.39
          ? "food"
          : "grass";
  });
  tiles[40] = "shelter";
  tiles[31] = "food";
  tiles[41] = "grass";
  tiles[49] = "grass";
  tiles[39] = "grass";
  return {
    seed,
    tiles,
    turn: 0,
    x: 4,
    y: 4,
    hp: 100,
    energy: 65,
    food: 0,
    hazards: 0,
    path: [40],
    ended: false,
  };
}
export function legalActions(w: World): Action[] {
  if (w.ended) return [];
  return ACTIONS.filter((a) => {
    if (a === "eat") return w.tiles[w.y * SIZE + w.x] === "food";
    if (a === "rest") return true;
    const [dx, dy] = DELTAS[a]!;
    const x = w.x + dx,
      y = w.y + dy;
    return (
      x >= 0 &&
      x < SIZE &&
      y >= 0 &&
      y < SIZE &&
      w.tiles[y * SIZE + x] !== "rock"
    );
  });
}
export function step(w: World, action: Action): World {
  if (!legalActions(w).includes(action)) return w;
  const next: World = {
    ...w,
    tiles: [...w.tiles],
    path: [...w.path],
    turn: w.turn + 1,
  };
  const d = DELTAS[action];
  if (d) {
    next.x += d[0];
    next.y += d[1];
  }
  const tile = next.tiles[next.y * SIZE + next.x];
  next.energy = Math.max(0, next.energy - 5);
  if (action === "eat") {
    next.energy = Math.min(100, next.energy + 35);
    next.hp = Math.min(100, next.hp + 8);
    next.food++;
    next.tiles[next.y * SIZE + next.x] = "grass";
  }
  if (action === "rest")
    next.hp = Math.min(100, next.hp + (tile === "shelter" ? 15 : 4));
  if (tile === "hazard") {
    next.hp -= 18;
    next.hazards++;
  }
  if (next.energy === 0) next.hp -= 12;
  next.hp = Math.max(0, next.hp);
  next.path.push(next.y * SIZE + next.x);
  next.ended = next.hp === 0 || next.turn >= 100;
  return next;
}
// 기준선은 지침을 읽지 않는 결정론적 최단 경로 정책이다.
export function ruleAction(w: World): Action {
  const legal = legalActions(w);
  if (legal.includes("eat")) return "eat";
  if (w.tiles[w.y * SIZE + w.x] === "shelter" && w.hp < 75 && w.energy > 20)
    return "rest";
  const start = w.y * SIZE + w.x;
  const queue: { pos: number; first?: Action }[] = [{ pos: start }];
  const seen = new Set([start]);
  for (let i = 0; i < queue.length; i++) {
    const { pos, first } = queue[i];
    if (w.tiles[pos] === "food" && first) return first;
    for (const a of ["north", "east", "south", "west"] as Action[]) {
      const [dx, dy] = DELTAS[a]!;
      const x = (pos % SIZE) + dx,
        y = Math.floor(pos / SIZE) + dy,
        p = y * SIZE + x;
      if (
        x < 0 ||
        x >= SIZE ||
        y < 0 ||
        y >= SIZE ||
        seen.has(p) ||
        w.tiles[p] === "rock" ||
        w.tiles[p] === "hazard"
      )
        continue;
      seen.add(p);
      queue.push({ pos: p, first: first ?? a });
    }
  }
  return "rest";
}
export function editTile(w: World, index: number, tile: Tile): World {
  if (w.turn !== 0 || index === 40 || index < 0 || index >= SIZE * SIZE)
    return w;
  return { ...w, tiles: w.tiles.map((t, i) => (i === index ? tile : t)) };
}
export function modelState(w: World, instruction: string) {
  return {
    instruction,
    turn: w.turn,
    slime: { x: w.x, y: w.y, health: w.hp, energy: w.energy },
    map: w.tiles.reduce<Tile[][]>((rows, t, i) => {
      if (i % SIZE === 0) rows.push([]);
      rows[rows.length - 1].push(t);
      return rows;
    }, []),
    recentPositions: w.path.slice(-6),
    rules:
      "Coordinates start at top-left (0,0). Each action costs 5 energy. Eat on food: +35 energy, +8 health, consumes food. Rest: +15 health on shelter, +4 elsewhere. Hazard: -18 health every turn on it. At zero energy: -12 health/turn. Survive up to 100 turns. Rocks block movement. Food does not respawn.",
  };
}
