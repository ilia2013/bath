import { EventBus } from "../core/EventBus";
import type { GameEventMap } from "../core/GameEvents";
import { InventorySystem } from "./InventorySystem";
import { DoorSystem } from "./DoorSystem";
import type { ItemId } from "../items/ItemTypes";

export type LockKind = "key" | "electronic";

export interface LockConfig {
  id: string;
  doorId: string;
  kind: LockKind;
  requiredItem?: ItemId;
  /** Electronic locks only unlock while the house has power. */
  requiresPower?: boolean;
}

/**
 * Bridges doors to their unlock requirements. Keys are checked against the
 * inventory (not consumed); electronic locks additionally need mains power,
 * so cutting the breaker re-locks them until it's restored.
 */
export class LockSystem {
  private locks = new Map<string, LockConfig>();
  private unlocked = new Set<string>();
  private powerOn = true;

  constructor(
    private readonly doors: DoorSystem,
    private readonly inventory: InventorySystem,
    private readonly bus: EventBus<GameEventMap>,
  ) {
    bus.on("power-toggled", ({ on }) => this.setPower(on));
  }

  register(cfg: LockConfig): void {
    this.locks.set(cfg.id, cfg);
    this.doors.get(cfg.doorId)?.setLocked(true);
  }

  getLockIdForDoor(doorId: string): string | undefined {
    for (const lock of this.locks.values()) if (lock.doorId === doorId) return lock.id;
    return undefined;
  }

  setPower(on: boolean): void {
    this.powerOn = on;
    for (const lock of this.locks.values()) {
      if (lock.kind !== "electronic") continue;
      const door = this.doors.get(lock.doorId);
      if (!door) continue;
      if (!on && !this.unlocked.has(lock.id)) door.setLocked(true);
      else if (on && this.unlocked.has(lock.id)) door.setLocked(false);
    }
  }

  /** Returns true if the attempt unlocked (or was already unlocked). Consumes nothing. */
  attempt(lockId: string): { success: boolean; reason?: string } {
    const lock = this.locks.get(lockId);
    if (!lock) return { success: false, reason: "No lock found." };
    if (this.unlocked.has(lockId)) return { success: true };

    if (lock.kind === "key") {
      if (lock.requiredItem && this.inventory.has(lock.requiredItem)) {
        this.unlock(lockId);
        return { success: true };
      }
      return { success: false, reason: "It's locked. You need a key." };
    }

    if (lock.kind === "electronic") {
      if (!this.powerOn) return { success: false, reason: "No power. The panel is dark." };
      this.unlock(lockId);
      return { success: true };
    }

    return { success: false };
  }

  unlock(lockId: string): void {
    const lock = this.locks.get(lockId);
    if (!lock) return;
    this.unlocked.add(lockId);
    this.doors.get(lock.doorId)?.setLocked(false);
    this.bus.emit("puzzle-solved", { id: lockId });
  }

  isUnlocked(lockId: string): boolean {
    return this.unlocked.has(lockId);
  }

  serialize(): string[] {
    return [...this.unlocked];
  }

  deserialize(ids: string[]): void {
    for (const id of ids) this.unlock(id);
  }
}
