import {
  CACTUS_SIZE,
  CLOUD_W,
  DINO_H,
  DUCK_H,
  PTERA_H,
  PTERA_W,
  drawCactus,
  drawCloud,
  drawDino,
  drawDuck,
  drawPtera,
  type DinoPose,
} from './sprites';

const WIDTH = 600;
const HEIGHT = 150;
const GROUND_Y = 130;
const DINO_X = 25;
const FRAME_MS = 1000 / 60;

const GRAVITY = 0.6;
const INITIAL_JUMP_VELOCITY = -10;
const DROP_VELOCITY = -5;
const MIN_JUMP_HEIGHT = 30;
// A held jump is cut short once the dino's head rises above this y, keeping it on screen.
const MAX_JUMP_TOP = 30;
const SPEED_DROP_COEFFICIENT = 3;

const START_SPEED = 6;
const MAX_SPEED = 13;
const ACCELERATION = 0.001;
const SCORE_COEFFICIENT = 0.025;

const CLEAR_TIME = 3000;
const GAP_COEFFICIENT = 0.6;
const MAX_GAP_COEFFICIENT = 1.5;
const MAX_OBSTACLE_LENGTH = 3;
const MAX_OBSTACLE_DUPLICATION = 2;
const PTERA_Y = [84, 60, 30];

const RESTART_DELAY = 500;
const NIGHT_EVERY = 700;
const NIGHT_FADE_MS = 1000;
const FLASH_MS = 1000;
const FLASH_STEP_MS = 250;
const LEG_FRAME_MS = 100;
const WING_FRAME_MS = 166;

const HI_KEY = 'dino-game:hi';

type Rgb = readonly [number, number, number];
const FG: [Rgb, Rgb] = [[83, 83, 83], [172, 172, 172]];
const BG: [Rgb, Rgb] = [[247, 247, 247], [8, 8, 8]];
const HI: [Rgb, Rgb] = [[117, 117, 117], [138, 138, 138]];
const CLOUD_COLOR: [Rgb, Rgb] = [[192, 192, 192], [63, 63, 63]];
const SUN_COLOR = 'rgb(172,172,172)';
const SKY_Y = 40;

