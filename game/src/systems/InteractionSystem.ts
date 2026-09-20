import * as THREE from "three";
import { EventBus } from "../core/EventBus";
import type { GameEventMap } from "../core/GameEvents";
import { InputManager } from "../core/InputManager";
import { ItemSystem } from "../items/ItemSystem";
import { InventorySystem } from "./InventorySystem";
import { DoorSystem } from "./DoorSystem";
import { LockSystem } from "./LockSystem";
import { HidingSystem } from "./HidingSystem";
import { ITEM_DEFS, type ItemId } from "../items/ItemTypes";

export type InteractableType = "pickup-inventory" | "pickup-prop" | "door" | "hide" | "use";

export interface InteractableData {
  type: InteractableType;
  uid: string | number;
  prompt: string;
  /** Only for type "use" — arbitrary world triggers (breaker switch, etc). */
  onUse?: () => void;
}

const MAX_RANGE = 2.6;

/**
 * Single raycast-from-camera interaction model. Anything the player can act
 * on tags itself via `mesh.userData.interactable`; this system just reads
 * that tag, shows the matching prompt, and routes E-presses to the right
 * subsystem. Keeps individual systems ignorant of input entirely.
 */
export class InteractionSystem {
  private raycaster = new THREE.Raycaster();
  private currentTarget: THREE.Object3D | null = null;
  onPromptChange: ((prompt: string | null) => void) | null = null;

  constructor(
    private readonly camera: THREE.Camera,
    private readonly scene: THREE.Scene,
    private readonly input: InputManager,
    private readonly items: ItemSystem,
    private readonly inventory: InventorySystem,
    private readonly doors: DoorSystem,
    private readonly locks: LockSystem,
    private readonly hiding: HidingSystem,
    private readonly bus: EventBus<GameEventMap>,
  ) {}

  update(): void {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    this.raycaster.far = MAX_RANGE;
    const hits = this.raycaster.intersectObjects(this.scene.children, true);
    let found: THREE.Object3D | null = null;
    for (const hit of hits) {
      if (hit.object.userData.interactable) {
        found = hit.object;
        break;
      }
    }

    this.currentTarget = found;
    const data = found?.userData.interactable as InteractableData | undefined;
    this.onPromptChange?.(data ? data.prompt : null);

    if (data && this.input.wasJustPressed("KeyE")) {
      this.activate(data);
    }
  }

  private activate(data: InteractableData): void {
    switch (data.type) {
      case "pickup-prop":
        this.items.pickUp(data.uid as number);
        break;
      case "pickup-inventory": {
        const item = this.items.items.get(data.uid as number);
        if (!item) return;
        if (this.inventory.add(item.itemId)) {
          this.items.collectIntoInventory(data.uid as number);
          this.bus.emit("notify", { text: `Picked up: ${ITEM_DEFS[item.itemId].name}` });
          this.bus.emit("item-collected", { itemId: item.itemId });
        } else {
          this.bus.emit("notify", { text: "Inventory full." });
        }
        break;
      }
      case "door": {
        const door = this.doors.get(data.uid as string);
        if (!door) return;
        if (door.isLocked()) {
          const lockId = this.locks.getLockIdForDoor(door.id);
          const result = lockId ? this.locks.attempt(lockId) : { success: false, reason: "It's locked." };
          if (result.success) this.doors.toggle(door.id);
          else this.bus.emit("notify", { text: result.reason ?? "It's locked." });
        } else {
          this.doors.toggle(door.id);
        }
        break;
      }
      case "hide":
        this.bus.emit("notify", { text: "" });
        this.hidingRequest = data.uid as string;
        break;
      case "use":
        data.onUse?.();
        break;
    }
  }

  /** Consumed by GameManager to know a hide request happened this frame. */
  hidingRequest: string | null = null;

  consumeHideRequest(): string | null {
    const v = this.hidingRequest;
    this.hidingRequest = null;
    return v;
  }

  getCurrentTargetPromptForItem(itemId: ItemId): boolean {
    const data = this.currentTarget?.userData.interactable as InteractableData | undefined;
    if (!data || data.type !== "pickup-prop") return false;
    const worldItem = this.items.items.get(data.uid as number);
    return worldItem?.itemId === itemId;
  }
}
