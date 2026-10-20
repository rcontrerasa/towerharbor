/**
 * Configuration for Cargo Stack game.
 */
export const CONFIG = {
  // --- Game Initialization ---
  title: {
    value: 'Cargo Stack',
    type: 'string',
    label: 'Game Title',
    group: 'GAME',
  },
  baseCanvasWidth: {
    value: 720,
    type: 'number',
    label: 'Base Canvas Width',
    group: 'GAME',
  },
  baseCanvasHeight: {
    value: 1280,
    type: 'number',
    label: 'Base Canvas Height',
    group: 'GAME',
  },

  // --- System Constants ---
  targetFPS: {
    value: 60,
    type: 'number',
    label: 'Target FPS',
    group: 'SYSTEM',
  },
  stepMs: {
    value: 1000 / 60,
    type: 'number',
    label: 'Step MS',
    group: 'SYSTEM',
  },
  maxSubSteps: {
    value: 5,
    type: 'number',
    label: 'Max Sub Steps',
    group: 'SYSTEM',
  },

  // --- Theme ---
  backgroundColor: {
    value: '#0a0a0f',
    type: 'color',
    label: 'Background Color',
    group: 'THEME',
  },
  primaryColor: {
    value: '#38bdf8',
    type: 'color',
    label: 'Primary Accent Color',
    group: 'THEME',
  },
  fontFamily: {
    value: 'Inter, system-ui, -apple-system, sans-serif',
    type: 'string',
    label: 'Font Family',
    group: 'THEME',
  },

  // --- Audio ---
  defaultMusicVolume: {
    value: 0.5,
    type: 'number',
    label: 'Default Music Volume',
    group: 'AUDIO',
  },
  defaultSfxVolume: {
    value: 0.7,
    type: 'number',
    label: 'Default SFX Volume',
    group: 'AUDIO',
  },

  // --- Gameplay & Physics Dynamics ---
  targetWinCount: {
    value: 200,
    type: 'number',
    label: 'Target Containers to Win',
    group: 'Rules',
  },
  containerWidth: {
    value: 240,
    type: 'number',
    label: 'Container Width',
    group: 'Physics',
  },
  containerHeight: {
    value: 110,
    type: 'number',
    label: 'Container Height',
    group: 'Physics',
  },
  baseSwingSpeed: {
    value: 1.05,
    type: 'number',
    label: 'Base Swing Speed (rad/s)',
    group: 'Physics',
  },
  dropGravity: {
    value: 2400,
    type: 'number',
    label: 'Drop Gravity Acceleration',
    group: 'Physics',
  },
  inertiaRatio: {
    value: 0.476,
    type: 'number',
    label: 'Tangential Inertia Transfer Ratio',
    group: 'Physics',
  },
  perfectSnapTolerance: {
    value: 42,
    type: 'number',
    label: 'Perfect Drop Magnetic Window (px)',
    group: 'Rules',
  },
  maxAllowedWobble: {
    value: 140,
    type: 'number',
    label: 'Max Wobble Capacity (px)',
    group: 'Rules',
  },

  // --- Asset Dimensions and Aspect Ratios (from read_assets_metadata) ---
  assetCraneHookAspectRatio: {
    value: 846 / 702, // 1.205128
    type: 'number',
    label: 'Crane Spreader Aspect Ratio',
    group: 'ASSETS',
  },
  assetCraneHookWidth: {
    value: 250,
    type: 'number',
    label: 'Crane Spreader Width',
    group: 'ASSETS',
  },
  assetCraneHookHeight: {
    value: 250 / (846 / 702), // 207.45
    type: 'number',
    label: 'Crane Spreader Height',
    group: 'ASSETS',
  },

  assetShipHullAspectRatio: {
    value: 876 / 224, // 3.910714
    type: 'number',
    label: 'Ship Hull Deck Aspect Ratio',
    group: 'ASSETS',
  },
  assetShipHullWidth: {
    value: 620,
    type: 'number',
    label: 'Ship Hull Deck Width',
    group: 'ASSETS',
  },
  assetShipHullHeight: {
    value: 620 / (876 / 224), // 158.54
    type: 'number',
    label: 'Ship Hull Deck Height',
    group: 'ASSETS',
  },

  assetUiRestartAspectRatio: {
    value: 1.0,
    type: 'number',
    label: 'Restart Icon Aspect Ratio',
    group: 'ASSETS',
  },
  assetUiRestartWidth: {
    value: 48,
    type: 'number',
    label: 'Restart Icon Width',
    group: 'ASSETS',
  },
  assetUiRestartHeight: {
    value: 48,
    type: 'number',
    label: 'Restart Icon Height',
    group: 'ASSETS',
  },

  assetUiTrophyAspectRatio: {
    value: 564 / 618, // 0.912621
    type: 'number',
    label: 'Trophy Icon Aspect Ratio',
    group: 'ASSETS',
  },
  assetUiTrophyWidth: {
    value: 44,
    type: 'number',
    label: 'Trophy Icon Width',
    group: 'ASSETS',
  },
  assetUiTrophyHeight: {
    value: 44 / (564 / 618), // 48.21
    type: 'number',
    label: 'Trophy Icon Height',
    group: 'ASSETS',
  },
};

// Merge customized config values if present (injected by Playground)
const {playgroundConfig} = globalThis as {
  playgroundConfig?: Record<string, unknown>;
};
if (playgroundConfig) {
  for (const [key, value] of Object.entries(playgroundConfig)) {
    if (key in CONFIG) {
      Object.assign(CONFIG[key as keyof typeof CONFIG], {value});
    }
  }
}

/**
 * Type helper for reading values in game code
 */
export type ConfigKey = keyof typeof CONFIG;

/**
 * Gets a configuration value by key.
 * @param key The configuration key.
 * @return The configuration value.
 */
export function getConfig<K extends ConfigKey>(
  key: K,
): (typeof CONFIG)[K]['value'] {
  return CONFIG[key].value;
}

export const PRESETS = {};
