import * as THREE from "three";

export interface VisionParams {
  eyePosition: THREE.Vector3;
  forward: THREE.Vector3;
  fovRadians: number;
  maxRange: number;
  targetPosition: THREE.Vector3;
  targetIsCrouching: boolean;
  /** 0 (pitch dark) to 1 (fully lit) sampled at the target's position. */
  lightLevelAtTarget: number;
}

/**
 * Cone + raycast visibility check. Never trusts the player's transform
 * directly - only ever answers "can Elias currently see the player", which
 * is the one fact real cheating AI would skip.
 */
export class VisionSystem {
  constructor(private readonly getObstructionMeshes: () => THREE.Object3D[]) {}

  private raycaster = new THREE.Raycaster();

  canSee(params: VisionParams): boolean {
    const toTarget = params.targetPosition.clone().sub(params.eyePosition);
    const distance = toTarget.length();
    if (distance > params.maxRange) return false;
    if (distance < 0.001) return true;

    const dirToTarget = toTarget.clone().normalize();
    const angle = params.forward.angleTo(dirToTarget);
    if (angle > params.fovRadians / 2) return false;

    // Darkness and crouching both shrink effective detection range multiplicatively.
    const lightFactor = THREE.MathUtils.lerp(0.35, 1.0, params.lightLevelAtTarget);
    const crouchFactor = params.targetIsCrouching ? 0.55 : 1.0;
    const effectiveRange = params.maxRange * lightFactor * crouchFactor;
    if (distance > effectiveRange) return false;

    this.raycaster.set(params.eyePosition, dirToTarget);
    this.raycaster.far = distance - 0.05;
    this.raycaster.near = 0.01;
    const hits = this.raycaster.intersectObjects(this.getObstructionMeshes(), true);
    if (hits.length > 0) return false; // A wall/door is between Elias and the player.

    return true;
  }
}