function mix([light, dark]: [Rgb, Rgb], t: number) {
  const c = light.map((l, i) => Math.round(l + (dark[i] - l) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

type State = 'idle' | 'running' | 'crashed';
type ObstacleKind = 'cactusSmall' | 'cactusLarge' | 'ptera';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Obstacle {
  kind: ObstacleKind;
  x: number;
  y: number;
  w: number;
  h: number;
  size: number;
  gap: number;
  speedOffset: number;
  frame: 0 | 1;
  frameTimer: number;
}

interface ObstacleType {
  w: number;
  h: number;
  y: number;
  minGap: number;
  minSpeed: number;
  multipleSpeed: number;
}

const OBSTACLE_TYPES: Record<ObstacleKind, ObstacleType> = {
  cactusSmall: {
    w: CACTUS_SIZE.small.w,
    h: CACTUS_SIZE.small.h,
    y: GROUND_Y - CACTUS_SIZE.small.h,
    minGap: 120,
    minSpeed: 0,
    multipleSpeed: 4,
  },
  cactusLarge: {
    w: CACTUS_SIZE.large.w,
    h: CACTUS_SIZE.large.h,
    y: GROUND_Y - CACTUS_SIZE.large.h,
    minGap: 120,
    minSpeed: 0,
    multipleSpeed: 7,
  },
  ptera: { w: PTERA_W, h: PTERA_H, y: 0, minGap: 150, minSpeed: 8.5, multipleSpeed: 999 },
};

const DINO_BOXES: Box[] = [
  { x: 18, y: 0, w: 24, h: 18 },
  { x: 4, y: 18, w: 26, h: 30 },
];
const DUCK_BOXES: Box[] = [{ x: 4, y: 2, w: 52, h: 22 }];

const JUMP_KEYS = new Set(['Space', 'ArrowUp']);

const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

function readHi() {
  try {
    return Number(localStorage.getItem(HI_KEY)) || 0;
  } catch {
    return 0;
  }
}

function overlaps(a: Box, b: Box) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export interface Theme {
  bg: string;
  fg: string;
}

export interface GameOptions {
  dark?: boolean;
  onTheme?: (theme: Theme) => void;
}

export class DinoGame {
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private last = 0;
  private scale = 1;
  private observer: ResizeObserver;

  private state: State = 'idle';
  private speed = START_SPEED;
  private distance = 0;
  private runningTime = 0;
  private score = 0;
  private hi = readHi();
  private crashedAt = 0;

  private obstacles: Obstacle[] = [];
  private history: ObstacleKind[] = [];
  private clouds: { x: number; y: number; gap: number }[] = [];
  private bumps: { x: number; y: number; w: number }[] = [];
  private stars: { x: number; y: number }[] = [];
  private skyX = WIDTH - 80;

  private offset = 0;
  private velocity = 0;
  private jumping = false;
  private reachedMin = false;
  private jumpReleased = false;
  private downHeld = false;
  private frame: 0 | 1 = 0;
  private frameTimer = 0;

  private flashing = false;
  private flashElapsed = 0;
  // 0 = light palette, 1 = dark palette; fades toward darkTarget.
  private dark = 0;
  // The theme the player picked.
  private baseDark = false;
  // Flipped every NIGHT_EVERY points, inverting the chosen theme.
  private inverted = false;
  private lastTheme = '';

  private canvas: HTMLCanvasElement;
  private onTheme?: (theme: Theme) => void;

  constructor(canvas: HTMLCanvasElement, options: GameOptions = {}) {
    this.canvas = canvas;
    this.onTheme = options.onTheme;
    this.baseDark = options.dark ?? false;
    this.ctx = canvas.getContext('2d')!;
    this.reset();

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('blur', this.onBlur);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(canvas);
    this.resize();

    this.raf = requestAnimationFrame(this.tick);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('blur', this.onBlur);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.observer.disconnect();
  }

  /** Switches the base palette; the change fades in like the day/night cycle. */
  setDark(dark: boolean) {
    this.baseDark = dark;
  }

  // ---- input ----

  private onKeyDown = (e: KeyboardEvent) => {
    // Let focused controls (e.g. the theme toggle) keep their own key handling.
    if (e.target instanceof Element && e.target.closest('button, input, select, textarea, a')) {
      return;
    }
    if (JUMP_KEYS.has(e.code)) {
      e.preventDefault();
      if (!e.repeat) this.pressJump();
    } else if (e.code === 'ArrowDown') {
      e.preventDefault();
      this.downHeld = true;
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (JUMP_KEYS.has(e.code)) this.releaseJump();
    else if (e.code === 'ArrowDown') this.downHeld = false;
  };

  private onPointerDown = (e: PointerEvent) => {
    e.preventDefault();
    this.pressJump();
  };

  private onPointerUp = () => this.releaseJump();

  // keyup never arrives if focus leaves mid-press, which would leave the dino stuck ducking.
  private onBlur = () => {
    this.downHeld = false;
    this.releaseJump();
  };

  private pressJump() {
    if (this.state === 'crashed') {
      if (performance.now() - this.crashedAt >= RESTART_DELAY) {
        this.reset();
        this.state = 'running';
      }
      return;
    }
    this.state = 'running';
    if (!this.jumping && !this.ducking) {
      this.jumping = true;
      this.reachedMin = false;
      this.jumpReleased = false;
      this.velocity = INITIAL_JUMP_VELOCITY - this.speed / 10;
    }
  }

  private releaseJump() {
    this.jumpReleased = true;
  }

  // ---- lifecycle ----

  private reset() {
    this.state = 'idle';
    this.speed = START_SPEED;
    this.distance = 0;
    this.runningTime = 0;
    this.score = 0;
    this.obstacles = [];
    this.history = [];
    this.clouds = [];
    this.offset = 0;
    this.velocity = 0;
    this.jumping = false;
    this.frame = 0;
    this.frameTimer = 0;
    this.reachedMin = false;
    this.jumpReleased = false;
    this.flashing = false;
    this.flashElapsed = 0;
    this.inverted = false;
    this.dark = this.darkTarget;
    this.bumps = [];
    for (let x = 0; x < WIDTH + 60; x += randInt(15, 60)) this.bumps.push(this.makeBump(x));
    this.stars = Array.from({ length: 8 }, () => ({
      x: randInt(0, WIDTH),
      y: randInt(10, 70),
    }));
  }

  private makeBump(x: number) {
    return { x, y: GROUND_Y + randInt(4, 10), w: randInt(2, 8) };
  }

  private resize = () => {
    const dpr = window.devicePixelRatio || 1;
    // Integer backing scale keeps sprite rects seam-free; CSS handles the final fit.
    this.scale = Math.max(1, Math.ceil((this.canvas.clientWidth * dpr) / WIDTH));
    this.canvas.width = WIDTH * this.scale;
    this.canvas.height = HEIGHT * this.scale;
  };

  private tick = (now: number) => {
    const dt = this.last ? Math.min((now - this.last) / FRAME_MS, 3) : 1;
    this.last = now;
    this.update(dt);
    this.draw();
    this.raf = requestAnimationFrame(this.tick);
  };

  // ---- update ----

  private update(dt: number) {
    const ms = dt * FRAME_MS;
    if (this.dark !== this.darkTarget) this.fadeDark(ms);
    if (this.state !== 'running') return;

    this.runningTime += ms;
    this.speed = Math.min(MAX_SPEED, this.speed + ACCELERATION * dt);
    this.distance += this.speed * dt;
    this.updateScore(ms);
    this.updateDino(dt, ms);
    this.updateBackground(dt);
    this.updateObstacles(dt, ms);
    if (this.collides()) this.crash();
  }

  private get darkTarget() {
    return this.baseDark !== this.inverted ? 1 : 0;
  }

  private fadeDark(ms: number) {
    const step = ms / NIGHT_FADE_MS;
    const target = this.darkTarget;
    this.dark =
      target > this.dark ? Math.min(target, this.dark + step) : Math.max(target, this.dark - step);
  }

  private updateScore(ms: number) {
    const next = Math.floor(this.distance * SCORE_COEFFICIENT);
    if (Math.floor(next / 100) > Math.floor(this.score / 100)) {
      this.flashing = true;
      this.flashElapsed = 0;
    }
    if (Math.floor(next / NIGHT_EVERY) > Math.floor(this.score / NIGHT_EVERY)) {
      this.inverted = !this.inverted;
    }
    this.score = next;
    if (this.flashing) {
      this.flashElapsed += ms;
      if (this.flashElapsed >= FLASH_MS) this.flashing = false;
    }
  }

  private get speedDrop() {
    return this.jumping && this.downHeld;
  }

  private get ducking() {
    return !this.jumping && this.downHeld;
  }

  private updateDino(dt: number, ms: number) {
    if (this.jumping) {
      // Speed drop always heads down; scaling an upward velocity would launch the dino instead.
      if (this.speedDrop) this.velocity = Math.max(this.velocity, 1);
      // Exact constant-acceleration step, so jump height doesn't depend on frame rate.
      const step = this.velocity * dt + 0.5 * GRAVITY * dt * dt;
      this.offset += step * (this.speedDrop ? SPEED_DROP_COEFFICIENT : 1);
      this.velocity += GRAVITY * dt;
      if (this.offset < -MIN_JUMP_HEIGHT || this.speedDrop) this.reachedMin = true;
      const tooHigh = GROUND_Y - DINO_H + this.offset < MAX_JUMP_TOP;
      if (this.reachedMin && (this.jumpReleased || tooHigh) && this.velocity < DROP_VELOCITY) {
        this.velocity = DROP_VELOCITY;
      }
      if (this.offset >= 0) {
        this.offset = 0;
        this.velocity = 0;
        this.jumping = false;
      }
    } else {
      this.frameTimer += ms;
      if (this.frameTimer >= LEG_FRAME_MS) {
        this.frameTimer = 0;
        this.frame = this.frame ? 0 : 1;
      }
    }
  }

  private updateBackground(dt: number) {
    const dx = this.speed * dt;

    for (const b of this.bumps) b.x -= dx;
    while (this.bumps.length && this.bumps[0].x + this.bumps[0].w < 0) this.bumps.shift();
    const lastBump = this.bumps[this.bumps.length - 1];
    if (!lastBump || lastBump.x < WIDTH) {
      this.bumps.push(this.makeBump((lastBump?.x ?? WIDTH) + randInt(15, 60)));
    }

    for (const c of this.clouds) c.x -= 0.2 * dx;
    while (this.clouds.length && this.clouds[0].x + CLOUD_W < 0) this.clouds.shift();
    const lastCloud = this.clouds[this.clouds.length - 1];
    if (!lastCloud || lastCloud.x < WIDTH - lastCloud.gap) {
      this.clouds.push({ x: WIDTH, y: randInt(30, 71), gap: randInt(100, 400) });
    }

    for (const s of this.stars) {
      s.x -= 0.1 * dx;
      if (s.x < 0) s.x = WIDTH;
    }
    this.skyX -= 0.1 * dx;
    if (this.skyX < -20) this.skyX = WIDTH + 20;
  }

  private updateObstacles(dt: number, ms: number) {
    for (const o of this.obstacles) {
      o.x -= (this.speed + o.speedOffset) * dt;
      if (o.kind === 'ptera') {
        o.frameTimer += ms;
        if (o.frameTimer >= WING_FRAME_MS) {
          o.frameTimer = 0;
          o.frame = o.frame ? 0 : 1;
        }
      }
    }
    while (this.obstacles.length && this.obstacles[0].x + this.obstacles[0].w < 0) {
      this.obstacles.shift();
    }
    const last = this.obstacles[this.obstacles.length - 1];
    if (this.runningTime > CLEAR_TIME && (!last || last.x + last.w + last.gap < WIDTH)) {
      this.spawnObstacle();
    }
  }

  private spawnObstacle() {
    const kinds = (Object.keys(OBSTACLE_TYPES) as ObstacleKind[]).filter(
      (k) => OBSTACLE_TYPES[k].minSpeed <= this.speed,
    );
    let kind: ObstacleKind;
    do {
      kind = kinds[randInt(0, kinds.length - 1)];
    } while (
      this.history.length >= MAX_OBSTACLE_DUPLICATION &&
      this.history.every((k) => k === kind)
    );

    const type = OBSTACLE_TYPES[kind];
    let size = randInt(1, MAX_OBSTACLE_LENGTH);
    if (kind === 'ptera' || this.speed < type.multipleSpeed) size = 1;
    const w = type.w * size;
    const minGap = Math.round(w * this.speed + type.minGap * GAP_COEFFICIENT);

    this.obstacles.push({
      kind,
      x: WIDTH,
      y: kind === 'ptera' ? PTERA_Y[randInt(0, PTERA_Y.length - 1)] : type.y,
      w,
      h: type.h,
      size,
      gap: randInt(minGap, Math.round(minGap * MAX_GAP_COEFFICIENT)),
      speedOffset: kind === 'ptera' ? (Math.random() > 0.5 ? 0.8 : -0.8) : 0,
      frame: 0,
      frameTimer: 0,
    });
    this.history = [...this.history, kind].slice(-MAX_OBSTACLE_DUPLICATION);
  }

  private dinoTop() {
    return this.ducking ? GROUND_Y - DUCK_H : GROUND_Y - DINO_H + this.offset;
  }

  private collides() {
    const top = this.dinoTop();
    const boxes = this.ducking ? DUCK_BOXES : DINO_BOXES;
    return this.obstacles.some((o) => {
      const hit: Box =
        o.kind === 'ptera'
          ? { x: o.x + 4, y: o.y + 8, w: o.w - 8, h: o.h - 16 }
          : { x: o.x + 3, y: o.y + 2, w: o.w - 6, h: o.h - 2 };
      return boxes.some((b) => overlaps({ x: DINO_X + b.x, y: top + b.y, w: b.w, h: b.h }, hit));
    });
  }

  private crash() {
    this.state = 'crashed';
    this.crashedAt = performance.now();
    this.flashing = false;
    if (this.score > this.hi) {
      this.hi = this.score;
      try {
        localStorage.setItem(HI_KEY, String(this.hi));
      } catch {
        // storage unavailable; high score just won't persist
      }
    }
  }

  // ---- draw ----

  private draw() {
    const { ctx } = this;
    const fg = mix(FG, this.dark);
    const bg = mix(BG, this.dark);
    if (bg !== this.lastTheme) {
      this.lastTheme = bg;
      this.onTheme?.({ bg, fg });
    }

    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    this.drawSky(fg, bg);
    for (const c of this.clouds) drawCloud(ctx, c.x, c.y, mix(CLOUD_COLOR, this.dark));
    this.drawGround(fg);
    for (const o of this.obstacles) {
      if (o.kind === 'ptera') drawPtera(ctx, o.x, o.y, o.frame, fg, bg);
      else {
        drawCactus(ctx, o.x, o.y, o.kind === 'cactusSmall' ? 'small' : 'large', o.size, fg);
      }
    }
    this.drawDino(fg, bg);
    this.drawHud();
    if (this.state === 'crashed') this.drawGameOver(fg);
  }

  // Sun by day, moon and stars by night; they share a position and cross-fade.
  private drawSky(fg: string, bg: string) {
    const { ctx } = this;
    if (this.dark < 1) {
      ctx.globalAlpha = 1 - this.dark;
      this.drawSun();
    }
    if (this.dark > 0) {
      ctx.globalAlpha = this.dark;
      ctx.fillStyle = fg;
      for (const s of this.stars) ctx.fillRect(Math.round(s.x), Math.round(s.y), 2, 2);
      ctx.beginPath();
      ctx.arc(this.skyX, SKY_Y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(this.skyX + 6, SKY_Y - 2, 9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawSun() {
    const { ctx } = this;
    const x = Math.round(this.skyX);
    ctx.fillStyle = SUN_COLOR;
    ctx.beginPath();
    ctx.arc(x, SKY_Y, 8, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const rx = Math.round(x + Math.cos(a) * 13);
      const ry = Math.round(SKY_Y + Math.sin(a) * 13);
      ctx.fillRect(rx - 1, ry - 1, 3, 3);
    }
  }

  private drawGround(fg: string) {
    const { ctx } = this;
    ctx.fillStyle = fg;
    ctx.fillRect(0, GROUND_Y, WIDTH, 2);
    for (const b of this.bumps) ctx.fillRect(Math.round(b.x), b.y, b.w, 2);
  }

  private drawDino(fg: string, bg: string) {
    const { ctx } = this;
    const top = this.dinoTop();
    if (this.state === 'crashed') drawDino(ctx, DINO_X, top, 'dead', fg, bg);
    else if (this.ducking) drawDuck(ctx, DINO_X, top, this.frame, fg, bg);
    else {
      const pose: DinoPose =
        this.state === 'idle' || this.jumping ? 'stand' : this.frame ? 'b' : 'a';
      drawDino(ctx, DINO_X, top, pose, fg, bg);
    }
  }

  private drawHud() {
    const { ctx } = this;
    const pad = (n: number) => String(n).padStart(5, '0');
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';

    const scoreText = pad(this.score);
    const hidden = this.flashing && Math.floor(this.flashElapsed / FLASH_STEP_MS) % 2 === 0;
    let x = WIDTH - 12;
    if (!hidden) {
      ctx.fillStyle = mix(FG, this.dark);
      ctx.fillText(scoreText, x, 22);
    }
    if (this.hi > 0) {
      x -= ctx.measureText(scoreText).width + 14;
      ctx.fillStyle = mix(HI, this.dark);
      ctx.fillText(`HI ${pad(this.hi)}`, x, 22);
    }
  }

  private drawGameOver(fg: string) {
    const { ctx } = this;
    const cx = WIDTH / 2;
    ctx.fillStyle = fg;
    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('G A M E   O V E R', cx, 55);

    const cy = 85;
    const r = 11;
    const end = Math.PI * 1.2;
    ctx.strokeStyle = fg;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI * 0.35, end);
    ctx.stroke();

    const ex = cx + r * Math.cos(end);
    const ey = cy + r * Math.sin(end);
    const [tx, ty] = [-Math.sin(end), Math.cos(end)];
    const [nx, ny] = [Math.cos(end), Math.sin(end)];
    ctx.beginPath();
    ctx.moveTo(ex + tx * 6, ey + ty * 6);
    ctx.lineTo(ex + nx * 5, ey + ny * 5);
    ctx.lineTo(ex - nx * 5, ey - ny * 5);
    ctx.closePath();
    ctx.fill();
  }
}
