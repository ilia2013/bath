import * as THREE from "three";
import { EventBus } from "../core/EventBus";
import type { GameEventMap } from "../core/GameEvents";
import { PlayerController } from "../player/PlayerController";
import { ItemSystem } from "../items/ItemSystem";

export type CaptureCallback = () => void;

/**
 * Handles what happens when Elias catches the player: no game-over screen,
 * just a short blackout, a drop back at the player's own house, and most
 * progress (unlocked doors, inventory, puzzle state) left intact - only
 * position resets, per the design brief.
 */
export class CaptureSystem {
  private capturing = false;
  onBlackoutStart: CaptureCallback | null = null;
  onBlackoutEnd: CaptureCallback | null = null;

  constructor(
    private readonly player: PlayerController,
    private readonly items: ItemSystem,
    private readonly respawnPoint: THREE.Vector3,
    private readonly bus: EventBus<GameEventMap>,
  ) {
    bus.on("player-caught", () => this.handleCapture());
  }

  isCapturing(): boolean {
    return this.capturing;
  }

  private handleCapture(): void {
    if (this.capturing) return;
    this.capturing = true;
    this.player.setFrozen(true);
    this.player.setNoiseSuppressed(true);
    this.items.dropHeld(false);
    this.bus.emit("notify", { text: "Caught." });
    this.onBlackoutStart?.();

    setTimeout(() => {
      this.player.teleport(this.respawnPoint, Math.PI);
      setTimeout(() => {
        this.player.setFrozen(false);
        this.player.setNoiseSuppressed(false);
        this.capturing = false;
        this.onBlackoutEnd?.();
        this.bus.emit("notify", { text: "You wake up in your own bed. That was close." });
      }, 900);
    }, 1400);
  }
}
