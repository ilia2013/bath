import * as THREE from "three";
import * as CANNON from "cannon-es";
import { InputManager } from "../core/InputManager";
import { PhysicsWorld } from "../physics/PhysicsWorld";
import { NoiseSystem, NOISE_LEVELS } from "../systems/NoiseSystem";

const BODY_RADIUS = 0.35;
// The physics body's Y is its sphere *center*, which rests at ~BODY_RADIUS
// above the floor - so eye height here is measured from that center, not
// the floor. Subtracting the radius keeps actual eye-above-floor height
// (~1.65m / ~1.05m crouched) realistic and low enough to look doors in the
// face instead of over their frame.
const EYE_HEIGHT_STAND = 1.65 - BODY_RADIUS;
const EYE_HEIGHT_CROUCH = 1.05 - BODY_RADIUS;
const WALK_SPEED = 3.1;
const SPRINT_SPEED = 5.6;
const CROUCH_SPEED = 1.5;
const JUMP_VELOCITY = 5.5;
const STAMINA_MAX = 100;
const STAMINA_DRAIN_PER_SEC = 22;
const STAMINA_REGEN_PER_SEC = 14;

/**
 * First-person capsule-ish controller. Uses a spherical cannon-es body
 * (simpler and more robust against edge-catching than a true capsule for a
 * vertical slice) with the camera's eye height offset applied on top.
 */
export class PlayerController {
  readonly body: CANNON.Body;
  readonly camera: THREE.PerspectiveCamera;
  private yaw = 0;
  private pitch = 0;
  private crouching = false;
  private grounded = false;
  private groundContactCount = 0;
  private stamina = STAMINA_MAX;
  private headbobEnabled = true;
  private headbobTime = 0;
  private distanceSinceStep = 0;
  private lastVerticalVelocity = 0;
  private noiseSuppressed = false;
  private frozen = false;

  constructor(
    private readonly input: InputManager,
    private readonly physics: PhysicsWorld,
    private readonly noise: NoiseSystem,
    spawnPosition: THREE.Vector3,
  ) {
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 200);

