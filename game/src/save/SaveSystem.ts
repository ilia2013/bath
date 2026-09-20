const SAVE_KEY = "house-across-street-save-v1";
const SETTINGS_KEY = "house-across-street-settings-v1";

export interface SaveData {
  version: 1;
  playerPosition: [number, number, number];
  playerYaw: number;
  dayHour: number;
  doors: Record<string, { isOpen: boolean; locked: boolean }>;
  unlockedLocks: string[];
  inventory: { slots: ({ itemId: string; count: number } | null)[]; journal: string[] };
  memory: { flags: string[]; counters: [string, number][] };
  power: { fuseInserted: boolean; powerOn: boolean };
  windowBroken: boolean;
  puzzlePhase: string;
  objective: { title: string; description: string };
  secretFound: boolean;
}

export interface GameSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  sensitivity: number;
  fov: number;
  headbob: boolean;
  fullscreen: boolean;
}

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.8,
  musicVolume: 0.7,
  sfxVolume: 0.9,
  sensitivity: 0.0022,
  fov: 75,
  headbob: true,
  fullscreen: false,
};

/**
 * Pure persistence: reads/writes JSON blobs to localStorage. Never inspects
 * gameplay state itself - GameManager composes the SaveData from each
 * system's own serialize()/deserialize() methods.
 */
export class SaveSystem {
  hasSave(): boolean {
    return localStorage.getItem(SAVE_KEY) !== null;
  }

  save(data: SaveData): void {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  }

  load(): SaveData | null {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SaveData;
    } catch {
      return null;
    }
  }

  clear(): void {
    localStorage.removeItem(SAVE_KEY);
  }

  loadSettings(): GameSettings {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    try {
      return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<GameSettings>) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  saveSettings(settings: GameSettings): void {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }
}
