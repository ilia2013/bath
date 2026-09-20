import * as THREE from "three";
import { EventBus } from "../core/EventBus";
import type { GameEventMap } from "../core/GameEvents";

/** Standard loudness radii (meters) per the design spec. */
export const NOISE_LEVELS = {
  CROUCH_STEP: 2,
  WALK_STEP: 6,
  RUN_STEP: 14,
  JUMP_LAND: 10,
  OPEN_DOOR: 5,
  THROW_OBJECT: 18,
  BREAK_WINDOW: 30,
  DROP_OBJECT: 8,
} as const;

/**
 * Fire-and-forget noise events. EnemyAI's HearingSystem subscribes and
 * decides for itself whether a given emission was within earshot -
 * this module only broadcasts, it never queries the AI directly.
 */
export class NoiseSystem {
  private lastEmitTime = 0;

  constructor(private readonly bus: EventBus<GameEventMap>) {}

  emit(position: THREE.Vector3, loudness: number, sourceTag: string): void {
    const now = performance.now();
    // Debounce identical rapid-fire emissions (e.g. footstep spam) by tag.
    if (sourceTag === this.lastTag && now - this.lastEmitTime < 90) return;
    this.lastTag = sourceTag;
    this.lastEmitTime = now;
    this.bus.emit("noise", { position: position.clone(), loudness, sourceTag });
  }

  private lastTag = "";
}
