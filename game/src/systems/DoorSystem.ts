import * as THREE from "three";
import * as CANNON from "cannon-es";
import { EventBus } from "../core/EventBus";
import type { GameEventMap } from "../core/GameEvents";
import { NoiseSystem, NOISE_LEVELS } from "./NoiseSystem";
import { PhysicsWorld } from "../physics/PhysicsWorld";

export interface DoorConfig {
  id: string;
  hingePosition: THREE.Vector3;
  width: number;
  height: number;
  thickness?: number;
  openAngle?: number;
  color?: number;
  /** If set, this door starts locked and needs LockSystem to clear it before it can be toggled. */
  locked?: boolean;
  /**
   * Which world axis the closed slab spans from the hinge, matching the
   * wall opening it fills: "x" for a doorway in a wall that runs along X
   * (opening gap along X), "z" for one in a wall running along Z. Getting
   * this wrong means the door never actually covers its opening.
   */
  axis?: "x" | "z";
}

/**
 * A single swinging door: a pivot Object3D holding the visible slab, plus a
 * kinematic physics body that blocks the player only while closed.
 */
export class Door {
  readonly id: string;
  readonly pivot: THREE.Object3D;
  readonly body: CANNON.Body;
  isOpen = false;
  locked: boolean;
  private targetAngle = 0;
  private currentAngle = 0;
  private readonly openAngle: number;
  private readonly halfWidth: number;
  private readonly halfHeight: number;
  private readonly halfThickness: number;
  private readonly axis: "x" | "z";

  constructor(cfg: DoorConfig, scene: THREE.Scene, physics: PhysicsWorld) {
    this.id = cfg.id;
    this.locked = cfg.locked ?? false;
    this.openAngle = cfg.openAngle ?? Math.PI / 2;
    this.axis = cfg.axis ?? "x";
    const thickness = cfg.thickness ?? 0.08;
    this.halfWidth = cfg.width / 2;
    this.halfHeight = cfg.height / 2;
    this.halfThickness = thickness / 2;

    this.pivot = new THREE.Object3D();
    this.pivot.position.copy(cfg.hingePosition);
    scene.add(this.pivot);

    // Before the swing (Y) rotation is applied, the slab must already
    // extend along the wall's own run axis so it actually covers the gap.
    const geo =
      this.axis === "x"
        ? new THREE.BoxGeometry(cfg.width, cfg.height, thickness)
        : new THREE.BoxGeometry(thickness, cfg.height, cfg.width);
    if (this.axis === "x") geo.translate(cfg.width / 2, cfg.height / 2, 0);
    else geo.translate(0, cfg.height / 2, cfg.width / 2);
    const mat = new THREE.MeshStandardMaterial({ color: cfg.color ?? 0x5c4632, roughness: 0.8 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.interactable = { type: "door", uid: cfg.id, prompt: this.promptText() };
    this.pivot.add(mesh);
    this.mesh = mesh;

    this.body = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC });
    const shapeExtents =
      this.axis === "x"
        ? new CANNON.Vec3(this.halfWidth, this.halfHeight, this.halfThickness)
        : new CANNON.Vec3(this.halfThickness, this.halfHeight, this.halfWidth);
    this.body.addShape(new CANNON.Box(shapeExtents));
    this.syncBodyToPivot();
    physics.addBody(this.body);
  }

  readonly mesh: THREE.Mesh;

  private promptText(): string {
    if (this.locked) return "Locked";
    return this.isOpen ? "E — Close" : "E — Open";
  }

  isLocked(): boolean {
    return this.locked;
  }

  toggle(noise: NoiseSystem): boolean {
    if (this.locked) return false;
    this.isOpen = !this.isOpen;
    this.targetAngle = this.isOpen ? this.openAngle : 0;
    // A door that's sat closed long enough to fall asleep still needs its
    // kinematic body to actually move (and update its broadphase AABB) once
    // the swing animation starts.
    this.body.wakeUp();
    const worldPos = new THREE.Vector3();
    this.pivot.getWorldPosition(worldPos);
    noise.emit(worldPos, NOISE_LEVELS.OPEN_DOOR, `door-${this.id}`);
    (this.mesh.userData.interactable as { prompt: string }).prompt = this.promptText();
    return true;
  }

  setLocked(locked: boolean): void {
    this.locked = locked;
    (this.mesh.userData.interactable as { prompt: string }).prompt = this.promptText();
  }

  /** Smoothly animates the door slab and updates its physical blocker each frame. */
  update(dt: number): void {
    const speed = 3.2;
    if (Math.abs(this.currentAngle - this.targetAngle) > 0.001) {
      const dir = Math.sign(this.targetAngle - this.currentAngle);
      const step = dir * speed * dt;
      if (Math.abs(step) >= Math.abs(this.targetAngle - this.currentAngle)) {
        this.currentAngle = this.targetAngle;
      } else {
        this.currentAngle += step;
      }
      this.pivot.rotation.y = this.currentAngle;
      this.syncBodyToPivot();
    }
    // Fully open doors stop blocking movement; closed/near-closed doors still collide.
    this.body.collisionResponse = Math.abs(this.currentAngle) < 0.35;
  }

  private syncBodyToPivot(): void {
    // Body center sits at the slab's midpoint, not the hinge, so it must be
    // rotated the same way and offset along the (rotated) local axis the
    // slab actually extends along.
    const localCenter =
      this.axis === "x" ? new THREE.Vector3(this.halfWidth, this.halfHeight, 0) : new THREE.Vector3(0, this.halfHeight, this.halfWidth);
    localCenter.applyEuler(new THREE.Euler(0, this.currentAngle, 0));
    const worldPos = this.pivot.position.clone().add(localCenter);
    this.body.position.set(worldPos.x, worldPos.y, worldPos.z);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.currentAngle, 0));
    this.body.quaternion.set(q.x, q.y, q.z, q.w);
  }

  serialize(): { id: string; isOpen: boolean; locked: boolean } {
    return { id: this.id, isOpen: this.isOpen, locked: this.locked };
  }
}

/** Registry of all doors in the level, keyed by id. */
export class DoorSystem {
  private doors = new Map<string, Door>();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly physics: PhysicsWorld,
    private readonly noise: NoiseSystem,
    private readonly bus: EventBus<GameEventMap>,
  ) {}

  create(cfg: DoorConfig): Door {
    const door = new Door(cfg, this.scene, this.physics);
    this.doors.set(cfg.id, door);
    return door;
  }

  get(id: string): Door | undefined {
    return this.doors.get(id);
  }

  toggle(id: string): void {
    const door = this.doors.get(id);
    if (!door) return;
    if (door.toggle(this.noise)) {
      this.bus.emit("door-state-changed", { doorId: id, open: door.isOpen });
    }
  }

  update(dt: number): void {
    for (const door of this.doors.values()) door.update(dt);
  }

  all(): Door[] {
    return [...this.doors.values()];
  }

  serialize(): Record<string, { isOpen: boolean; locked: boolean }> {
    const out: Record<string, { isOpen: boolean; locked: boolean }> = {};
    for (const [id, door] of this.doors) out[id] = { isOpen: door.isOpen, locked: door.locked };
    return out;
  }

  deserialize(data: Record<string, { isOpen: boolean; locked: boolean }>): void {
    for (const [id, state] of Object.entries(data)) {
      const door = this.doors.get(id);
      if (!door) continue;
      door.locked = state.locked;
      if (state.isOpen !== door.isOpen) door.toggle(this.noise);
    }
  }
}
