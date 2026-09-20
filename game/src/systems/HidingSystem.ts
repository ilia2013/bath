import * as THREE from "three";

export interface HidingSpotConfig {
  id: string;
  name: string;
  /** Where the camera sits while hidden. */
  interiorPosition: THREE.Vector3;
  /** Where the player capsule is teleported back to on exit. */
  exitPosition: THREE.Vector3;
  /** How far the camera may yaw while hidden, simulating peeking through a gap. */
  peekYawLimit: number;
  mesh: THREE.Object3D;
}

/**
 * Closets / under-bed / crates the player can duck into. Hiding does not
 * guarantee safety - EnemyAI's SearchSystem can flag a spot as "seen" and
 * check it directly.
 */
export class HidingSystem {
  private spots = new Map<string, HidingSpotConfig>();
  private activeSpotId: string | null = null;
  /** Spots the AI watched the player enter and hasn't checked yet. */
  private readonly compromisedSpots = new Set<string>();

  register(cfg: HidingSpotConfig): void {
    this.spots.set(cfg.id, cfg);
    cfg.mesh.userData.interactable = { type: "hide", uid: cfg.id, prompt: `E — Hide (${cfg.name})` };
  }

  get(id: string): HidingSpotConfig | undefined {
    return this.spots.get(id);
  }

  enter(id: string): HidingSpotConfig | undefined {
    const spot = this.spots.get(id);
    if (!spot || this.activeSpotId) return undefined;
    this.activeSpotId = id;
    return spot;
  }

  exit(): HidingSpotConfig | undefined {
    if (!this.activeSpotId) return undefined;
    const spot = this.spots.get(this.activeSpotId);
    this.activeSpotId = null;
    return spot;
  }

  isHiding(): boolean {
    return this.activeSpotId !== null;
  }

  getActiveSpotId(): string | null {
    return this.activeSpotId;
  }

  /** Called by EnemyAI when it directly witnesses the player duck into a spot. */
  markCompromised(id: string): void {
    this.compromisedSpots.add(id);
  }

  isCompromised(id: string): boolean {
    return this.compromisedSpots.has(id);
  }

  clearCompromised(id: string): void {
    this.compromisedSpots.delete(id);
  }

  all(): HidingSpotConfig[] {
    return [...this.spots.values()];
  }
}
