import * as THREE from "three";
import * as CANNON from "cannon-es";
import { EventBus } from "../core/EventBus";
import type { GameEventMap } from "../core/GameEvents";
import { NoiseSystem, NOISE_LEVELS } from "../systems/NoiseSystem";
import { PhysicsWorld } from "../physics/PhysicsWorld";
import { ITEM_DEFS, type ItemId } from "./ItemTypes";

export interface WorldItem {
  uid: number;
  itemId: ItemId;
  mesh: THREE.Object3D;
  body: CANNON.Body;
  pickedUp: boolean;
  heldOffset: THREE.Vector3;
}

let uidCounter = 1;

/**
 * Owns every physical item in the world: spawning, pickup/drop/throw physics,
 * and holding the currently-carried item in front of the camera.
 */
export class ItemSystem {
  readonly items = new Map<number, WorldItem>();
  private heldItem: WorldItem | null = null;
  private readonly holdAnchor = new THREE.Object3D();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly physics: PhysicsWorld,
    private readonly camera: THREE.Camera,
    private readonly noise: NoiseSystem,
    private readonly bus: EventBus<GameEventMap>,
  ) {
    this.camera.add(this.holdAnchor);
    this.holdAnchor.position.set(0.35, -0.3, -0.6);
  }

  spawn(itemId: ItemId, position: THREE.Vector3, size = 0.22): WorldItem {
    const def = ITEM_DEFS[itemId];
    const color = ITEM_COLORS[itemId] ?? 0xcccccc;
    const geo = new THREE.BoxGeometry(size, size, size);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.position.copy(position);
    const pickupType = def.category === "prop" ? "pickup-prop" : "pickup-inventory";
    mesh.userData.interactable = { type: pickupType, uid: -1, prompt: `E — Pick Up (${def.name})` };
    this.scene.add(mesh);

    const shape = new CANNON.Box(new CANNON.Vec3(size / 2, size / 2, size / 2));
    const body = new CANNON.Body({
      mass: 1.2,
      material: this.physics.objectMaterial,
      position: new CANNON.Vec3(position.x, position.y, position.z),
      linearDamping: 0.4,
      angularDamping: 0.6,
    });
    body.addShape(shape);
    this.physics.addBody(body);

    const uid = uidCounter++;
    mesh.userData.interactable.uid = uid;
    const worldItem: WorldItem = {
      uid,
      itemId,
      mesh,
      body,
      pickedUp: false,
      heldOffset: new THREE.Vector3(),
    };
    this.items.set(uid, worldItem);
    return worldItem;
  }

  syncMeshesFromPhysics(): void {
    for (const item of this.items.values()) {
      if (item.pickedUp) continue;
      item.mesh.position.copy(item.body.position as unknown as THREE.Vector3);
      item.mesh.quaternion.copy(item.body.quaternion as unknown as THREE.Quaternion);
    }
  }

  getHeldItem(): WorldItem | null {
    return this.heldItem;
  }

  /** Removes the item from physics simulation and parents it to the camera. */
  pickUp(uid: number): WorldItem | undefined {
    const item = this.items.get(uid);
    if (!item || item.pickedUp) return undefined;
    if (this.heldItem) this.dropHeld(false);

    item.pickedUp = true;
    item.body.type = CANNON.Body.KINEMATIC;
    item.body.velocity.set(0, 0, 0);
    this.physics.removeBody(item.body);
    this.scene.remove(item.mesh);
    item.mesh.userData.interactable = undefined;
    this.holdAnchor.add(item.mesh);
    item.mesh.position.set(0, 0, 0);
    item.mesh.rotation.set(0, 0, 0);
    this.heldItem = item;
    return item;
  }

  /** Drop the held item in place in front of the player. */
  dropHeld(emitNoise = true): void {
    const item = this.heldItem;
    if (!item) return;
    this.releaseHeld(item);
    const worldPos = new THREE.Vector3();
    this.holdAnchor.getWorldPosition(worldPos);
    item.body.position.set(worldPos.x, worldPos.y, worldPos.z);
    item.body.velocity.set(0, -0.5, 0);
    this.physics.addBody(item.body);
    this.scene.add(item.mesh);
    if (emitNoise) this.noise.emit(worldPos, NOISE_LEVELS.DROP_OBJECT, "drop-item");
  }

  /** Throw the held item forward with velocity derived from camera direction. */
  throwHeld(): void {
    const item = this.heldItem;
    if (!item) return;
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    this.releaseHeld(item);
    const worldPos = new THREE.Vector3();
    this.holdAnchor.getWorldPosition(worldPos);
    item.body.position.set(worldPos.x, worldPos.y, worldPos.z);
    this.physics.addBody(item.body);
    this.scene.add(item.mesh);
    const throwSpeed = 9;
    item.body.velocity.set(dir.x * throwSpeed, dir.y * throwSpeed + 2, dir.z * throwSpeed);
    item.body.angularVelocity.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);

    // Distraction noise fires where it lands, handled by a short delayed check.
    const checkLanding = () => {
      const speed = item.body.velocity.length();
      if (speed < 0.4) {
        this.noise.emit(item.body.position as unknown as THREE.Vector3, NOISE_LEVELS.THROW_OBJECT, "thrown-item");
      } else {
        setTimeout(checkLanding, 120);
      }
    };
    setTimeout(checkLanding, 200);
  }

  private releaseHeld(item: WorldItem): void {
    this.holdAnchor.remove(item.mesh);
    item.pickedUp = false;
    item.body.type = CANNON.Body.DYNAMIC;
    item.mesh.userData.interactable = { type: "pickup-prop", uid: item.uid, prompt: `E — Pick Up (${ITEM_DEFS[item.itemId].name})` };
    this.heldItem = null;
  }

  /** Removes an inventory/lore item's world representation entirely (it now lives only in the InventorySystem/journal). */
  collectIntoInventory(uid: number): WorldItem | undefined {
    const item = this.items.get(uid);
    if (!item) return undefined;
    this.scene.remove(item.mesh);
    this.physics.removeBody(item.body);
    this.items.delete(uid);
    return item;
  }

  /** Consumes a held/inventory item permanently (used in a lock, etc). */
  destroyWorldItem(uid: number): void {
    const item = this.items.get(uid);
    if (!item) return;
    if (item.pickedUp) this.holdAnchor.remove(item.mesh);
    else {
      this.scene.remove(item.mesh);
      this.physics.removeBody(item.body);
    }
    this.items.delete(uid);
  }
}

const ITEM_COLORS: Partial<Record<ItemId, number>> = {
  key_workshop: 0xd8b25c,
  key_basement: 0x8a8a90,
  crowbar: 0xb23c3c,
  hammer: 0x555560,
  screwdriver: 0xe0a030,
  fuse: 0x4488cc,
  battery: 0x33aa55,
  flashlight: 0xdddddd,
  magnet: 0x993333,
  rope: 0x9c8355,
  box: 0x8a6b3f,
  chair: 0x6f4e2c,
  stone: 0x777777,
  note_photo: 0xf0e6c8,
  note_letter: 0xf0e6c8,
};
