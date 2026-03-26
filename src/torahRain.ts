// Torah Rain - ambient falling Hebrew characters
// A warm, reverent take on the Matrix rain effect using Hebrew letters

// Hebrew alphabet (22 letters, no finals for visual clarity)
const HEBREW_LETTERS = 'אבגדהוזחטיכלמנסעפצקרשת';

interface RainDrop {
  x: number;       // horizontal position (0-1 normalized)
  y: number;       // vertical position (0-1 normalized, 0=top)
  char: string;    // Hebrew character
  size: number;    // font size in px
  speed: number;   // fall speed (fraction of screen per second)
  opacity: number; // max opacity for this drop
  wobblePhase: number;  // phase offset for horizontal wobble
  wobbleAmp: number;    // amplitude of wobble in px
}

const POOL_SIZE = 45;
const MIN_SIZE = 10;
const MAX_SIZE = 24;
const MIN_SPEED = 0.25;  // screen heights per second (2-4 sec crossing)
const MAX_SPEED = 0.5;
const MIN_OPACITY = 0.08;
const MAX_OPACITY = 0.18;
const WOBBLE_FREQ = 1.5;   // oscillations per second
const MAX_WOBBLE_AMP = 8;  // max horizontal wobble in px
const FADE_ZONE = 0.08;    // bottom 8% of screen for fade-out

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let drops: RainDrop[] = [];
let animFrameId: number = 0;
let lastTime: number = 0;
let running = false;

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function createDrop(startAtTop: boolean = true): RainDrop {
  return {
    x: Math.random(),
    y: startAtTop ? -Math.random() * 0.1 : Math.random(),
    char: HEBREW_LETTERS[Math.floor(Math.random() * HEBREW_LETTERS.length)],
    size: randomBetween(MIN_SIZE, MAX_SIZE),
    speed: randomBetween(MIN_SPEED, MAX_SPEED),
    opacity: randomBetween(MIN_OPACITY, MAX_OPACITY),
    wobblePhase: Math.random() * Math.PI * 2,
    wobbleAmp: randomBetween(2, MAX_WOBBLE_AMP),
  };
}

function recycleDrop(drop: RainDrop): void {
  drop.x = Math.random();
  drop.y = -Math.random() * 0.05;
  drop.char = HEBREW_LETTERS[Math.floor(Math.random() * HEBREW_LETTERS.length)];
  drop.size = randomBetween(MIN_SIZE, MAX_SIZE);
  drop.speed = randomBetween(MIN_SPEED, MAX_SPEED);
  drop.opacity = randomBetween(MIN_OPACITY, MAX_OPACITY);
  drop.wobblePhase = Math.random() * Math.PI * 2;
  drop.wobbleAmp = randomBetween(2, MAX_WOBBLE_AMP);
}

function animate(time: number): void {
  if (!running || !ctx || !canvas) return;

  const dt = lastTime === 0 ? 0.016 : (time - lastTime) / 1000;
  lastTime = time;

  // Clamp dt to avoid huge jumps if tab was hidden
  const clampedDt = Math.min(dt, 0.1);

  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  for (const drop of drops) {
    // Update position
    drop.y += drop.speed * clampedDt;

    // Recycle if off bottom
    if (drop.y > 1.1) {
      recycleDrop(drop);
      continue;
    }

    // Compute fade near bottom
    let alpha = drop.opacity;
    if (drop.y > 1 - FADE_ZONE) {
      alpha *= (1 - drop.y) / FADE_ZONE;
    }
    // Fade in at top
    if (drop.y < 0.05) {
      alpha *= Math.max(0, drop.y / 0.05);
    }

    if (alpha <= 0) continue;

    // Horizontal wobble
    const wobbleX = Math.sin(time / 1000 * WOBBLE_FREQ * Math.PI * 2 + drop.wobblePhase) * drop.wobbleAmp;

    const px = drop.x * w + wobbleX;
    const py = drop.y * h;

    // Golden/warm amber color
    ctx.font = `${drop.size}px "Noto Sans Hebrew", sans-serif`;
    ctx.fillStyle = `rgba(218, 165, 50, ${alpha})`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(drop.char, px, py);
  }

  animFrameId = requestAnimationFrame(animate);
}

/**
 * Initialize the Torah Rain effect.
 * Creates a canvas overlay and starts the animation loop.
 */
export function initTorahRain(): void {
  if (running) return;

  // Create canvas
  canvas = document.createElement('canvas');
  canvas.id = 'torah-rain';
  canvas.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 1;
  `;

  // Insert after the WebGL canvas
  const webglCanvas = document.getElementById('canvas');
  if (webglCanvas && webglCanvas.parentNode) {
    webglCanvas.parentNode.insertBefore(canvas, webglCanvas.nextSibling);
  } else {
    document.body.appendChild(canvas);
  }

  ctx = canvas.getContext('2d');
  if (!ctx) {
    console.warn('Torah Rain: Could not get 2d context');
    return;
  }

  // Size to window, accounting for DPR
  function resize(): void {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
  }
  resize();
  window.addEventListener('resize', resize);

  // Initialize drop pool — spread them across the screen initially
  drops = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    drops.push(createDrop(false));
  }

  running = true;
  lastTime = 0;
  animFrameId = requestAnimationFrame(animate);
}

/**
 * Stop and clean up the Torah Rain effect.
 */
export function destroyTorahRain(): void {
  running = false;
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = 0;
  }
  if (canvas && canvas.parentNode) {
    canvas.parentNode.removeChild(canvas);
  }
  canvas = null;
  ctx = null;
  drops = [];
}
