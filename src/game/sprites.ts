export const PX = 2;

type Rect = readonly [x: number, y: number, w: number, h: number];

function bitmapToRects(rows: readonly string[], yOffset = 0): Rect[] {
  const rects: Rect[] = [];
  rows.forEach((row, y) => {
    let start = -1;
    for (let x = 0; x <= row.length; x++) {
      const on = x < row.length && row[x] === '#';
      if (on && start < 0) start = x;
      if (!on && start >= 0) {
        rects.push([start, y + yOffset, x - start, 1]);
        start = -1;
      }
    }
  });
  return mergeRows(rects);
}

// Joins vertically adjacent runs with the same x/width so scaled canvas draws leave no seams.
function mergeRows(rects: Rect[]): Rect[] {
  const merged: [number, number, number, number][] = [];
  for (const [x, y, w, h] of rects) {
    const above = merged.find((m) => m[0] === x && m[2] === w && m[1] + m[3] === y);
    if (above) above[3] += h;
    else merged.push([x, y, w, h]);
  }
  return merged;
}

function fillRects(ctx: CanvasRenderingContext2D, rects: readonly Rect[], x: number, y: number) {
  const ox = Math.round(x);
  const oy = Math.round(y);
  for (const [rx, ry, rw, rh] of rects) {
    ctx.fillRect(ox + rx * PX, oy + ry * PX, rw * PX, rh * PX);
  }
}

// ---- Dino (22 x 24 cells) ----

const DINO_BODY = bitmapToRects([
  '.........############.',
  '........##############',
  '........###.##########',
  '........##############',
  '........##############',
  '........##############',
  '........#######.......',
  '........##########....',
  '#......#######........',
  '#......#########......',
  '##....###########.#...',
  '###..#############.##.',
  '.###############......',
  '.###############......',
  '..#############.......',
  '...###########........',
  '....##########........',
  '.....#########........',
]);

const DINO_LEGS = {
  a: bitmapToRects(
    [
      '.....###..###.........',
      '.....###..###.........',
      '.....###..#...........',
      '.....###..............',
      '.....###..............',
      '.....####.............',
    ],
    18,
  ),
  b: bitmapToRects(
    [
      '.....###..###.........',
      '.....###..###.........',
      '.....#....###.........',
      '..........###.........',
      '..........###.........',
      '..........####........',
    ],
    18,
  ),
  stand: bitmapToRects(
    [
      '.....###..###.........',
      '.....###..###.........',
      '.....###..###.........',
      '.....###..###.........',
      '.....###..###.........',
      '.....####..####.......',
    ],
    18,
  ),
};

export const DINO_W = 22 * PX;
export const DINO_H = 24 * PX;

export type DinoPose = 'a' | 'b' | 'stand' | 'dead';

export function drawDino(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  pose: DinoPose,
  fg: string,
  bg: string,
) {
  ctx.fillStyle = fg;
  fillRects(ctx, DINO_BODY, x, y);
  fillRects(ctx, DINO_LEGS[pose === 'dead' ? 'stand' : pose], x, y);
  if (pose === 'dead') {
    fillRects(ctx, [[10, 1, 3, 3]], x, y);
    ctx.fillStyle = bg;
    fillRects(
      ctx,
      [
        [10, 1, 1, 1],
        [12, 1, 1, 1],
        [11, 2, 1, 1],
        [10, 3, 1, 1],
        [12, 3, 1, 1],
      ],
      x,
      y,
    );
  }
}

// ---- Ducking dino (30 x 13 cells) ----

const DUCK_BODY: Rect[] = [
  [2, 0, 20, 10],
  [20, 0, 10, 9],
  [0, 1, 3, 4],
];
const DUCK_HOLES: Rect[] = [
  [24, 1, 2, 2],
  [24, 6, 6, 1],
];
const DUCK_LEGS: Record<0 | 1, Rect[]> = {
  0: [
    [5, 10, 3, 3],
    [13, 10, 3, 1],
  ],
  1: [
    [5, 10, 3, 1],
    [13, 10, 3, 3],
  ],
};

export const DUCK_W = 30 * PX;
export const DUCK_H = 13 * PX;

export function drawDuck(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  frame: 0 | 1,
  fg: string,
  bg: string,
) {
  ctx.fillStyle = fg;
  fillRects(ctx, DUCK_BODY, x, y);
  fillRects(ctx, DUCK_LEGS[frame], x, y);
  ctx.fillStyle = bg;
  fillRects(ctx, DUCK_HOLES, x, y);
}

// ---- Cacti ----

const CACTUS = {
  small: {
    w: 8,
    h: 17,
    rects: [
      [2, 0, 4, 17],
      [0, 4, 2, 6],
      [0, 8, 3, 2],
      [6, 2, 2, 6],
      [5, 6, 2, 2],
    ] as Rect[],
  },
  large: {
    w: 12,
    h: 25,
    rects: [
      [3, 0, 6, 25],
      [0, 6, 3, 9],
      [0, 12, 4, 3],
      [9, 3, 3, 10],
      [8, 9, 4, 3],
    ] as Rect[],
  },
};

export type CactusKind = keyof typeof CACTUS;

export const CACTUS_SIZE = {
  small: { w: CACTUS.small.w * PX, h: CACTUS.small.h * PX },
  large: { w: CACTUS.large.w * PX, h: CACTUS.large.h * PX },
};

export function drawCactus(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  kind: CactusKind,
  count: number,
  fg: string,
) {
  ctx.fillStyle = fg;
  for (let i = 0; i < count; i++) {
    fillRects(ctx, CACTUS[kind].rects, x + i * CACTUS_SIZE[kind].w, y);
  }
}

// ---- Pterodactyl (23 x 20 cells) ----

const PTERA_BODY: Rect[] = [
  [3, 9, 15, 4],
  [17, 7, 4, 4],
  [21, 8, 2, 2],
  [0, 10, 3, 2],
];
const PTERA_WINGS: Record<0 | 1, Rect[]> = {
  0: [
    [9, 3, 4, 6],
    [7, 5, 2, 4],
  ],
  1: [
    [9, 13, 4, 6],
    [7, 13, 2, 4],
  ],
};

export const PTERA_W = 23 * PX;
export const PTERA_H = 20 * PX;

export function drawPtera(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  frame: 0 | 1,
  fg: string,
  bg: string,
) {
  ctx.fillStyle = fg;
  fillRects(ctx, PTERA_BODY, x, y);
  fillRects(ctx, PTERA_WINGS[frame], x, y);
  ctx.fillStyle = bg;
  fillRects(ctx, [[19, 8, 1, 1]], x, y);
}

// ---- Cloud (26 x 6 cells) ----

const CLOUD: Rect[] = [
  [6, 0, 8, 2],
  [2, 2, 20, 2],
  [0, 4, 26, 2],
];

export function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.fillStyle = color;
  fillRects(ctx, CLOUD, x, y);
}

export const CLOUD_W = 26 * PX;
