import * as THREE from "three";
import { EventBus } from "../core/EventBus";
import type { GameEventMap } from "../core/GameEvents";
import { InventorySystem } from "../systems/InventorySystem";
import { NoiseSystem, NOISE_LEVELS } from "../systems/NoiseSystem";

/**
 * The garage breaker panel: dead until a fuse is inserted, then toggleable.
 * Cutting power re-locks every electronic lock in the house (via LockSystem
 * listening for the same "power-toggled" event) and is loud/visible enough
 * that EnemyAI reacts to it.
 */
export class PowerSystem {
  private fuseInserted = false;
  private powerOn = false;

  constructor(
    private readonly mesh: THREE.Object3D,
    private readonly inventory: InventorySystem,
    private readonly noise: NoiseSystem,
    private readonly bus: EventBus<GameEventMap>,
  ) {
    this.refreshPrompt();
  }

  private refreshPrompt(): void {
    let prompt: string;
    if (!this.fuseInserted) prompt = "E — Insert Fuse";
    else prompt = this.powerOn ? "E — Cut Power" : "E — Restore Power";
    this.mesh.userData.interactable = { type: "use", uid: "breaker-box", prompt, onUse: () => this.interact() };
  }

  private interact(): void {
    if (!this.fuseInserted) {
      if (!this.inventory.consume("fuse")) {
        this.bus.emit("notify", { text: "The breaker box has a burnt-out fuse socket. It needs a fuse." });
        return;
      }
      this.fuseInserted = true;
      this.bus.emit("notify", { text: "Fuse installed. The panel hums to life." });
      this.setPower(true);
    } else {
      this.setPower(!this.powerOn);
    }
    this.refreshPrompt();
  }

  setPower(on: boolean): void {
    if (this.powerOn === on) return;
    this.powerOn = on;
    const worldPos = new THREE.Vector3();
    this.mesh.getWorldPosition(worldPos);
    this.noise.emit(worldPos, NOISE_LEVELS.OPEN_DOOR, "breaker-toggle");
    this.bus.emit("power-toggled", { on });
    if (!on) this.bus.emit("memory-flag", { flag: "playerDisabledPower" });
    this.refreshPrompt();
  }

  isPowerOn(): boolean {
    return this.powerOn;
  }

  serialize(): { fuseInserted: boolean; powerOn: boolean } {
    return { fuseInserted: this.fuseInserted, powerOn: this.powerOn };
  }

  deserialize(data: { fuseInserted: boolean; powerOn: boolean }): void {
    this.fuseInserted = data.fuseInserted;
    this.powerOn = data.powerOn;
    this.refreshPrompt();
    this.bus.emit("power-toggled", { on: this.powerOn });
  }
}
