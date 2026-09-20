import type * as THREE from "three";
import type { ItemId } from "../items/ItemTypes";
import type { MemoryFlag } from "../ai/MemorySystem";

export interface NoiseEvent {
  position: THREE.Vector3;
  loudness: number; // radius in meters the sound is audible at full confidence
  sourceTag: string;
}

export interface ObjectiveChangedEvent {
  title: string;
  description: string;
}

export interface NotifyEvent {
  text: string;
}

export interface PuzzleSolvedEvent {
  id: string;
}

export interface MemoryFlagEvent {
  flag: MemoryFlag;
}

/** All cross-system events flow through one bus so nothing needs a direct reference cycle. */
export interface GameEventMap {
  noise: NoiseEvent;
  "objective-changed": ObjectiveChangedEvent;
  notify: NotifyEvent;
  "puzzle-solved": PuzzleSolvedEvent;
  "memory-flag": MemoryFlagEvent;
  "player-spotted": { distance: number };
  "player-lost": Record<string, never>;
  "player-caught": Record<string, never>;
  "power-toggled": { on: boolean };
  "door-state-changed": { doorId: string; open: boolean };
  "ai-state-changed": { state: string };
  "inventory-changed": Record<string, never>;
  "item-collected": { itemId: ItemId };
  "secret-found": Record<string, never>;
  "game-escaped": Record<string, never>;
}
