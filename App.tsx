// tslint:disable
/* eslint-disable */
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Play,
  RotateCw,
  Menu as MenuIcon,
  Volume2,
  VolumeX,
  Trophy,
  HelpCircle,
  X,
  Sparkles,
  Zap,
  Shield,
  Layers,
  Award,
  Compass,
  Orbit,
  Atom,
} from 'lucide-react';
import {getConfig} from './constants';
import BackgroundMusic from './utils/BackgroundMusic';
import {
  createFixedStepper,
  drawAsset,
  GameState,
  MenuOverlay,
  Overlay,
  prepareCanvas,
  useAssets,
  useAutoFocus,
  useInput,
  useIsMobile,
  gameAudio,
} from './utils/helper';
import {
  usePlayground,
  usePlaygroundGameLifecycle,
  useRpc,
} from './utils/usePlayground';

// Dynamic multi-aspect ratio viewport computing helper
interface ViewportDimensions {
  width: number;
  height: number;
  centerX: number;
  baseY: number;
  aspect: number;
}

function computeViewport(windowWidth: number, windowHeight: number): ViewportDimensions {
  const w = windowWidth > 0 ? windowWidth : 720;
  const h = windowHeight > 0 ? windowHeight : 1280;
  const aspect = w / h;
  const baseAspect = 720 / 1280; // ~0.5625

  let logicalWidth = 720;
  let logicalHeight = 1280;

  if (aspect < baseAspect) {
    // Taller screen (portrait 9:18, 9:19.5, 9:20, 9:21, etc.)
    logicalWidth = 720;
    logicalHeight = Math.round(720 / aspect);
  } else {
    // Wider screen (3:4, 16:9, 19.5:9, 21:9 landscape, desktop, tablets)
    logicalHeight = 1280;
    logicalWidth = Math.round(1280 * aspect);
  }

  return {
    width: logicalWidth,
    height: logicalHeight,
    centerX: logicalWidth / 2,
    baseY: logicalHeight - 200,
    aspect,
  };
}

// Color interpolation helpers for 100% seamless atmosphere transitions
interface RGB {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function lerpColor(c1: RGB, c2: RGB, t: number): RGB {
  const f = Math.max(0, Math.min(1, t));
  const smoothT = (1 - Math.cos(f * Math.PI)) / 2;
  return {
    r: Math.round(c1.r + (c2.r - c1.r) * smoothT),
    g: Math.round(c1.g + (c2.g - c1.g) * smoothT),
    b: Math.round(c1.b + (c2.b - c1.b) * smoothT),
  };
}

function rgbToStr(c: RGB, alpha = 1): string {
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
}

// Combo Progression Tiers (8 Complete Tiers)
interface ComboTierInfo {
  tier: number;
  minCombo: number;
  maxCombo: number;
  scale: number;
  color: string;
  name: string;
  heartbeatIntensity: number;
  milestoneTrigger: number | null;
}

const COMBO_TIERS: ComboTierInfo[] = [
  {
    tier: 1,
    minCombo: 2,
    maxCombo: 5,
    scale: 0.8,
    color: '#00ff66', // Neon Green
    name: 'STABLE STACK',
    heartbeatIntensity: 0.0,
    milestoneTrigger: null,
  },
  {
    tier: 2,
    minCombo: 6,
    maxCombo: 15,
    scale: 1.25,
    color: '#00e5ff', // Cyan
    name: 'PRECISION HARBOR',
    heartbeatIntensity: 0.03,
    milestoneTrigger: 6,
  },
  {
    tier: 3,
    minCombo: 16,
    maxCombo: 30,
    scale: 1.6,
    color: '#ffea00', // Yellow
    name: 'STRATOSPHERE VELOCITY',
    heartbeatIntensity: 0.06,
    milestoneTrigger: 16,
  },
  {
    tier: 4,
    minCombo: 31,
    maxCombo: 50,
    scale: 1.9,
    color: '#ff6600', // Orange
    name: 'ORBITAL SYNC',
    heartbeatIntensity: 0.1,
    milestoneTrigger: 31,
  },
  {
    tier: 5,
    minCombo: 51,
    maxCombo: 99,
    scale: 2.2,
    color: '#e6007e', // Magenta
    name: 'COSMIC RESONANCE',
    heartbeatIntensity: 0.15,
    milestoneTrigger: 51,
  },
  {
    tier: 6,
    minCombo: 100,
    maxCombo: 149,
    scale: 4.2,
    color: '#a855f7', // Hyper Electric Violet
    name: 'ELECTRIC CELESTIAL',
    heartbeatIntensity: 0.20,
    milestoneTrigger: 100,
  },
  {
    tier: 7,
    minCombo: 150,
    maxCombo: 199,
    scale: 5.0,
    color: '#ffd700', // Radiant Solar Gold
    name: 'SOLAR FLARE DOMAIN',
    heartbeatIntensity: 0.25,
    milestoneTrigger: 150,
  },
  {
    tier: 8,
    minCombo: 200,
    maxCombo: 999999,
    scale: 6.0,
    color: '#ec4899', // Transcendent Rainbow / Helix Nebula
    name: 'TRANSCENDENT ZENITH',
    heartbeatIntensity: 0.30,
    milestoneTrigger: 200,
  },
];

function getComboTier(combo: number): ComboTierInfo | null {
  if (combo < 2) return null;
  for (const t of COMBO_TIERS) {
    if (combo >= t.minCombo && combo <= t.maxCombo) return t;
  }
  return COMBO_TIERS[COMBO_TIERS.length - 1];
}

// Sky atmosphere palettes across altitude (expanded for Helix Nebula up to 250)
interface SkyPalette {
  altitude: number;
  top: RGB;
  mid: RGB;
  bottom: RGB;
}

const SKY_STOPS: SkyPalette[] = [
  {
    altitude: 0, // Sunny Harbor (Daytime)
    top: hexToRgb('#38bdf8'),
    mid: hexToRgb('#7dd3fc'),
    bottom: hexToRgb('#e0f2fe'),
  },
  {
    altitude: 18, // Blue Sky
    top: hexToRgb('#2563eb'),
    mid: hexToRgb('#60a5fa'),
    bottom: hexToRgb('#bfdbfe'),
  },
  {
    altitude: 50, // Mid Troposphere
    top: hexToRgb('#1e40af'),
    mid: hexToRgb('#3b82f6'),
    bottom: hexToRgb('#93c5fd'),
  },
  {
    altitude: 85, // Stratosphere / Deep Twilight
    top: hexToRgb('#0f172a'),
    mid: hexToRgb('#1e1b4b'),
    bottom: hexToRgb('#312e81'),
  },
  {
    altitude: 130, // Outer Cosmos / Deep Space
    top: hexToRgb('#030208'),
    mid: hexToRgb('#0b051e'),
    bottom: hexToRgb('#060312'),
  },
  {
    altitude: 175, // Stage 5: Asteroid Belt & Lunar Approach
    top: hexToRgb('#020106'),
    mid: hexToRgb('#140624'),
    bottom: hexToRgb('#070214'),
  },
  {
    altitude: 200, // Lunar Orbit Zenith
    top: hexToRgb('#000000'),
    mid: hexToRgb('#0b0818'),
    bottom: hexToRgb('#030208'),
  },
  {
    altitude: 225, // Helix Nebula Outskirts
    top: hexToRgb('#020006'),
    mid: hexToRgb('#130324'),
    bottom: hexToRgb('#090116'),
  },
  {
    altitude: 250, // Helix Nebula Core / Singularity Gate
    top: hexToRgb('#03000a'),
    mid: hexToRgb('#1c0432'),
    bottom: hexToRgb('#0d021c'),
  },
];

function getContinuousSkyGradient(
  ctx: CanvasRenderingContext2D,
  height: number,
  altitudeVal: number,
): CanvasGradient {
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  const alt = Math.max(0, altitudeVal);

  let lower = SKY_STOPS[0];
  let upper = SKY_STOPS[SKY_STOPS.length - 1];

  for (let i = 0; i < SKY_STOPS.length - 1; i++) {
    if (alt >= SKY_STOPS[i].altitude && alt <= SKY_STOPS[i + 1].altitude) {
      lower = SKY_STOPS[i];
      upper = SKY_STOPS[i + 1];
      break;
    }
  }

  const range = upper.altitude - lower.altitude;
  const t = range > 0 ? (alt - lower.altitude) / range : 0;

  const topColor = rgbToStr(lerpColor(lower.top, upper.top, t));
  const midColor = rgbToStr(lerpColor(lower.mid, upper.mid, t));
  const botColor = rgbToStr(lerpColor(lower.bottom, upper.bottom, t));

  grad.addColorStop(0, topColor);
  grad.addColorStop(0.5, midColor);
  grad.addColorStop(1, botColor);

  return grad;
}

// Container Branding Themes
interface ContainerBrand {
  name: string;
  code: string;
  bgGradStart: string;
  bgGradEnd: string;
  ribColor: string;
  accentColor: string;
  textColor: string;
  shadowColor: string;
  tagline: string;
}

const BRANDS: ContainerBrand[] = [
  {
    name: 'UAN',
    code: 'UAN-01',
    bgGradStart: '#e6007e',
    bgGradEnd: '#b80064',
    ribColor: 'rgba(255, 255, 255, 0.22)',
    accentColor: '#ffb3d9',
    textColor: '#ffffff',
    shadowColor: 'rgba(0, 0, 0, 0.85)',
    tagline: 'MAGENTA EXPRESS',
  },
  {
    name: 'JAPAG-LOID',
    code: 'JPL-02',
    bgGradStart: '#f37021',
    bgGradEnd: '#c85510',
    ribColor: 'rgba(255, 255, 255, 0.22)',
    accentColor: '#fed7aa',
    textColor: '#ffffff',
    shadowColor: 'rgba(0, 0, 0, 0.85)',
    tagline: 'GLOBAL LOGISTICS',
  },
  {
    name: 'MERSC',
    code: 'MSC-03',
    bgGradStart: '#00b0f0',
    bgGradEnd: '#0084b4',
    ribColor: 'rgba(255, 255, 255, 0.22)',
    accentColor: '#b9f3fc',
    textColor: '#ffffff',
    shadowColor: 'rgba(0, 0, 0, 0.85)',
    tagline: 'OCEAN CARRIER',
  },
  {
    name: 'EMESCI',
    code: 'EMS-04',
    bgGradStart: '#ffea00',
    bgGradEnd: '#d8c600',
    ribColor: 'rgba(0, 0, 0, 0.18)',
    accentColor: '#fde047',
    textColor: '#ffffff',
    shadowColor: 'rgba(0, 0, 0, 0.85)',
    tagline: 'CONTINENTAL FREIGHT',
  },
  {
    name: 'EBERGRIN',
    code: 'EBG-05',
    bgGradStart: '#00ff66',
    bgGradEnd: '#00cc52',
    ribColor: 'rgba(0, 0, 0, 0.18)',
    accentColor: '#86efac',
    textColor: '#ffffff',
    shadowColor: 'rgba(0, 0, 0, 0.85)',
    tagline: 'SEAWAY LINES',
  },
];

// Morse Code Timing Array for L-O-V-E-U
const MORSE_LOVE_U: number[] = [
  1, 0, 1, 1, 1, 0, 1, 0, 1,
  0, 0, 0,
  1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1,
  0, 0, 0,
  1, 0, 1, 0, 1, 0, 1, 1, 1,
  0, 0, 0,
  1,
  0, 0, 0,
  1, 0, 1, 0, 1, 1, 1,
  0, 0, 0, 0, 0, 0, 0,
];

// Stacked Container Entity
interface StackedBlock {
  x: number;
  y: number;
  brandIndex: number;
  isPerfect: boolean;
  offset: number;
  // Singularity suction deformation
  singularityOffsetX?: number;
  singularityOffsetY?: number;
  singularityScale?: number;
  singularityAngle?: number;
  singularityAlpha?: number;
}

// Particle interface
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  shape?: 'spark' | 'circle' | 'dust' | 'confetti' | 'smoke' | 'trail' | 'debris' | 'star';
}

// Shockwave Ring interface
interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
  width: number;
}

// Floating Toast Notification
interface FloatingText {
  id: number;
  text: string;
  x: number;
  y: number;
  alpha: number;
  color: string;
  scale: number;
  isPerfect?: boolean;
}

// Atmospheric & Stage Background Entities
interface HarborTugboat {
  x: number;
  y: number;
  speed: number;
  smokeTimer: number;
  soundTimer: number;
}

interface HarborBuoy {
  x: number;
  baseY: number;
  bobPhase: number;
  bellTimer: number;
  lightState: boolean;
}

interface Dolphin {
  x: number;
  baseY: number;
  speed: number;
  progress: number;
  leapActive: boolean;
  leapCooldown: number;
  jumpRadius: number;
}

interface Pelican {
  x: number;
  y: number;
  speed: number;
  scale: number;
  wingPhase: number;
}

interface HotAirBalloon {
  x: number;
  y: number;
  speed: number;
  scale: number;
  colors: [string, string, string];
  burnerTimer: number;
  burnerBurst: number;
}

interface BirdFlock {
  x: number;
  y: number;
  speed: number;
  scale: number;
  chirpTimer: number;
  wingPhase: number;
}

interface Paraglider {
  x: number;
  y: number;
  speed: number;
  scale: number;
  canopyColor: string;
  swayPhase: number;
}

interface WindStream {
  x: number;
  y: number;
  speed: number;
  length: number;
  alpha: number;
}

interface SupersonicJet {
  x: number;
  y: number;
  speed: number;
  scale: number;
  isStealth: boolean;
  flybyPlayed: boolean;
}

interface WeatherBalloon {
  x: number;
  y: number;
  speed: number;
  scale: number;
  telemetryTimer: number;
  radarAngle: number;
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  len: number;
}

interface CosmicShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  angle: number;
  life: number;
  maxLife: number;
  len: number;
  width: number;
  headColor: string;
  tailColor: string;
  tailEndColor: string;
  glowColor: string;
  stardustTimer: number;
}

interface SpaceStation {
  x: number;
  y: number;
  speed: number;
  rotAngle: number;
  beaconTimer: number;
}

interface Astronaut {
  x: number;
  y: number;
  speed: number;
  wavePhase: number;
  tetherX: number;
  tetherY: number;
}

interface Comet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
  tailTimer: number;
  fizzPlayed: boolean;
}

interface UFOEntity {
  x: number;
  y: number;
  speed: number;
  beamPhase: number;
  humTimer: number;
}

interface BeltAsteroid {
  x: number;
  y: number;
  speedX: number;
  speedY: number;
  rot: number;
  rotSpeed: number;
  radius: number;
  baseColor: string;
  shadeColor: string;
  craters: {cx: number; cy: number; r: number}[];
}