    this.body = new CANNON.Body({
      mass: 62,
      material: physics.playerMaterial,
      fixedRotation: true,
      linearDamping: 0.001,
      position: new CANNON.Vec3(spawnPosition.x, spawnPosition.y, spawnPosition.z),
    });
    this.body.addShape(new CANNON.Sphere(BODY_RADIUS));
    this.body.angularDamping = 1;
    // The player is actively driven every frame (velocity set directly from
    // input), not left to settle - cannon-es's default sleep-after-rest
    // would otherwise freeze the body in place after ~1s of standing still,
    // silently breaking movement until something else nudges it awake.
    this.body.allowSleep = false;
    this.body.addEventListener("collide", (e: { contact: CANNON.ContactEquation }) => {
      const contact = e.contact;
      const normal = contact.bi.id === this.body.id ? contact.ni : contact.ni.clone().negate();
      if (normal.y > 0.5) {
        this.groundContactCount++;
      }
    });
    physics.addBody(this.body);
  }

  setFrozen(frozen: boolean): void {
    this.frozen = frozen;
    if (frozen) this.body.velocity.set(0, this.body.velocity.y, 0);
  }

  teleport(position: THREE.Vector3, yaw = 0): void {
    this.body.position.set(position.x, position.y, position.z);
    this.body.velocity.set(0, 0, 0);
    this.yaw = yaw;
  }

  setHeadbobEnabled(enabled: boolean): void {
    this.headbobEnabled = enabled;
  }

  isCrouching(): boolean {
    return this.crouching;
  }

  isSprinting(): boolean {
    return this.currentlySprinting;
  }
  private currentlySprinting = false;

  getStamina(): number {
    return this.stamina / STAMINA_MAX;
  }

  getPosition(): THREE.Vector3 {
    return new THREE.Vector3(this.body.position.x, this.body.position.y, this.body.position.z);
  }

  getEyeHeight(): number {
    return this.crouching ? EYE_HEIGHT_CROUCH : EYE_HEIGHT_STAND;
  }

  /** Suppress footstep noise entirely — used while frozen in cutscenes etc. */
  setNoiseSuppressed(v: boolean): void {
    this.noiseSuppressed = v;
  }

  update(dt: number): void {
    this.grounded = this.groundContactCount > 0;
    this.groundContactCount = 0;

    if (this.frozen) {
      this.updateCamera(dt, 0);
      return;
    }

    const { x: dYaw, y: dPitch } = this.input.consumeMouseDelta();
    this.yaw -= dYaw;
    this.pitch -= dPitch;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);

    this.crouching = this.input.isDown("ControlLeft") || this.input.isDown("KeyC");
    const wantSprint = this.input.isDown("ShiftLeft") && !this.crouching && this.stamina > 1;

    let speed = this.crouching ? CROUCH_SPEED : wantSprint ? SPRINT_SPEED : WALK_SPEED;
    this.currentlySprinting = wantSprint && speed === SPRINT_SPEED;

    if (this.currentlySprinting) {
      this.stamina = Math.max(0, this.stamina - STAMINA_DRAIN_PER_SEC * dt);
    } else {
      this.stamina = Math.min(STAMINA_MAX, this.stamina + STAMINA_REGEN_PER_SEC * dt);
    }

    let moveX = 0;
    let moveZ = 0;
    if (this.input.isDown("KeyW")) moveZ -= 1;
    if (this.input.isDown("KeyS")) moveZ += 1;
    if (this.input.isDown("KeyA")) moveX -= 1;
    if (this.input.isDown("KeyD")) moveX += 1;
    const moving = moveX !== 0 || moveZ !== 0;

    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const move = new THREE.Vector3();
    move.addScaledVector(forward, -moveZ);
    move.addScaledVector(right, moveX);
    if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed);

    this.body.velocity.x = move.x;
    this.body.velocity.z = move.z;

    if (this.input.isDown("Space") && this.grounded) {
      this.body.velocity.y = JUMP_VELOCITY;
    }

    // Footstep noise: emit at a cadence proportional to speed.
    if (moving && this.grounded && !this.noiseSuppressed) {
      this.distanceSinceStep += speed * dt;
      const strideLength = this.crouching ? 0.55 : this.currentlySprinting ? 0.9 : 0.75;
      if (this.distanceSinceStep >= strideLength) {
        this.distanceSinceStep = 0;
        const loudness = this.crouching
          ? NOISE_LEVELS.CROUCH_STEP
          : this.currentlySprinting
            ? NOISE_LEVELS.RUN_STEP
            : NOISE_LEVELS.WALK_STEP;
        this.noise.emit(this.getPosition(), loudness, "footstep");
      }
    } else {
      this.distanceSinceStep = 0;
    }

    // Landing noise.
    if (this.grounded && this.lastVerticalVelocity < -6 && !this.noiseSuppressed) {
      this.noise.emit(this.getPosition(), NOISE_LEVELS.JUMP_LAND, "landing");
    }
    this.lastVerticalVelocity = this.body.velocity.y;

    this.updateCamera(dt, moving && this.grounded ? speed : 0);
    // Note: input.endFrame() is intentionally NOT called here - GameManager's
    // loop calls it exactly once per frame, after every system (interaction,
    // inventory, hiding) has had a chance to read this frame's key presses.
  }

  private updateCamera(dt: number, movementSpeed: number): void {
    const pos = this.getPosition();
    let bobOffset = 0;
    if (this.headbobEnabled && movementSpeed > 0.1) {
      this.headbobTime += dt * movementSpeed * 3.2;
      bobOffset = Math.sin(this.headbobTime) * 0.035;
    } else {
      this.headbobTime = 0;
    }
    this.camera.position.set(pos.x, pos.y + this.getEyeHeight() + bobOffset, pos.z);
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  getYaw(): number {
    return this.yaw;
  }

  /** Dev-only: used by automated smoke tests to aim down at floor items without simulating raw mouse deltas. */
  debugSetPitch(pitch: number): void {
    this.pitch = pitch;
  }
}
