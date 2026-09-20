import * as THREE from "three";
import * as CANNON from "cannon-es";
import { PhysicsWorld } from "../physics/PhysicsWorld";

export interface Opening {
  /** Position along the wall's run direction, in world units, where the opening is centered. */
  center: number;
  width: number;
  height: number;
  /** Height of the opening's sill above the wall's base Y. 0 = floor-level doorway. */
  sill?: number;
}

export interface WallSpec {
  axis: "x" | "z";
  /** Fixed coordinate perpendicular to the wall's run (the wall's own X for axis "z", or Z for axis "x"). */
  at: number;
  /** Start/end along the run axis. */
  from: number;
  to: number;
  baseY: number;
  height: number;
  thickness?: number;
  color?: number;
  opening?: Opening;
}

/**
 * Builds simple placeholder architecture: box-based walls (optionally with a
 * single rectangular opening for a door/window), flat floor/ceiling slabs,
 * and inclined ramps for stairs. Every solid piece gets a matching static
 * cannon-es body and is returned so callers can register it as an AI
 * vision-obstruction mesh.
 */
export class StructureBuilder {
  readonly solidMeshes: THREE.Object3D[] = [];

  constructor(
    private readonly scene: THREE.Scene,
    private readonly physics: PhysicsWorld,
  ) {}

  private addStaticBox(
    center: THREE.Vector3,
    size: THREE.Vector3,
    color: number,
    castShadow = true,
  ): THREE.Mesh {
    const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.02 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(center);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    const body = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC, material: this.physics.groundMaterial });
    body.addShape(new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2)));
    body.position.set(center.x, center.y, center.z);
    this.physics.addBody(body);

    this.solidMeshes.push(mesh);
    return mesh;
  }

  wall(spec: WallSpec): THREE.Mesh[] {
    const thickness = spec.thickness ?? 0.2;
    const meshes: THREE.Mesh[] = [];
    const run = spec.to - spec.from;
    const midY = spec.baseY + spec.height / 2;

    const makeSegment = (segFrom: number, segTo: number, segBaseY: number, segHeight: number) => {
      const len = segTo - segFrom;
      if (len <= 0.001 || segHeight <= 0.001) return;
      const mid = (segFrom + segTo) / 2;
      const segMidY = segBaseY + segHeight / 2;
      const size =
        spec.axis === "x" ? new THREE.Vector3(len, segHeight, thickness) : new THREE.Vector3(thickness, segHeight, len);
      const center = spec.axis === "x" ? new THREE.Vector3(mid, segMidY, spec.at) : new THREE.Vector3(spec.at, segMidY, mid);
      meshes.push(this.addStaticBox(center, size, spec.color ?? 0xcfc3ad));
    };

    if (!spec.opening) {
      makeSegment(spec.from, spec.to, spec.baseY, spec.height);
      return meshes;
    }

    const { center, width, height: openingHeight, sill = 0 } = spec.opening;
    const openStart = center - width / 2;
    const openEnd = center + width / 2;

    // Left/below segment, right/above segment (relative to the run direction).
    makeSegment(spec.from, Math.max(spec.from, openStart), spec.baseY, spec.height);
    makeSegment(Math.min(spec.to, openEnd), spec.to, spec.baseY, spec.height);

    // Sill segment beneath the opening (for windows raised off the ground).
    if (sill > 0) {
      const sillFrom = Math.max(spec.from, openStart);
      const sillTo = Math.min(spec.to, openEnd);
      makeSegment(sillFrom, sillTo, spec.baseY, sill);
    }

    // Lintel segment above the opening.
    const lintelBaseY = spec.baseY + sill + openingHeight;
    const lintelHeight = spec.height - sill - openingHeight;
    if (lintelHeight > 0.001) {
      const lintelFrom = Math.max(spec.from, openStart);
      const lintelTo = Math.min(spec.to, openEnd);
      makeSegment(lintelFrom, lintelTo, lintelBaseY, lintelHeight);
    }

    void run;
    void midY;
    return meshes;
  }

  floor(minX: number, maxX: number, minZ: number, maxZ: number, y: number, color = 0x6b5f4e, thickness = 0.2): THREE.Mesh {
    const center = new THREE.Vector3((minX + maxX) / 2, y - thickness / 2, (minZ + maxZ) / 2);
    const size = new THREE.Vector3(maxX - minX, thickness, maxZ - minZ);
    return this.addStaticBox(center, size, color);
  }

  ceiling(minX: number, maxX: number, minZ: number, maxZ: number, y: number, color = 0x9a9184, thickness = 0.2): THREE.Mesh {
    const center = new THREE.Vector3((minX + maxX) / 2, y + thickness / 2, (minZ + maxZ) / 2);
    const size = new THREE.Vector3(maxX - minX, thickness, maxZ - minZ);
    return this.addStaticBox(center, size, color);
  }

  /** An inclined box acting as both stair ramp visual and physics collider. Runs along Z. */
  rampAlongZ(centerX: number, zFrom: number, zTo: number, yFrom: number, yTo: number, width: number, color = 0x5c5346): THREE.Mesh {
    const run = zTo - zFrom;
    const rise = yTo - yFrom;
    const length = Math.sqrt(run * run + rise * rise);
    const angle = Math.atan2(rise, run);
    const geo = new THREE.BoxGeometry(width, 0.25, length);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(centerX, (yFrom + yTo) / 2, (zFrom + zTo) / 2);
    mesh.rotation.x = -angle;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    const body = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC, material: this.physics.groundMaterial });
    body.addShape(new CANNON.Box(new CANNON.Vec3(width / 2, 0.125, length / 2)));
    body.position.set(centerX, (yFrom + yTo) / 2, (zFrom + zTo) / 2);
    body.quaternion.setFromEuler(-angle, 0, 0);
    this.physics.addBody(body);

    this.solidMeshes.push(mesh);
    return mesh;
  }

  pointLight(position: THREE.Vector3, color: number, intensity: number, distance: number): THREE.PointLight {
    // Three.js (r155+) uses physically-based candela units for point lights,
    // so the small "relative brightness" values used across Level.ts need
    // scaling up to actually read as visible light sources.
    const light = new THREE.PointLight(color, intensity * 45, distance, 2);
    light.position.copy(position);
    light.castShadow = false;
    this.scene.add(light);
    return light;
  }
}
