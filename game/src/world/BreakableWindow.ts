import * as THREE from "three";
import * as CANNON from "cannon-es";
import { EventBus } from "../core/EventBus";
import type { GameEventMap } from "../core/GameEvents";
import { NoiseSystem, NOISE_LEVELS } from "../systems/NoiseSystem";
import { PhysicsWorld } from "../physics/PhysicsWorld";

/**
 * A glass pane filling a wall opening. Breaking it is loud (100) and
 * permanent - it both frees the opening for movement and tags the memory
 * flag EnemyAI reads for "used a window entrance".
 */
export class BreakableWindow {
  readonly mesh: THREE.Mesh;
  readonly body: CANNON.Body;
  private broken = false;

  constructor(
    center: THREE.Vector3,
    width: number,
    height: number,
    thickness: number,
    private readonly scene: THREE.Scene,
    private readonly physics: PhysicsWorld,
    private readonly noise: NoiseSystem,
    private readonly bus: EventBus<GameEventMap>,
  ) {
    const geo = new THREE.BoxGeometry(width, height, thickness);
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xbcd4e0,
      transparent: true,
      opacity: 0.35,
      roughness: 0.05,
      metalness: 0,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(center);
    this.mesh.userData.interactable = { type: "use", uid: "window", prompt: "E — Break Window", onUse: () => this.break() };
    scene.add(this.mesh);

    this.body = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC, material: physics.groundMaterial });
    this.body.addShape(new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, thickness / 2)));
    this.body.position.set(center.x, center.y, center.z);
    physics.addBody(this.body);
  }

  isBroken(): boolean {
    return this.broken;
  }

  break(): void {
    if (this.broken) return;
    this.broken = true;
    this.scene.remove(this.mesh);
    this.physics.removeBody(this.body);
    this.noise.emit(this.mesh.position, NOISE_LEVELS.BREAK_WINDOW, "break-window");
    this.bus.emit("memory-flag", { flag: "playerUsedWindowEntrance" });
    this.bus.emit("notify", { text: "The glass shatters." });
  }

  serialize(): boolean {
    return this.broken;
  }

  deserialize(broken: boolean): void {
    if (broken) this.break();
  }
}