// Container Vector Renderer
function drawVectorContainer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  brand: ContainerBrand,
) {
  ctx.save();
  ctx.translate(x, y);

  // 1. Container Body Base Gradient
  const bodyGrad = ctx.createLinearGradient(0, 0, 0, h);
  bodyGrad.addColorStop(0, brand.bgGradStart);
  bodyGrad.addColorStop(1, brand.bgGradEnd);
  ctx.fillStyle = bodyGrad;
  ctx.fillRect(0, 0, w, h);

  // 2. Corrugated Steel Ribs
  const ribCount = 18;
  const ribW = w / ribCount;
  for (let r = 0; r < ribCount; r++) {
    const rx = r * ribW;
    ctx.fillStyle = r % 2 === 0 ? brand.ribColor : 'rgba(0, 0, 0, 0.14)';
    ctx.fillRect(rx, 6, ribW * 0.5, h - 12);
  }

  // 3. Top & Bottom Structural Rails
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(0, 0, w, 6);
  ctx.fillRect(0, h - 6, w, 6);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.fillRect(0, 0, w, 2);

  // 4. ISO Corner Castings & Twistlock Apertures
  const cornerSize = 14;
  const corners = [
    {cx: 0, cy: 0},
    {cx: w - cornerSize, cy: 0},
    {cx: 0, cy: h - cornerSize},
    {cx: w - cornerSize, cy: h - cornerSize},
  ];

  ctx.fillStyle = '#0f172a';
  for (const c of corners) {
    ctx.fillRect(c.cx, c.cy, cornerSize, cornerSize);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1;
    ctx.strokeRect(c.cx, c.cy, cornerSize, cornerSize);

    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.ellipse(
      c.cx + cornerSize / 2,
      c.cy + cornerSize / 2,
      cornerSize * 0.3,
      cornerSize * 0.2,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.fillStyle = '#0f172a';
  }

  // 5. Container Brand Logo Banner & Stencil Typography
  const bannerW = w * 0.72;
  const bannerH = h * 0.44;
  const bannerX = (w - bannerW) / 2;
  const bannerY = (h - bannerH) / 2;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.46)';
  ctx.fillRect(bannerX, bannerY, bannerW, bannerH);
  ctx.strokeStyle = brand.accentColor;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(bannerX, bannerY, bannerW, bannerH);

  ctx.font = '900 24px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.strokeText(brand.name, w / 2, bannerY + bannerH * 0.42);

  ctx.fillStyle = brand.textColor;
  ctx.shadowColor = brand.shadowColor;
  ctx.shadowBlur = 6;
  ctx.fillText(brand.name, w / 2, bannerY + bannerH * 0.42);

  ctx.font = '800 9px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = brand.accentColor;
  ctx.shadowBlur = 0;
  ctx.fillText(brand.tagline, w / 2, bannerY + bannerH * 0.78);

  ctx.font = '800 8px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillText(brand.code, w - 18, 14);

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, w, h);

  ctx.restore();
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stepperRef = useRef<ReturnType<typeof createFixedStepper>>();
  const lastCancelRef = useRef(false);
  const isMobile = useIsMobile();

  // Multi-Aspect Ratio Dynamic Viewport State & Lifecycle
  const [viewport, setViewport] = useState<ViewportDimensions>(() =>
    computeViewport(
      typeof window !== 'undefined' ? window.innerWidth : 720,
      typeof window !== 'undefined' ? window.innerHeight : 1280,
    ),
  );
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  useEffect(() => {
    const handleResize = () => {
      const nextVp = computeViewport(window.innerWidth, window.innerHeight);
      setViewport(nextVp);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Playground SDK Integration
  const {sdk} = usePlayground();
  const [exitChat] = useRpc<Record<string, unknown>, void>('ExitChat');

  // Asset Manifest
  const ASSETS_MANIFEST: Record<string, string> = {
    crane_hook: 'assets/images/crane_hook_spreader.png',
    ship_hull: 'assets/images/container_ship_hull.png',
    ui_restart: 'assets/images/ui_restart_icon.png',
    ui_trophy: 'assets/images/ui_trophy_icon.png',
  };
  const {assets, isReady: assetsReady} = useAssets(ASSETS_MANIFEST);

  if (!stepperRef.current) {
    const stepMs = getConfig('stepMs');
    const maxSubSteps = getConfig('maxSubSteps');
    stepperRef.current = createFixedStepper(stepMs, maxSubSteps);
  }

  // Reactive Game State
  const [gameState, setGameState] = useState<GameState>({
    status: 'START',
    score: 0,
    level: 1,
    combo: 0,
    stability: 100,
  });

  const [highScore, setHighScore] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('cargostack_highscore');
      return saved ? parseInt(saved, 10) || 0 : 0;
    } catch {
      return 0;
    }
  });

  const [adminMode, setAdminMode] = useState(false);
  const adminModeRef = useRef(adminMode);
  adminModeRef.current = adminMode;
  const adminTapCountRef = useRef(0);
  const adminTapTimerRef = useRef<number | null>(null);

  const [singularityAnimTime, setSingularityAnimTime] = useState(0);
  const [showSingularityScreen, setShowSingularityScreen] = useState(false);
  const showSingularityScreenRef = useRef(false);

  const [isGameMenuOpen, setIsGameMenuOpen] = useState(false);
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const [isMusicMuted, setIsMusicMuted] = useState(false);
  const [isSfxMuted, setIsSfxMuted] = useState(false);

  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  useEffect(() => {
    (window as any).canHandleBackKey = gameState.status !== 'START';
  }, [gameState.status]);

  const inputRef = useInput(canvasRef, true, {
    width: viewport.width,
    height: viewport.height,
  });

  // ----------------------------------------------------
  // SIMULATION STATE (Viewport Adaptive Coordinates)
  // ----------------------------------------------------
  const sim = useRef({
    // Target Count (Dynamically expands from 200 to 250 when unlocking Helix Nebula)
    targetWinCount: 200,
    isHelixUnlocked: false,
    victoryMode: 'MOON' as 'MOON' | 'NEBULA' | 'SINGULARITY',

    // Camera
    cameraY: 0,
    targetCameraY: 0,
    screenShake: 0,
    shakeRot: 0,
    predictiveShake: 0,

    // Crane & Hook Kinematics
    swingTime: 0,
    craneX: viewport.centerX,
    hookX: viewport.centerX + 220,
    hookY: 200,
    hookVx: 0,
    hookVy: 0,
    trolleyX: viewport.centerX,

    // Container in Hook
    isHolding: true,
    currentBrand: 0,
    clampOpenRatio: 0,

    // Dropping Container & Freefalling Missed Blocks
    dropping: null as {
      x: number;
      y: number;
      vx: number;
      vy: number;
      brandIndex: number;
      rotation: number;
      vRot: number;
    } | null,
    missedBlocks: [] as {
      x: number;
      y: number;
      vx: number;
      vy: number;
      brandIndex: number;
      rotation: number;
      vRot: number;
      isMissed: boolean;
    }[],

    // Stack & Physics
    stack: [] as StackedBlock[],
    baseY: viewport.baseY,
    shipX: viewport.centerX,
    totalWobble: 0,
    wobbleAngle: 0,
    wobbleVelocity: 0,
    combo: 0,
    maxCombo: 0,
    score: 0,
    perfectCount: 0,

    // Particles & FX
    particles: [] as Particle[],
    shockwaves: [] as Shockwave[],
    floatingTexts: [] as FloatingText[],
    windParticles: [] as {x: number; y: number; vx: number; vy: number; len: number; alpha: number; thickness: number}[],
    wavePhase: 0,
    heartbeatPhase: 0,
    heartbeatIntensity: 0,
    milestoneFlash: null as {color: string; alpha: number; text: string} | null,

    // Stage 1 Elements (Daytime Harbor: 0-15)
    tugboats: [] as HarborTugboat[],
    buoys: [] as HarborBuoy[],
    dolphins: [] as Dolphin[],
    pelicans: [] as Pelican[],
    foghornTimer: 10,
    waveAudioTimer: 1.5,
    seagullAudioTimer: 3.5,
    lighthouseAngle: 0,

    // Stage 2 Elements (Blue Sky: 16-50)
    balloons: [] as HotAirBalloon[],
    flocks: [] as BirdFlock[],
    paragliders: [] as Paraglider[],
    windStreams: [] as WindStream[],
    windGustCooldown: 8,
    windGustDuration: 0,
    windGustTotalDur: 2.8,
    windGustDir: 1,
    windGustForce: 0,

    // Stage 3 Elements (Stratosphere / Twilight: 51-100)
    activePlane: null as SupersonicJet | null,
    planeSpawnCooldown: 2.0,
    weatherBalloons: [] as WeatherBalloon[],
    shootingStars: [] as ShootingStar[],
    shootingStarTimer: 4,
    auroraTimer: 16,
    auroraPhase: 0,

    // Stage 4 Elements (Cosmos: 101-140)
    spaceStations: [] as SpaceStation[],
    astronauts: [] as Astronaut[],
    comets: [] as Comet[],
    cometSpawnTimer: 8,
    cosmicShootingStars: [] as CosmicShootingStar[],
    cosmicShootingStarTimer: 1.5,
    ufos: [] as UFOEntity[],
    starfield: [] as {x: number; y: number; size: number; alpha: number; speed: number; color: string}[],
    asteroids: [] as {x: number; y: number; speed: number; rot: number; rotSpeed: number; scale: number}[],
    cosmicTimer: 18,

    // Stage 5 Elements (Dense Asteroid Belt & Lunar Orbit: 141-199)
    beltAsteroids: [] as BeltAsteroid[],
    spaceDustTimer: 0.1,
    asteroidRumbleTimer: 6,

    // Secret Helix Nebula & Singularity State
    helixAngle: 0,
    helixPulse: 0,
    isSingularityActive: false,
    singularityTime: 0,
    singularityProgress: 0, // 0 to 1
    singularityDiskAngle: 0,
    singularityFlare: 0,
    craneShearProgress: 0,
    uiShards: [] as {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      alpha: number;
      rot: number;
      vRot: number;
      targetAngle: number;
      dist: number;
    }[],

    // Victory Finale Cinematic State
    victoryTimer: 0,
    victoryCameraGlide: 0,

    // Input & Collapse
    hasTriggeredDrop: false,
    tapCooldown: 0,
    collapseTimer: 0,
    isCollapsing: false,
  });

  // Initialize background simulation pool adapted to viewport
  useEffect(() => {
    const s = sim.current;
    const vp = viewportRef.current;
    const width = vp.width;
    const height = vp.height;

    if (s.starfield.length === 0) {
      const colors = ['#ffffff', '#bae6fd', '#fef08a', '#e9d5ff', '#a7f3d0', '#f472b6', '#38bdf8'];
      for (let i = 0; i < 260; i++) {
        s.starfield.push({
          x: Math.random() * width,
          y: Math.random() * height * 2,
          size: Math.random() * 2.8 + 0.8,
          alpha: Math.random() * 0.7 + 0.3,
          speed: Math.random() * 2 + 1,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }

      s.tugboats = [
        {x: width * 0.15, y: height - 135, speed: 22, smokeTimer: 0, soundTimer: 3},
        {x: width * 0.75, y: height - 105, speed: -18, smokeTimer: 0, soundTimer: 9},
      ];
      s.buoys = [
        {x: width * 0.22, baseY: height - 130, bobPhase: 0, bellTimer: 6, lightState: true},
        {x: width * 0.82, baseY: height - 120, bobPhase: 2.2, bellTimer: 12, lightState: false},
      ];
      s.dolphins = [
        {x: width * 0.32, baseY: height - 125, speed: 65, progress: 0, leapActive: false, leapCooldown: 3, jumpRadius: 38},
        {x: width * 0.68, baseY: height - 115, speed: 60, progress: 0, leapActive: false, leapCooldown: 8, jumpRadius: 42},
      ];
      s.pelicans = [
        {x: 60, y: height - 360, speed: 52, scale: 1.0, wingPhase: 0},
        {x: width * 0.45, y: height - 400, speed: 46, scale: 0.85, wingPhase: 1.5},
        {x: width * 0.8, y: height - 330, speed: 58, scale: 1.1, wingPhase: 3.2},
      ];

      s.balloons = [
        {x: width * 0.75, y: 440, speed: -14, scale: 1.1, colors: ['#f43f5e', '#fbbf24', '#06b6d4'], burnerTimer: 4, burnerBurst: 0},
        {x: width * 0.2, y: 620, speed: 12, scale: 0.85, colors: ['#8b5cf6', '#ec4899', '#38bdf8'], burnerTimer: 7, burnerBurst: 0},
      ];
      s.flocks = [
        {x: -150, y: 380, speed: 55, scale: 1.0, chirpTimer: 5, wingPhase: 0},
      ];
      s.paragliders = [
        {x: width * 0.85, y: 520, speed: -18, scale: 0.95, canopyColor: '#f97316', swayPhase: 0},
      ];
      s.windStreams = [
        {x: -100, y: 340, speed: 90, length: 180, alpha: 0.28},
        {x: width * 0.3, y: 480, speed: 110, length: 240, alpha: 0.22},
        {x: -250, y: 580, speed: 80, length: 210, alpha: 0.25},
      ];

      s.activePlane = null;
      s.planeSpawnCooldown = 1.5;
      s.weatherBalloons = [
        {x: width * 0.65, y: 320, speed: 10, scale: 1.0, telemetryTimer: 3, radarAngle: 0},
      ];
      s.shootingStars = [];

      s.spaceStations = [
        {x: width * 0.72, y: 180, speed: -8, rotAngle: 0, beaconTimer: 4},
      ];
      s.astronauts = [
        {x: width * 0.28, y: 260, speed: 5, wavePhase: 0, tetherX: width * 0.22, tetherY: 190},
      ];
      s.ufos = [
        {x: -120, y: 140, speed: 38, beamPhase: 0, humTimer: 5},
      ];
      s.asteroids = [
        {x: width * 0.15, y: 120, speed: 14, rot: 0, rotSpeed: 0.6, scale: 1.2},
        {x: width * 0.55, y: 80, speed: -12, rot: 1, rotSpeed: -0.4, scale: 0.9},
        {x: width * 0.85, y: 200, speed: 16, rot: 2, rotSpeed: 0.8, scale: 1.4},
      ];
      s.comets = [
        {x: width + 50, y: -50, vx: -280, vy: 160, active: false, tailTimer: 0, fizzPlayed: false},
      ];

      s.beltAsteroids = [
        {
          x: width * 0.12,
          y: 180,
          speedX: 12,
          speedY: 4,
          rot: 0.2,
          rotSpeed: 0.35,
          radius: 38,
          baseColor: '#78716c',
          shadeColor: '#292524',
          craters: [
            {cx: -10, cy: -8, r: 8},
            {cx: 12, cy: 10, r: 10},
            {cx: 4, cy: -14, r: 6},
          ],
        },
        {
          x: width * 0.8,
          y: 280,
          speedX: -16,
          speedY: -3,
          rot: 1.5,
          rotSpeed: -0.45,
          radius: 52,
          baseColor: '#64748b',
          shadeColor: '#1e293b',
          craters: [
            {cx: -15, cy: 12, r: 12},
            {cx: 14, cy: -12, r: 9},
            {cx: -5, cy: -18, r: 7},
            {cx: 18, cy: 14, r: 6},
          ],
        },
        {
          x: width * 0.44,
          y: 110,
          speedX: 8,
          speedY: 6,
          rot: 3.2,
          rotSpeed: 0.25,
          radius: 26,
          baseColor: '#71717a',
          shadeColor: '#27272a',
          craters: [
            {cx: -4, cy: 4, r: 6},
            {cx: 8, cy: -6, r: 5},
          ],
        },
        {
          x: width * 0.28,
          y: 420,
          speedX: -10,
          speedY: 2,
          rot: 0.8,
          rotSpeed: 0.5,
          radius: 44,
          baseColor: '#854d0e',
          shadeColor: '#451a03',
          craters: [
            {cx: -12, cy: -6, r: 9},
            {cx: 10, cy: 8, r: 11},
          ],
        },
      ];
    }
  }, []);

  // Start / Restart Session
  const initGame = useCallback(() => {
    const s = sim.current;
    const vp = viewportRef.current;

    s.targetWinCount = 200;
    s.isHelixUnlocked = false;
    s.victoryMode = 'MOON';
    s.isSingularityActive = false;
    s.singularityTime = 0;
    s.singularityProgress = 0;
    s.singularityDiskAngle = 0;
    s.singularityFlare = 0;
    s.craneShearProgress = 0;
    s.uiShards = [];
    s.helixAngle = 0;
    s.helixPulse = 0;

    s.cameraY = 0;
    s.targetCameraY = 0;
    s.screenShake = 0;
    s.shakeRot = 0;
    s.predictiveShake = 0;
    s.swingTime = 0;
    s.craneX = vp.centerX;
    s.hookX = vp.centerX + 220;
    s.hookY = 200;
    s.hookVx = 0;
    s.hookVy = 0;
    s.trolleyX = vp.centerX;
    s.isHolding = true;
    s.currentBrand = 0;
    s.clampOpenRatio = 0;
    s.dropping = null;
    s.missedBlocks = [];
    s.stack = [];
    s.baseY = vp.baseY;
    s.shipX = vp.centerX;
    s.totalWobble = 0;
    s.wobbleAngle = 0;
    s.wobbleVelocity = 0;
    s.combo = 0;
    s.maxCombo = 0;
    s.score = 0;
    s.perfectCount = 0;
    s.particles = [];
    s.shockwaves = [];
    s.floatingTexts = [];
    s.windParticles = [];
    s.wavePhase = 0;
    s.heartbeatPhase = 0;
    s.heartbeatIntensity = 0;
    s.milestoneFlash = null;
    s.foghornTimer = 10;
    s.waveAudioTimer = 1.5;
    s.seagullAudioTimer = 3.5;
    s.windGustCooldown = 8;
    s.windGustDuration = 0;
    s.windGustForce = 0;
    s.activePlane = null;
    s.planeSpawnCooldown = 1.5;
    s.shootingStarTimer = 4;
    s.cosmicShootingStars = [];
    s.cosmicShootingStarTimer = 1.5;
    s.auroraTimer = 16;
    s.cosmicTimer = 18;
    s.asteroidRumbleTimer = 7;
    s.victoryTimer = 0;
    s.victoryCameraGlide = 0;
    s.hasTriggeredDrop = false;
    s.tapCooldown = 0;
    s.collapseTimer = 0;
    s.isCollapsing = false;

    showSingularityScreenRef.current = false;
    setShowSingularityScreen(false);
    setSingularityAnimTime(0);

    gameAudio.stopJetEngine();
    gameAudio.stopSingularityDrone();

    setGameState({
      status: 'PLAYING',
      score: 0,
      level: 1,
      combo: 0,
      stability: 100,
    });
    setIsGameMenuOpen(false);
    setIsHowToPlayOpen(false);

    if (sdk) {
      sdk.startGame();
    }
  }, [sdk]);

  // Audio stingers on game completion
  useEffect(() => {
    if (gameState.status === 'GAME_OVER') {
      gameAudio.stopJetEngine();
      gameAudio.stopSingularityDrone();
      gameAudio.playDefeatMotif();
    } else if (gameState.status === 'VICTORY') {
      gameAudio.stopJetEngine();
      gameAudio.stopSingularityDrone();
      gameAudio.playVictoryFanfare();
    } else if (gameState.status === 'SINGULARITY') {
      gameAudio.stopJetEngine();
      gameAudio.startSingularityDrone();
    } else if (gameState.status === 'START') {
      gameAudio.stopJetEngine();
      gameAudio.stopSingularityDrone();
    }
  }, [gameState.status]);

  // Lifecycle SDK
  usePlaygroundGameLifecycle(gameState, sdk);

  // Autoplay support
  const hasAutoplayed = useRef(false);
  useEffect(() => {
    if (
      !hasAutoplayed.current &&
      new URLSearchParams(window.location.search).has('autoplay')
    ) {
      hasAutoplayed.current = true;
      initGame();
    }
  }, [initGame]);

  // Helper to spawn floating toast
  const spawnToast = (
    text: string,
    x: number,
    y: number,
    color = '#38bdf8',
    isPerfect = false,
    customScale?: number,
  ) => {
    const vp = viewportRef.current;
    const tier = getComboTier(sim.current.combo);
    const resolvedScale =
      customScale !== undefined
        ? customScale
        : isPerfect && tier
        ? tier.scale
        : isPerfect
        ? 1.4
        : 1.0;

    const clampedX = Math.max(160, Math.min(vp.width - 160, x));

    sim.current.floatingTexts.push({
      id: Math.random(),
      text,
      x: clampedX,
      y,
      alpha: 1.0,
      color,
      scale: resolvedScale,
      isPerfect,
    });
  };

  const handleSecretTap = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (adminTapTimerRef.current) {
      window.clearTimeout(adminTapTimerRef.current);
    }
    adminTapCountRef.current += 1;
    adminTapTimerRef.current = window.setTimeout(() => {
      adminTapCountRef.current = 0;
    }, 5000);

    if (adminTapCountRef.current >= 20) {
      adminTapCountRef.current = 0;
      setAdminMode((prev) => {
        const next = !prev;
        if (next) {
          gameAudio.playPowerupChime();
          spawnToast('ADMIN MODE: ON', viewportRef.current.centerX, 280, '#38bdf8', true, 1.4);
        } else {
          gameAudio.playCrispClick();
          spawnToast('ADMIN MODE: OFF', viewportRef.current.centerX, 280, '#94a3b8', false, 1.2);
        }
        return next;
      });
    }
  };

  // Helper to spawn impact particles & sparks
  const spawnImpactVFX = (
    x: number,
    y: number,
    color: string,
    isPerfect = false,
    combo = 0,
  ) => {
    const s = sim.current;
    const isStage5 = s.stack.length >= 141;
    const count = isPerfect ? (combo >= 200 ? 80 : combo >= 100 ? 64 : combo >= 4 ? 48 : 36) : 20;

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = isPerfect
        ? (240 + Math.random() * 320 + Math.min(100, combo * 10)) * (isStage5 ? 0.75 : 1.0)
        : (130 + Math.random() * 180) * (isStage5 ? 0.75 : 1.0);
      s.particles.push({
        x: x + (Math.random() - 0.5) * 80,
        y: y + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: (Math.sin(angle) * speed - 90) * (isStage5 ? 0.6 : 1.0),
        size: isPerfect ? 5 + Math.random() * 6 : 3 + Math.random() * 4,
        color:
          combo >= 200
            ? ['#ffffff', '#ffd700', '#a855f7', '#38bdf8', '#ff3366', '#22d3ee'][i % 6]
            : combo >= 150
            ? ['#ffd700', '#ff3366', '#ffffff'][i % 3]
            : combo >= 100
            ? ['#a855f7', '#38bdf8', '#ffffff'][i % 3]
            : i % 3 === 0
            ? '#ffffff'
            : i % 2 === 0
            ? color
            : combo >= 5
            ? '#f43f5e'
            : '#facc15',
        alpha: 1.0,
        life: 0,
        maxLife: isPerfect ? 0.9 + Math.random() * 0.5 : 0.55 + Math.random() * 0.3,
        shape: isPerfect && i % 3 === 0 ? 'confetti' : 'spark',
      });
    }

    if (isPerfect) {
      const swColor =
        combo >= 200
          ? '#ec4899'
          : combo >= 150
          ? '#ffd700'
          : combo >= 100
          ? '#a855f7'
          : combo >= 5
          ? '#f43f5e'
          : '#38bdf8';

      s.shockwaves.push({
        x,
        y,
        radius: 12,
        maxRadius: 220 + Math.min(140, combo * 15),
        alpha: 1.0,
        color: swColor,
        width: 7,
      });
      s.shockwaves.push({
        x,
        y,
        radius: 6,
        maxRadius: 160 + Math.min(90, combo * 10),
        alpha: 0.95,
        color: '#facc15',
        width: 5,
      });
      if (combo >= 4) {
        s.shockwaves.push({
          x,
          y,
          radius: 2,
          maxRadius: 100,
          alpha: 1.0,
          color: '#ec4899',
          width: 4,
        });
      }
    }
  };

  // ----------------------------------------------------
  // MAIN UPDATE LOOP (Fixed Stepper Physics & Audio Triggers)
  // ----------------------------------------------------
  const update = (deltaTime: number) => {
    const s = sim.current;
    const vp = viewportRef.current;
    const status = gameStateRef.current.status;

    // SINGULARITY APOCALYPTIC BLACK HOLE COLLAPSE (EPIC 5-PHASE CINEMATIC SEQUENCE)
    if (status === 'SINGULARITY') {
      s.singularityTime += deltaTime;
      const t = s.singularityTime;
      s.singularityProgress = Math.min(1.0, t / 19.0);
      s.singularityDiskAngle += deltaTime * (2.0 + Math.min(6.0, t * 0.4));
      s.helixPulse += deltaTime * 2.8;

      // Sync React state for fluid DOM HUD suction animation and finale screen
      setSingularityAnimTime(t);
      if (t >= 18.8 && !showSingularityScreenRef.current) {
        showSingularityScreenRef.current = true;
        setShowSingularityScreen(true);
      }

      const bhX = vp.centerX;
      const bhY = vp.height * 0.45;
      const baseBhRadius = 92;

      // Multi-phase acoustic synthesizer automation
      gameAudio.updateSingularityAudio(t);

      // --- PHASE 1: Spacetime Gravitational Rupture (0.0s - 4.0s) ---
      if (t < 4.0) {
        const p1 = t / 4.0;
        s.screenShake = (0.5 + 0.5 * Math.sin(t * 12)) * (3.5 * p1);

        // Blinding photon pulses from the quantum tear
        if (Math.random() < 0.45) {
          const a = Math.random() * Math.PI * 2;
          const dist = 30 + Math.random() * 80;
          s.particles.push({
            x: bhX + Math.cos(a) * dist,
            y: bhY + Math.sin(a) * dist,
            vx: -Math.cos(a) * 180,
            vy: -Math.sin(a) * 180,
            size: 2.0 + Math.random() * 3.0,
            color: Math.random() > 0.5 ? '#ffffff' : '#38bdf8',
            alpha: 0.95,
            life: 0,
            maxLife: 0.4 + Math.random() * 0.3,
            shape: 'spark',
          });
        }
      }

      // --- PHASE 2: Horizon Awakening & Accretion Flare (4.0s - 8.0s) ---
      else if (t < 8.0) {
        const p2 = (t - 4.0) / 4.0;
        s.screenShake = 3.0 * (1 - p2 * 0.5);

        // Accretion disk igniting plasma sparks
        if (Math.random() < 0.8) {
          const a = Math.random() * Math.PI * 2;
          const dist = 100 + Math.random() * 220;
          s.particles.push({
            x: bhX + Math.cos(a) * dist,
            y: bhY + Math.sin(a) * (dist * 0.4),
            vx: -Math.cos(a) * 160 - Math.sin(a) * 280,
            vy: -Math.sin(a) * 160 + Math.cos(a) * 280,
            size: 2.5 + Math.random() * 3.5,
            color: Math.random() > 0.4 ? '#fbbf24' : '#38bdf8',
            alpha: 1.0,
            life: 0,
            maxLife: 0.7 + Math.random() * 0.5,
            shape: 'spark',
          });
        }
      }

      // --- PHASE 3: Massive 250-Container Spaghettification & Spiral Ingestion (4.5s - 18.0s) ---
      if (t >= 4.5 && t < 19.0) {
        const totalBlocks = s.stack.length;

        for (let i = 0; i < totalBlocks; i++) {
          const b = s.stack[i];
          const normIdx = i / Math.max(1, totalBlocks); // 0 at base, 1 at top
          // Containers near top lift off first, base containers follow
          const blockStartTime = 4.5 + (1 - normIdx) * 4.5;
          const blockDuration = 5.0;

          if (t >= blockStartTime) {
            const blockProgress = Math.min(1.0, (t - blockStartTime) / blockDuration);
            const armIndex = i % 6;
            const armBaseAngle = (armIndex * Math.PI * 2) / 6 + normIdx * Math.PI * 4;
            const currentAngle = armBaseAngle + s.singularityDiskAngle * (1.2 + (totalBlocks - i) * 0.008) + blockProgress * Math.PI * 5;

            const initialDistX = b.x - bhX;
            const initialDistY = (b.y + s.cameraY) - bhY;
            const startDist = Math.max(180, Math.hypot(initialDistX, initialDistY) + 120);
            const currentRadius = startDist * Math.pow(Math.max(0, 1 - blockProgress), 2.1);

            const targetX = bhX + Math.cos(currentAngle) * currentRadius;
            const targetY = bhY + Math.sin(currentAngle) * (currentRadius * 0.45);

            b.singularityOffsetX = targetX - b.x;
            b.singularityOffsetY = targetY - b.y - s.cameraY;
            b.singularityAngle = currentAngle + Math.PI * 0.5 + blockProgress * Math.PI * 4;
            b.singularityScale = Math.max(0.001, (1 - blockProgress * 0.96) * (currentRadius > baseBhRadius ? 1.0 : Math.max(0.02, currentRadius / baseBhRadius)));
            b.singularityAlpha = currentRadius < 16 ? 0 : Math.max(0, 1 - blockProgress * 1.08);

            // Glowing brand-colored plasma ribbons & sparks
            if (b.singularityAlpha > 0.06 && Math.random() < 0.35) {
              const brand = BRANDS[b.brandIndex];
              s.particles.push({
                x: targetX + (Math.random() - 0.5) * 12,
                y: targetY - s.cameraY + (Math.random() - 0.5) * 8,
                vx: -Math.cos(currentAngle) * 130 - Math.sin(currentAngle) * 250,
                vy: -Math.sin(currentAngle) * 130 + Math.cos(currentAngle) * 250,
                size: 2.2 + Math.random() * 3.8,
                color: Math.random() > 0.4 ? brand.bgGradStart : brand.accentColor,
                alpha: 0.95,
                life: 0,
                maxLife: 0.5 + Math.random() * 0.35,
                shape: 'spark',
              });
            }
          }
        }

        // Gantry crane and cables shearing and pulled in
        if (t >= 10.0) {
          s.craneShearProgress = Math.min(1.0, (t - 10.0) / 3.5);
          if (s.craneShearProgress < 1.0 && Math.random() < 0.4) {
            s.particles.push({
              x: vp.centerX + (Math.random() - 0.5) * 280,
              y: 40 + Math.random() * 60,
              vx: (bhX - vp.centerX) * 0.8 + (Math.random() - 0.5) * 100,
              vy: 240 + Math.random() * 120,
              size: 3.0 + Math.random() * 4.0,
              color: Math.random() > 0.5 ? '#eab308' : '#38bdf8',
              alpha: 0.9,
              life: 0,
              maxLife: 0.8,
              shape: 'spark',
            });
          }
        }
      }

      // --- PHASE 4: HUD & UI Ingestion (14.0s - 19.0s) ---
      if (t >= 14.0 && t < 19.0) {
        // Spawn UI shattering shards on entering Phase 4
        if (s.uiShards.length === 0) {
          const hudColors = ['#38bdf8', '#eab308', '#ec4899', '#34d399', '#f8fafc', '#60a5fa'];
          for (let k = 0; k < 120; k++) {
            const startX = k % 2 === 0 ? Math.random() * vp.width : (Math.random() < 0.5 ? 40 : vp.width - 40);
            const startY = k % 3 === 0 ? 30 + Math.random() * 80 : vp.height - 40 - Math.random() * 120;
            const dx = bhX - startX;
            const dy = bhY - startY;
            const initDist = Math.hypot(dx, dy);
            s.uiShards.push({
              x: startX,
              y: startY,
              vx: 0,
              vy: 0,
              size: 3 + Math.random() * 6,
              color: hudColors[k % hudColors.length],
              alpha: 1.0,
              rot: Math.random() * Math.PI * 2,
              vRot: (Math.random() - 0.5) * 8,
              targetAngle: Math.atan2(dy, dx),
              dist: initDist,
            });
          }
        }

        const p4 = (t - 14.0) / 5.0;
        for (let i = s.uiShards.length - 1; i >= 0; i--) {
          const shard = s.uiShards[i];
          shard.dist = Math.max(5, shard.dist * (1 - deltaTime * (1.8 + p4 * 3.5)));
          shard.targetAngle += deltaTime * (2.5 + p4 * 6.0);
          shard.x = bhX + Math.cos(shard.targetAngle) * shard.dist;
          shard.y = bhY + Math.sin(shard.targetAngle) * (shard.dist * 0.45);
          shard.rot += shard.vRot * deltaTime;
          shard.alpha = Math.max(0, shard.dist / 80);
        }
      }

      // --- PHASE 5: Total Collapse & Ethereal Flare (19.0s+) ---
      if (t >= 18.8 && t <= 21.5) {
        // Colossal radiant relativistic burst
        s.singularityFlare = Math.max(0, 1 - (t - 18.8) / 2.7);
      } else if (t > 21.5) {
        s.singularityFlare = 0;
      }

      // Starfield vortex inward suction
      for (const star of s.starfield) {
        const dx = bhX - star.x;
        const dy = bhY - star.y;
        const dist = Math.hypot(dx, dy);
        const spiralSpeed = 120 + Math.min(500, t * 24);
        const starAngle = Math.atan2(dy, dx) + 1.25;

        star.x += Math.cos(starAngle) * spiralSpeed * deltaTime;
        star.y += Math.sin(starAngle) * spiralSpeed * deltaTime;
        if (dist < 30) {
          star.x = Math.random() * vp.width;
          star.y = Math.random() * vp.height;
        }
      }

      // Singularity particle sparks & plasma jets vortex
      const particleRate = t < 19.0 ? 0.95 : 0.25;
      if (Math.random() < particleRate) {
        const orbitRadius = 90 + Math.random() * (260 * (1 - Math.min(1, t / 20)));
        const a = Math.random() * Math.PI * 2;
        s.particles.push({
          x: bhX + Math.cos(a) * orbitRadius,
          y: bhY + Math.sin(a) * orbitRadius,
          vx: -Math.cos(a) * 220 - Math.sin(a) * 320,
          vy: -Math.sin(a) * 220 + Math.cos(a) * 320,
          size: 2.0 + Math.random() * 4.5,
          color:
            Math.random() > 0.6
              ? '#38bdf8'
              : Math.random() > 0.3
              ? '#fbbf24'
              : Math.random() > 0.15
              ? '#ec4899'
              : '#ffffff',
          alpha: 1.0,
          life: 0,
          maxLife: 0.8 + Math.random() * 0.6,
          shape: 'spark',
        });
      }

      for (let i = s.particles.length - 1; i >= 0; i--) {
        const p = s.particles[i];
        p.life += deltaTime;
        if (p.life >= p.maxLife) {
          s.particles.splice(i, 1);
          continue;
        }
        p.x += p.vx * deltaTime;
        p.y += p.vy * deltaTime;
        p.alpha = 1 - p.life / p.maxLife;
      }
      return;
    }

    // Cinematic Victory Camera Glide & Cosmic Aura Update
    if (status === 'VICTORY') {
      s.victoryTimer += deltaTime;
      s.victoryCameraGlide = Math.min(1.0, s.victoryCameraGlide + deltaTime * 0.5);
      s.helixAngle += deltaTime * 0.18;
      s.helixPulse += deltaTime * 1.5;

      const targetFocusCamY =
        s.stack.length > 0 ? 880 - s.stack[s.stack.length - 1].y : 0;
      s.cameraY += (targetFocusCamY - s.cameraY) * Math.min(1, deltaTime * 2.5);

      // Continuous drifting starlight & cosmic victory sparkles
      if (Math.random() < 0.6) {
        const starAngle = Math.random() * Math.PI * 2;
        const starDist = 180 + Math.random() * 240;
        const targetX = vp.centerX;
        const targetY = vp.height * 0.38;

        s.particles.push({
          x: targetX + Math.cos(starAngle) * starDist,
          y: targetY + Math.sin(starAngle) * starDist,
          vx: (Math.random() - 0.5) * 25,
          vy: -15 - Math.random() * 25,
          size: 2.0 + Math.random() * 3.5,
          color:
            s.victoryMode === 'NEBULA'
              ? Math.random() > 0.4
                ? '#22d3ee'
                : '#f43f5e'
              : Math.random() > 0.4
              ? '#ffd700'
              : '#a855f7',
          alpha: 0.95,
          life: 0,
          maxLife: 1.8 + Math.random() * 1.2,
          shape: 'star',
        });
      }

      for (let i = s.particles.length - 1; i >= 0; i--) {
        const p = s.particles[i];
        p.life += deltaTime;
        if (p.life >= p.maxLife) {
          s.particles.splice(i, 1);
          continue;
        }
        p.x += p.vx * deltaTime;
        p.y += p.vy * deltaTime;
        p.alpha = 1 - p.life / p.maxLife;
      }
      return;
    }

    if (status !== 'PLAYING' || isGameMenuOpen) {
      gameAudio.stopJetEngine();
      return;
    }

    const input = inputRef.current;
    const containerH = getConfig('containerHeight') as number;
    const baseSwingSpeed = getConfig('baseSwingSpeed') as number;
    const rawGravity = getConfig('dropGravity') as number;
    const inertiaFactor = getConfig('inertiaRatio') as number;
    const perfectTolerance = getConfig('perfectSnapTolerance') as number;
    const maxWobble = getConfig('maxAllowedWobble') as number;

    s.tapCooldown = Math.max(0, s.tapCooldown - deltaTime);
    s.wavePhase += deltaTime * 2.8;
    s.lighthouseAngle += deltaTime * 0.38;
    s.auroraPhase += deltaTime * 0.8;
    s.helixAngle += deltaTime * 0.12;
    s.helixPulse += deltaTime * 1.2;
    s.baseY = vp.baseY;
    s.shipX = vp.centerX;

    const stackHeight = s.stack.length;
    const scoreAlt = s.score;

    const isStage1 = stackHeight <= 25 || scoreAlt <= 25;
    const isStage2 = stackHeight > 25 && stackHeight <= 50;
    const isStage3 = stackHeight > 50 && stackHeight <= 100;
    const isStage4 = stackHeight > 100 && stackHeight <= 140;
    const isStage5 = stackHeight > 140 && stackHeight <= 200;
    const isStageHelix = stackHeight > 200;

    const effectiveGravity = isStageHelix
      ? rawGravity * 0.42
      : isStage5
      ? rawGravity * 0.52
      : rawGravity;

    // Bimodal Heartbeat Simulation for Active Combo Tier
    const currentTier = getComboTier(s.combo);
    if (currentTier && currentTier.heartbeatIntensity > 0) {
      s.heartbeatIntensity = currentTier.heartbeatIntensity;
      s.heartbeatPhase += deltaTime * (6.2 + currentTier.tier * 0.8);
    } else {
      s.heartbeatIntensity = 0;
      s.heartbeatPhase = 0;
    }

    // Milestone Flash decay
    if (s.milestoneFlash) {
      s.milestoneFlash.alpha = Math.max(0, s.milestoneFlash.alpha - deltaTime * 1.8);
      if (s.milestoneFlash.alpha <= 0) {
        s.milestoneFlash = null;
      }
    }

    // --- STAGE 1: Daytime Harbor ---
    if (stackHeight <= 25) {
      s.waveAudioTimer -= deltaTime;
      if (s.waveAudioTimer <= 0) {
        s.waveAudioTimer = 3.8 + Math.random() * 1.6;
        if (!isSfxMuted && isStage1) {
          gameAudio.playOceanWaveWash();
        }
      }

      s.seagullAudioTimer -= deltaTime;
      if (s.seagullAudioTimer <= 0) {
        s.seagullAudioTimer = 4.5 + Math.random() * 3.0;
        if (!isSfxMuted && (isStage1 || isStage2)) {
          gameAudio.playSeagullCall();
        }
      }

      s.foghornTimer -= deltaTime;
      if (s.foghornTimer <= 0) {
        s.foghornTimer = 18 + Math.random() * 12;
        if (!isSfxMuted && isStage1) {
          gameAudio.playFoghorn();
        }
      }

      for (const boat of s.tugboats) {
        boat.x += boat.speed * deltaTime;
        boat.smokeTimer += deltaTime;
        boat.soundTimer -= deltaTime;

        if (boat.smokeTimer >= 0.28) {
          boat.smokeTimer = 0;
          s.particles.push({
            x: boat.x + (boat.speed > 0 ? -12 : 12),
            y: boat.y - 18,
            vx: (Math.random() - 0.5) * 10 - boat.speed * 0.2,
            vy: -25 - Math.random() * 15,
            size: 4 + Math.random() * 3,
            color: 'rgba(226, 232, 240, 0.7)',
            alpha: 0.7,
            life: 0,
            maxLife: 1.2,
            shape: 'smoke',
          });
        }

        if (boat.soundTimer <= 0) {
          boat.soundTimer = 5 + Math.random() * 4;
          if (!isSfxMuted && isStage1 && boat.x > 50 && boat.x < vp.width - 50) {
            gameAudio.playTugboatEngine();
          }
        }

        if (boat.speed > 0 && boat.x > vp.width + 120) boat.x = -120;
        else if (boat.speed < 0 && boat.x < -120) boat.x = vp.width + 120;
      }

      for (const buoy of s.buoys) {
        buoy.bobPhase += deltaTime * 2.2;
        buoy.bellTimer -= deltaTime;
        if (buoy.bellTimer <= 0) {
          buoy.bellTimer = 8 + Math.random() * 6;
          buoy.lightState = !buoy.lightState;
          if (!isSfxMuted && isStage1) {
            gameAudio.playBuoyBell();
          }
        }
      }

      for (const dol of s.dolphins) {
        if (!dol.leapActive) {
          dol.leapCooldown -= deltaTime;
          if (dol.leapCooldown <= 0) {
            dol.leapActive = true;
            dol.progress = 0;
            dol.x = 80 + Math.random() * (vp.width - 160);
          }
        } else {
          dol.progress += deltaTime * 1.5;
          if (dol.progress >= Math.PI) {
            dol.leapActive = false;
            dol.leapCooldown = 5 + Math.random() * 6;
            if (!isSfxMuted && isStage1) {
              gameAudio.playWaterSplash();
            }
            for (let k = 0; k < 12; k++) {
              s.particles.push({
                x: dol.x + Math.cos(dol.progress) * dol.jumpRadius,
                y: dol.baseY,
                vx: (Math.random() - 0.5) * 80,
                vy: -60 - Math.random() * 80,
                size: 2.5 + Math.random() * 2,
                color: '#bae6fd',
                alpha: 0.9,
                life: 0,
                maxLife: 0.5,
                shape: 'dust',
              });
            }
          }
        }
      }

      for (const pel of s.pelicans) {
        pel.x += pel.speed * deltaTime;
        pel.wingPhase += deltaTime * 7;
        if (pel.x > vp.width + 80) {
          pel.x = -80;
          pel.y = vp.height - 380 + Math.random() * 140;
          pel.speed = 48 + Math.random() * 25;
        }
      }
    }

    // --- STAGE 2: Blue Sky (Score 16-50) ---
    if (stackHeight >= 10 && stackHeight <= 65) {
      s.seagullAudioTimer -= deltaTime;
      if (s.seagullAudioTimer <= 0) {
        s.seagullAudioTimer = 4.0 + Math.random() * 3.0;
        if (!isSfxMuted && isStage2) {
          gameAudio.playSeagullCall();
        }
      }

      if (s.windGustDuration <= 0) {
        s.windGustCooldown -= deltaTime;
        if (s.windGustCooldown <= 0) {
          s.windGustCooldown = 6 + Math.random() * 6;
          s.windGustDuration = 2.6;
          s.windGustTotalDur = 2.6;
          s.windGustDir = Math.random() > 0.5 ? 1 : -1;
          s.windGustForce = 0;
          if (!isSfxMuted && isStage2) {
            gameAudio.playWindGust();
          }
        }
      } else {
        s.windGustDuration -= deltaTime;
        const gustProgress = 1 - s.windGustDuration / s.windGustTotalDur;
        const gustIntensity = Math.sin(gustProgress * Math.PI);
        s.windGustForce = s.windGustDir * gustIntensity * 38;

        if (Math.random() < 0.85) {
          const startX = s.windGustDir > 0 ? -120 : vp.width + 120;
          s.windParticles.push({
            x: startX,
            y: 80 + Math.random() * (vp.height - 300),
            vx: s.windGustDir * (450 + Math.random() * 250),
            vy: (Math.random() - 0.5) * 20,
            len: 120 + Math.random() * 140,
            alpha: 0.75,
            thickness: 1.5 + Math.random() * 2,
          });
        }
        s.wobbleVelocity += s.windGustDir * gustIntensity * 0.25 * deltaTime;
      }

      for (let i = s.windParticles.length - 1; i >= 0; i--) {
        const wp = s.windParticles[i];
        wp.x += wp.vx * deltaTime;
        wp.y += wp.vy * deltaTime;
        wp.alpha -= deltaTime * 0.45;
        if (
          wp.alpha <= 0 ||
          wp.x < -200 ||
          wp.x > vp.width + 200 ||
          wp.y > vp.height + 100
        ) {
          s.windParticles.splice(i, 1);
        }
      }

      for (const bal of s.balloons) {
        bal.x += bal.speed * deltaTime;
        bal.burnerTimer -= deltaTime;
        if (bal.burnerBurst > 0) {
          bal.burnerBurst = Math.max(0, bal.burnerBurst - deltaTime * 1.8);
        }
        if (bal.burnerTimer <= 0) {
          bal.burnerTimer = 6 + Math.random() * 5;
          bal.burnerBurst = 1.0;
          if (!isSfxMuted && isStage2 && bal.x > 60 && bal.x < vp.width - 60) {
            gameAudio.playBalloonBurner();
          }
        }
        if (bal.speed > 0 && bal.x > vp.width + 140) bal.x = -140;
        else if (bal.speed < 0 && bal.x < -140) bal.x = vp.width + 140;
      }

      for (const flock of s.flocks) {
        flock.x += flock.speed * deltaTime;
        flock.wingPhase += deltaTime * 8;
        flock.chirpTimer -= deltaTime;
        if (flock.chirpTimer <= 0) {
          flock.chirpTimer = 5 + Math.random() * 4;
          if (!isSfxMuted && isStage2 && flock.x > 50 && flock.x < vp.width - 50) {
            gameAudio.playFlockChirp();
          }
        }
        if (flock.x > vp.width + 200) {
          flock.x = -200;
          flock.y = 260 + Math.random() * 240;
          flock.speed = 60 + Math.random() * 25;
        }
      }

      for (const para of s.paragliders) {
        para.x += para.speed * deltaTime;
        para.swayPhase += deltaTime * 1.8;
        if (para.speed < 0 && para.x < -120) para.x = vp.width + 120;
        else if (para.speed > 0 && para.x > vp.width + 120) para.x = -120;
      }

      for (const ws of s.windStreams) {
        ws.x += ws.speed * deltaTime;
        if (ws.x > vp.width + ws.length) ws.x = -ws.length - 80;
      }
    }

    // --- STAGE 3: Stratosphere / Twilight (Score 51-100) ---
    if (stackHeight >= 40 && stackHeight <= 115) {
      s.auroraTimer -= deltaTime;
      if (s.auroraTimer <= 0) {
        s.auroraTimer = 16 + Math.random() * 10;
        if (!isSfxMuted && isStage3) {
          gameAudio.playAuroraChime();
        }
      }

      if (!s.activePlane) {
        s.planeSpawnCooldown -= deltaTime;
        if (s.planeSpawnCooldown <= 0) {
          const moveRight = Math.random() > 0.45;
          const isStealth = Math.random() < 0.35;
          const speedVal = (moveRight ? 1 : -1) * (190 + Math.random() * 80);
          const startX = moveRight ? -220 : vp.width + 220;
          const startY = 130 + Math.random() * 170;

          s.activePlane = {
            x: startX,
            y: startY,
            speed: speedVal,
            scale: 0.9 + Math.random() * 0.25,
            isStealth,
            flybyPlayed: false,
          };
        }
      }

      if (s.activePlane) {
        const jet = s.activePlane;
        jet.x += jet.speed * deltaTime;

        const hasDespawned =
          (jet.speed > 0 && jet.x > vp.width + 260) ||
          (jet.speed < 0 && jet.x < -260);

        if (hasDespawned) {
          s.activePlane = null;
          s.planeSpawnCooldown = 3.2 + Math.random() * 4.0;
          gameAudio.updateJetEngine(false);
        } else {
          const isVisible = jet.x >= -120 && jet.x <= vp.width + 120;
          if (isVisible && !isSfxMuted && isStage3) {
            const pan = Math.max(-0.95, Math.min(0.95, (jet.x - vp.centerX) / vp.centerX));
            let doppler = 1.0;

            if (jet.speed > 0) {
              if (jet.x <= vp.centerX) {
                const norm = Math.max(0, jet.x / vp.centerX);
                doppler = 1.25 - 0.25 * norm;
              } else {
                const norm = Math.min(1, (jet.x - vp.centerX) / vp.centerX);
                doppler = 1.0 - 0.28 * norm;
              }
            } else {
              if (jet.x >= vp.centerX) {
                const norm = Math.max(0, (vp.width - jet.x) / vp.centerX);
                doppler = 1.25 - 0.25 * norm;
              } else {
                const norm = Math.min(1, (vp.centerX - jet.x) / vp.centerX);
                doppler = 1.0 - 0.28 * norm;
              }
            }

            const distFromCenter = Math.abs(jet.x - vp.centerX);
            const maxRange = vp.centerX + 100;
            const volEnvelope = Math.max(0, 1 - distFromCenter / maxRange);
            const targetVol = 0.03 + 0.08 * volEnvelope;

            gameAudio.updateJetEngine(true, pan, targetVol, doppler);
          } else {
            gameAudio.updateJetEngine(false);
          }
        }
      } else {
        gameAudio.updateJetEngine(false);
      }

      for (const wb of s.weatherBalloons) {
        wb.x += wb.speed * deltaTime;
        wb.radarAngle += deltaTime * 3;
        wb.telemetryTimer -= deltaTime;
        if (wb.telemetryTimer <= 0) {
          wb.telemetryTimer = 5 + Math.random() * 4;
          if (!isSfxMuted && isStage3) {
            gameAudio.playWeatherBalloonTelemetry();
          }
        }
        if (wb.x > vp.width + 80) wb.x = -80;
      }

      s.shootingStarTimer -= deltaTime;
      if (s.shootingStarTimer <= 0) {
        s.shootingStarTimer = 3.5 + Math.random() * 3;
        s.shootingStars.push({
          x: 100 + Math.random() * (vp.width - 150),
          y: 40 + Math.random() * 180,
          vx: -350 - Math.random() * 180,
          vy: 200 + Math.random() * 120,
          life: 0,
          maxLife: 0.45 + Math.random() * 0.25,
          len: 120 + Math.random() * 80,
        });
      }

      for (let i = s.shootingStars.length - 1; i >= 0; i--) {
        const star = s.shootingStars[i];
        star.life += deltaTime;
        star.x += star.vx * deltaTime;
        star.y += star.vy * deltaTime;
        if (star.life >= star.maxLife) {
          s.shootingStars.splice(i, 1);
        }
      }
    } else {
      gameAudio.updateJetEngine(false);
    }

    // --- STAGE 4, 5 & HELIX NEBULA: Outer Space, Moon & Helix Nebula (Score 101-250) ---
    if (stackHeight >= 85) {
      s.cosmicTimer -= deltaTime;
      if (s.cosmicTimer <= 0) {
        s.cosmicTimer = 18 + Math.random() * 12;
        if (!isSfxMuted && (isStage4 || isStage5 || isStageHelix)) {
          gameAudio.playCosmicResonance();
        }
      }

      s.cosmicShootingStarTimer -= deltaTime;
      if (s.cosmicShootingStarTimer <= 0) {
        s.cosmicShootingStarTimer = 1.4 + Math.random() * 2.2;

        const starColorPalettes = [
          {
            head: '#ffffff',
            glow: '#38bdf8',
            tail: 'rgba(56, 189, 248, 0.95)',
            tailEnd: 'rgba(6, 182, 212, 0)',
          },
          {
            head: '#ffffff',
            glow: '#fde047',
            tail: 'rgba(250, 204, 21, 0.95)',
            tailEnd: 'rgba(234, 179, 8, 0)',
          },
          {
            head: '#ffffff',
            glow: '#f472b6',
            tail: 'rgba(244, 114, 182, 0.95)',
            tailEnd: 'rgba(236, 72, 153, 0)',
          },
          {
            head: '#ffffff',
            glow: '#c084fc',
            tail: 'rgba(192, 132, 252, 0.95)',
            tailEnd: 'rgba(147, 51, 234, 0)',
          },
        ];

        const spawnCount = Math.random() < 0.25 ? 2 : 1;
        for (let sc = 0; sc < spawnCount; sc++) {
          const palette =
            starColorPalettes[Math.floor(Math.random() * starColorPalettes.length)];
          const angleDeg = 24 + Math.random() * 28;
          const angle = (angleDeg * Math.PI) / 180;
          const speed = 600 + Math.random() * 380;
          const startX = -60 + Math.random() * (vp.width * 0.85);
          const startY = -40 + Math.random() * (vp.height * 0.55);
          const len = 150 + Math.random() * 160;
          const maxLife = (len + vp.width * 0.8) / speed;

          s.cosmicShootingStars.push({
            x: startX,
            y: startY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            speed,
            angle,
            life: 0,
            maxLife: Math.min(1.2, maxLife),
            len,
            width: 2.2 + Math.random() * 1.8,
            headColor: palette.head,
            tailColor: palette.tail,
            tailEndColor: palette.tailEnd,
            glowColor: palette.glow,
            stardustTimer: 0,
          });
        }

        if (!isSfxMuted && (isStage4 || isStage5 || isStageHelix)) {
          gameAudio.playCelestialShootingStarChime();
        }
      }

      for (let i = s.cosmicShootingStars.length - 1; i >= 0; i--) {
        const star = s.cosmicShootingStars[i];
        star.life += deltaTime;
        star.x += star.vx * deltaTime;
        star.y += star.vy * deltaTime;
        star.stardustTimer += deltaTime;

        if (star.stardustTimer >= 0.02) {
          star.stardustTimer = 0;
          const trailDistance = Math.random() * (star.len * 0.7);
          const px = star.x - Math.cos(star.angle) * trailDistance + (Math.random() - 0.5) * 6;
          const py = star.y - Math.sin(star.angle) * trailDistance + (Math.random() - 0.5) * 6;

          s.particles.push({
            x: px,
            y: py - s.cameraY,
            vx: -star.vx * 0.04 + (Math.random() - 0.5) * 35,
            vy: -star.vy * 0.04 + (Math.random() - 0.5) * 35,
            size: 1.8 + Math.random() * 2.6,
            color: Math.random() > 0.4 ? star.glowColor : '#ffffff',
            alpha: 0.95,
            life: 0,
            maxLife: 0.4 + Math.random() * 0.45,
            shape: 'spark',
          });
        }

        if (
          star.life >= star.maxLife ||
          star.x > vp.width + 200 ||
          star.y > vp.height + 100
        ) {
          s.cosmicShootingStars.splice(i, 1);
        }
      }

      for (const ss of s.spaceStations) {
        ss.x += ss.speed * deltaTime;
        ss.rotAngle += deltaTime * 0.4;
        ss.beaconTimer -= deltaTime;
        if (ss.beaconTimer <= 0) {
          ss.beaconTimer = 6 + Math.random() * 4;
          if (!isSfxMuted && isStage4) {
            gameAudio.playSpaceBeaconPing();
          }
        }
        if (ss.speed < 0 && ss.x < -160) ss.x = vp.width + 160;
      }

      for (const astro of s.astronauts) {
        astro.x += astro.speed * deltaTime;
        astro.wavePhase += deltaTime * 2.5;
        if (astro.x > vp.width + 100) astro.x = -100;
      }

      for (const ufo of s.ufos) {
        ufo.x += ufo.speed * deltaTime;
        ufo.beamPhase += deltaTime * 2.8;
        ufo.humTimer -= deltaTime;
        if (ufo.humTimer <= 0) {
          ufo.humTimer = 6 + Math.random() * 4;
          if (!isSfxMuted && isStage4 && ufo.x > 80 && ufo.x < vp.width - 80) {
            gameAudio.playUfoHum();
          }
        }
        if (ufo.x > vp.width + 140) ufo.x = -140;
      }

      for (const ast of s.asteroids) {
        ast.x += ast.speed * deltaTime;
        ast.rot += ast.rotSpeed * deltaTime;
        if (ast.speed > 0 && ast.x > vp.width + 80) ast.x = -80;
        else if (ast.speed < 0 && ast.x < -80) ast.x = vp.width + 80;
      }

      if (isStage5 || isStageHelix) {
        s.asteroidRumbleTimer -= deltaTime;
        if (s.asteroidRumbleTimer <= 0) {
          s.asteroidRumbleTimer = 8 + Math.random() * 6;
          if (!isSfxMuted) {
            gameAudio.playAsteroidRumble();
          }
        }

        for (const bast of s.beltAsteroids) {
          bast.x += bast.speedX * deltaTime;
          bast.y += bast.speedY * deltaTime;
          bast.rot += bast.rotSpeed * deltaTime;

          if (bast.speedX > 0 && bast.x > vp.width + 100) bast.x = -100;
          else if (bast.speedX < 0 && bast.x < -100) bast.x = vp.width + 100;

          if (bast.y > vp.height + 100) bast.y = -100;
          else if (bast.y < -100) bast.y = vp.height + 100;
        }

        s.spaceDustTimer -= deltaTime;
        if (s.spaceDustTimer <= 0) {
          s.spaceDustTimer = 0.08;
          s.particles.push({
            x: Math.random() * vp.width,
            y: Math.random() * vp.height,
            vx: (Math.random() - 0.5) * 15,
            vy: (Math.random() - 0.5) * 15,
            size: 1.2 + Math.random() * 2.2,
            color: Math.random() > 0.5 ? '#c084fc' : '#38bdf8',
            alpha: 0.6,
            life: 0,
            maxLife: 2.5 + Math.random() * 2,
            shape: 'dust',
          });
        }
      }

      s.cometSpawnTimer -= deltaTime;
      if (s.cometSpawnTimer <= 0) {
        s.cometSpawnTimer = 9 + Math.random() * 6;
        for (const c of s.comets) {
          if (!c.active) {
            c.active = true;
            c.x = vp.width + 80;
            c.y = 40 + Math.random() * 120;
            c.fizzPlayed = false;
            break;
          }
        }
      }

      for (const c of s.comets) {
        if (c.active) {
          c.x += c.vx * deltaTime;
          c.y += c.vy * deltaTime;
          c.tailTimer += deltaTime;

          if (!c.fizzPlayed && c.x > 150 && c.x < vp.width - 150) {
            c.fizzPlayed = true;
            if (!isSfxMuted && (isStage4 || isStage5 || isStageHelix)) {
              gameAudio.playCometFizz();
            }
          }

          for (let k = 0; k < 3; k++) {
            s.particles.push({
              x: c.x + (Math.random() - 0.5) * 8,
              y: c.y + (Math.random() - 0.5) * 8,
              vx: -c.vx * 0.15 + (Math.random() - 0.5) * 40,
              vy: -c.vy * 0.15 + (Math.random() - 0.5) * 40,
              size: 2.5 + Math.random() * 3,
              color: k === 0 ? '#38bdf8' : k === 1 ? '#e0f2fe' : '#fef08a',
              alpha: 0.9,
              life: 0,
              maxLife: 0.6 + Math.random() * 0.4,
              shape: 'spark',
            });
          }

          if (c.x < -180 || c.y > vp.height + 100) {
            c.active = false;
          }
        }
      }
    }

    // --- STACK COLLAPSE & PHYSICS ENGINE ---
    if (s.isCollapsing) {
      s.collapseTimer += deltaTime;
      s.screenShake = Math.max(0, s.screenShake - deltaTime * 15);
      for (const b of s.stack) {
        b.y += (isStageHelix ? 280 : isStage5 ? 380 : 680) * deltaTime;
        b.x += (Math.random() - 0.5) * 70 * deltaTime;
      }
      if (s.collapseTimer > 1.2) {
        setGameState((prev) => ({...prev, status: 'GAME_OVER'}));
      }
      return;
    }

    if (s.screenShake > 0) {
      s.screenShake = Math.max(0, s.screenShake - deltaTime * 22);
      s.shakeRot = (Math.random() - 0.5) * (s.screenShake * 0.003);
    } else {
      s.shakeRot = 0;
    }

    if (s.predictiveShake > 0) {
      s.predictiveShake = Math.max(0, s.predictiveShake - deltaTime * 30);
    }

    // Camera Lerp
    const topStackY = s.stack.length > 0 ? s.stack[s.stack.length - 1].y : s.baseY;
    s.targetCameraY = Math.max(0, 750 - topStackY);
    s.cameraY += (s.targetCameraY - s.cameraY) * Math.min(1, deltaTime * 5);

    // Crane Swing Kinematics
    const speedMultiplier = Math.min(1.45, 1 + Math.floor(s.score / 8) * 0.025);
    const currentSwingSpeed = baseSwingSpeed * speedMultiplier;
    s.swingTime += deltaTime * currentSwingSpeed;

    const craneCenterY = 200 - s.cameraY;
    const amplitudeX = 220;
    const amplitudeY = 95;

    const prevHookX = s.hookX;
    const prevHookY = s.hookY;

    s.hookX = vp.centerX + amplitudeX * Math.cos(s.swingTime) + s.windGustForce;
    s.hookY = craneCenterY - amplitudeY * Math.sin(s.swingTime) + Math.abs(s.windGustForce) * 0.12;

    const targetTrolleyX = vp.centerX + (s.hookX - vp.centerX) * 0.45;
    s.trolleyX += (targetTrolleyX - s.trolleyX) * Math.min(1, deltaTime * 10);

    s.hookVx = (s.hookX - prevHookX) / Math.max(0.001, deltaTime);
    s.hookVy = (s.hookY - prevHookY) / Math.max(0.001, deltaTime);

    if (s.isHolding) {
      s.clampOpenRatio = Math.max(0, s.clampOpenRatio - deltaTime * 8);
    } else {
      s.clampOpenRatio = Math.min(1, s.clampOpenRatio + deltaTime * 6);
    }

    // Drop Input (Instant Snap & Zero Cooldown in Admin Mode)
    const isActionTriggered =
      input.actions.confirm || input.actions.tap || input.actions.down;

    const canTriggerDrop = adminModeRef.current
      ? isActionTriggered && s.isHolding
      : isActionTriggered && !s.hasTriggeredDrop && s.isHolding && s.tapCooldown <= 0;

    if (canTriggerDrop) {
      if (adminModeRef.current) {
        // ADMIN MODE: INSTANT DROP (0ms delay, 0 gravity, instantaneous snap)
        s.isHolding = true;
        s.tapCooldown = 0; // zero cooldown for machine-gun rapid stacking

        const pivotX = vp.centerX;
        const targetCenterStackX = vp.centerX;
        const stackedY =
          s.stack.length > 0
            ? s.stack[s.stack.length - 1].y - containerH
            : s.baseY - containerH;

        s.combo += 1;
        s.perfectCount += 1;
        if (s.combo > s.maxCombo) {
          s.maxCombo = s.combo;
        }
        s.totalWobble = 0;
        s.wobbleAngle = 0;
        s.wobbleVelocity = 0;

        const comboBonus = s.combo > 1 ? s.combo * 50 : 0;
        s.score += 100 + comboBonus;

        gameAudio.playHeavyContainerLatch(true, s.combo);

        const tierInfo = getComboTier(s.combo);
        const tierColor = tierInfo ? tierInfo.color : '#00ff66';
        const tierScale = tierInfo ? tierInfo.scale : 1.0;

        if (tierInfo && tierInfo.milestoneTrigger === s.combo) {
          s.milestoneFlash = {
            color: tierColor,
            alpha: 1.0,
            text: `TIER ${tierInfo.tier}: ${tierInfo.name}! (x${s.combo})`,
          };
          s.screenShake = 16;
          gameAudio.playLevelUpStinger();
        } else {
          s.screenShake = 4.0;
        }

        spawnToast(
          s.combo > 1 ? `¡PERFECTO! x${s.combo}` : '¡PERFECTO!',
          targetCenterStackX,
          stackedY - 45,
          tierColor,
          true,
          tierScale,
        );
        spawnImpactVFX(
          targetCenterStackX,
          stackedY + containerH / 2,
          tierColor,
          true,
          s.combo,
        );

        s.stack.push({
          x: targetCenterStackX,
          y: stackedY,
          brandIndex: s.currentBrand,
          isPerfect: true,
          offset: 0,
        });

        s.currentBrand = (s.currentBrand + 1) % BRANDS.length;

        if (s.score > highScore) {
          setHighScore(s.score);
          try {
            localStorage.setItem('cargostack_highscore', s.score.toString());
          } catch {}
        }

        // Dynamic Secret Helix Stage Unlock at 200
        if (s.stack.length === 200 && !s.isHelixUnlocked) {
          s.isHelixUnlocked = true;
          s.targetWinCount = 250;
          s.milestoneFlash = {
            color: '#ec4899',
            alpha: 1.0,
            text: 'SECRET STAGE UNLOCKED: HELIX NEBULA (201-250)!',
          };
          s.screenShake = 22;
          gameAudio.playLevelUpStinger();
          spawnToast('SECRET UNLOCKED: 0/250 HELIX NEBULA!', vp.centerX, stackedY - 65, '#ec4899', true, 1.8);
        }

        // Finale branching
        if (s.stack.length >= s.targetWinCount) {
          if (s.targetWinCount >= 250) {
            s.isSingularityActive = true;
            s.victoryMode = 'SINGULARITY';
            s.singularityTime = 0;
            s.singularityProgress = 0;
            s.singularityFlare = 0;
            s.craneShearProgress = 0;
            s.uiShards = [];
            showSingularityScreenRef.current = false;
            setShowSingularityScreen(false);
            setSingularityAnimTime(0);
            gameAudio.playSingularityCollapse();
            setGameState((prev) => ({
              ...prev,
              status: 'SINGULARITY',
              score: s.score,
              level: Math.floor(s.score / 10) + 1,
            }));
            return;
          } else {
            s.victoryMode = 'MOON';
            setGameState((prev) => ({
              ...prev,
              status: 'VICTORY',
              score: s.score,
              level: Math.floor(s.score / 10) + 1,
            }));
            return;
          }
        }

        setGameState((prev) => ({
          ...prev,
          score: s.score,
          combo: s.combo,
          stability: 100,
          level: Math.floor(s.score / 10) + 1,
        }));
        return;
      }

      s.hasTriggeredDrop = true;
      s.isHolding = false;
      s.tapCooldown = 0.25;

      s.dropping = {
        x: s.hookX,
        y: s.hookY + 50,
        vx: s.hookVx * inertiaFactor + s.windGustForce * 1.5,
        vy: Math.max(0, s.hookVy * inertiaFactor),
        brandIndex: s.currentBrand,
        rotation: 0,
        vRot: (s.hookVx / 600) * 0.2 + (s.windGustForce / 40) * 0.1,
      };

      gameAudio.playCrispClick();
    } else if (!isActionTriggered) {
      s.hasTriggeredDrop = false;
    }

    // Dropping Container Freefall & Collision (Turbo Drop Speed in Admin Mode)
    if (s.dropping) {
      const drop = s.dropping;
      const gravityMultiplier = adminModeRef.current ? 4.5 : 1.0;
      drop.vy += effectiveGravity * gravityMultiplier * deltaTime;
      drop.x += (drop.vx + s.windGustForce * 0.4) * deltaTime;
      drop.y += drop.vy * deltaTime;
      drop.rotation += drop.vRot * deltaTime;

      const pivotX = vp.centerX;
      const pivotY = s.baseY;

      let actualLandingY = s.baseY - containerH / 2;
      let actualLandingX = vp.centerX;
      let targetRotAngle = 0;
      let targetCenterStackX = vp.centerX;

      if (s.stack.length > 0) {
        const topBlock = s.stack[s.stack.length - 1];
        targetCenterStackX = topBlock.x;
        const topHeightFactor = Math.min(2.0, (s.baseY - topBlock.y) / 600);
        targetRotAngle = Math.max(-0.05, Math.min(0.05, s.wobbleAngle * topHeightFactor));

        const dx = topBlock.x - pivotX;
        const dy = topBlock.y - pivotY;
        const cosA = Math.cos(targetRotAngle);
        const sinA = Math.sin(targetRotAngle);

        actualLandingX = pivotX + dx * cosA - dy * sinA;
        actualLandingY = pivotY + dx * sinA + dy * cosA - containerH / 2;
      }

      const distToLanding = actualLandingY - drop.y;
      if (distToLanding > 0 && distToLanding <= 70) {
        s.predictiveShake = 1.8;
      }

      if (drop.y >= actualLandingY) {
        const cosA = Math.cos(targetRotAngle);
        const sinA = Math.sin(targetRotAngle);
        const relX = drop.x - actualLandingX;
        const relY = drop.y - actualLandingY;
        const localDiffX = adminModeRef.current ? 0 : relX * cosA + relY * sinA;
        const absDiffX = Math.abs(localDiffX);

        if (adminModeRef.current || absDiffX <= 120) {
          const isPerfect = adminModeRef.current || absDiffX <= perfectTolerance;
          let finalX = targetCenterStackX;
          let addedWobble = 0;

          if (isPerfect) {
            finalX = targetCenterStackX;
            s.combo += 1;
            s.perfectCount += 1;
            if (s.combo > s.maxCombo) {
              s.maxCombo = s.combo;
            }
            s.totalWobble = adminModeRef.current ? 0 : s.totalWobble * 0.65;
            if (adminModeRef.current) {
              s.wobbleAngle = 0;
              s.wobbleVelocity = 0;
            }
            addedWobble = 0;

            const comboBonus = s.combo > 1 ? s.combo * 50 : 0;
            s.score += 100 + comboBonus;

            gameAudio.playHeavyContainerLatch(true, s.combo);

            const tierInfo = getComboTier(s.combo);
            const tierColor = tierInfo ? tierInfo.color : '#00ff66';
            const tierScale = tierInfo ? tierInfo.scale : 1.0;

            if (tierInfo && tierInfo.milestoneTrigger === s.combo) {
              s.milestoneFlash = {
                color: tierColor,
                alpha: 1.0,
                text: `TIER ${tierInfo.tier}: ${tierInfo.name}! (x${s.combo})`,
              };
              s.screenShake = 16;
              gameAudio.playLevelUpStinger();
            } else {
              s.screenShake = 7.5 + Math.min(8, s.combo * 0.8);
            }

            spawnToast(
              s.combo > 1 ? `¡PERFECTO! x${s.combo}` : '¡PERFECTO!',
              actualLandingX,
              actualLandingY - 45,
              tierColor,
              true,
              tierScale,
            );
            spawnImpactVFX(
              actualLandingX,
              actualLandingY + containerH / 2,
              tierColor,
              true,
              s.combo,
            );
          } else {
            const slotOffset = Math.round(localDiffX / 12) * 12;
            finalX = targetCenterStackX + slotOffset;
            addedWobble = slotOffset * 0.70;
            s.totalWobble += addedWobble;
            s.combo = 0;
            s.score += 40;

            gameAudio.playHeavyContainerLatch(false, 0);
            s.screenShake = 4.2;
            spawnToast('GOOD!', actualLandingX, actualLandingY - 30, '#facc15', false, 1.0);
            spawnImpactVFX(
              actualLandingX,
              actualLandingY + containerH / 2,
              BRANDS[drop.brandIndex].accentColor,
              false,
              0,
            );
          }

          const stackedY =
            s.stack.length > 0
              ? s.stack[s.stack.length - 1].y - containerH
              : s.baseY - containerH;

          s.stack.push({
            x: finalX,
            y: stackedY,
            brandIndex: drop.brandIndex,
            isPerfect,
            offset: finalX - vp.centerX,
          });

          if (s.score > highScore) {
            setHighScore(s.score);
            try {
              localStorage.setItem('cargostack_highscore', s.score.toString());
            } catch {}
          }

          // Dynamic Secret Helix Stage Unlock at 200 with Combo >= 200 (or Admin mode)
          if (s.stack.length === 200 && (s.combo >= 200 || adminModeRef.current) && !s.isHelixUnlocked) {
            s.isHelixUnlocked = true;
            s.targetWinCount = 250;
            s.milestoneFlash = {
              color: '#ec4899',
              alpha: 1.0,
              text: 'SECRET STAGE UNLOCKED: HELIX NEBULA (201-250)!',
            };
            s.screenShake = 22;
            gameAudio.playLevelUpStinger();
            spawnToast('SECRET UNLOCKED: 0/250 HELIX NEBULA!', vp.centerX, actualLandingY - 65, '#ec4899', true, 1.8);
          }

          // Strict Finale Branching at Height 250 / 200
          if (s.stack.length >= s.targetWinCount) {
            if (s.targetWinCount >= 250) {
              // ONLY if reached Height 250 with unbroken 250 combo (or admin with >=250 combo), trigger SINGULARITY FINALE
              if (s.combo >= 250 || adminModeRef.current) {
                s.isSingularityActive = true;
                s.victoryMode = 'SINGULARITY';
                s.singularityTime = 0;
                s.singularityProgress = 0;
                s.singularityFlare = 0;
                s.craneShearProgress = 0;
                s.uiShards = [];
                showSingularityScreenRef.current = false;
                setShowSingularityScreen(false);
                setSingularityAnimTime(0);
                gameAudio.playSingularityCollapse();
                setGameState((prev) => ({
                  ...prev,
                  status: 'SINGULARITY',
                  score: s.score,
                  level: Math.floor(s.score / 10) + 1,
                }));
                return;
              } else {
                // If reached Height 250 with combo < 250, trigger NEBULA FINALE
                s.victoryMode = 'NEBULA';
                setGameState((prev) => ({
                  ...prev,
                  status: 'VICTORY',
                  score: s.score,
                  level: Math.floor(s.score / 10) + 1,
                }));
                return;
              }
            } else {
              // BASE MOON VICTORY (Height 200)
              s.victoryMode = 'MOON';
              setGameState((prev) => ({
                ...prev,
                status: 'VICTORY',
                score: s.score,
                level: Math.floor(s.score / 10) + 1,
              }));
              return;
            }
          }

          s.dropping = null;
          s.isHolding = true;
          s.currentBrand = (s.currentBrand + 1) % BRANDS.length;
          if (adminModeRef.current) {
            s.tapCooldown = 0.04;
          }

          const gustDamp = Math.abs(s.windGustForce) * 0.2;
          const currentStability = Math.max(
            0,
            Math.round(100 - (Math.abs(s.totalWobble) / maxWobble) * 100 - gustDamp),
          );
          setGameState((prev) => ({
            ...prev,
            score: s.score,
            combo: s.combo,
            stability: currentStability,
            level: Math.floor(s.score / 10) + 1,
          }));
        } else {
          s.missedBlocks.push({
            x: drop.x,
            y: drop.y,
            vx: (drop.x > actualLandingX ? 280 : -280) + (Math.random() - 0.5) * 50,
            vy: -680,
            vRot: drop.x > actualLandingX ? 3.2 : -3.2,
            brandIndex: drop.brandIndex,
            rotation: drop.rotation,
            isMissed: true,
          });

          s.dropping = null;
          s.combo = 0;
          gameAudio.playErrorBuzz();
          spawnToast('MISS!', drop.x, actualLandingY - 20, '#f87171', false, 1.0);
          setGameState((prev) => ({...prev, combo: 0}));

          s.isHolding = true;
          s.currentBrand = (s.currentBrand + 1) % BRANDS.length;
        }
      }
    }

    // Update Missed Freefalling Containers
    for (let i = s.missedBlocks.length - 1; i >= 0; i--) {
      const mb = s.missedBlocks[i];
      mb.vy += effectiveGravity * deltaTime;
      mb.x += mb.vx * deltaTime;
      mb.y += mb.vy * deltaTime;
      mb.rotation += mb.vRot * deltaTime;
      if (mb.y > s.baseY + 500) {
        s.missedBlocks.splice(i, 1);
      }
    }

    // Natural Harmonic Pendulum Tower Wobble & High-Altitude Stability (+100)
    if (s.stack.length > 0) {
      const altitudeDamp =
        s.score > 100
          ? Math.max(0.40, 1 - ((s.score - 100) / 250) * 0.60)
          : 1.0;
      const maxSwayAngle = 0.05;
      const wobbleFrequency = 0.0028;
      const baseMultiplier = 0.00038;
      const naturalWobble =
        s.totalWobble * baseMultiplier * Math.sin(Date.now() * wobbleFrequency);
      const targetAngle = Math.max(
        -maxSwayAngle,
        Math.min(maxSwayAngle, naturalWobble * altitudeDamp),
      );

      s.wobbleAngle += (targetAngle - s.wobbleAngle) * Math.min(1, deltaTime * 5.0);

      if (Math.abs(s.totalWobble) >= maxWobble) {
        s.isCollapsing = true;
        s.screenShake = 18;
        gameAudio.playTowerCollapse();
        spawnToast('STRUCTURAL COLLAPSE!', vp.centerX, topStackY - 50, '#ef4444', true);
      }
    } else {
      s.wobbleAngle = 0;
    }

    // Update Particles
    for (let i = s.particles.length - 1; i >= 0; i--) {
      const p = s.particles[i];
      p.life += deltaTime;
      if (p.life >= p.maxLife) {
        s.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * deltaTime;
      p.y += p.vy * deltaTime;
      if (p.shape === 'smoke') {
        p.size += deltaTime * 6;
      } else if (p.shape === 'dust') {
        p.vy += 5 * deltaTime;
      } else {
        p.vy += (isStageHelix ? 160 : isStage5 ? 200 : 420) * deltaTime;
      }
      p.alpha = 1 - p.life / p.maxLife;
    }

    // Update Shockwaves
    for (let i = s.shockwaves.length - 1; i >= 0; i--) {
      const sw = s.shockwaves[i];
      sw.radius += deltaTime * 260;
      sw.alpha = Math.max(0, 1 - sw.radius / sw.maxRadius);
      if (sw.radius >= sw.maxRadius) {
        s.shockwaves.splice(i, 1);
      }
    }

    // Update Floating Texts
    for (let i = s.floatingTexts.length - 1; i >= 0; i--) {
      const ft = s.floatingTexts[i];
      ft.y -= deltaTime * 70;
      ft.alpha -= deltaTime * 0.9;
      if (ft.alpha <= 0) {
        s.floatingTexts.splice(i, 1);
      }
    }
  };

  // ----------------------------------------------------
  // DRAW FUNCTION (Edge-to-Edge Multi-Aspect Ratio Visuals)
  // ----------------------------------------------------
  const draw = (ctx: CanvasRenderingContext2D) => {
    const vp = viewportRef.current;
    prepareCanvas(ctx, vp.width, vp.height);
    const s = sim.current;
    const containerW = getConfig('containerWidth') as number;
    const containerH = getConfig('containerHeight') as number;
    const isVictory = gameStateRef.current.status === 'VICTORY';
    const isSingularity = gameStateRef.current.status === 'SINGULARITY';

    ctx.save();

    // Screen Shake & Bimodal Heartbeat Zoom
    const totalShake = s.screenShake + s.predictiveShake;
    let hbZoom = 1.0;
    if (s.heartbeatIntensity > 0 && !isVictory && !isSingularity) {
      const cycle = s.heartbeatPhase % (Math.PI * 2);
      let pulse = 0;
      if (cycle < 0.7) {
        pulse = Math.sin((cycle / 0.7) * Math.PI) * 0.75;
      } else if (cycle >= 0.8 && cycle < 1.5) {
        pulse = Math.sin(((cycle - 0.8) / 0.7) * Math.PI);
      }
      hbZoom = 1.0 + pulse * s.heartbeatIntensity * 0.045;
    }

    ctx.translate(vp.centerX, vp.height / 2);
    if (hbZoom !== 1.0) {
      ctx.scale(hbZoom, hbZoom);
    }
    if (totalShake > 0) {
      const sx = (Math.random() - 0.5) * totalShake * 2;
      const sy = (Math.random() - 0.5) * totalShake * 2;
      ctx.translate(sx, sy);
      if (s.shakeRot !== 0) {
        ctx.rotate(s.shakeRot);
      }
    }
    ctx.translate(-vp.centerX, -vp.height / 2);

    // 1. SKY GRADIENT (Full Logical Viewport Coverage)
    const continuousSky = getContinuousSkyGradient(ctx, vp.height, s.stack.length);
    ctx.fillStyle = continuousSky;
    ctx.fillRect(0, 0, vp.width, vp.height);

    const count = s.stack.length;
    const harborBlend = Math.max(0, 1 - count / 26);
    const skyBlend = Math.min(1, Math.max(0, (count - 18) / 10)) * Math.max(0, 1 - (count - 55) / 15);
    const stratBlend = Math.min(1, Math.max(0, (count - 45) / 15)) * Math.max(0, 1 - (count - 95) / 15);
    const spaceBlend = Math.min(1, Math.max(0, (count - 75) / 15));
    const beltBlend = Math.min(1, Math.max(0, (count - 130) / 20));
    const helixBlend = (count >= 210 || (isVictory && s.victoryMode === 'NEBULA') || isSingularity)
      ? Math.min(1, Math.max(0, (count - 210) / 30))
      : 0;

    // STAGE 1 VISUALS: Sunny Harbor & TALL LIGHTHOUSE (Score 0-25)
    if (harborBlend > 0 && !isVictory && !isSingularity) {
      ctx.save();
      ctx.globalAlpha = harborBlend;

      const sunX = vp.width - 110;
      const sunY = 120 + s.cameraY * 0.1;
      const sunGlow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 140);
      sunGlow.addColorStop(0, 'rgba(254, 240, 138, 0.9)');
      sunGlow.addColorStop(0.3, 'rgba(253, 224, 71, 0.4)');
      sunGlow.addColorStop(0.7, 'rgba(250, 204, 21, 0.1)');
      sunGlow.addColorStop(1, 'rgba(250, 204, 21, 0)');
      ctx.fillStyle = sunGlow;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 140, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(sunX, sunY, 28, 0, Math.PI * 2);
      ctx.fill();

      const harborOffsetY = s.cameraY * 0.2;
      ctx.fillStyle = '#0f2942';
      ctx.beginPath();
      ctx.moveTo(0, vp.height - 160 + harborOffsetY);

      const skylineSteps = 8;
      const segmentWidth = vp.width / skylineSteps;
      for (let seg = 0; seg < skylineSteps; seg++) {
        const segX = seg * segmentWidth;
        const hVal = (seg % 3 === 0 ? 240 : seg % 3 === 1 ? 190 : 310) + ((seg * 37) % 40);
        ctx.lineTo(segX + segmentWidth * 0.25, vp.height - hVal + harborOffsetY);
        ctx.lineTo(segX + segmentWidth * 0.75, vp.height - hVal + harborOffsetY);
        ctx.lineTo(segX + segmentWidth, vp.height - 160 + harborOffsetY);
      }

      ctx.lineTo(vp.width, vp.height);
      ctx.lineTo(0, vp.height);
      ctx.closePath();
      ctx.fill();

      // =========================================================================
      // DRAMATICALLY TALLER RED/WHITE MARITIME LIGHTHOUSE & ROCKY COASTAL JETTY
      // =========================================================================
      const lhX = Math.max(95, vp.width * 0.16);
      const lhBaseY = vp.height - 145 + harborOffsetY;
      const towerHeight = 215; // Increased height to stand significantly taller
      const towerBottomW = 54;
      const towerTopW = 28;
      const towerTopY = lhBaseY - towerHeight;
      const beaconCenterY = towerTopY - 24;

      // 1. Coastal Rocky Jetty / Outcrop Base
      ctx.save();
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(lhX - 80, lhBaseY + 45);
      ctx.lineTo(lhX - 65, lhBaseY - 12);
      ctx.lineTo(lhX - 35, lhBaseY - 22);
      ctx.lineTo(lhX + 35, lhBaseY - 22);
      ctx.lineTo(lhX + 68, lhBaseY - 10);
      ctx.lineTo(lhX + 90, lhBaseY + 45);
      ctx.closePath();
      ctx.fill();

      // Rocky Shading & Layered Crevices
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(lhX - 65, lhBaseY - 12);
      ctx.lineTo(lhX - 42, lhBaseY + 45);
      ctx.lineTo(lhX - 80, lhBaseY + 45);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(lhX + 22, lhBaseY - 18);
      ctx.lineTo(lhX + 35, lhBaseY + 45);
      ctx.lineTo(lhX + 58, lhBaseY + 45);
      ctx.lineTo(lhX + 45, lhBaseY - 4);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(lhX - 28, lhBaseY - 22);
      ctx.lineTo(lhX + 24, lhBaseY - 22);
      ctx.lineTo(lhX + 10, lhBaseY - 8);
      ctx.lineTo(lhX - 20, lhBaseY - 8);
      ctx.closePath();
      ctx.fill();

      // Stone Plinth Foundation
      ctx.fillStyle = '#475569';
      ctx.fillRect(lhX - 32, lhBaseY - 28, 64, 9);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(lhX - 32, lhBaseY - 28, 64, 9);
      ctx.restore();

      // 2. Rotating Sweeping Radiant Light Beam (Drawn from lantern center)
      ctx.save();
      const beamAngle = s.lighthouseAngle;
      const beamLength = 560;
      const beamSpread = 0.28;

      const beamGrad = ctx.createRadialGradient(
        lhX,
        beaconCenterY,
        4,
        lhX,
        beaconCenterY,
        beamLength,
      );
      beamGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      beamGrad.addColorStop(0.08, 'rgba(254, 240, 138, 0.85)');
      beamGrad.addColorStop(0.35, 'rgba(253, 224, 71, 0.38)');
      beamGrad.addColorStop(0.7, 'rgba(250, 204, 21, 0.12)');
      beamGrad.addColorStop(1, 'rgba(250, 204, 21, 0)');

      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(lhX, beaconCenterY);
      ctx.lineTo(
        lhX + Math.cos(beamAngle - beamSpread) * beamLength,
        beaconCenterY + Math.sin(beamAngle - beamSpread) * beamLength * 0.45,
      );
      ctx.lineTo(
        lhX + Math.cos(beamAngle + beamSpread) * beamLength,
        beaconCenterY + Math.sin(beamAngle + beamSpread) * beamLength * 0.45,
      );
      ctx.closePath();
      ctx.fill();

      // Secondary Faint Rear Lens Ambient Glow
      const rearAngle = beamAngle + Math.PI;
      const rearLength = 190;
      const rearGrad = ctx.createRadialGradient(
        lhX,
        beaconCenterY,
        2,
        lhX,
        beaconCenterY,
        rearLength,
      );
      rearGrad.addColorStop(0, 'rgba(254, 240, 138, 0.4)');
      rearGrad.addColorStop(0.5, 'rgba(253, 224, 71, 0.12)');
      rearGrad.addColorStop(1, 'rgba(250, 204, 21, 0)');
      ctx.fillStyle = rearGrad;
      ctx.beginPath();
      ctx.moveTo(lhX, beaconCenterY);
      ctx.lineTo(
        lhX + Math.cos(rearAngle - 0.2) * rearLength,
        beaconCenterY + Math.sin(rearAngle - 0.2) * rearLength * 0.4,
      );
      ctx.lineTo(
        lhX + Math.cos(rearAngle + 0.2) * rearLength,
        beaconCenterY + Math.sin(rearAngle + 0.2) * rearLength * 0.4,
      );
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // 3. Tapered Red and White Striped Tower Trunk (7 Distinct High-Altitude Bands)
      const numBands = 7;
      const trunkH = towerHeight - 28;

      for (let b = 0; b < numBands; b++) {
        const t0 = b / numBands;
        const t1 = (b + 1) / numBands;
        const y0 = (lhBaseY - 28) - t0 * trunkH;
        const y1 = (lhBaseY - 28) - t1 * trunkH;
        const w0 = towerBottomW - (towerBottomW - towerTopW) * t0;
        const w1 = towerBottomW - (towerBottomW - towerTopW) * t1;

        const isRedBand = b % 2 === 0;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(lhX - w0 / 2, y0);
        ctx.lineTo(lhX - w1 / 2, y1);
        ctx.lineTo(lhX + w1 / 2, y1);
        ctx.lineTo(lhX + w0 / 2, y0);
        ctx.closePath();

        ctx.fillStyle = isRedBand ? '#dc2626' : '#f8fafc';
        ctx.fill();

        // 3D Cylindrical Curvature Shading Overlay
        const shadeGrad = ctx.createLinearGradient(lhX - w0 / 2, 0, lhX + w0 / 2, 0);
        shadeGrad.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
        shadeGrad.addColorStop(0.25, 'rgba(0, 0, 0, 0.1)');
        shadeGrad.addColorStop(0.55, 'rgba(255, 255, 255, 0.25)');
        shadeGrad.addColorStop(0.85, 'rgba(0, 0, 0, 0.15)');
        shadeGrad.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
        ctx.fillStyle = shadeGrad;
        ctx.fill();

        ctx.strokeStyle = 'rgba(15, 23, 42, 0.6)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Arched Maritime Windows on White Bands
        if (!isRedBand) {
          const winY = (y0 + y1) / 2;
          const winW = 8;
          const winH = 12;
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.arc(lhX, winY - winH / 2 + winW / 2, winW / 2, Math.PI, 0);
          ctx.lineTo(lhX + winW / 2, winY + winH / 2);
          ctx.lineTo(lhX - winW / 2, winY + winH / 2);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#64748b';
          ctx.fillRect(lhX - winW / 2 - 1.5, winY + winH / 2, winW + 3, 2.5);
        }

        ctx.restore();
      }

      // 4. Observation Gallery Deck & Iron Railings
      ctx.save();
      ctx.fillStyle = '#991b1b';
      ctx.beginPath();
      ctx.moveTo(lhX - towerTopW / 2 - 2, towerTopY + 5);
      ctx.lineTo(lhX - 22, towerTopY - 2);
      ctx.lineTo(lhX + 22, towerTopY - 2);
      ctx.lineTo(lhX + towerTopW / 2 + 2, towerTopY + 5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Gallery Walkway Deck
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(lhX - 24, towerTopY - 6, 48, 5);

      // Gallery Iron Railings
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(lhX - 23, towerTopY - 16);
      ctx.lineTo(lhX + 23, towerTopY - 16);
      ctx.moveTo(lhX - 23, towerTopY - 10);
      ctx.lineTo(lhX + 23, towerTopY - 10);
      const railPosts = [-22, -14, -7, 0, 7, 14, 22];
      for (const rx of railPosts) {
        ctx.moveTo(lhX + rx, towerTopY - 6);
        ctx.lineTo(lhX + rx, towerTopY - 16);
      }
      ctx.stroke();
      ctx.restore();

      // 5. Lantern Room Enclosure & Luminous Warm Golden Beacon Core
      ctx.save();
      const lanternW = 28;
      const lanternH = 20;
      const lanternY = towerTopY - 6 - lanternH;

      const glassGrad = ctx.createLinearGradient(0, lanternY, 0, lanternY + lanternH);
      glassGrad.addColorStop(0, '#fef08a');
      glassGrad.addColorStop(0.5, '#fde047');
      glassGrad.addColorStop(1, '#eab308');
      ctx.fillStyle = glassGrad;
      ctx.fillRect(lhX - lanternW / 2, lanternY, lanternW, lanternH);

      const beaconGlow = ctx.createRadialGradient(
        lhX,
        beaconCenterY,
        2,
        lhX,
        beaconCenterY,
        34,
      );
      beaconGlow.addColorStop(0, 'rgba(255, 255, 255, 1)');
      beaconGlow.addColorStop(0.25, 'rgba(254, 240, 138, 0.95)');
      beaconGlow.addColorStop(0.65, 'rgba(245, 158, 11, 0.55)');
      beaconGlow.addColorStop(1, 'rgba(245, 158, 11, 0)');
      ctx.fillStyle = beaconGlow;
      ctx.beginPath();
      ctx.arc(lhX, beaconCenterY, 34, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(lhX - lanternW / 2, lanternY, lanternW, lanternH);
      ctx.beginPath();
      ctx.moveTo(lhX - 7, lanternY);
      ctx.lineTo(lhX - 7, lanternY + lanternH);
      ctx.moveTo(lhX + 7, lanternY);
      ctx.lineTo(lhX + 7, lanternY + lanternH);
      ctx.stroke();
      ctx.restore();

      // 6. Conical Cupola Roof & Spire
      ctx.save();
      const roofBottomY = towerTopY - 6 - lanternH;
      const roofPeakY = roofBottomY - 16;

      ctx.fillStyle = '#7f1d1d';
      ctx.beginPath();
      ctx.moveTo(lhX - 16, roofBottomY);
      ctx.lineTo(lhX, roofPeakY);
      ctx.lineTo(lhX + 16, roofBottomY);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.beginPath();
      ctx.moveTo(lhX, roofPeakY);
      ctx.lineTo(lhX + 8, roofBottomY);
      ctx.lineTo(lhX, roofBottomY);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#450a0a';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(lhX - 17, roofBottomY - 2, 34, 3);

      ctx.fillStyle = '#fbbf24';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(lhX, roofPeakY - 2, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(lhX, roofPeakY - 2);
      ctx.lineTo(lhX, roofPeakY - 16);
      ctx.stroke();
      ctx.restore();

      for (const pel of s.pelicans) {
        const py = pel.y + s.cameraY * 0.15 + Math.sin(pel.wingPhase * 0.5) * 8;
        const wing = Math.sin(pel.wingPhase) * 9 * pel.scale;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.4 * pel.scale;
        ctx.beginPath();
        ctx.moveTo(pel.x - 16 * pel.scale, py - wing);
        ctx.quadraticCurveTo(pel.x - 7 * pel.scale, py + 5 * pel.scale, pel.x, py);
        ctx.quadraticCurveTo(pel.x + 7 * pel.scale, py + 5 * pel.scale, pel.x + 16 * pel.scale, py - wing);
        ctx.stroke();

        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(pel.x + 2, py);
        ctx.lineTo(pel.x + 8 * pel.scale, py + 2);
        ctx.lineTo(pel.x + 2, py + 3);
        ctx.fill();
      }

      ctx.restore();
    }

    // STAGE 2 VISUALS: Blue Sky (Score 16-50)
    if (skyBlend > 0 && !isVictory && !isSingularity) {
      ctx.save();
      ctx.globalAlpha = skyBlend;

      for (const ws of s.windStreams) {
        const wy = ws.y + s.cameraY * 0.12;
        const wGrad = ctx.createLinearGradient(ws.x, wy, ws.x + ws.length, wy);
        wGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        wGrad.addColorStop(0.5, `rgba(255, 255, 255, ${ws.alpha})`);
        wGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = wGrad;
        ctx.fillRect(ws.x, wy, ws.length, 3);
      }

      for (const bal of s.balloons) {
        const by = bal.y + s.cameraY * 0.14 + Math.sin(Date.now() * 0.0015 + bal.x) * 6;
        ctx.save();
        ctx.translate(bal.x, by);

        const [c1, c2, c3] = bal.colors;
        ctx.fillStyle = c1;
        ctx.beginPath();
        ctx.ellipse(0, 0, 26 * bal.scale, 32 * bal.scale, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = c2;
        ctx.beginPath();
        ctx.ellipse(0, 0, 16 * bal.scale, 32 * bal.scale, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = c3;
        ctx.beginPath();
        ctx.ellipse(0, 0, 8 * bal.scale, 32 * bal.scale, 0, 0, Math.PI * 2);
        ctx.fill();

        if (bal.burnerBurst > 0) {
          const flameH = (16 + Math.random() * 10) * bal.burnerBurst * bal.scale;
          const flameGrad = ctx.createLinearGradient(0, 32 * bal.scale, 0, 32 * bal.scale + flameH);
          flameGrad.addColorStop(0, 'rgba(254, 240, 138, 0.95)');
          flameGrad.addColorStop(0.5, 'rgba(249, 115, 22, 0.85)');
          flameGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
          ctx.fillStyle = flameGrad;
          ctx.beginPath();
          ctx.moveTo(-5 * bal.scale, 32 * bal.scale);
          ctx.lineTo(0, 32 * bal.scale + flameH);
          ctx.lineTo(5 * bal.scale, 32 * bal.scale);
          ctx.closePath();
          ctx.fill();
        }

        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-10 * bal.scale, 30 * bal.scale);
        ctx.lineTo(-6 * bal.scale, 44 * bal.scale);
        ctx.moveTo(10 * bal.scale, 30 * bal.scale);
        ctx.lineTo(6 * bal.scale, 44 * bal.scale);
        ctx.stroke();

        ctx.fillStyle = '#b45309';
        ctx.fillRect(-7 * bal.scale, 44 * bal.scale, 14 * bal.scale, 10 * bal.scale);
        ctx.restore();
      }

      for (const flock of s.flocks) {
        const fy = flock.y + s.cameraY * 0.12;
        const vOffsets = [
          {dx: 0, dy: 0},
          {dx: -24, dy: 14},
          {dx: -48, dy: 28},
          {dx: -72, dy: 42},
          {dx: -24, dy: -14},
          {dx: -48, dy: -28},
          {dx: -72, dy: -42},
        ];
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.8 * flock.scale;
        for (const pt of vOffsets) {
          const bx = flock.x + pt.dx * flock.scale;
          const by = fy + pt.dy * flock.scale;
          const wing = Math.sin(flock.wingPhase + pt.dx * 0.1) * 6 * flock.scale;
          ctx.beginPath();
          ctx.moveTo(bx - 8 * flock.scale, by - wing);
          ctx.quadraticCurveTo(bx - 3 * flock.scale, by + 3 * flock.scale, bx, by);
          ctx.quadraticCurveTo(bx + 3 * flock.scale, by + 3 * flock.scale, bx + 8 * flock.scale, by - wing);
          ctx.stroke();
        }
      }

      for (const para of s.paragliders) {
        const py = para.y + s.cameraY * 0.15 + Math.sin(para.swayPhase) * 8;
        ctx.save();
        ctx.translate(para.x, py);
        ctx.rotate(Math.sin(para.swayPhase) * 0.08);

        ctx.fillStyle = para.canopyColor;
        ctx.beginPath();
        ctx.ellipse(0, 0, 32 * para.scale, 12 * para.scale, 0, Math.PI, 0);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(0, 0, 18 * para.scale, 12 * para.scale, 0, Math.PI, 0);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(-28 * para.scale, 0);
        ctx.lineTo(0, 26 * para.scale);
        ctx.moveTo(28 * para.scale, 0);
        ctx.lineTo(0, 26 * para.scale);
        ctx.moveTo(-10 * para.scale, 0);
        ctx.lineTo(0, 26 * para.scale);
        ctx.moveTo(10 * para.scale, 0);
        ctx.lineTo(0, 26 * para.scale);
        ctx.stroke();

        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(0, 26 * para.scale, 3.5 * para.scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();
    }

    // STAGE 3 VISUALS: Stratosphere & Twilight (Score 51-100)
    if (stratBlend > 0 && !isVictory && !isSingularity) {
      ctx.save();
      ctx.globalAlpha = stratBlend;

      const auroraY = 60 + s.cameraY * 0.06;
      for (let band = 0; band < 3; band++) {
        const aGrad = ctx.createLinearGradient(0, auroraY + band * 35, 0, auroraY + band * 35 + 110);
        const col = band === 0 ? 'rgba(52, 211, 153, ' : band === 1 ? 'rgba(56, 189, 248, ' : 'rgba(168, 85, 247, ';
        aGrad.addColorStop(0, `${col}0)`);
        aGrad.addColorStop(0.5, `${col}0.35)`);
        aGrad.addColorStop(1, `${col}0)`);
        ctx.fillStyle = aGrad;
        ctx.beginPath();
        ctx.moveTo(0, auroraY + band * 35);
        for (let x = 0; x <= vp.width; x += 30) {
          const wave = Math.sin(x * 0.015 + s.auroraPhase + band * 1.8) * 26;
          ctx.lineTo(x, auroraY + band * 35 + wave);
        }
        ctx.lineTo(vp.width, auroraY + band * 35 + 110);
        ctx.lineTo(0, auroraY + band * 35 + 110);
        ctx.closePath();
        ctx.fill();
      }

      if (s.activePlane) {
        const jet = s.activePlane;
        const jy = jet.y + s.cameraY * 0.08;
        ctx.save();
        ctx.translate(jet.x, jy);
        if (jet.speed < 0) ctx.scale(-1, 1);

        const cGrad = ctx.createLinearGradient(-260, 0, 0, 0);
        cGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        cGrad.addColorStop(0.7, jet.isStealth ? 'rgba(56, 189, 248, 0.4)' : 'rgba(255, 255, 255, 0.6)');
        cGrad.addColorStop(1, '#ffffff');
        ctx.fillStyle = cGrad;
        ctx.fillRect(-260, -4, 260, 2.5);
        ctx.fillRect(-260, 2, 260, 2.5);

        ctx.fillStyle = jet.isStealth ? '#0f172a' : '#e2e8f0';
        ctx.beginPath();
        ctx.ellipse(0, 0, 22 * jet.scale, 4 * jet.scale, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(4 * jet.scale, 0);
        ctx.lineTo(-12 * jet.scale, -18 * jet.scale);
        ctx.lineTo(-6 * jet.scale, 0);
        ctx.lineTo(-12 * jet.scale, 18 * jet.scale);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#38bdf8';
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(-22 * jet.scale, -2, 2.5, 0, Math.PI * 2);
        ctx.arc(-22 * jet.scale, 2, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
      }

      for (const wb of s.weatherBalloons) {
        const wy = wb.y + s.cameraY * 0.08 + Math.sin(Date.now() * 0.002) * 5;
        ctx.save();
        ctx.translate(wb.x, wy);

        const bGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, 22 * wb.scale);
        bGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        bGrad.addColorStop(0.8, 'rgba(224, 242, 254, 0.5)');
        bGrad.addColorStop(1, 'rgba(186, 230, 253, 0.2)');
        ctx.fillStyle = bGrad;
        ctx.beginPath();
        ctx.arc(0, 0, 22 * wb.scale, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 22 * wb.scale);
        ctx.lineTo(0, 42 * wb.scale);
        ctx.stroke();

        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-5 * wb.scale, 42 * wb.scale, 10 * wb.scale, 8 * wb.scale);

        const ledOn = Math.sin(Date.now() * 0.01) > 0;
        ctx.fillStyle = ledOn ? '#ef4444' : '#22c55e';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(0, 46 * wb.scale, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(0, 42 * wb.scale);
        ctx.lineTo(Math.cos(wb.radarAngle) * 8, 42 * wb.scale - 4);
        ctx.stroke();
        ctx.restore();
      }

      for (const star of s.shootingStars) {
        const sGrad = ctx.createLinearGradient(star.x - star.len, star.y - star.len * 0.6, star.x, star.y);
        sGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        sGrad.addColorStop(0.7, 'rgba(254, 240, 138, 0.5)');
        sGrad.addColorStop(1, '#ffffff');
        ctx.strokeStyle = sGrad;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(star.x - star.len, star.y - star.len * 0.6);
        ctx.lineTo(star.x, star.y);
        ctx.stroke();
      }

      ctx.restore();
    }

    // STAGE 4 VISUALS: Outer Space & Cosmos (Score 101-250+)
    if (spaceBlend > 0 || isVictory || isSingularity) {
      ctx.save();
      const currentSpaceAlpha = isVictory ? 1.0 : spaceBlend;

      for (const star of s.starfield) {
        const starY = (((star.y - s.cameraY * 0.05 * star.speed) % vp.height) + vp.height) % vp.height;
        const starX = (((star.x) % vp.width) + vp.width) % vp.width;
        const twinkle = 0.65 + 0.35 * Math.sin(Date.now() * 0.002 * star.speed + star.x * 0.5);
        ctx.save();
        ctx.fillStyle = star.color;
        ctx.globalAlpha = Math.max(0, Math.min(1, star.alpha * currentSpaceAlpha * twinkle));
        ctx.beginPath();
        ctx.arc(starX, starY, Math.max(0.5, star.size), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (!isVictory && !isSingularity) {
        for (const ss of s.spaceStations) {
          const ssy = ss.y + s.cameraY * 0.03;
          ctx.save();
          ctx.globalAlpha = Math.max(0, Math.min(1, spaceBlend));
          ctx.translate(ss.x, ssy);
          ctx.rotate(ss.rotAngle);

          ctx.fillStyle = '#e2e8f0';
          ctx.beginPath();
          ctx.arc(0, 0, 10, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(-45, 0);
          ctx.lineTo(45, 0);
          ctx.stroke();

          ctx.fillStyle = '#0284c7';
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1;
          ctx.fillRect(-45, -16, 20, 32);
          ctx.strokeRect(-45, -16, 20, 32);
          ctx.fillRect(25, -16, 20, 32);
          ctx.strokeRect(25, -16, 20, 32);

          const morseUnitDuration = 0.22;
          const currentMorseUnit = Math.floor((Date.now() / 1000 / morseUnitDuration) % MORSE_LOVE_U.length);
          const isMorseOn = MORSE_LOVE_U[currentMorseUnit] === 1;

          if (isMorseOn) {
            ctx.fillStyle = '#f43f5e';
            ctx.shadowColor = '#f43f5e';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
          } else {
            ctx.fillStyle = '#3f1118';
            ctx.beginPath();
            ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }

        for (const astro of s.astronauts) {
          const asY = astro.y + s.cameraY * 0.03 + Math.sin(astro.wavePhase * 0.5) * 6;
          ctx.save();
          ctx.globalAlpha = Math.max(0, Math.min(1, spaceBlend));
          ctx.translate(astro.x, asY);

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(-40, -30);
          ctx.quadraticCurveTo(-15, -10 + Math.sin(astro.wavePhase) * 10, 0, 0);
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(0, -6, 6, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.ellipse(2, -6, 3, 4, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#e2e8f0';
          ctx.fillRect(-5, 0, 10, 12);
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(-8, 1, 3, 10);

          const armAngle = Math.sin(astro.wavePhase) * 0.5;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(5, 2);
          ctx.lineTo(5 + Math.cos(armAngle - 0.8) * 10, 2 + Math.sin(armAngle - 0.8) * 10);
          ctx.stroke();
          ctx.restore();
        }

        for (const ufo of s.ufos) {
          const uy = ufo.y + s.cameraY * 0.03 + Math.sin(Date.now() * 0.003) * 8;
          ctx.save();
          ctx.globalAlpha = Math.max(0, Math.min(1, spaceBlend));
          ctx.translate(ufo.x, uy);

          const ufoBeam = ctx.createLinearGradient(0, 0, 0, 100);
          ufoBeam.addColorStop(0, 'rgba(56, 189, 248, 0.5)');
          ufoBeam.addColorStop(1, 'rgba(56, 189, 248, 0)');
          ctx.fillStyle = ufoBeam;
          ctx.beginPath();
          ctx.moveTo(-10, 6);
          ctx.lineTo(-40, 100);
          ctx.lineTo(40, 100);
          ctx.lineTo(10, 6);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.arc(0, -5, 10, Math.PI, 0);
          ctx.fill();

          ctx.fillStyle = '#e2e8f0';
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(0, 0, 28, 9, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          const lightPhase = Date.now() * 0.008;
          for (let li = 0; li < 6; li++) {
            const lx = Math.cos(lightPhase + (li * Math.PI * 2) / 6) * 20;
            ctx.fillStyle = li % 2 === 0 ? '#38bdf8' : '#f43f5e';
            ctx.beginPath();
            ctx.arc(lx, 2, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      }

      ctx.restore();
    }

    // STAGE 5 VISUALS: Dense Asteroid Belt (Score 141-199)
    if (beltBlend > 0 && !isVictory && !isSingularity && count <= 200) {
      ctx.save();
      ctx.globalAlpha = beltBlend;

      for (const bast of s.beltAsteroids) {
        const ay = bast.y + s.cameraY * 0.03;
        ctx.save();
        ctx.translate(bast.x, ay);
        ctx.rotate(bast.rot);

        const astGrad = ctx.createRadialGradient(
          -bast.radius * 0.35,
          -bast.radius * 0.35,
          bast.radius * 0.1,
          0,
          0,
          bast.radius,
        );
        astGrad.addColorStop(0, '#e7e5e4');
        astGrad.addColorStop(0.35, bast.baseColor);
        astGrad.addColorStop(0.85, bast.shadeColor);
        astGrad.addColorStop(1, '#0c0a09');

        ctx.fillStyle = astGrad;
        ctx.beginPath();
        const points = 8;
        for (let p = 0; p < points; p++) {
          const a = (p / points) * Math.PI * 2;
          const rMod = 0.85 + 0.3 * Math.sin(p * 2.5 + bast.rot);
          const px = Math.cos(a) * bast.radius * rMod;
          const py = Math.sin(a) * bast.radius * rMod;
          if (p === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        for (const crater of bast.craters) {
          ctx.save();
          ctx.translate(crater.cx, crater.cy);
          const cGrad = ctx.createRadialGradient(
            -crater.r * 0.2,
            -crater.r * 0.2,
            crater.r * 0.1,
            0,
            0,
            crater.r,
          );
          cGrad.addColorStop(0, 'rgba(0, 0, 0, 0.75)');
          cGrad.addColorStop(0.7, bast.shadeColor);
          cGrad.addColorStop(1, 'rgba(255, 255, 255, 0.25)');
          ctx.fillStyle = cGrad;
          ctx.beginPath();
          ctx.arc(0, 0, crater.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        ctx.restore();
      }

      ctx.restore();
    }

    // =========================================================================
    // COLOSSAL PROGRESSIVE MOON WITH DETAILED CRATERS & MARIA (Score 140 -> 250)
    // Smoothly glides downward as altitude climbs from 200 toward 250
    // =========================================================================
    if ((count >= 140 && count <= 248) || (isVictory && s.victoryMode === 'MOON')) {
      const isPost200 = count > 200 && !isVictory;
      const moonProgress = isVictory
        ? 1.0
        : Math.min(1, Math.max(0, (count - 140) / 60));
      const moonAlpha = isVictory
        ? 1.0
        : isPost200
        ? Math.max(0, 1 - (count - 200) / 45)
        : 0.2 + 0.8 * moonProgress;

      if (moonAlpha > 0.01) {
        ctx.save();
        ctx.globalAlpha = moonAlpha;

        const moonCenterX = vp.centerX;
        const baseMoonY = 220 + (1 - Math.min(1, moonProgress)) * 140;
        const downwardGlide = isPost200 ? (count - 200) * 16 : 0;
        const moonCenterY = isVictory
          ? vp.height * 0.38
          : baseMoonY + downwardGlide + s.cameraY * 0.02;

        const moonRadius = 220 + 175 * Math.min(1, moonProgress);
        const scaleRef = moonRadius / 220;

        // 1. Multi-Layered Luminous Lunar Halo
        const haloGrad = ctx.createRadialGradient(
          moonCenterX,
          moonCenterY,
          moonRadius * 0.85,
          moonCenterX,
          moonCenterY,
          moonRadius * 2.6,
        );
        haloGrad.addColorStop(0, `rgba(224, 242, 254, ${0.45 + 0.35 * Math.min(1, moonProgress)})`);
        haloGrad.addColorStop(0.25, `rgba(56, 189, 248, ${0.25 + 0.20 * Math.min(1, moonProgress)})`);
        haloGrad.addColorStop(0.65, `rgba(168, 85, 247, ${0.12 + 0.15 * Math.min(1, moonProgress)})`);
        haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = haloGrad;
        ctx.beginPath();
        ctx.arc(moonCenterX, moonCenterY, moonRadius * 2.6, 0, Math.PI * 2);
        ctx.fill();

        // 2. Base Lunar Spherical Body (3D Top-Left Lighting)
        const moonGrad = ctx.createRadialGradient(
          moonCenterX - moonRadius * 0.35,
          moonCenterY - moonRadius * 0.35,
          moonRadius * 0.08,
          moonCenterX,
          moonCenterY,
          moonRadius,
        );
        moonGrad.addColorStop(0, '#ffffff');
        moonGrad.addColorStop(0.28, '#f8fafc');
        moonGrad.addColorStop(0.65, '#cbd5e1');
        moonGrad.addColorStop(0.88, '#64748b');
        moonGrad.addColorStop(1, '#0f172a');

        ctx.fillStyle = moonGrad;
        ctx.beginPath();
        ctx.arc(moonCenterX, moonCenterY, moonRadius, 0, Math.PI * 2);
        ctx.fill();

        // 3. Lunar Maria (Dark Basaltic Plains)
        const mariaList = [
          // Oceanus Procellarum
          {cx: -80 * scaleRef, cy: -20 * scaleRef, rx: 75 * scaleRef, ry: 100 * scaleRef, rot: -0.15},
          // Mare Imbrium
          {cx: -45 * scaleRef, cy: -65 * scaleRef, rx: 65 * scaleRef, ry: 50 * scaleRef, rot: -0.1},
          // Mare Serenitatis
          {cx: 25 * scaleRef, cy: -50 * scaleRef, rx: 45 * scaleRef, ry: 40 * scaleRef, rot: 0.15},
          // Mare Tranquillitatis
          {cx: 65 * scaleRef, cy: -15 * scaleRef, rx: 55 * scaleRef, ry: 45 * scaleRef, rot: 0.3},
          // Mare Crisium (Isolated oval)
          {cx: 110 * scaleRef, cy: -25 * scaleRef, rx: 32 * scaleRef, ry: 24 * scaleRef, rot: 0.05},
          // Mare Fecunditatis
          {cx: 80 * scaleRef, cy: 35 * scaleRef, rx: 48 * scaleRef, ry: 40 * scaleRef, rot: 0.4},
          // Mare Nectaris
          {cx: 55 * scaleRef, cy: 65 * scaleRef, rx: 32 * scaleRef, ry: 28 * scaleRef, rot: 0.2},
          // Mare Nubium
          {cx: -35 * scaleRef, cy: 60 * scaleRef, rx: 50 * scaleRef, ry: 42 * scaleRef, rot: -0.25},
          // Mare Humorum
          {cx: -85 * scaleRef, cy: 65 * scaleRef, rx: 30 * scaleRef, ry: 28 * scaleRef, rot: 0.1},
          // Mare Frigoris (Northern arc)
          {cx: -10 * scaleRef, cy: -115 * scaleRef, rx: 90 * scaleRef, ry: 18 * scaleRef, rot: -0.05},
        ];

        for (const m of mariaList) {
          ctx.save();
          ctx.translate(moonCenterX + m.cx, moonCenterY + m.cy);
          ctx.rotate(m.rot);
          const mGrad = ctx.createRadialGradient(0, 0, m.rx * 0.1, 0, 0, m.rx);
          mGrad.addColorStop(0, 'rgba(30, 41, 59, 0.72)');
          mGrad.addColorStop(0.65, 'rgba(51, 65, 85, 0.60)');
          mGrad.addColorStop(1, 'rgba(71, 85, 105, 0.15)');
          ctx.fillStyle = mGrad;
          ctx.beginPath();
          ctx.ellipse(0, 0, m.rx, m.ry, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // 4. Tycho Crater & 16-Ray Radiating System (Southern Lunar Highlands)
        const tychoX = moonCenterX - 35 * scaleRef;
        const tychoY = moonCenterY + 110 * scaleRef;
        const tychoRadius = 14 * scaleRef;

        // Radiating Tycho Ray Filaments across disk
        ctx.save();
        const rayAngles = [
          -0.1, 0.25, 0.55, 0.9, 1.25, 1.6, 1.95, 2.3, 2.65, 3.0, 3.35, 3.7, 4.05, 4.4, 4.75, 5.2
        ];
        for (const rAng of rayAngles) {
          const rayLen = (140 + Math.sin(rAng * 4) * 50) * scaleRef;
          const rayGrad = ctx.createLinearGradient(
            tychoX,
            tychoY,
            tychoX + Math.cos(rAng) * rayLen,
            tychoY + Math.sin(rAng) * rayLen,
          );
          rayGrad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
          rayGrad.addColorStop(0.2, 'rgba(241, 245, 249, 0.45)');
          rayGrad.addColorStop(0.7, 'rgba(226, 232, 240, 0.18)');
          rayGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

          ctx.strokeStyle = rayGrad;
          ctx.lineWidth = 2.2 * scaleRef;
          ctx.beginPath();
          ctx.moveTo(tychoX, tychoY);
          ctx.lineTo(tychoX + Math.cos(rAng) * rayLen, tychoY + Math.sin(rAng) * rayLen);
          ctx.stroke();
        }
        ctx.restore();

        // Tycho Main Crater Body
        ctx.save();
        ctx.translate(tychoX, tychoY);
        // Outer Ejecta Glow
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.arc(0, 0, tychoRadius * 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Floor Shadow
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(0, 0, tychoRadius, 0, Math.PI * 2);
        ctx.fill();

        // Sunlit Rim (Northwest Highlight)
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.2 * scaleRef;
        ctx.beginPath();
        ctx.arc(0, 0, tychoRadius, Math.PI * 0.75, Math.PI * 1.85);
        ctx.stroke();

        // Central Peak
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-1 * scaleRef, -1 * scaleRef, 2.8 * scaleRef, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 5. Copernicus Crater (Terraced Walls, Dual Peaks, Ray Halo)
        const copX = moonCenterX - 65 * scaleRef;
        const copY = moonCenterY - 30 * scaleRef;
        const copRadius = 18 * scaleRef;

        ctx.save();
        ctx.translate(copX, copY);
        // Halo
        const copHalo = ctx.createRadialGradient(0, 0, copRadius * 0.5, 0, 0, copRadius * 2.8);
        copHalo.addColorStop(0, 'rgba(255, 255, 255, 0.65)');
        copHalo.addColorStop(0.4, 'rgba(241, 245, 249, 0.3)');
        copHalo.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = copHalo;
        ctx.beginPath();
        ctx.arc(0, 0, copRadius * 2.8, 0, Math.PI * 2);
        ctx.fill();

        // Terraced Outer Wall
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(0, 0, copRadius, 0, Math.PI * 2);
        ctx.fill();

        // Inner Shadow
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(1.5 * scaleRef, 1.5 * scaleRef, copRadius * 0.75, 0, Math.PI * 2);
        ctx.fill();

        // Sunlit Rim
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5 * scaleRef;
        ctx.beginPath();
        ctx.arc(0, 0, copRadius, Math.PI * 0.7, Math.PI * 1.8);
        ctx.stroke();

        // Central Peak Complex
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-1.5 * scaleRef, -1 * scaleRef, 2.2 * scaleRef, 0, Math.PI * 2);
        ctx.arc(1 * scaleRef, -0.5 * scaleRef, 1.8 * scaleRef, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 6. Varied Landmark Craters (Plato, Kepler, Aristarchus, Clavius, Archimedes)
        const landmarkCraters = [
          // Plato (Dark basaltic flat floor in northern uplands)
          {x: -28 * scaleRef, y: -105 * scaleRef, r: 15 * scaleRef, isDarkFloor: true, name: 'Plato'},
          // Aristarchus (Brightest high-albedo spot on the moon)
          {x: -125 * scaleRef, y: -45 * scaleRef, r: 10 * scaleRef, isSuperBright: true, name: 'Aristarchus'},
          // Kepler (Miniature ray system)
          {x: -95 * scaleRef, y: -10 * scaleRef, r: 11 * scaleRef, isRayed: true, name: 'Kepler'},
          // Archimedes
          {x: -15 * scaleRef, y: -55 * scaleRef, r: 13 * scaleRef, isDarkFloor: false, name: 'Archimedes'},
          // Clavius (Huge southern crater with arc of sub-craters)
          {x: -20 * scaleRef, y: 150 * scaleRef, r: 24 * scaleRef, isClavius: true, name: 'Clavius'},
          // Grimaldi (Near western limb, very dark oval)
          {x: -145 * scaleRef, y: 15 * scaleRef, r: 16 * scaleRef, isDarkFloor: true, name: 'Grimaldi'},
          // Stevinus & Snellius
          {x: 105 * scaleRef, y: 95 * scaleRef, r: 12 * scaleRef, isRayed: false, name: 'Stevinus'},
          // Posidonius (Serenitatis rim)
          {x: 68 * scaleRef, y: -75 * scaleRef, r: 12 * scaleRef, isDarkFloor: false, name: 'Posidonius'},
          // Theophilus, Cyrillus, Catharina triplet
          {x: 60 * scaleRef, y: 40 * scaleRef, r: 14 * scaleRef, isDarkFloor: false, name: 'Theophilus'},
          {x: 52 * scaleRef, y: 55 * scaleRef, r: 13 * scaleRef, isDarkFloor: false, name: 'Cyrillus'},
          {x: 48 * scaleRef, y: 72 * scaleRef, r: 13 * scaleRef, isDarkFloor: false, name: 'Catharina'},
        ];

        for (const cr of landmarkCraters) {
          const cx = moonCenterX + cr.x;
          const cy = moonCenterY + cr.y;

          ctx.save();
          ctx.translate(cx, cy);

          if (cr.isSuperBright) {
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 14;
            ctx.beginPath();
            ctx.arc(0, 0, cr.r * 1.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
          }

          if (cr.isDarkFloor) {
            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.arc(0, 0, cr.r, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillStyle = '#1e293b';
            ctx.beginPath();
            ctx.arc(0, 0, cr.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.arc(cr.r * 0.15, cr.r * 0.15, cr.r * 0.75, 0, Math.PI * 2);
            ctx.fill();
          }

          // Crisp Sunlit Rim Highlight
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.8 * scaleRef;
          ctx.beginPath();
          ctx.arc(0, 0, cr.r, Math.PI * 0.7, Math.PI * 1.85);
          ctx.stroke();

          if (cr.isClavius) {
            // Arc of interior micro-craters inside Clavius
            const claviusSubs = [
              {dx: -8, dy: -6, sr: 5},
              {dx: -1, dy: -3, sr: 4},
              {dx: 5, dy: 1, sr: 3.2},
              {dx: 10, dy: 6, sr: 2.5},
            ];
            for (const sub of claviusSubs) {
              ctx.fillStyle = '#020617';
              ctx.beginPath();
              ctx.arc(sub.dx * scaleRef, sub.dy * scaleRef, sub.sr * scaleRef, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 1 * scaleRef;
              ctx.beginPath();
              ctx.arc(sub.dx * scaleRef, sub.dy * scaleRef, sub.sr * scaleRef, Math.PI * 0.7, Math.PI * 1.85);
              ctx.stroke();
            }
          }

          ctx.restore();
        }

        // 7. Micro-Crater Distribution System Across Highlands
        const microCraters = [
          {x: -110, y: 110, r: 6}, {x: -80, y: 135, r: 5}, {x: -60, y: 160, r: 7},
          {x: 10, y: 130, r: 6}, {x: 35, y: 155, r: 8}, {x: 75, y: 125, r: 5},
          {x: 120, y: 60, r: 6}, {x: 135, y: 15, r: 7}, {x: 140, y: -45, r: 5},
          {x: 95, y: -110, r: 6}, {x: 50, y: -135, r: 5}, {x: -70, y: -125, r: 7},
          {x: -130, y: -85, r: 6}, {x: -150, y: -30, r: 5}, {x: -140, y: 80, r: 7},
        ];

        for (const mc of microCraters) {
          const cx = moonCenterX + mc.x * scaleRef;
          const cy = moonCenterY + mc.y * scaleRef;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.arc(0, 0, mc.r * scaleRef, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.lineWidth = 1.2 * scaleRef;
          ctx.beginPath();
          ctx.arc(0, 0, mc.r * scaleRef, Math.PI * 0.7, Math.PI * 1.85);
          ctx.stroke();
          ctx.restore();
        }

        ctx.restore();
      }
    }

    // =========================================================================
    // SECRET HELIX NEBULA ("THE EYE OF GOD") (Score 210 -> 250 & Nebula Victory)
    // Starts far above the Moon and descends smoothly into exact center, locking strictly in place
    // =========================================================================
    if (helixBlend > 0 && !isSingularity) {
      ctx.save();
      ctx.globalAlpha = isVictory && s.victoryMode === 'NEBULA' ? 1.0 : helixBlend;

      const nebCenterX = vp.centerX;
      const targetCenterY = vp.height * 0.45; // Exact Majestic Center Framing
      const progress250 = Math.min(1.0, Math.max(0, (count - 210) / 40));
      const startHighCosmicY = targetCenterY - 1200; // Far above the Moon in outer cosmos

      // Interpolates smoothly downward and clamps strictly at targetCenterY once centered (stops descending!)
      const calculatedY = startHighCosmicY + progress250 * (targetCenterY - startHighCosmicY);
      const nebCenterY = isVictory
        ? targetCenterY
        : Math.min(targetCenterY, calculatedY);

      const nebScale = isVictory ? 1.45 : 0.70 + progress250 * 0.75;
      const outerRx = 340 * nebScale;
      const outerRy = 230 * nebScale;
      const innerRx = 190 * nebScale;
      const innerRy = 125 * nebScale;

      // 1. Cosmic Background Stardust Fog & Outer Emission Corona
      const nebOuterGrad = ctx.createRadialGradient(
        nebCenterX,
        nebCenterY,
        innerRx * 0.5,
        nebCenterX,
        nebCenterY,
        outerRx * 1.5,
      );
      nebOuterGrad.addColorStop(0, 'rgba(168, 85, 247, 0.45)');
      nebOuterGrad.addColorStop(0.35, 'rgba(236, 72, 153, 0.35)');
      nebOuterGrad.addColorStop(0.65, 'rgba(6, 182, 212, 0.22)');
      nebOuterGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = nebOuterGrad;
      ctx.beginPath();
      ctx.ellipse(nebCenterX, nebCenterY, outerRx * 1.5, outerRy * 1.5, s.helixAngle * 0.2, 0, Math.PI * 2);
      ctx.fill();

      // 2. Outer Crimson / Magenta Filament Gas Torus
      ctx.save();
      ctx.translate(nebCenterX, nebCenterY);
      ctx.rotate(0.35 + s.helixAngle * 0.3);

      const crimsonGrad = ctx.createRadialGradient(0, 0, innerRx * 0.8, 0, 0, outerRx);
      crimsonGrad.addColorStop(0, 'rgba(244, 63, 94, 0)');
      crimsonGrad.addColorStop(0.4, 'rgba(244, 63, 94, 0.65)');
      crimsonGrad.addColorStop(0.7, 'rgba(225, 29, 72, 0.85)');
      crimsonGrad.addColorStop(0.9, 'rgba(147, 51, 234, 0.45)');
      crimsonGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = crimsonGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, outerRx, outerRy, 0, 0, Math.PI * 2);
      ctx.fill();

      // Radial Gaseous Filaments & Cometary Knots
      const filamentCount = 36;
      for (let f = 0; f < filamentCount; f++) {
        const fa = (f / filamentCount) * Math.PI * 2 + s.helixAngle * 0.5;
        const fr1 = innerRx + Math.sin(f * 4 + s.helixPulse) * 15;
        const fr2 = outerRx + Math.cos(f * 3 + s.helixPulse) * 20;

        ctx.strokeStyle = f % 2 === 0 ? 'rgba(244, 114, 182, 0.45)' : 'rgba(192, 132, 252, 0.35)';
        ctx.lineWidth = 2.5 * nebScale;
        ctx.beginPath();
        ctx.moveTo(Math.cos(fa) * fr1, Math.sin(fa) * (fr1 * (outerRy / outerRx)));
        ctx.lineTo(Math.cos(fa) * fr2, Math.sin(fa) * (fr2 * (outerRy / outerRx)));
        ctx.stroke();
      }
      ctx.restore();

      // 3. Inner Iridescent Turquoise / Cyan Gaseous Eye Ring
      ctx.save();
      ctx.translate(nebCenterX, nebCenterY);
      ctx.rotate(-0.25 - s.helixAngle * 0.4);

      const turquoiseGrad = ctx.createRadialGradient(0, 0, 20 * nebScale, 0, 0, innerRx);
      turquoiseGrad.addColorStop(0, 'rgba(6, 182, 212, 0)');
      turquoiseGrad.addColorStop(0.4, 'rgba(34, 211, 238, 0.75)');
      turquoiseGrad.addColorStop(0.75, 'rgba(56, 189, 248, 0.85)');
      turquoiseGrad.addColorStop(0.95, 'rgba(168, 85, 247, 0.3)');
      turquoiseGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = turquoiseGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, innerRx, innerRy, 0, 0, Math.PI * 2);
      ctx.fill();

      // Swirling Stardust Filaments inside turquoise ring
      for (let k = 0; k < 24; k++) {
        const ka = (k / 24) * Math.PI * 2 + s.helixAngle * 1.2;
        const kr = innerRx * (0.65 + 0.3 * Math.sin(k * 2 + s.helixPulse));
        ctx.fillStyle = k % 2 === 0 ? '#ffffff' : '#67e8f9';
        ctx.shadowColor = '#22d3ee';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(
          Math.cos(ka) * kr,
          Math.sin(ka) * (kr * (innerRy / innerRx)),
          1.8 * nebScale,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.restore();

      // 4. Radiant Central White Dwarf Star ("The Pupil")
      const starGlow = ctx.createRadialGradient(
        nebCenterX,
        nebCenterY,
        1,
        nebCenterX,
        nebCenterY,
        55 * nebScale,
      );
      starGlow.addColorStop(0, '#ffffff');
      starGlow.addColorStop(0.25, 'rgba(255, 255, 255, 0.95)');
      starGlow.addColorStop(0.5, 'rgba(103, 232, 249, 0.7)');
      starGlow.addColorStop(0.8, 'rgba(168, 85, 247, 0.3)');
      starGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = starGlow;
      ctx.beginPath();
      ctx.arc(nebCenterX, nebCenterY, 55 * nebScale, 0, Math.PI * 2);
      ctx.fill();

      // 8-Point Diffraction Spikes
      const spikeLen = (70 + Math.sin(s.helixPulse * 3) * 12) * nebScale;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 1.8 * nebScale;
      ctx.beginPath();
      ctx.moveTo(nebCenterX - spikeLen, nebCenterY);
      ctx.lineTo(nebCenterX + spikeLen, nebCenterY);
      ctx.moveTo(nebCenterX, nebCenterY - spikeLen);
      ctx.lineTo(nebCenterX, nebCenterY + spikeLen);
      ctx.moveTo(nebCenterX - spikeLen * 0.6, nebCenterY - spikeLen * 0.6);
      ctx.lineTo(nebCenterX + spikeLen * 0.6, nebCenterY + spikeLen * 0.6);
      ctx.moveTo(nebCenterX - spikeLen * 0.6, nebCenterY + spikeLen * 0.6);
      ctx.lineTo(nebCenterX + spikeLen * 0.6, nebCenterY - spikeLen * 0.6);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(nebCenterX, nebCenterY, 6 * nebScale, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.restore();
    }

    // =========================================================================
    // CINEMATIC SINGULARITY BLACK HOLE FINALE (MULTI-STAGE PROGRESSION)
    // Materializes when reaching Height 250 with perfect x250 combo!
    // Phase 1 (Gravitational Rupture) -> Phase 2 (Horizon Awakening) ->
    // Phase 3 (250-Container Spaghettification) -> Phase 4 (UI Ingestion) ->
    // Phase 5 (Total Collapse & Ethereal Silence)
    // =========================================================================
    if (isSingularity) {
      const bhX = vp.centerX;
      const bhY = vp.height * 0.45;
      const t = s.singularityTime;
      const finalBhRadius = 92;

      // Dynamic Radius growth across phases
      const currentBhRadius =
        t < 4.0
          ? Math.max(2, (t / 4.0) * 18)
          : t < 8.0
          ? 18 + ((t - 4.0) / 4.0) * (finalBhRadius - 18)
          : finalBhRadius + Math.sin(s.helixPulse) * 2.5;

      ctx.save();

      // --- HELIX NEBULA SUCKED INWARD LAYER BY LAYER ---
      const nebWarpage = Math.min(1.0, t / 14.0);
      const nebScale = (1.45 * (1 - nebWarpage * 0.85));
      const nebOuterRx = 340 * nebScale;
      const nebOuterRy = 230 * nebScale;
      const nebInnerRx = 190 * nebScale;
      const nebInnerRy = 125 * nebScale;

      if (nebScale > 0.05) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - t / 16.0);
        ctx.translate(bhX, bhY);
        ctx.rotate(s.singularityDiskAngle * 0.4);

        const nebOuterGrad = ctx.createRadialGradient(
          0, 0, nebInnerRx * 0.4,
          0, 0, nebOuterRx * 1.4
        );
        nebOuterGrad.addColorStop(0, 'rgba(168, 85, 247, 0.4)');
        nebOuterGrad.addColorStop(0.4, 'rgba(236, 72, 153, 0.3)');
        nebOuterGrad.addColorStop(0.7, 'rgba(6, 182, 212, 0.2)');
        nebOuterGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = nebOuterGrad;
        ctx.beginPath();
        ctx.ellipse(0, 0, nebOuterRx * 1.4, nebOuterRy * 1.4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Crimson & Turquoise swirling gaseous arms
        const crimsonGrad = ctx.createRadialGradient(0, 0, nebInnerRx * 0.8, 0, 0, nebOuterRx);
        crimsonGrad.addColorStop(0, 'rgba(244, 63, 94, 0)');
        crimsonGrad.addColorStop(0.5, 'rgba(244, 63, 94, 0.7)');
        crimsonGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = crimsonGrad;
        ctx.beginPath();
        ctx.ellipse(0, 0, nebOuterRx, nebOuterRy, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // --- PHASE 1: Spacetime Gravitational Rupture Rings & Lensing Lensing Rays ---
      const ruptureAlpha = t < 4.0 ? t / 4.0 : Math.max(0.2, 1 - (t - 4.0) / 10.0);
      const ringCount = 18;
      for (let r = 0; r < ringCount; r++) {
        const ringProgress = ((t * 0.4 + r / ringCount) % 1.0);
        const ringRadius = 20 + ringProgress * 420;
        const ringAlpha = Math.sin(ringProgress * Math.PI) * 0.35 * ruptureAlpha;

        ctx.strokeStyle = r % 2 === 0 ? `rgba(56, 189, 248, ${ringAlpha})` : `rgba(236, 72, 153, ${ringAlpha * 0.8})`;
        ctx.lineWidth = 1.8 + Math.sin(r + s.helixPulse) * 1.2;
        ctx.beginPath();
        ctx.ellipse(bhX, bhY, ringRadius, ringRadius * (0.6 + ringProgress * 0.3), s.singularityDiskAngle * 0.1, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Gravitational Spacetime Polar Lensing Grid
      ctx.strokeStyle = `rgba(56, 189, 248, ${0.18 * ruptureAlpha})`;
      ctx.lineWidth = 1.0;
      for (let r = 30; r < 520; r += 36) {
        ctx.beginPath();
        for (let a = 0; a <= Math.PI * 2; a += 0.1) {
          const warp = (currentBhRadius * 120) / (r * r + 80);
          const px = bhX + Math.cos(a + warp * (1 + s.singularityProgress * 2)) * (r - warp * 15);
          const py = bhY + Math.sin(a + warp * (1 + s.singularityProgress * 2)) * (r - warp * 15);
          if (a === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }

      // --- PHASE 2 & 3: Relativistic Accretion Disk with Doppler Beaming ---
      if (t >= 3.0) {
        const diskFade = t < 6.0 ? (t - 3.0) / 3.0 : 1.0;
        ctx.save();
        ctx.translate(bhX, bhY);
        ctx.rotate(s.singularityDiskAngle * 0.18);

        // Upper Lensed Secondary Arc
        const upperLensingGrad = ctx.createLinearGradient(-300, -180, 300, -180);
        upperLensingGrad.addColorStop(0, `rgba(56, 189, 248, ${0.95 * diskFade})`); // Approaching side (Blueshifted & Bright)
        upperLensingGrad.addColorStop(0.25, `rgba(254, 240, 138, ${0.9 * diskFade})`);
        upperLensingGrad.addColorStop(0.65, `rgba(249, 115, 22, ${0.65 * diskFade})`);
        upperLensingGrad.addColorStop(1, `rgba(239, 68, 68, ${0.25 * diskFade})`); // Receding side (Redshifted & Dimmer)

        ctx.strokeStyle = upperLensingGrad;
        ctx.lineWidth = (16 + Math.sin(s.singularityDiskAngle * 2) * 3) * (currentBhRadius / finalBhRadius);
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 26;
        ctx.beginPath();
        ctx.ellipse(0, -16 * (currentBhRadius / finalBhRadius), 250 * (currentBhRadius / finalBhRadius), 105 * (currentBhRadius / finalBhRadius), 0, Math.PI, 0);
        ctx.stroke();

        // Primary Relativistic Accretion Disk (Equatorial Plane)
        const diskGrad = ctx.createLinearGradient(-340, 0, 340, 0);
        diskGrad.addColorStop(0, `rgba(255, 255, 255, ${0.98 * diskFade})`);
        diskGrad.addColorStop(0.15, `rgba(56, 189, 248, ${0.95 * diskFade})`);
        diskGrad.addColorStop(0.42, `rgba(253, 224, 71, ${0.85 * diskFade})`);
        diskGrad.addColorStop(0.72, `rgba(249, 115, 22, ${0.65 * diskFade})`);
        diskGrad.addColorStop(1, `rgba(185, 28, 28, ${0.25 * diskFade})`);

        ctx.strokeStyle = diskGrad;
        ctx.lineWidth = (30 + Math.cos(s.singularityDiskAngle * 2) * 4) * (currentBhRadius / finalBhRadius);
        ctx.shadowColor = '#fde047';
        ctx.shadowBlur = 35;
        ctx.beginPath();
        ctx.ellipse(0, 0, 310 * (currentBhRadius / finalBhRadius), 56 * (currentBhRadius / finalBhRadius), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();
      }

      // --- Spaghettified Matter Ribbons Ingestion (Phase 3: 8s - 15s) ---
      if (t >= 7.5 && t < 18.0) {
        const ribbonProgress = Math.min(1.0, (t - 7.5) / 9.5);
        const ribbonCount = 18;
        const brandRibbonColors = ['#e6007e', '#f37021', '#00b0f0', '#ffea00', '#00ff66'];

        for (let rc = 0; rc < ribbonCount; rc++) {
          const rBaseA = (rc / ribbonCount) * Math.PI * 2 + s.singularityDiskAngle * (1.2 + rc * 0.05);
          const rDist = (480 * (1 - ribbonProgress * 0.7)) * (0.8 + 0.4 * Math.sin(rc * 1.5));
          const startX = bhX + Math.cos(rBaseA) * rDist;
          const startY = bhY + Math.sin(rBaseA) * (rDist * 0.48) + (1 - ribbonProgress) * 160;
          const midX = bhX + Math.cos(rBaseA + 1.1) * (rDist * 0.5);
          const midY = bhY + Math.sin(rBaseA + 1.1) * (rDist * 0.25);
          const endX = bhX + Math.cos(rBaseA + 2.2) * (currentBhRadius * 0.85);
          const endY = bhY + Math.sin(rBaseA + 2.2) * (currentBhRadius * 0.85);

          const col = brandRibbonColors[rc % brandRibbonColors.length];
          const ribbonGrad = ctx.createLinearGradient(startX, startY, endX, endY);
          ribbonGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
          ribbonGrad.addColorStop(0.35, col);
          ribbonGrad.addColorStop(0.75, '#ffffff');
          ribbonGrad.addColorStop(1, 'rgba(255, 255, 255, 0.95)');

          ctx.strokeStyle = ribbonGrad;
          ctx.lineWidth = Math.max(1, 6 - ribbonProgress * 4.5);
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.bezierCurveTo(midX, midY, midX + 20, midY - 15, endX, endY);
          ctx.stroke();
        }
      }

      // --- UI Shards & Shattered Digital Fragment Pixels (Phase 4: 15s - 19s) ---
      if (s.uiShards.length > 0 && t < 19.5) {
        for (const shard of s.uiShards) {
          if (shard.alpha > 0.02) {
            ctx.save();
            ctx.translate(shard.x, shard.y);
            ctx.rotate(shard.rot);
            ctx.fillStyle = shard.color;
            ctx.globalAlpha = shard.alpha;
            ctx.shadowColor = shard.color;
            ctx.shadowBlur = 6;
            ctx.fillRect(-shard.size / 2, -shard.size / 2, shard.size, shard.size);
            ctx.restore();
          }
        }
      }

      // --- Razor-Sharp Relativistic Photon Sphere Ring ---
      const photonGrad = ctx.createRadialGradient(
        bhX, bhY, Math.max(0, currentBhRadius - 3),
        bhX, bhY, currentBhRadius + 14
      );
      photonGrad.addColorStop(0, '#ffffff');
      photonGrad.addColorStop(0.35, '#38bdf8');
      photonGrad.addColorStop(0.75, '#f59e0b');
      photonGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = photonGrad;
      ctx.beginPath();
      ctx.arc(bhX, bhY, currentBhRadius + 14, 0, Math.PI * 2);
      ctx.fill();

      // --- Pure Pitch-Black Event Horizon Void Sphere ---
      ctx.fillStyle = '#000000';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 24;
      ctx.beginPath();
      ctx.arc(bhX, bhY, Math.max(1, currentBhRadius), 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // --- Relativistic High-Energy Bipolar Plasma Jets ---
      if (t >= 4.0) {
        const jetAlpha = t < 7.0 ? (t - 4.0) / 3.0 : (t >= 19.0 ? 0.35 : 0.75);
        const jetGrad = ctx.createLinearGradient(bhX, bhY - 480, bhX, bhY + 480);
        jetGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
        jetGrad.addColorStop(0.38, `rgba(56, 189, 248, ${0.6 * jetAlpha})`);
        jetGrad.addColorStop(0.5, `rgba(255, 255, 255, ${0.95 * jetAlpha})`);
        jetGrad.addColorStop(0.62, `rgba(56, 189, 248, ${0.6 * jetAlpha})`);
        jetGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = jetGrad;
        ctx.fillRect(bhX - 4, bhY - 460, 8, 920);
      }

      // --- Colossal Radiant Relativistic Flare (Phase 5: ~19.0s Burst) ---
      if (s.singularityFlare > 0.01) {
        const flareAlpha = s.singularityFlare;
        const flareRadius = 80 + (1 - flareAlpha) * 700;
        const flareGrad = ctx.createRadialGradient(bhX, bhY, 5, bhX, bhY, flareRadius);
        flareGrad.addColorStop(0, `rgba(255, 255, 255, ${flareAlpha})`);
        flareGrad.addColorStop(0.3, `rgba(56, 189, 248, ${flareAlpha * 0.8})`);
        flareGrad.addColorStop(0.7, `rgba(236, 72, 153, ${flareAlpha * 0.4})`);
        flareGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = flareGrad;
        ctx.fillRect(0, 0, vp.width, vp.height);
      }

      ctx.restore();
    }

    // 2. WORLD COORDINATE SPACE (Ocean, Ship, Stack & Animated Entities)
    ctx.save();
    ctx.translate(0, s.cameraY);

    const waterY = s.baseY + 60;
    const waterGrad = ctx.createLinearGradient(0, waterY, 0, waterY + 600);
    waterGrad.addColorStop(0, '#0284c7');
    waterGrad.addColorStop(0.3, '#0369a1');
    waterGrad.addColorStop(0.7, '#075985');
    waterGrad.addColorStop(1, '#0c4a6e');
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, waterY, vp.width, 700);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 2.5;
    for (let row = 0; row < 3; row++) {
      ctx.beginPath();
      const rowY = waterY + 12 + row * 22;
      for (let x = 0; x <= vp.width; x += 15) {
        const wave = Math.sin(x * 0.02 + s.wavePhase + row * 1.5) * 5;
        if (x === 0) ctx.moveTo(x, rowY + wave);
        else ctx.lineTo(x, rowY + wave);
      }
      ctx.stroke();
    }

    if (!isVictory && !isSingularity) {
      for (const boat of s.tugboats) {
        ctx.save();
        ctx.translate(boat.x, waterY + 22);
        if (boat.speed < 0) ctx.scale(-1, 1);

        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.moveTo(-35, 0);
        ctx.lineTo(35, 0);
        ctx.lineTo(25, 14);
        ctx.lineTo(-28, 14);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-35, -4, 70, 4);

        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(-14, -18, 28, 14);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(-10, -15, 6, 6);
        ctx.fillRect(-2, -15, 6, 6);
        ctx.fillRect(6, -15, 6, 6);

        ctx.fillStyle = '#eab308';
        ctx.fillRect(-12, -26, 8, 8);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-13, -28, 10, 2);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(35, 2);
        ctx.lineTo(48, 8);
        ctx.stroke();
        ctx.restore();
      }

      for (const buoy of s.buoys) {
        const by = buoy.baseY + Math.sin(buoy.bobPhase) * 6;
        ctx.save();
        ctx.translate(buoy.x, by);

        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.moveTo(-12, 10);
        ctx.lineTo(12, 10);
        ctx.lineTo(0, -14);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-6, -22, 12, 8);

        const lightCol = buoy.lightState ? '#22c55e' : '#ef4444';
        ctx.fillStyle = lightCol;
        ctx.shadowColor = lightCol;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(0, -25, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
      }

      for (const dol of s.dolphins) {
        if (dol.leapActive) {
          const dy = dol.baseY - Math.sin(dol.progress) * 45;
          const dx = dol.x + (dol.progress - Math.PI / 2) * dol.jumpRadius;
          const angle = (dol.progress - Math.PI / 2) * 0.8;
          ctx.save();
          ctx.translate(dx, dy);
          ctx.rotate(angle);

          ctx.fillStyle = '#0284c7';
          ctx.beginPath();
          ctx.ellipse(0, 0, 18, 6, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(-2, -6);
          ctx.lineTo(-6, -12);
          ctx.lineTo(3, -6);
          ctx.closePath();
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(-18, 0);
          ctx.lineTo(-24, -6);
          ctx.lineTo(-24, 6);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#e0f2fe';
          ctx.beginPath();
          ctx.ellipse(0, 2, 12, 3, 0, 0, Math.PI);
          ctx.fill();
          ctx.restore();
        }
      }
    }

    // Cargo Vessel Platform
    const shipW = getConfig('assetShipHullWidth') as number;
    const shipH = getConfig('assetShipHullHeight') as number;
    const shipX = s.shipX - shipW / 2;
    const shipDeckOffset = Math.round(shipH * (46 / 224));
    const shipY = s.baseY - shipDeckOffset;

    drawAsset(
      ctx,
      assets['ship_hull'],
      shipX,
      shipY,
      shipW,
      shipH,
      (fallbackCtx) => {
        fallbackCtx.fillStyle = '#1e293b';
        fallbackCtx.fillRect(shipX, s.baseY, shipW, shipH);
        fallbackCtx.fillStyle = '#eab308';
        fallbackCtx.fillRect(shipX, s.baseY, shipW, 8);
      },
    );

    // Deck Landing Target Line
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(vp.centerX - containerW / 2, s.baseY);
    ctx.lineTo(vp.centerX + containerW / 2, s.baseY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Stacked Containers & Rigid Sway / Singularity Suction
    const pivotX = vp.centerX;
    const pivotY = s.baseY;

    for (let i = 0; i < s.stack.length; i++) {
      const block = s.stack[i];
      const brand = BRANDS[block.brandIndex];

      ctx.save();
      if (isSingularity) {
        const sx = block.x + (block.singularityOffsetX || 0);
        const sy = block.y + (block.singularityOffsetY || 0);
        const sc = block.singularityScale ?? 1.0;
        const sa = block.singularityAngle ?? 0;
        const alpha = block.singularityAlpha ?? 1.0;

        if (alpha > 0.005) {
          ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
          ctx.translate(sx, sy + containerH / 2);
          ctx.rotate(sa);
          ctx.scale(sc, sc);
          drawVectorContainer(
            ctx,
            -containerW / 2,
            -containerH / 2,
            containerW,
            containerH,
            brand,
          );
        }
      } else {
        if (s.wobbleAngle !== 0) {
          const heightFactor = Math.min(2.0, (s.baseY - block.y) / 600);
          const currentTilt = Math.max(-0.05, Math.min(0.05, s.wobbleAngle * heightFactor));
          ctx.translate(pivotX, pivotY);
          ctx.rotate(currentTilt);
          ctx.translate(-pivotX, -pivotY);
        }

        drawVectorContainer(
          ctx,
          block.x - containerW / 2,
          block.y,
          containerW,
          containerH,
          brand,
        );
      }

      ctx.restore();
    }

    // Dynamic Electric Arcs on High Combos (Combo >= 3)
    if (s.combo >= 3 && s.stack.length >= 2 && !isVictory && !isSingularity) {
      ctx.save();
      const arcCount = Math.min(4, s.stack.length - 1);
      const arcColor =
        s.combo >= 200
          ? '#ffd700'
          : s.combo >= 150
          ? '#ff3366'
          : s.combo >= 100
          ? '#a855f7'
          : s.combo >= 8
          ? '#ec4899'
          : s.combo >= 5
          ? '#f59e0b'
          : '#38bdf8';

      ctx.strokeStyle = arcColor;
      ctx.shadowColor = arcColor;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 2.5;

      for (let k = 0; k < arcCount; k++) {
        const topIdx = s.stack.length - 1 - k;
        const botIdx = topIdx - 1;
        const bTop = s.stack[topIdx];
        const bBot = s.stack[botIdx];

        ctx.beginPath();
        const startX = bTop.x - containerW / 2 + 15;
        const startY = bTop.y + containerH;
        const endX = bBot.x - containerW / 2 + 15;
        const endY = bBot.y;

        ctx.moveTo(startX, startY);
        const midY = (startY + endY) / 2;
        const jitter = (Math.random() - 0.5) * 14;
        ctx.lineTo(startX + jitter, midY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        const rStartX = bTop.x + containerW / 2 - 15;
        const rEndX = bBot.x + containerW / 2 - 15;
        ctx.beginPath();
        ctx.moveTo(rStartX, startY);
        ctx.lineTo(rStartX - jitter, midY);
        ctx.lineTo(rEndX, endY);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Missed Freefalling Containers
    for (const mb of s.missedBlocks) {
      const brand = BRANDS[mb.brandIndex];
      ctx.save();
      ctx.translate(mb.x, mb.y + containerH / 2);
      ctx.rotate(mb.rotation);
      drawVectorContainer(
        ctx,
        -containerW / 2,
        -containerH / 2,
        containerW,
        containerH,
        brand,
      );
      ctx.restore();
    }

    // Dropping Container in Freefall
    if (s.dropping && !isVictory && !isSingularity) {
      const drop = s.dropping;
      const brand = BRANDS[drop.brandIndex];
      ctx.save();
      ctx.translate(drop.x, drop.y + containerH / 2);
      ctx.rotate(drop.rotation);
      drawVectorContainer(
        ctx,
        -containerW / 2,
        -containerH / 2,
        containerW,
        containerH,
        brand,
      );
      ctx.restore();
    }

    // 3. OVERHEAD GANTRY CRANE, TROLLEY & SPREADER (Hidden during victory / sheared in singularity)
    if (!isVictory && (!isSingularity || s.singularityTime < 14.0)) {
      const craneCenterY = 200 - s.cameraY;
      const topGantryY = -s.cameraY + 36;
      const amplitudeX = 220;
      const amplitudeY = 95;

      ctx.save();
      if (isSingularity && s.craneShearProgress > 0) {
        const shear = s.craneShearProgress;
        ctx.translate(vp.centerX, 100);
        ctx.rotate(shear * 0.45);
        ctx.translate(-vp.centerX, -100);
        ctx.globalAlpha = Math.max(0, 1 - shear * 1.2);
      }

      // Guide Wire
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.ellipse(vp.centerX, craneCenterY, amplitudeX, amplitudeY, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Top Gantry Track
      ctx.save();
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, topGantryY - 22, vp.width, 26);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(0, topGantryY - 22, vp.width, 26);

      ctx.fillStyle = '#eab308';
      for (let bx = 10; bx < vp.width - 10; bx += 38) {
        ctx.beginPath();
        ctx.moveTo(bx, topGantryY + 4);
        ctx.lineTo(bx + 16, topGantryY - 22);
        ctx.lineTo(bx + 26, topGantryY - 22);
        ctx.lineTo(bx + 10, topGantryY + 4);
        ctx.fill();
      }

      // Motorized Pulley Trolley
      const trolleyX = s.trolleyX;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(trolleyX - 65, topGantryY - 14, 130, 28);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.strokeRect(trolleyX - 65, topGantryY - 14, 130, 28);

      const pulleyLeftX = trolleyX - 42;
      const pulleyRightX = trolleyX + 42;
      const pulleyY = topGantryY + 14;

      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.arc(pulleyLeftX, pulleyY, 8, 0, Math.PI * 2);
      ctx.arc(pulleyRightX, pulleyY, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(pulleyLeftX, pulleyY, 3.5, 0, Math.PI * 2);
      ctx.arc(pulleyRightX, pulleyY, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const spreaderY = s.hookY + 40;
      const spreaderW = containerW;
      const spreaderH = 22;
      const spreaderLeftCornerX = s.hookX - spreaderW / 2;
      const spreaderRightCornerX = s.hookX + spreaderW / 2;

      // Cables
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(pulleyLeftX + 2, pulleyY + 2);
      ctx.lineTo(spreaderLeftCornerX + 20 + 2, spreaderY - spreaderH + 2);
      ctx.moveTo(pulleyLeftX + 2, pulleyY + 2);
      ctx.lineTo(spreaderLeftCornerX + 50 + 2, spreaderY - spreaderH + 2);
      ctx.moveTo(pulleyRightX + 2, pulleyY + 2);
      ctx.lineTo(spreaderRightCornerX - 50 + 2, spreaderY - spreaderH + 2);
      ctx.moveTo(pulleyRightX + 2, pulleyY + 2);
      ctx.lineTo(spreaderRightCornerX - 20 + 2, spreaderY - spreaderH + 2);
      ctx.stroke();

      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(pulleyLeftX, pulleyY);
      ctx.lineTo(spreaderLeftCornerX + 20, spreaderY - spreaderH);
      ctx.moveTo(pulleyLeftX, pulleyY);
      ctx.lineTo(spreaderLeftCornerX + 50, spreaderY - spreaderH);
      ctx.moveTo(pulleyRightX, pulleyY);
      ctx.lineTo(spreaderRightCornerX - 50, spreaderY - spreaderH);
      ctx.moveTo(pulleyRightX, pulleyY);
      ctx.lineTo(spreaderRightCornerX - 20, spreaderY - spreaderH);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.arc(spreaderLeftCornerX + 20, spreaderY - spreaderH, 4, 0, Math.PI * 2);
      ctx.arc(spreaderLeftCornerX + 50, spreaderY - spreaderH, 4, 0, Math.PI * 2);
      ctx.arc(spreaderRightCornerX - 50, spreaderY - spreaderH, 4, 0, Math.PI * 2);
      ctx.arc(spreaderRightCornerX - 20, spreaderY - spreaderH, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Spreader Frame
      ctx.save();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(spreaderLeftCornerX, spreaderY - spreaderH, spreaderW, spreaderH);
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(spreaderLeftCornerX, spreaderY - spreaderH, spreaderW, spreaderH);

      ctx.fillStyle = '#eab308';
      for (let sx = spreaderLeftCornerX + 10; sx < spreaderRightCornerX - 10; sx += 24) {
        ctx.beginPath();
        ctx.moveTo(sx, spreaderY);
        ctx.lineTo(sx + 10, spreaderY - spreaderH);
        ctx.lineTo(sx + 16, spreaderY - spreaderH);
        ctx.lineTo(sx + 6, spreaderY);
        ctx.fill();
      }

      const clampWidth = 20;
      const clampHeight = 10;
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(spreaderLeftCornerX, spreaderY, clampWidth, clampHeight);
      ctx.fillRect(spreaderRightCornerX - clampWidth, spreaderY, clampWidth, clampHeight);

      ctx.fillStyle = '#cbd5e1';
      if (s.isHolding) {
        ctx.fillRect(spreaderLeftCornerX + 6, spreaderY + clampHeight, 8, 6);
        ctx.fillRect(spreaderRightCornerX - 14, spreaderY + clampHeight, 8, 6);
      }
      ctx.restore();

      // Laser Guide Beam
      if (s.isHolding) {
        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(s.hookX, s.hookY + 40 + containerH);
        ctx.lineTo(s.hookX, s.baseY + 40);
        ctx.stroke();
        ctx.restore();
      }

      // Container attached to spreader
      if (s.isHolding) {
        const brand = BRANDS[s.currentBrand];
        drawVectorContainer(
          ctx,
          s.hookX - containerW / 2,
          s.hookY + 40,
          containerW,
          containerH,
          brand,
        );
      }

      ctx.restore();
    }

    // Shockwaves
    for (const sw of s.shockwaves) {
      ctx.save();
      ctx.strokeStyle = sw.color;
      ctx.globalAlpha = Math.max(0, sw.alpha);
      ctx.lineWidth = sw.width;
      ctx.beginPath();
      ctx.ellipse(sw.x, sw.y, sw.radius, sw.radius * 0.35, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Particles
    for (const p of s.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      if (p.shape === 'confetti') {
        ctx.fillRect(p.x, p.y, p.size * 1.6, p.size * 0.8);
      } else if (p.shape === 'star') {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Wind Particles
    for (const wp of s.windParticles) {
      ctx.save();
      ctx.beginPath();
      const tailX = wp.vx > 0 ? wp.x - wp.len : wp.x + wp.len;
      const wGrad = ctx.createLinearGradient(tailX, wp.y, wp.x, wp.y);
      wGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      wGrad.addColorStop(0.5, `rgba(255, 255, 255, ${wp.alpha * 0.8})`);
      wGrad.addColorStop(1, `rgba(255, 255, 255, ${wp.alpha})`);
      ctx.strokeStyle = wGrad;
      ctx.lineWidth = wp.thickness;
      ctx.moveTo(tailX, wp.y);
      ctx.lineTo(wp.x, wp.y);
      ctx.stroke();
      ctx.restore();
    }

    // Floating Toasts
    for (const ft of s.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.alpha);
      const baseFontSize = ft.isPerfect ? (ft.text.includes('x') ? 40 : 34) : 26;
      const fontSize = Math.min(46, Math.round(baseFontSize * (ft.scale || 1.0)));
      ctx.font = `900 ${fontSize}px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const maxTextWidth = vp.width - 100;
      const renderX = Math.max(140, Math.min(vp.width - 140, ft.x));

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = Math.max(3, 5 * (ft.scale || 1.0) * 0.7);
      ctx.lineJoin = 'round';
      ctx.strokeText(ft.text, renderX, ft.y, maxTextWidth);

      ctx.shadowColor = ft.color;
      ctx.shadowBlur = ft.isPerfect ? 20 : 8;
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, renderX, ft.y, maxTextWidth);

      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = Math.max(0, ft.alpha * 0.95);
      ctx.fillText(ft.text, renderX, ft.y, maxTextWidth);

      ctx.shadowBlur = 0;
      ctx.restore();
    }

    ctx.restore(); // Restore World Transform

    // 4. FULL SCREEN CHROMATIC FLASH & PROGRESSIVE COMBO AURA
    if (s.milestoneFlash && s.milestoneFlash.alpha > 0 && !isVictory && !isSingularity) {
      ctx.save();
      const mf = s.milestoneFlash;
      ctx.fillStyle = mf.color;
      ctx.globalAlpha = mf.alpha * 0.45;
      ctx.fillRect(0, 0, vp.width, vp.height);

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 14 * mf.alpha;
      ctx.globalAlpha = mf.alpha;
      ctx.beginPath();
      ctx.arc(vp.centerX, vp.height / 2, (1 - mf.alpha) * 650 + 50, 0, Math.PI * 2);
      ctx.stroke();

      ctx.font = '900 32px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = mf.color;
      ctx.shadowBlur = 24;
      ctx.fillText(mf.text, vp.centerX, vp.height / 2 - 90, vp.width - 60);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    if (s.combo >= 2 && !isVictory && !isSingularity) {
      const tier = getComboTier(s.combo);
      const tierColor = tier ? tier.color : '#00ff66';
      const tierWidth = tier ? 4 + tier.tier * 2.5 : 6;
      const pulse = 0.5 + 0.5 * Math.sin(s.wavePhase * 3.5);

      ctx.save();
      ctx.strokeStyle = tierColor;
      ctx.globalAlpha = 0.45 + pulse * 0.4;
      ctx.lineWidth = tierWidth;
      ctx.shadowColor = tierColor;
      ctx.shadowBlur = 14 + (tier ? tier.tier * 4 : 0);
      ctx.strokeRect(tierWidth / 2, tierWidth / 2, vp.width - tierWidth, vp.height - tierWidth);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    ctx.restore(); // Restore Screen Shake & Heartbeat Zoom
  };

  // --- Game Loop Execution ---
  const updateRef = useRef(update);
  const drawRef = useRef(draw);
  updateRef.current = update;
  drawRef.current = draw;

  useEffect(() => {
    let raf = 0;
    const loop = (time: number) => {
      if (inputRef.current) {
        const cancelPressed = inputRef.current.actions.cancel;
        if (cancelPressed && !lastCancelRef.current) {
          const currentStatus = gameStateRef.current.status;
          if (currentStatus === 'PLAYING') {
            setIsGameMenuOpen((prev) => !prev);
          } else if (currentStatus === 'START') {
            void exitChat({});
          }
        }
        lastCancelRef.current = cancelPressed;
      }

      stepperRef.current?.(time, (dt) => updateRef.current(dt));

      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) drawRef.current(ctx);

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const isMusicPlaying =
    !['START', 'GAME_OVER', 'VICTORY', 'SINGULARITY'].includes(gameState.status) &&
    !isMusicMuted;

  const currentComboTier = getComboTier(gameState.combo);
  const comboTierColor = currentComboTier ? currentComboTier.color : '#00ff66';

  const isSingularityMode = gameState.status === 'SINGULARITY';
  // Progressively suck all HUD elements into the center between 12s and 18s
  const hudSuctionProgress = isSingularityMode
    ? Math.min(1.0, Math.max(0, (singularityAnimTime - 12.0) / 5.5))
    : 0;

  const topBarTransform =
    hudSuctionProgress > 0
      ? `translateY(${hudSuctionProgress * 42}vh) scale(${Math.max(0.001, 1 - hudSuctionProgress)}) rotate(${hudSuctionProgress * 540}deg)`
      : 'none';
  const hudOpacity = hudSuctionProgress > 0 ? Math.max(0, 1 - hudSuctionProgress * 1.15) : 1;
  const hudFilter = hudSuctionProgress > 0 ? `blur(${hudSuctionProgress * 12}px)` : 'none';

  const scoreTransform =
    hudSuctionProgress > 0
      ? `translate(${hudSuctionProgress * 36}vw, -${hudSuctionProgress * 45}vh) scale(${Math.max(0.001, 1 - hudSuctionProgress)}) rotate(-${hudSuctionProgress * 620}deg)`
      : 'none';

  const stabilityTransform =
    hudSuctionProgress > 0
      ? `translateY(-${hudSuctionProgress * 45}vh) scale(${Math.max(0.001, 1 - hudSuctionProgress)}) rotate(${hudSuctionProgress * 480}deg)`
      : 'none';

  const comboTransform =
    hudSuctionProgress > 0
      ? `translate(-${hudSuctionProgress * 36}vw, -${hudSuctionProgress * 45}vh) scale(${Math.max(0.001, 1 - hudSuctionProgress)}) rotate(${hudSuctionProgress * 720}deg)`
      : 'none';

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden touch-none select-none bg-black text-white font-sans">
      {!assetsReady && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0f18] text-white font-sans">
          <div className="text-xl font-black tracking-widest text-sky-400 animate-pulse">
            LOADING PORT GANTRY ASSETS...
          </div>
        </div>
      )}

      <BackgroundMusic
        isPlaying={isMusicPlaying}
        isMuted={isMusicMuted}
        altitude={sim.current.stack.length || gameState.score}
        combo={gameState.combo}
      />

      {/* DYNAMIC FULL-SCREEN MULTI-ASPECT RATIO CANVAS */}
      <canvas
        ref={canvasRef}
        width={viewport.width}
        height={viewport.height}
        className="w-full h-full block cursor-pointer absolute inset-0 object-cover"
      />

      {/* ========================================================================= */}
      {/* 1. TOP INDUSTRIAL PORT / CONTAINER METAL HEADER BAR */}
      {/* ========================================================================= */}
      {gameState.status !== 'VICTORY' && (!isSingularityMode || hudOpacity > 0.01) && (
        <div
          style={{
            transform: topBarTransform,
            opacity: hudOpacity,
            filter: hudFilter,
            transition: 'transform 0.08s linear, opacity 0.08s linear, filter 0.08s linear',
          }}
          className="absolute top-2.5 sm:top-3 left-3 right-3 z-30 pointer-events-auto max-w-2xl mx-auto origin-center">
          <div className="relative w-full rounded-xl bg-gradient-to-b from-slate-800 via-slate-900 to-zinc-950 border-2 border-slate-600/90 shadow-2xl p-1.5 overflow-hidden">
            <div className="absolute top-1 left-1 w-2 h-2 rounded-full bg-slate-400 border border-slate-700 shadow-inner" />
            <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-slate-400 border border-slate-700 shadow-inner" />
            <div className="absolute bottom-1 left-1 w-2 h-2 rounded-full bg-slate-400 border border-slate-700 shadow-inner" />
            <div className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-slate-400 border border-slate-700 shadow-inner" />

            <div
              className="absolute bottom-0 left-0 right-0 h-1.5 opacity-90"
              style={{
                backgroundImage: sim.current.isHelixUnlocked
                  ? 'repeating-linear-gradient(45deg, #ec4899 0, #ec4899 8px, #06b6d4 8px, #06b6d4 16px)'
                  : 'repeating-linear-gradient(45deg, #eab308 0, #eab308 8px, #0f172a 8px, #0f172a 16px)',
              }}
            />

            <div className="flex items-center justify-between gap-2 px-2 py-1">
              {/* Left Group: Port Height Counter & Secret Admin Area */}
              <div className="flex items-center gap-2">
                <div className="relative flex items-center">
                  <div className="bg-slate-950/90 border border-slate-700/80 rounded-lg px-2.5 py-1 flex flex-col justify-center shadow-inner">
                    <span className="text-[9px] font-sans font-black uppercase tracking-widest text-slate-400 leading-none">
                      HEIGHT
                    </span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className={`text-xl font-black font-sans leading-none ${sim.current.isHelixUnlocked ? 'text-pink-400 drop-shadow-[0_0_8px_rgba(236,72,153,0.6)]' : 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]'}`}>
                        {sim.current.stack.length.toString().padStart(3, '0')}
                      </span>
                      <span className="text-[10px] font-sans font-bold text-slate-500">
                        /{sim.current.targetWinCount}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSecretTap}
                    onTouchStart={handleSecretTap}
                    className="w-5 h-8 ml-0.5 opacity-0 cursor-default select-none focus:outline-none"
                    aria-label="Secret Button"
                  />
                </div>

                {adminMode && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAdminMode(false);
                      gameAudio.playCrispClick();
                      spawnToast('ADMIN MODE: OFF', viewportRef.current.centerX, 280, '#94a3b8', false, 1.2);
                    }}
                    title="Click to Disable Admin Mode"
                    className="flex items-center gap-1.5 bg-gradient-to-r from-cyan-950/90 via-slate-900/90 to-amber-950/90 border border-cyan-400/80 rounded-lg px-2.5 py-1 shadow-[0_0_12px_rgba(56,189,248,0.5)] transition-all hover:border-amber-400 active:scale-95 animate-pulse">
                    <Sparkles size={13} className="text-amber-400 animate-spin" style={{animationDuration: '4s'}} />
                    <div className="flex flex-col text-left">
                      <span className="text-[7px] font-sans font-black uppercase tracking-wider text-amber-400 leading-none">
                        GOD MODE
                      </span>
                      <span className="text-[10px] font-sans font-black text-cyan-300 leading-none tracking-tight">
                        ADMIN: ON
                      </span>
                    </div>
                  </button>
                )}

                {sim.current.isHelixUnlocked && !adminMode && (
                  <div className="flex items-center gap-1 bg-pink-950/80 border border-pink-500/80 rounded-lg px-2 py-1 shadow-[0_0_10px_rgba(236,72,153,0.4)] animate-pulse">
                    <Atom size={13} className="text-cyan-300 animate-spin" style={{animationDuration: '8s'}} />
                    <span className="text-[9px] font-sans font-black uppercase tracking-widest text-pink-300">
                      {gameState.status === 'SINGULARITY' ? 'SINGULARITY' : 'HELIX NEBULA'}
                    </span>
                  </div>
                )}

                <div className="hidden xs:flex items-center gap-1.5 bg-slate-950/80 border border-slate-700/70 rounded-lg px-2 py-1 shadow-inner">
                  <Trophy size={13} className="text-yellow-400" />
                  <div className="flex flex-col">
                    <span className="text-[8px] font-sans uppercase font-bold text-slate-400 leading-none">
                      BEST
                    </span>
                    <span className="text-xs font-sans font-black text-yellow-400 leading-none">
                      {highScore}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Group: Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    gameAudio.playCrispClick();
                    initGame();
                  }}
                  title="Retry Session"
                  className="h-9 px-3 rounded-lg bg-gradient-to-b from-slate-700 to-slate-900 hover:from-slate-600 hover:to-slate-800 border border-slate-600 active:border-amber-400 flex items-center gap-1.5 text-xs font-sans font-black text-slate-200 hover:text-amber-300 transition-transform active:scale-95 shadow-md shadow-black/40">
                  <RotateCw size={15} />
                  <span>RETRY</span>
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    gameAudio.playCrispClick();
                    setIsGameMenuOpen(true);
                  }}
                  title="Port Command Menu"
                  className="h-9 px-3.5 rounded-lg bg-gradient-to-b from-sky-600 via-sky-700 to-blue-900 hover:from-sky-500 hover:to-blue-800 border-2 border-sky-400 flex items-center gap-1.5 text-xs font-sans font-black text-white transition-transform active:scale-95 shadow-lg shadow-sky-900/60">
                  <MenuIcon size={16} />
                  <span>MENU</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. BOTTOM RESPONSIVE HUD CONTAINER (DYNAMIC EVENT HORIZON SUCTION) */}
      {/* ========================================================================= */}
      {(gameState.status === 'PLAYING' || (isSingularityMode && hudOpacity > 0.01)) && (
        <div className="absolute bottom-4 sm:bottom-5 left-3 right-3 z-20 pointer-events-none max-w-3xl mx-auto flex items-end justify-between gap-2">
          {/* Bottom-Left: Score Display */}
          <div
            style={{
              transform: scoreTransform,
              opacity: hudOpacity,
              filter: hudFilter,
              transition: 'transform 0.08s linear, opacity 0.08s linear, filter 0.08s linear',
            }}
            className="relative bg-gradient-to-b from-slate-800/95 via-slate-900/95 to-zinc-950/95 border-2 border-sky-500/50 rounded-xl px-3.5 py-2 backdrop-blur-md shadow-2xl shadow-sky-950/60 overflow-hidden origin-bottom-left">
            <div className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-slate-400 border border-slate-600" />
            <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-slate-400 border border-slate-600" />

            <div className="flex items-center gap-1 text-[10px] font-sans font-black uppercase text-sky-400 tracking-wider mb-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping mr-0.5" />
              SCORE
            </div>
            <div className="font-sans text-xl xs:text-2xl font-black text-white drop-shadow-[0_0_10px_rgba(56,189,248,0.7)] leading-none tracking-tight">
              {gameState.score.toLocaleString()}
            </div>
          </div>

          {/* Bottom-Center: Hydraulic Pressure Stability Gauge */}
          <div
            style={{
              transform: stabilityTransform,
              opacity: hudOpacity,
              filter: hudFilter,
              transition: 'transform 0.08s linear, opacity 0.08s linear, filter 0.08s linear',
            }}
            className="w-[170px] xs:w-[210px] sm:w-[240px] origin-bottom-center">
            <div className="relative bg-gradient-to-b from-slate-800/95 via-slate-900/95 to-zinc-950/95 border-2 border-slate-600 rounded-xl px-3 py-2 backdrop-blur-md shadow-2xl shadow-black/80 overflow-hidden">
              <div className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-slate-400 border border-slate-600" />
              <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-slate-400 border border-slate-600" />

              <div className="w-full flex items-center justify-between text-[9px] font-sans font-black uppercase tracking-wider mb-1">
                <span className="text-slate-300 flex items-center gap-1">
                  <Shield size={11} className="text-sky-400" /> STABILITY PSI
                </span>
                <span
                  className={
                    gameState.stability > 60
                      ? 'text-emerald-400 font-sans font-black'
                      : gameState.stability > 30
                      ? 'text-amber-400 font-sans font-black'
                      : 'text-red-500 font-sans font-black animate-pulse'
                  }>
                  {gameState.stability}%
                </span>
              </div>

              <div className="relative w-full h-3 bg-slate-950 rounded-full border border-slate-700/90 overflow-hidden p-0.5 shadow-inner">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    gameState.stability > 60
                      ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.5)]'
                      : gameState.stability > 30
                      ? 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                      : 'bg-gradient-to-r from-red-600 via-rose-500 to-red-400 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.7)]'
                  }`}
                  style={{width: `${gameState.stability}%`}}
                />
                <div className="absolute inset-0 flex justify-between px-2 pointer-events-none opacity-40">
                  <div className="w-0.5 h-full bg-black/60" />
                  <div className="w-0.5 h-full bg-black/60" />
                  <div className="w-0.5 h-full bg-black/60" />
                  <div className="w-0.5 h-full bg-black/60" />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom-Right: Active Combo Streak Display */}
          <div
            style={{
              borderColor: gameState.combo > 1 ? comboTierColor : '#475569',
              boxShadow:
                gameState.combo > 1
                  ? `0 0 16px ${comboTierColor}40, 0 10px 25px rgba(0,0,0,0.8)`
                  : '0 10px 25px rgba(0,0,0,0.8)',
              transform: comboTransform,
              opacity: hudOpacity,
              filter: hudFilter,
              transition: 'transform 0.08s linear, opacity 0.08s linear, filter 0.08s linear',
            }}
            className="relative bg-gradient-to-b from-slate-800/95 via-slate-900/95 to-zinc-950/95 border-2 rounded-xl px-3.5 py-2 backdrop-blur-md shadow-2xl transition-all duration-200 overflow-hidden text-right origin-bottom-right">
            <div className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-slate-400 border border-slate-600" />
            <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-slate-400 border border-slate-600" />

            <div
              style={{color: gameState.combo > 1 ? comboTierColor : '#94a3b8'}}
              className="flex items-center justify-end gap-1 text-[10px] font-sans font-black uppercase tracking-wider mb-0.5">
              <Zap size={10} className="fill-current" />
              {currentComboTier ? `TIER ${currentComboTier.tier}` : 'COMBO'}
            </div>
            <div
              style={{
                color: gameState.combo > 1 ? comboTierColor : '#64748b',
                textShadow:
                  gameState.combo > 1 ? `0 0 12px ${comboTierColor}` : 'none',
              }}
              className="font-sans text-xl xs:text-2xl font-black leading-none tracking-tight">
              x{gameState.combo.toString().padStart(2, '0')}
            </div>
          </div>
        </div>
      )}

      {/* Mobile / Keyboard Tap Hint */}
      {gameState.status === 'PLAYING' && sim.current.stack.length === 0 && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 pointer-events-none text-center bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-full border border-sky-500/40 text-xs font-sans font-black text-sky-300 animate-pulse shadow-lg whitespace-nowrap z-20">
          {isMobile ? 'TAP ANYWHERE TO RELEASE CONTAINER' : 'PRESS SPACEBAR OR CLICK TO DROP'}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. ULTIMATE SECRET FINALE: SINGULARITY BLACK HOLE SCREEN (PHASE 5: 18.0s+) */}
      {/* ========================================================================= */}
      {gameState.status === 'SINGULARITY' && showSingularityScreen && (
        <div className="absolute inset-0 z-50 flex flex-col justify-between p-4 sm:p-6 bg-black/40 backdrop-blur-[2px] animate-fadeIn transition-opacity duration-1000">
          {/* Top Minimalist Title */}
          <div className="flex flex-col items-center text-center mt-3 sm:mt-6 max-w-lg mx-auto pointer-events-none">
            <div className="flex items-center gap-2 px-3.5 py-1 rounded-full bg-gradient-to-r from-cyan-500/20 via-pink-500/30 to-amber-500/20 border border-cyan-400/60 text-cyan-200 text-[10px] sm:text-xs font-sans font-black tracking-[0.3em] uppercase shadow-[0_0_20px_rgba(56,189,248,0.5)] mb-2 animate-pulse">
              <Sparkles size={14} className="text-cyan-300 animate-spin" style={{animationDuration: '4s'}} />
              INFINITE COSMIC DENSITY
              <Sparkles size={14} className="text-cyan-300 animate-spin" style={{animationDuration: '4s'}} />
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-[0.25em] uppercase bg-gradient-to-r from-white via-cyan-200 to-amber-300 bg-clip-text text-transparent drop-shadow-[0_4px_24px_rgba(0,0,0,1)] leading-tight">
              SINGULARITY
            </h1>

            <p className="text-xs sm:text-sm font-bold italic tracking-wide text-slate-300 drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)] mt-1.5 max-w-md">
              "All matter, space, and time have merged into infinite density."
            </p>
          </div>

          {/* Central space open for the Calm, Majestic Rotating Black Hole */}
          <div className="flex-1 pointer-events-none" />

          {/* Bottom Minimalist Glass Stats Strip & Actions */}
          <div className="flex flex-col items-center max-w-md mx-auto w-full gap-3 mb-2 sm:mb-4">
            <div className="w-full bg-slate-950/85 border border-cyan-400/50 rounded-2xl p-3.5 backdrop-blur-md shadow-[0_0_30px_rgba(0,0,0,0.9)] flex items-center justify-around text-center">
              <div className="flex flex-col items-center">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                  CONTAINERS
                </span>
                <span className="text-xl font-black text-cyan-300 leading-tight">
                  250 / 250
                </span>
              </div>

              <div className="w-[1px] h-8 bg-slate-800" />

              <div className="flex flex-col items-center">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                  FINAL SCORE
                </span>
                <span className="text-xl font-black text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)] leading-tight">
                  {gameState.score.toLocaleString()}
                </span>
              </div>

              <div className="w-[1px] h-8 bg-slate-800" />

              <div className="flex flex-col items-center">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                  PERFECT STREAK
                </span>
                <span className="text-xl font-black text-pink-400 leading-tight">
                  x{sim.current.combo || 250}
                </span>
              </div>

              <div className="w-[1px] h-8 bg-slate-800" />

              <div className="flex flex-col items-center">
                <span className="text-[9px] font-black uppercase tracking-wider text-amber-400">
                  RANK
                </span>
                <span className="text-xs sm:text-sm font-black text-amber-300 leading-tight tracking-wider uppercase drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]">
                  PORT GOD
                </span>
              </div>
            </div>

            <div className="w-full flex items-center gap-2">
              <button
                onClick={initGame}
                autoFocus
                className="flex-1 min-h-[50px] bg-gradient-to-r from-cyan-500 via-sky-400 to-pink-500 hover:from-cyan-400 hover:to-pink-400 text-slate-950 font-black text-sm sm:text-base rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(56,189,248,0.7)] active:scale-95 border border-cyan-200 cursor-pointer">
                <RotateCw size={18} className="text-slate-950" />
                <span>PLAY AGAIN</span>
              </button>

              <button
                onClick={() => setIsGameMenuOpen(true)}
                className="h-[50px] px-4 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 rounded-xl text-slate-200 text-xs font-black transition-all active:scale-95 flex items-center gap-1.5 shadow-md cursor-pointer">
                <MenuIcon size={16} />
                <span>MENU</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. CINEMATIC MOON / NEBULA VICTORY FINALE OVERLAY */}
      {/* ========================================================================= */}
      {gameState.status === 'VICTORY' && (
        <div className="absolute inset-0 z-40 pointer-events-auto flex flex-col justify-between p-4 sm:p-6 bg-black/25 backdrop-blur-[2px] animate-fadeIn">
          {/* Top Title Bar */}
          <div className="flex flex-col items-center text-center mt-2 sm:mt-4 max-w-lg mx-auto pointer-events-none">
            <div className={`flex items-center gap-2 px-3.5 py-1 rounded-full border text-[10px] sm:text-xs font-sans font-black tracking-widest uppercase mb-2 animate-pulse ${
              sim.current.victoryMode === 'NEBULA'
                ? 'bg-gradient-to-r from-pink-500/20 via-cyan-400/30 to-pink-500/20 border-cyan-400/50 text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.3)]'
                : 'bg-gradient-to-r from-amber-500/20 via-yellow-400/30 to-amber-500/20 border-yellow-400/50 text-yellow-300 shadow-[0_0_15px_rgba(250,204,21,0.3)]'
            }`}>
              <Sparkles size={14} className="animate-spin" style={{animationDuration: '6s'}} />
              {sim.current.victoryMode === 'NEBULA' ? 'THE EYE OF GOD CONQUERED' : 'ORBITAL FREIGHT REACHED ZENITH'}
              <Sparkles size={14} className="animate-spin" style={{animationDuration: '6s'}} />
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-wider uppercase bg-gradient-to-b from-white via-slate-100 to-amber-200 bg-clip-text text-transparent drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)] leading-tight">
              {sim.current.victoryMode === 'NEBULA' ? 'HELIX NEBULA REACHED' : 'LUNAR HARBOR REACHED'}
            </h1>

            <p className="text-xs sm:text-sm font-black uppercase tracking-[0.25em] text-cyan-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] mt-1">
              {sim.current.victoryMode === 'NEBULA' ? 'COSMIC MASTER OF TIME & SPACE' : 'PORT MASTER RANK ACHIEVED'}
            </p>
          </div>

          {/* Central space intentionally open */}
          <div className="flex-1 pointer-events-none" />

          {/* Bottom Glassmorphic Stats Strip */}
          <div className="flex flex-col items-center max-w-md mx-auto w-full gap-3 mb-2 sm:mb-4">
            <div className="w-full bg-gradient-to-b from-slate-900/80 via-slate-950/85 to-black/90 border border-yellow-400/40 rounded-2xl p-3.5 backdrop-blur-md shadow-2xl shadow-black/80 flex items-center justify-around text-center">
              <div className="flex flex-col items-center">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                  CONTAINERS
                </span>
                <span className="text-xl font-black text-amber-300 leading-tight">
                  {sim.current.stack.length} / {sim.current.targetWinCount}
                </span>
              </div>

              <div className="w-[1px] h-8 bg-slate-700/60" />

              <div className="flex flex-col items-center">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                  TOTAL SCORE
                </span>
                <span className="text-xl font-black text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)] leading-tight">
                  {gameState.score.toLocaleString()}
                </span>
              </div>

              <div className="w-[1px] h-8 bg-slate-700/60" />

              <div className="flex flex-col items-center">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                  BEST COMBO
                </span>
                <span className="text-xl font-black text-pink-400 leading-tight">
                  x{sim.current.maxCombo || sim.current.combo || sim.current.targetWinCount}
                </span>
              </div>
            </div>

            <div className="w-full flex items-center gap-2">
              <button
                onClick={initGame}
                autoFocus
                className="flex-1 min-h-[50px] bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-sm sm:text-base rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(251,191,36,0.6)] active:scale-95 border border-yellow-200">
                <RotateCw size={18} className="text-slate-950" />
                <span>NEW EXPEDITION (PLAY AGAIN)</span>
              </button>

              <button
                onClick={() => setIsGameMenuOpen(true)}
                className="h-[50px] px-4 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 rounded-xl text-slate-200 text-xs font-black transition-all active:scale-95 flex items-center gap-1.5 shadow-md">
                <MenuIcon size={16} />
                <span>MENU</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* START SCREEN */}
      {gameState.status === 'START' && (
        <MenuOverlay tone="neutral" zIndex={50}>
          <div className="w-full max-w-sm flex flex-col items-center bg-slate-900 border-2 border-sky-500/40 rounded-2xl p-6 shadow-2xl text-center backdrop-blur-md">
            <div className="w-14 h-14 rounded-2xl bg-sky-500/20 border border-sky-400/50 flex items-center justify-center text-sky-400 mb-3 shadow-lg shadow-sky-500/20">
              <Layers size={32} />
            </div>

            <h1 className="text-3xl font-black text-white tracking-wider mb-1">
              HARBOR <span className="text-sky-400">STACK</span>
            </h1>
            <p className="text-xs font-bold text-sky-300/80 uppercase tracking-widest mb-4">
              Stack containers to the moon
            </p>

            <div className="w-full bg-slate-950/70 border border-slate-800 rounded-xl p-3 mb-6 text-left text-xs text-slate-300 space-y-1.5">
              <p className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="font-semibold text-white">Apila:</span> Conecta los contenedores en el centro.
              </p>
              <p className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-pink-400" />
                <span className="font-semibold text-white">Tambaleo:</span> Si pierdes la estabilidad de tu torre perderas.
              </p>
              <p className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <span className="font-semibold text-white">Combos</span> Apila perfecto para desbloquear elementos del juego.
              </p>
              <p className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="font-semibold text-white">Objetivo:</span> Apila 200 contenedores, el cielo es el limite!
              </p>
            </div>
            
            <button
              onClick={initGame}
              autoFocus
              className="w-full min-h-[48px] bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-extrabold text-base rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-sky-600/40 active:scale-95">
              <Play size={20} className="fill-white" />
              START STACKING
            </button>
          </div>
        </MenuOverlay>
      )}

      {/* GAME OVER SCREEN */}
      {gameState.status === 'GAME_OVER' && (
        <Overlay
          title="TOWER COLLAPSED"
          description={`Final Score: ${gameState.score} • Height: ${sim.current.stack.length} / ${sim.current.targetWinCount} containers`}
          actionLabel="TRY AGAIN"
          onAction={initGame}
          icon={<RotateCw size={22} />}
          tone="danger"
        />
      )}

      {/* GAME MENU OVERLAY */}
      {isGameMenuOpen && (
        <MenuOverlay tone="neutral" zIndex={60}>
          <div className="w-full max-w-sm flex flex-col items-center bg-slate-900 border-2 border-slate-700 rounded-2xl p-6 shadow-2xl backdrop-blur-md">
            <h2 className="text-2xl font-black text-sky-400 mb-6 tracking-wide">
              PORT CONTROL MENU
            </h2>

            <div className="w-full flex flex-col gap-3 mb-6">
              <button
                onClick={() => setIsGameMenuOpen(false)}
                autoFocus
                className="w-full min-h-[48px] bg-sky-500 hover:bg-sky-400 text-white font-bold text-base rounded-xl transition-colors flex items-center justify-center gap-2 shadow-md">
                <Play size={18} /> RESUME RUN
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setIsMusicMuted((prev) => !prev)}
                  className={`min-h-[48px] rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-colors ${
                    isMusicMuted
                      ? 'bg-slate-800 text-slate-400 border-slate-700'
                      : 'bg-slate-800 text-emerald-400 border-emerald-500/40'
                  }`}>
                  {isMusicMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  Music: {isMusicMuted ? 'OFF' : 'ON'}
                </button>

                <button
                  onClick={() => {
                    const newMuted = gameAudio.toggleMute();
                    setIsSfxMuted(newMuted);
                  }}
                  className={`min-h-[48px] rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-colors ${
                    isSfxMuted
                      ? 'bg-slate-800 text-slate-400 border-slate-700'
                      : 'bg-slate-800 text-emerald-400 border-emerald-500/40'
                  }`}>
                  {isSfxMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  SFX: {isSfxMuted ? 'OFF' : 'ON'}
                </button>
              </div>

              <button
                onClick={() => setIsHowToPlayOpen(true)}
                className="w-full min-h-[48px] bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2">
                <HelpCircle size={18} /> HOW TO PLAY
              </button>

              <button
                onClick={initGame}
                className="w-full min-h-[48px] bg-slate-800 hover:bg-rose-900/60 border border-slate-700 hover:border-rose-500/50 text-slate-200 hover:text-rose-300 font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2">
                <RotateCw size={18} /> RESTART SESSION
              </button>
            </div>

            <button
              onClick={() => setIsGameMenuOpen(false)}
              className="text-xs text-slate-400 hover:text-white underline">
              Close Menu
            </button>
          </div>
        </MenuOverlay>
      )}

      {/* HOW TO PLAY OVERLAY */}
      {isHowToPlayOpen && (
        <MenuOverlay tone="neutral" zIndex={70}>
          <div className="w-full max-w-md flex flex-col bg-slate-900 border-2 border-sky-500/40 rounded-2xl p-6 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-xl font-black text-sky-400 flex items-center gap-2">
                <HelpCircle size={22} /> HOW TO PLAY
              </h3>
              <button
                onClick={() => setIsHowToPlayOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-300 leading-relaxed mb-6 max-h-[60vh] overflow-y-auto pr-1">
              <div>
                <h4 className="font-bold text-white text-sm mb-1 text-sky-300">
                  1. Apila
                </h4>
                <p>
                  Conecta los contenedores en el centro.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-white text-sm mb-1 text-emerald-400">
                  2. Tambaleo
                </h4>
                <p>
                  Si pierdes la estabilidad de tu torre perderas.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-white text-sm mb-1 text-pink-400">
                  3. Combos
                </h4>
                <p>
                  Apila perfecto para desbloquear elementos del juego.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-white text-sm mb-1 text-cyan-300">
                  4. Objetivo
                </h4>
                <p>
                  Apila 200 contenedores, el cielo es el limite!
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsHowToPlayOpen(false)}
              autoFocus
              className="w-full min-h-[48px] bg-sky-500 hover:bg-sky-400 text-white font-bold text-base rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-sky-600/30">
              GOT IT, LET'S PLAY
            </button>
          </div>
        </MenuOverlay>
      )}
    </div>
  );
}
