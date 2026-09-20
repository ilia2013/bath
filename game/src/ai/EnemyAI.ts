import * as THREE from "three";
import { EventBus } from "../core/EventBus";
import type { GameEventMap } from "../core/GameEvents";
import { NavGraph } from "./NavGraph";
import { VisionSystem } from "./VisionSystem";
import { MemorySystem, type MemoryFlag } from "./MemorySystem";
import { ScheduleSystem, type ScheduleActivity, type SchedulePhase } from "./ScheduleSystem";
import { HidingSystem } from "../systems/HidingSystem";
import { DoorSystem } from "../systems/DoorSystem";
import { PlayerController } from "../player/PlayerController";

export type AIState =
  | "IDLE"
  | "PATROL"
  | "WORK"
  | "EAT"
  | "SLEEP"
  | "INVESTIGATE"
  | "SEARCH"
  | "CHASE"
  | "CHECK_HIDING_PLACE"
  | "RETURN_TO_ROUTINE";

const FOV_RADIANS = THREE.MathUtils.degToRad(100);
const VISION_RANGE = 11;
const EYE_HEIGHT = 1.7;
const CHASE_SPEED = 4.4;
const PATROL_SPEED = 1.7;
const INVESTIGATE_SPEED = 2.5;
const SEARCH_SPEED = 2.3;
const CAPTURE_RADIUS = 1.0;
const LOSE_SIGHT_TIME = 3.0;
const DOOR_AUTO_OPEN_RADIUS = 1.4;
const WAYPOINT_EPSILON = 0.25;

export interface EnemyAIConfig {
  scene: THREE.Scene;
  navGraph: NavGraph;
  schedule: ScheduleSystem;
  hiding: HidingSystem;
  doors: DoorSystem;
  bus: EventBus<GameEventMap>;
  player: PlayerController;
  getObstructionMeshes: () => THREE.Object3D[];
  getDayHour: () => number;
  getLightLevelAt: (position: THREE.Vector3) => number;
  breakerBoxPosition: THREE.Vector3;
  startNodeId: string;
  memory: MemorySystem;
  /** Extra nodes Elias starts favoring during PATROL once a given memory flag is set. */
  flagWatchNodes?: Partial<Record<MemoryFlag, string[]>>;
}

/**
 * Elias Voss. A single state machine tying together vision, hearing
 * (via the noise event bus), memory, schedule and pathing. This module
 * never reads the player's transform except through VisionSystem or a
 * noise event's declared position - it cannot "cheat".
 */
export class EnemyAI {
  readonly root: THREE.Object3D;
  private state: AIState = "IDLE";
  private stateTimer = 0;
  private vision: VisionSystem;
  private currentPath: THREE.Vector3[] = [];
  private pathIndex = 0;
  private lastKnownPlayerPos: THREE.Vector3 | null = null;
  private timeSinceLastSeen = 0;
  private searchQueue: THREE.Vector3[] = [];
  private searchSpotIds: (string | null)[] = [];
  private dwellTimer = 0;
  private currentDwellNode: string | null = null;
  private facingAngle = 0;
  private investigateTarget: THREE.Vector3 | null = null;
  private forcedInvestigate = false;

  constructor(private readonly cfg: EnemyAIConfig) {
    this.vision = new VisionSystem(cfg.getObstructionMeshes);

    this.root = new THREE.Object3D();
    const startNode = cfg.navGraph.get(cfg.startNodeId);
    if (startNode) this.root.position.copy(startNode.position);
    cfg.scene.add(this.root);
    this.buildPlaceholderMesh();

    cfg.bus.on("noise", (e) => this.onNoiseHeard(e.position, e.loudness));
    cfg.bus.on("power-toggled", ({ on }) => {
      if (!on) this.onPowerCut();
    });
    cfg.bus.on("memory-flag", ({ flag }) => cfg.memory.setFlag(flag));
  }

  private mesh!: THREE.Group;

