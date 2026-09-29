export function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function buildGrid(polygon, width, height, cell, radius = 0) {
  const cols = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const walk = new Uint8Array(cols * rows);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * cell + cell / 2;
      const y = row * cell + cell / 2;
      if ([[0, 0], [radius, 0], [-radius, 0], [0, radius], [0, -radius]]
        .every(([dx, dy]) => pointInPolygon(x + dx, y + dy, polygon))) walk[row * cols + col] = 1;
    }
  }
  return { cols, rows, cell, walk };
}

export function nearestWalkable(grid, x, y) {
  const col = Math.max(0, Math.min(grid.cols - 1, Math.floor(x / grid.cell)));
  const row = Math.max(0, Math.min(grid.rows - 1, Math.floor(y / grid.cell)));
  if (grid.walk[row * grid.cols + col]) return center(grid, col, row);
  let best = null;
  let bestDist = Infinity;
  for (let radius = 1; radius < Math.max(grid.cols, grid.rows); radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const c = col + dx, r = row + dy;
        if (c < 0 || r < 0 || c >= grid.cols || r >= grid.rows) continue;
        if (!grid.walk[r * grid.cols + c]) continue;
        const point = center(grid, c, r);
        const dist = (point.x - x) ** 2 + (point.y - y) ** 2;
        if (dist < bestDist) {
          bestDist = dist;
          best = point;
        }
      }
    }
    if (best) return best;
  }
  return null;
}

export function findPath(grid, from, to) {
  const start = cellOf(grid, from.x, from.y);
  const goal = cellOf(grid, to.x, to.y);
  if (!start || !goal) return [];
  if (start.col === goal.col && start.row === goal.row) return [to];
  const key = (col, row) => row * grid.cols + col;
  const open = [start];
  const came = new Map();
  const score = new Map([[key(start.col, start.row), 0]]);
  const estimate = new Map([[key(start.col, start.row), Math.hypot(goal.col - start.col, goal.row - start.row)]]);
  while (open.length) {
    open.sort((a, b) => estimate.get(key(a.col, a.row)) - estimate.get(key(b.col, b.row)));
    const current = open.shift();
    if (current.col === goal.col && current.row === goal.row) {
      const path = [to];
      let cursor = key(current.col, current.row);
      while (came.has(cursor)) {
        const previous = came.get(cursor);
        path.push(center(grid, previous.col, previous.row));
        cursor = key(previous.col, previous.row);
      }
      path.pop();
      return path.reverse();
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const col = current.col + dx, row = current.row + dy;
      if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) continue;
      if (!grid.walk[key(col, row)]) continue;
      const nextScore = score.get(key(current.col, current.row)) + 1;
      const id = key(col, row);
      if (nextScore >= (score.get(id) ?? Infinity)) continue;
      came.set(id, current);
      score.set(id, nextScore);
      estimate.set(id, nextScore + Math.hypot(goal.col - col, goal.row - row));
      if (!open.some((item) => item.col === col && item.row === row)) open.push({ col, row });
    }
  }
  return [];
}

function cellOf(grid, x, y) {
  const col = Math.floor(x / grid.cell);
  const row = Math.floor(y / grid.cell);
  if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) return null;
  if (!grid.walk[row * grid.cols + col]) return null;
  return { col, row };
}

function center(grid, col, row) {
  return { x: col * grid.cell + grid.cell / 2, y: row * grid.cell + grid.cell / 2 };
}