  private buildPlaceholderMesh(): void {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2b2b33, roughness: 0.85 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xac8868, roughness: 0.9 });

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.75, 4, 8), bodyMat);
    torso.position.y = 1.05;
    torso.castShadow = true;
    group.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 12), skinMat);
    head.position.y = 1.62;
    head.castShadow = true;
    group.add(head);

    const eyeGeo = new THREE.SphereGeometry(0.03, 6, 6);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(side * 0.07, 1.64, -0.16);
      group.add(eye);
    }

    this.root.add(group);
    this.mesh = group;
  }

  getState(): AIState {
    return this.state;
  }

  /**
   * Called at the exact moment the player commits to hiding. If Elias
   * currently has line of sight to that spot, he has witnessed it and will
   * check it during his next SEARCH - hiding is a gamble, not a free pass.
   */
  witnessHideAttempt(spotPosition: THREE.Vector3): boolean {
    const eyePos = this.root.position.clone().add(new THREE.Vector3(0, EYE_HEIGHT, 0));
    const forward = new THREE.Vector3(Math.sin(this.facingAngle), 0, Math.cos(this.facingAngle));
    return this.vision.canSee({
      eyePosition: eyePos,
      forward,
      fovRadians: FOV_RADIANS,
      maxRange: VISION_RANGE,
      targetPosition: spotPosition,
      targetIsCrouching: false,
      lightLevelAtTarget: this.cfg.getLightLevelAt(spotPosition),
    });
  }

  getPosition(): THREE.Vector3 {
    return this.root.position.clone();
  }

  getFacingAngle(): number {
    return this.facingAngle;
  }

  private setState(next: AIState): void {
    if (this.state === next) return;
    this.state = next;
    this.stateTimer = 0;
    this.cfg.bus.emit("ai-state-changed", { state: next });
  }

  // ---------------------------------------------------------------- hearing
  private onNoiseHeard(position: THREE.Vector3, loudness: number): void {
    if (this.state === "CHASE") return; // Fully committed to the chase already.
    const distance = this.root.position.distanceTo(position);
    const sleepPenalty = this.state === "SLEEP" ? 0.4 : 1.0;
    const effectiveRadius = loudness * sleepPenalty;

    let heard = false;
    if (distance <= effectiveRadius) heard = true;
    else if (distance <= effectiveRadius * 1.6) {
      const chance = 1 - (distance - effectiveRadius) / (effectiveRadius * 0.6);
      heard = Math.random() < Math.max(0, chance);
    }
    if (!heard) return;

    this.investigateTarget = position.clone();
    this.forcedInvestigate = false;
    this.setState("INVESTIGATE");
    this.currentPath = [];
  }

  private onPowerCut(): void {
    this.cfg.bus.emit("memory-flag", { flag: "playerDisabledPower" });
    if (this.state === "CHASE" || this.state === "SLEEP") return;
    this.investigateTarget = this.cfg.breakerBoxPosition.clone();
    this.forcedInvestigate = true;
    this.setState("INVESTIGATE");
    this.currentPath = [];
  }

  // ----------------------------------------------------------------- update
  update(dt: number): void {
    this.stateTimer += dt;

    const playerPos = this.cfg.player.getPosition();
    const eyePos = this.root.position.clone().add(new THREE.Vector3(0, EYE_HEIGHT, 0));
    const forward = new THREE.Vector3(Math.sin(this.facingAngle), 0, Math.cos(this.facingAngle));

    const canSee = this.vision.canSee({
      eyePosition: eyePos,
      forward,
      fovRadians: FOV_RADIANS,
      maxRange: VISION_RANGE,
      targetPosition: playerPos.clone().add(new THREE.Vector3(0, 0.9, 0)),
      targetIsCrouching: this.cfg.player.isCrouching(),
      lightLevelAtTarget: this.cfg.getLightLevelAt(playerPos),
    });

    if (canSee) {
      this.timeSinceLastSeen = 0;
      this.lastKnownPlayerPos = playerPos.clone();
      if (this.state !== "CHASE") {
        this.cfg.bus.emit("player-spotted", { distance: eyePos.distanceTo(playerPos) });
        this.setState("CHASE");
        this.currentPath = [];
      }
    } else if (this.state === "CHASE") {
      this.timeSinceLastSeen += dt;
      if (this.timeSinceLastSeen > LOSE_SIGHT_TIME) {
        this.cfg.bus.emit("player-lost", {});
        this.beginSearch();
      }
    }

    switch (this.state) {
      case "CHASE":
        this.updateChase(dt, playerPos);
        break;
      case "INVESTIGATE":
        this.updateInvestigate(dt);
        break;
      case "SEARCH":
        this.updateSearch(dt);
        break;
      case "CHECK_HIDING_PLACE":
        this.updateCheckHiding(dt);
        break;
      case "RETURN_TO_ROUTINE":
        this.updateReturnToRoutine(dt);
        break;
      default:
        this.updateRoutine(dt);
        break;
    }

    this.autoOpenNearbyDoors();
  }

  // ------------------------------------------------------------------ chase
  private updateChase(dt: number, playerPos: THREE.Vector3): void {
    this.moveToward(playerPos, CHASE_SPEED, dt);
    if (this.root.position.distanceTo(playerPos) <= CAPTURE_RADIUS) {
      this.cfg.bus.emit("player-caught", {});
    }
  }

  // ------------------------------------------------------------ investigate
  private updateInvestigate(dt: number): void {
    if (!this.investigateTarget) {
      this.setState("RETURN_TO_ROUTINE");
      return;
    }
    if (this.currentPath.length === 0) {
      this.currentPath = this.cfg.navGraph.pathBetweenPositions(this.root.position, this.investigateTarget);
      this.pathIndex = 0;
    }
    const arrived = this.advancePath(dt, INVESTIGATE_SPEED);
    if (arrived) {
      // Look around briefly, then give up unless the investigate was forced (power cut).
      if (this.stateTimer > 2.2) {
        this.investigateTarget = null;
        this.setState(this.forcedInvestigate ? "RETURN_TO_ROUTINE" : "RETURN_TO_ROUTINE");
      } else {
        this.facingAngle += dt * 1.1;
      }
    }
  }

  // ----------------------------------------------------------------- search
  private beginSearch(): void {
    if (!this.lastKnownPlayerPos) {
      this.setState("RETURN_TO_ROUTINE");
      return;
    }
    const center = this.lastKnownPlayerPos;
    const points: THREE.Vector3[] = [center.clone()];
    const spotIds: (string | null)[] = [null];
    for (const spot of this.cfg.hiding.all()) {
      if (spot.interiorPosition.distanceTo(center) < 6) {
        points.push(spot.exitPosition.clone());
        spotIds.push(spot.id);
      }
    }
    this.searchQueue = points;
    this.searchSpotIds = spotIds;
    this.currentPath = [];
    this.setState("SEARCH");
  }

  private updateSearch(dt: number): void {
    if (this.searchQueue.length === 0) {
      this.setState("RETURN_TO_ROUTINE");
      return;
    }
    const targetIdx = 0;
    const target = this.searchQueue[targetIdx];
    if (this.currentPath.length === 0) {
      this.currentPath = this.cfg.navGraph.pathBetweenPositions(this.root.position, target);
      this.pathIndex = 0;
    }
    const arrived = this.advancePath(dt, SEARCH_SPEED);
    if (arrived) {
      const spotId = this.searchSpotIds[targetIdx];
      if (spotId && this.cfg.hiding.isCompromised(spotId)) {
        if (this.cfg.hiding.getActiveSpotId() === spotId) {
          this.cfg.bus.emit("player-caught", {});
          this.searchQueue = [];
          return;
        }
        this.cfg.hiding.clearCompromised(spotId);
      }
      this.searchQueue.shift();
      this.searchSpotIds.shift();
      this.currentPath = [];
      if (this.searchQueue.length === 0) this.setState("RETURN_TO_ROUTINE");
    }
  }

  private updateCheckHiding(dt: number): void {
    // Reserved for a dedicated "peering into one specific spot" animation beat;
    // current vertical slice folds this into updateSearch's arrival check.
    this.updateSearch(dt);
  }

  // -------------------------------------------------------- return/routine
  private updateReturnToRoutine(dt: number): void {
    const phase = this.cfg.schedule.getPhaseAtHour(this.cfg.getDayHour());
    const nodeId = this.cfg.schedule.pickRandomNode(phase);
    const node = this.cfg.navGraph.get(nodeId);
    if (!node) {
      this.setState("IDLE");
      return;
    }
    if (this.currentPath.length === 0) {
      this.currentPath = this.cfg.navGraph.pathBetweenPositions(this.root.position, node.position);
      this.pathIndex = 0;
      this.currentDwellNode = nodeId;
    }
    const arrived = this.advancePath(dt, PATROL_SPEED);
    if (arrived) {
      this.dwellTimer = 4 + Math.random() * 6;
      this.setState(this.activityToState(phase.activity));
    }
  }

  private updateRoutine(dt: number): void {
    const phase = this.cfg.schedule.getPhaseAtHour(this.cfg.getDayHour());
    const expectedState = this.activityToState(phase.activity);

    if (this.currentPath.length > 0) {
      const arrived = this.advancePath(dt, PATROL_SPEED);
      if (arrived) {
        this.dwellTimer = 4 + Math.random() * 6;
      }
      return;
    }

    this.dwellTimer -= dt;
    if (this.dwellTimer <= 0 || this.state !== expectedState) {
      const nodeId = this.pickNextRoutineNode(phase);
      const node = this.cfg.navGraph.get(nodeId);
      if (node) {
        this.currentPath = this.cfg.navGraph.pathBetweenPositions(this.root.position, node.position);
        this.pathIndex = 0;
        this.currentDwellNode = nodeId;
      }
      this.setState(expectedState);
    } else {
      // Idle facing drift while dwelling, so standing still doesn't look frozen.
      this.facingAngle += Math.sin(this.stateTimer * 0.4) * dt * 0.15;
    }
  }

  /**
   * Normally delegates straight to ScheduleSystem, but if the player has
   * been repeatedly witnessed doing something (memory flags), occasionally
   * substitutes a "watch" node near that behavior during patrol - never
   * targeting the player directly, only a fixed location tied to the flag.
   */
  private pickNextRoutineNode(phase: SchedulePhase): string {
    if (phase.activity === "patrol" && this.cfg.flagWatchNodes) {
      const candidates: string[] = [];
      for (const [flag, nodes] of Object.entries(this.cfg.flagWatchNodes) as [MemoryFlag, string[]][]) {
        if (this.cfg.memory.hasFlag(flag)) candidates.push(...nodes);
      }
      if (candidates.length > 0 && Math.random() < 0.35) {
        return candidates[Math.floor(Math.random() * candidates.length)];
      }
    }
    return this.cfg.schedule.pickRandomNode(phase, this.currentDwellNode ?? undefined);
  }

  private activityToState(activity: ScheduleActivity): AIState {
    switch (activity) {
      case "work":
        return "WORK";
      case "eat":
        return "EAT";
      case "sleep":
        return "SLEEP";
      default:
        return "PATROL";
    }
  }

  // ------------------------------------------------------------- movement
  /** Advances along currentPath. Returns true once the final waypoint is reached. */
  private advancePath(dt: number, speed: number): boolean {
    if (this.pathIndex >= this.currentPath.length) return true;
    const target = this.currentPath[this.pathIndex];
    const reached = this.moveToward(target, speed, dt);
    if (reached) {
      this.pathIndex++;
      if (this.pathIndex >= this.currentPath.length) {
        this.currentPath = [];
        this.pathIndex = 0;
        return true;
      }
    }
    return false;
  }

  /** Moves the root toward `target` on the XZ plane. Returns true if arrived this frame. */
  private moveToward(target: THREE.Vector3, speed: number, dt: number): boolean {
    const flatTarget = new THREE.Vector3(target.x, this.root.position.y, target.z);
    const toTarget = flatTarget.clone().sub(this.root.position);
    const distance = toTarget.length();
    if (distance < WAYPOINT_EPSILON) return true;

    const step = Math.min(distance, speed * dt);
    const dir = toTarget.normalize();
    this.root.position.addScaledVector(dir, step);

    this.facingAngle = Math.atan2(dir.x, dir.z);
    this.mesh.rotation.y = this.facingAngle;
    return distance - step < WAYPOINT_EPSILON;
  }

  private autoOpenNearbyDoors(): void {
    for (const door of this.cfg.doors.all()) {
      if (door.locked || door.isOpen) continue;
      const worldPos = new THREE.Vector3();
      door.pivot.getWorldPosition(worldPos);
      if (this.root.position.distanceTo(worldPos) < DOOR_AUTO_OPEN_RADIUS) {
        this.cfg.doors.toggle(door.id);
      }
    }
  }

  serialize(): { position: [number, number, number]; state: AIState } {
    return {
      position: [this.root.position.x, this.root.position.y, this.root.position.z],
      state: this.state,
    };
  }
}
