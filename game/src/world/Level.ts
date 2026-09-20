import * as THREE from "three";
import { StructureBuilder } from "./StructureBuilder";
import { DoorSystem } from "../systems/DoorSystem";
import { LockSystem } from "../systems/LockSystem";
import { HidingSystem } from "../systems/HidingSystem";
import { NoiseSystem } from "../systems/NoiseSystem";
import { InventorySystem } from "../systems/InventorySystem";
import { ItemSystem } from "../items/ItemSystem";
import { NavGraph } from "../ai/NavGraph";
import { ScheduleSystem } from "../ai/ScheduleSystem";
import { MemorySystem } from "../ai/MemorySystem";
import { EnemyAI } from "../ai/EnemyAI";
import { PowerSystem } from "../puzzle/PowerSystem";
import { BreakableWindow } from "./BreakableWindow";
import { DayNightCycle } from "./DayNightCycle";
import { PlayerController } from "../player/PlayerController";
import { EventBus } from "../core/EventBus";
import type { GameEventMap } from "../core/GameEvents";
import { PhysicsWorld } from "../physics/PhysicsWorld";

interface Lamp {
  position: THREE.Vector3;
  radius: number;
  intensity: number;
}

/**
 * Builds the entire vertical-slice map: the street, the player's small
 * house, and Elias Voss's house (floor 1, a partial floor 2, basement, and
 * the secret room behind the basement's locked metal door). Also wires up
 * every door/lock/item/hiding-spot instance and Elias's own AI.
 */
export class Level {
  readonly doors: DoorSystem;
  readonly locks: LockSystem;
  readonly hiding: HidingSystem;
  readonly items: ItemSystem;
  readonly navGraph = new NavGraph();
  readonly memory = new MemorySystem();
  enemyAI!: EnemyAI;
  power!: PowerSystem;
  garageWindow!: BreakableWindow;

  readonly playerHouseSpawn = new THREE.Vector3(0, 0.5, 10);
  readonly eliasHouseFrontYard = new THREE.Vector3(0, 0.5, -3);

  private readonly structure: StructureBuilder;
  private readonly lamps: Lamp[] = [];

  constructor(
    private readonly scene: THREE.Scene,
    private readonly physics: PhysicsWorld,
    private readonly noise: NoiseSystem,
    private readonly bus: EventBus<GameEventMap>,
    private readonly inventory: InventorySystem,
    private readonly player: PlayerController,
    private readonly dayNight: DayNightCycle,
  ) {
    this.structure = new StructureBuilder(scene, physics);
    this.doors = new DoorSystem(scene, physics, noise, bus);
    this.locks = new LockSystem(this.doors, inventory, bus);
    this.hiding = new HidingSystem();
    this.items = new ItemSystem(scene, physics, player.camera, noise, bus);

    this.buildGround();
    this.buildPlayerHouse();
    this.buildEliasFloor1();
    this.buildEliasFloor2();
    this.buildBasementAndSecretRoom();
    this.buildNavGraph();
    this.spawnItemsAndPuzzles();
    this.setupEnemyAI();
  }

  // ------------------------------------------------------------- exterior
  private buildGround(): void {
    const groundGeo = new THREE.PlaneGeometry(140, 140);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x3a4a34, roughness: 1 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.structure.floor(-70, 70, -70, 70, 0, 0x3a4a34, 0.4);

    const roadGeo = new THREE.PlaneGeometry(140, 7);
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.95 });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.01;
    road.receiveShadow = true;
    this.scene.add(road);

    // A couple of streetlamps for night-time atmosphere and light/dark contrast.
    for (const x of [-18, 0, 18]) {
      const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 4, 8);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(x, 2, 3.6);
      pole.castShadow = true;
      this.scene.add(pole);
      const bulb = new THREE.PointLight(0xffd9a0, 0.9, 14, 2);
      bulb.position.set(x, 4, 3.6);
      this.scene.add(bulb);
      this.lamps.push({ position: bulb.position.clone(), radius: 14, intensity: 0.9 });
    }
  }

  private buildPlayerHouse(): void {
    const s = this.structure;
    s.floor(-6, 6, 6, 14, 0, 0x8a7a5c);
    s.ceiling(-6, 6, 6, 14, 3, 0x9a9184);
    s.wall({ axis: "x", at: 6, from: -6, to: 6, baseY: 0, height: 3, opening: { center: 0, width: 1.4, height: 2.2 }, color: 0xcbb894 });
    s.wall({ axis: "x", at: 14, from: -6, to: 6, baseY: 0, height: 3, color: 0xcbb894 });
    s.wall({ axis: "z", at: -6, from: 6, to: 14, baseY: 0, height: 3, color: 0xcbb894 });
    s.wall({ axis: "z", at: 6, from: 6, to: 14, baseY: 0, height: 3, color: 0xcbb894 });

    const doorMesh = this.doors.create({
      id: "player-house-door",
      hingePosition: new THREE.Vector3(-0.7, 0, 6),
      width: 1.4,
      height: 2.2,
      color: 0x5c4632,
    });
    void doorMesh;

    const lamp = this.structure.pointLight(new THREE.Vector3(0, 2.4, 10), 0xffe2b0, 0.85, 9);
    this.lamps.push({ position: lamp.position.clone(), radius: 9, intensity: 0.85 });

    // A simple bed prop so the room reads as "player's bedroom".
    const bed = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.5, 2.1),
      new THREE.MeshStandardMaterial({ color: 0x6f5b46, roughness: 0.9 }),
    );
    bed.position.set(-4, 0.25, 12.5);
    bed.castShadow = true;
    this.scene.add(bed);
  }

  // ---------------------------------------------------------- Elias floor 1
  private buildEliasFloor1(): void {
    const s = this.structure;

    // Floors.
    s.floor(-8, 8, -13, -6, 0, 0x7d7060); // Living room + kitchen
    s.floor(-6, 0, -20, -13, 0, 0x6b6252); // Hallway
    s.floor(-8, -6, -20, -13, 0, 0x6b6252); // Stair-up shaft base
    s.floor(2, 8, -20, -13, 0, 0x5c5648); // Garage
    s.floor(0, 2, -14, -13, 0, 0x6b6252); // Basement-shaft cap (north)
    s.floor(0, 2, -20, -18, 0, 0x6b6252); // Basement-shaft cap (south) — gap -18..-14 is the stairwell opening

    // Ceilings / floor-2 sub-floor / roof caps at y=3.
    s.ceiling(-8, 0, -13, -6, 3, 0x9a9184); // Living room ceiling -> Bedroom floor
    s.ceiling(0, 8, -13, -6, 3, 0x8b8272); // Kitchen roof cap (no floor 2 above kitchen)
    s.ceiling(-6, 0, -20, -13, 3, 0x9a9184); // Hallway ceiling -> Landing floor
    s.ceiling(0, 2, -20, -13, 3, 0x9a9184); // Basement-shaft ceiling -> Workshop floor portion
    s.ceiling(2, 8, -20, -13, 3, 0x9a9184); // Garage ceiling -> Workshop/Locked Room floor portion
    // Stair-up shaft (-8..-6, -20..-13) intentionally left open to floor 2.

    const wallColor = 0xc9bfa8;
    // Front wall (street-facing), locked front door - Elias never uses it.
    s.wall({ axis: "x", at: -6, from: -8, to: 8, baseY: 0, height: 3, color: wallColor, opening: { center: 0, width: 2, height: 2.3 } });
    // Back wall, split for back door + garage door.
    s.wall({ axis: "x", at: -20, from: -8, to: -2, baseY: 0, height: 3, color: wallColor, opening: { center: -4.4, width: 1.2, height: 2.1 } });
    s.wall({ axis: "x", at: -20, from: -2, to: 2, baseY: 0, height: 3, color: wallColor });
    s.wall({ axis: "x", at: -20, from: 2, to: 8, baseY: 0, height: 3, color: wallColor, opening: { center: 4, width: 4, height: 2.4 } });
    // West exterior wall.
    s.wall({ axis: "z", at: -8, from: -20, to: -6, baseY: 0, height: 3, color: wallColor });
    // East exterior wall, with the garage's breakable window.
    s.wall({ axis: "z", at: 8, from: -20, to: -6, baseY: 0, height: 3, color: wallColor, opening: { center: -16.5, width: 1.6, height: 1.4, sill: 1.0 } });
    // Living room <-> kitchen archway.
    s.wall({ axis: "z", at: 0, from: -13, to: -6, baseY: 0, height: 3, color: wallColor, opening: { center: -9.75, width: 1.5, height: 2.2 } });
    // Hallway <-> basement-shaft doorway.
    s.wall({ axis: "z", at: 0, from: -20, to: -13, baseY: 0, height: 3, color: wallColor, opening: { center: -14, width: 1.2, height: 2.2 } });
    // Stair-up shaft <-> hallway archway.
    s.wall({ axis: "z", at: -6, from: -20, to: -13, baseY: 0, height: 3, color: wallColor, opening: { center: -14, width: 1.2, height: 2.2 } });
    // Living room <-> hallway archway.
    s.wall({ axis: "x", at: -13, from: -8, to: 0, baseY: 0, height: 3, color: wallColor, opening: { center: -4.25, width: 1.5, height: 2.2 } });
    // Kitchen <-> garage divider (solid - garage only reachable via the window).
    s.wall({ axis: "x", at: -13, from: 0, to: 8, baseY: 0, height: 3, color: wallColor });
    // Basement-shaft <-> garage divider (solid).
    s.wall({ axis: "z", at: 2, from: -20, to: -13, baseY: 0, height: 3, color: wallColor });

    this.doors.create({ id: "front-door", hingePosition: new THREE.Vector3(-1, 0, -6), width: 2, height: 2.3, color: 0x3a2e22, locked: true });
    this.doors.create({ id: "back-door", hingePosition: new THREE.Vector3(-5, 0, -20), width: 1.2, height: 2.1, color: 0x5c4632 });
    this.doors.create({ id: "garage-door", hingePosition: new THREE.Vector3(2, 0, -20), width: 4, height: 2.4, color: 0x40403f, locked: true });
    this.doors.create({ id: "basement-shaft-door", hingePosition: new THREE.Vector3(0, 0, -14.6), width: 1.2, height: 2.2, color: 0x5c4632, axis: "z" });

    this.locks.register({ id: "lock-front-door", doorId: "front-door", kind: "key", requiredItem: undefined });

    // Ramp up to floor 2, inside the stair shaft.
    s.rampAlongZ(-7, -13.5, -19, 0, 3, 1.8);
    // Landing cap at the top of that ramp.
    s.ceiling(-8, -6, -20, -19, 3, 0x9a9184);

    // Ramp down to the basement, inside the basement shaft column.
    s.rampAlongZ(1, -14, -18, 0, -2.8, 1.7, 0x4c473c);

    // Ambient lamps - kitchen and living room are warm/safe; hallway dimmer.
    this.addLamp(new THREE.Vector3(-4, 2.6, -9), 0xffdca8, 0.7, 8);
    this.addLamp(new THREE.Vector3(4, 2.6, -9), 0xffdca8, 0.75, 8);
    this.addLamp(new THREE.Vector3(-3, 2.6, -17), 0xd8c9a8, 0.35, 6);

    // Breaker box on the garage's back wall - dead until the fuse is found and installed.
    const breakerMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.7, 0.15),
      new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.6, metalness: 0.4 }),
    );
    breakerMesh.position.set(5, 1.3, -19.85);
    this.scene.add(breakerMesh);
    this.power = new PowerSystem(breakerMesh, this.inventory, this.noise, this.bus);

    this.garageWindow = new BreakableWindow(
      new THREE.Vector3(8, 1.7, -16.5),
      1.6,
      1.4,
      0.15,
      this.scene,
      this.physics,
      this.noise,
      this.bus,
    );
  }

  // ---------------------------------------------------------- Elias floor 2
  private buildEliasFloor2(): void {
    const s = this.structure;
    const wallColor = 0xb8ab90;

    s.wall({ axis: "x", at: -6, from: -8, to: 0, baseY: 3, height: 3, color: wallColor }); // Bedroom front (no balcony yet)
    s.wall({ axis: "z", at: -8, from: -13, to: -6, baseY: 3, height: 3, color: wallColor }); // Bedroom west
    s.wall({ axis: "x", at: -13, from: -8, to: 0, baseY: 3, height: 3, color: wallColor, opening: { center: -4, width: 1.6, height: 2.2 } }); // Bedroom <-> Landing
    s.wall({ axis: "z", at: -6, from: -20, to: -13, baseY: 3, height: 3, color: wallColor, opening: { center: -19.5, width: 1.2, height: 2.2 } }); // Landing <-> stair top
    s.wall({ axis: "x", at: -20, from: -8, to: 8, baseY: 3, height: 3, color: wallColor }); // Back exterior (Landing/Workshop/Locked Room)
    s.wall({ axis: "z", at: 0, from: -16.5, to: -13, baseY: 3, height: 3, color: wallColor, opening: { center: -14.75, width: 1.2, height: 2.2 } }); // Landing <-> Workshop (electronic)
    s.wall({ axis: "z", at: 0, from: -20, to: -16.5, baseY: 3, height: 3, color: wallColor, opening: { center: -18.25, width: 1.2, height: 2.2 } }); // Landing <-> Locked Room (key)
    s.wall({ axis: "x", at: -16.5, from: 0, to: 8, baseY: 3, height: 3, color: wallColor }); // Workshop <-> Locked Room divider
    s.wall({ axis: "x", at: -13, from: 0, to: 8, baseY: 3, height: 3, color: wallColor }); // Workshop north (over kitchen roof)
    s.wall({ axis: "z", at: 8, from: -16.5, to: -13, baseY: 3, height: 3, color: wallColor }); // Workshop east
    s.wall({ axis: "z", at: 8, from: -20, to: -16.5, baseY: 3, height: 3, color: wallColor, opening: { center: -18.25, width: 1.2, height: 2.2 } }); // Locked Room east -> secret nook

    // Roofs.
    s.ceiling(-8, 0, -13, -6, 6, 0x847a66); // Bedroom
    s.ceiling(-8, -6, -20, -13, 6, 0x847a66); // Stairwell atrium
    s.ceiling(-6, 0, -20, -13, 6, 0x847a66); // Landing
    s.ceiling(0, 8, -16.5, -13, 6, 0x847a66); // Workshop
    s.ceiling(0, 8, -20, -16.5, 6, 0x847a66); // Locked Room

    this.doors.create({ id: "workshop-door", hingePosition: new THREE.Vector3(0, 3, -15.35), width: 1.2, height: 2.2, color: 0x4a4a4a, locked: true, axis: "z" });
    this.doors.create({ id: "locked-room-door", hingePosition: new THREE.Vector3(0, 3, -18.85), width: 1.2, height: 2.2, color: 0x5c4632, locked: true, axis: "z" });
    this.locks.register({ id: "lock-workshop", doorId: "workshop-door", kind: "electronic" });
    this.locks.register({ id: "lock-locked-room", doorId: "locked-room-door", kind: "key", requiredItem: "key_workshop" });

    // Bedroom closet (hiding spot).
    s.wall({ axis: "x", at: -7, from: -8, to: -6.6, baseY: 3, height: 3, color: wallColor });
    s.wall({ axis: "x", at: -9, from: -8, to: -6.6, baseY: 3, height: 3, color: wallColor });
    s.wall({ axis: "z", at: -6.6, from: -9, to: -7, baseY: 3, height: 3, color: wallColor, opening: { center: -8, width: 1.0, height: 2.0 } });
    const closetDoor = this.doors.create({ id: "closet-door", hingePosition: new THREE.Vector3(-6.6, 3, -8.5), width: 1.0, height: 2.0, color: 0x6b563d, axis: "z" });
    void closetDoor;
    const closetInterior = new THREE.Vector3(-7.6, 3, -8);
    const closetMarker = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), new THREE.MeshBasicMaterial({ visible: false }));
    closetMarker.position.set(-6.6, 3.5, -8);
    this.scene.add(closetMarker);
    this.hiding.register({
      id: "bedroom-closet",
      name: "Closet",
      interiorPosition: new THREE.Vector3(closetInterior.x, 3 + this.player.getEyeHeight(), closetInterior.z),
      exitPosition: new THREE.Vector3(-6.0, 3, -8),
      peekYawLimit: THREE.MathUtils.degToRad(35),
      mesh: closetMarker,
    });

    // Secret nook off the Locked Room, behind a "bookshelf" panel door.
    s.floor(8, 9.4, -19, -17.5, 3, 0x4a3f33);
    s.ceiling(8, 9.4, -19, -17.5, 6, 0x4a3f33);
    s.wall({ axis: "x", at: -17.5, from: 8, to: 9.4, baseY: 3, height: 3, color: 0x4a3f33 });
    s.wall({ axis: "x", at: -19, from: 8, to: 9.4, baseY: 3, height: 3, color: 0x4a3f33 });
    s.wall({ axis: "z", at: 9.4, from: -19, to: -17.5, baseY: 3, height: 3, color: 0x4a3f33 });
    this.doors.create({
      id: "secret-bookshelf",
      hingePosition: new THREE.Vector3(8, 3, -18.85),
      width: 1.2,
      height: 2.2,
      color: 0x5a4326,
      axis: "z",
    });

    // Bed + table props to sell the room reads.
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 2.1), new THREE.MeshStandardMaterial({ color: 0x4a4030 }));
    bed.position.set(-2, 3.25, -11);
    bed.castShadow = true;
    this.scene.add(bed);
    const table = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.7), new THREE.MeshStandardMaterial({ color: 0x5a4a35 }));
    table.position.set(5.5, 3.4, -14.5);
    table.castShadow = true;
    this.scene.add(table);

    this.addLamp(new THREE.Vector3(-4, 5.6, -9), 0xffe0b0, 0.5, 7);
    this.addLamp(new THREE.Vector3(4.5, 5.6, -18), 0xd8d0c0, 0.4, 6);
  }

  // -------------------------------------------------- Basement + secret room
  private buildBasementAndSecretRoom(): void {
    const s = this.structure;
    const basementY = -2.8;
    const wallColor = 0x3a362e;

    s.floor(-8, 8, -20, -13, basementY, 0x2c2a24);
    s.wall({ axis: "x", at: -13, from: -8, to: 8, baseY: basementY, height: 2.8, color: wallColor });
    s.wall({ axis: "x", at: -20, from: -8, to: -6, baseY: basementY, height: 2.8, color: wallColor });
    s.wall({ axis: "x", at: -20, from: 6, to: 8, baseY: basementY, height: 2.8, color: wallColor });
    s.wall({ axis: "x", at: -20, from: -6, to: 6, baseY: basementY, height: 2.8, color: wallColor, opening: { center: -4, width: 1.6, height: 2.3 } });
    s.wall({ axis: "z", at: -8, from: -20, to: -13, baseY: basementY, height: 2.8, color: wallColor });
    s.wall({ axis: "z", at: 8, from: -20, to: -13, baseY: basementY, height: 2.8, color: wallColor });

    this.doors.create({ id: "metal-door", hingePosition: new THREE.Vector3(-4.8, basementY, -20), width: 1.6, height: 2.3, color: 0x2f3236, locked: true });
    this.locks.register({ id: "lock-metal-door", doorId: "metal-door", kind: "key", requiredItem: "key_basement" });

    this.addLamp(new THREE.Vector3(-2, basementY + 2.2, -15), 0xc9b98a, 0.4, 7);
    this.addLamp(new THREE.Vector3(4, basementY + 2.2, -17), 0xc9b98a, 0.35, 6);

    // Clutter props to sell "old storage".
    const crate1 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), new THREE.MeshStandardMaterial({ color: 0x5c4a34 }));
    crate1.position.set(6, basementY + 0.35, -14.5);
    crate1.castShadow = true;
    this.scene.add(crate1);
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(2, 1.8, 0.4), new THREE.MeshStandardMaterial({ color: 0x40382c }));
    shelf.position.set(-6.5, basementY + 0.9, -14);
    shelf.castShadow = true;
    this.scene.add(shelf);

    // Secret final room, beyond the metal door - cold, sparse, unsettling.
    const secretY = basementY;
    s.floor(-4, 4, -24, -20, secretY, 0x1f2630);
    s.wall({ axis: "x", at: -24, from: -4, to: 4, baseY: secretY, height: 2.8, color: 0x232b36 });
    s.wall({ axis: "z", at: -4, from: -24, to: -20, baseY: secretY, height: 2.8, color: 0x232b36 });
    s.wall({ axis: "z", at: 4, from: -24, to: -20, baseY: secretY, height: 2.8, color: 0x232b36 });
    s.ceiling(-4, 4, -24, -20, secretY + 2.8, 0x1c222b);

    const coldLight = this.structure.pointLight(new THREE.Vector3(0, secretY + 2.2, -22), 0x6fa7d8, 0.9, 8);
    this.lamps.push({ position: coldLight.position.clone(), radius: 8, intensity: 0.5 });

    const container = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 1.8, 1.6),
      new THREE.MeshStandardMaterial({ color: 0x2e3a3e, roughness: 0.4, metalness: 0.7 }),
    );
    container.position.set(-1, secretY + 0.9, -22.5);
    container.castShadow = true;
    this.scene.add(container);

    const container2 = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 1.4, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x2e3a3e, roughness: 0.4, metalness: 0.7 }),
    );
    container2.position.set(1.6, secretY + 0.7, -21.2);
    container2.castShadow = true;
    this.scene.add(container2);
  }

  private addLamp(position: THREE.Vector3, color: number, intensity: number, radius: number): void {
    this.structure.pointLight(position, color, intensity, radius);
    this.lamps.push({ position: position.clone(), radius, intensity });
  }

  // ------------------------------------------------------------- nav graph
  private buildNavGraph(): void {
    const g = this.navGraph;
    const n = (id: string, x: number, y: number, z: number) => g.addNode(id, new THREE.Vector3(x, y, z));

    n("living-room", -4, 0, -9.5);
    n("kitchen", 4, 0, -9.5);
    n("lr-kitchen-door", 0, 0, -9.75);
    n("lr-hallway-door", -4.25, 0, -13);
    n("hallway", -3, 0, -16.5);
    n("hallway-shaft-door", -6, 0, -14);
    n("stair-base", -7, 0, -14.5);
    n("stair-top", -7, 3, -19.5);
    n("hallway-basement-door", 0, 0, -14);
    n("basement-shaft-top", 1, 0, -14.5);
    n("basement-floor", 1, -2.8, -16.5);
    n("basement-main", -2, -2.8, -16.5);
    n("metal-door-front", -4.8, -2.8, -20.5);

    n("landing", -3, 3, -16.5);
    n("bedroom", -4, 3, -9.5);
    n("closet-front", -6.0, 3, -8);
    n("workshop-door-n", 0.6, 3, -14.5);
    n("workshop", 4, 3, -14.5);
    n("locked-room-door-n", 0.6, 3, -18);
    n("locked-room", 4, 3, -18);

    n("garage-window", 7, 0, -16.5);
    n("garage", 5, 0, -16.5);
    n("breaker", 5, 0, -19);

    g.connect("living-room", "lr-kitchen-door");
    g.connect("lr-kitchen-door", "kitchen");
    g.connect("living-room", "lr-hallway-door");
    g.connect("lr-hallway-door", "hallway");
    g.connect("hallway", "hallway-shaft-door");
    g.connect("hallway-shaft-door", "stair-base");
    g.connect("stair-base", "stair-top");
    g.connect("stair-top", "landing");
    g.connect("hallway", "hallway-basement-door");
    g.connect("hallway-basement-door", "basement-shaft-top");
    g.connect("basement-shaft-top", "basement-floor");
    g.connect("basement-floor", "basement-main");
    g.connect("basement-main", "metal-door-front");
    g.connect("landing", "bedroom");
    g.connect("bedroom", "closet-front");
    g.connect("landing", "workshop-door-n");
    g.connect("workshop-door-n", "workshop");
    g.connect("landing", "locked-room-door-n");
    g.connect("locked-room-door-n", "locked-room");
    g.connect("garage", "garage-window");
    g.connect("garage", "breaker");
    // Garage intentionally has no edge to the rest of the house - it's only
    // reachable through the window, and NavGraph.pathBetweenPositions falls
    // back to the nearest reachable node instead of clipping through walls.
  }

  // ----------------------------------------------------------- items/puzzle
  private spawnItemsAndPuzzles(): void {
    // Items are spawned resting just above their floor (floor1=y0, floor2=y3,
    // basement=y-2.8) so they don't visibly drop far when physics kicks in.
    this.items.spawn("fuse", new THREE.Vector3(6.2, 0.15, -18.5));
    this.items.spawn("crowbar", new THREE.Vector3(3.5, 0.15, -18));
    this.items.spawn("key_workshop", new THREE.Vector3(4, 3.15, -14.7));
    this.items.spawn("hammer", new THREE.Vector3(4.6, 3.15, -14.3));
    this.items.spawn("screwdriver", new THREE.Vector3(3.4, 3.15, -14.3));
    this.items.spawn("key_basement", new THREE.Vector3(4, 3.15, -18.3));
    this.items.spawn("note_photo", new THREE.Vector3(4.6, 3.15, -18.6));
    this.items.spawn("note_letter", new THREE.Vector3(3.4, 3.15, -18.0));
    this.items.spawn("note_letter", new THREE.Vector3(8.7, 3.15, -18.2));
    this.items.spawn("battery", new THREE.Vector3(-4.3, 0.15, -9.3));
    this.items.spawn("flashlight", new THREE.Vector3(-3.7, 0.15, -9.3));
    this.items.spawn("box", new THREE.Vector3(2.5, 0.3, -3), 0.55);
    this.items.spawn("box", new THREE.Vector3(3.2, 0.3, -3), 0.55);
    this.items.spawn("chair", new THREE.Vector3(-2, 0.28, -9), 0.5);
    this.items.spawn("stone", new THREE.Vector3(1, 0.1, -4), 0.14);
    this.items.spawn("stone", new THREE.Vector3(-1.5, 0.2, -3.5), 0.14);
    this.items.spawn("rope", new THREE.Vector3(6.5, 0.15, -8));
    this.items.spawn("magnet", new THREE.Vector3(-3, 0.15, -18));
  }

  // -------------------------------------------------------------- enemy AI
  private setupEnemyAI(): void {
    const schedule = new ScheduleSystem([
      { name: "Late Night", startHour: 0, endHour: 6, activity: "sleep", locationNodeIds: ["bedroom"] },
      { name: "Morning", startHour: 6, endHour: 11, activity: "patrol", locationNodeIds: ["kitchen", "living-room", "hallway"] },
      { name: "Day", startHour: 11, endHour: 18, activity: "work", locationNodeIds: ["workshop", "locked-room"] },
      { name: "Evening", startHour: 18, endHour: 22, activity: "eat", locationNodeIds: ["kitchen", "living-room"] },
      { name: "Night Watch", startHour: 22, endHour: 24, activity: "patrol", locationNodeIds: ["living-room", "hallway", "kitchen"] },
    ]);

    this.enemyAI = new EnemyAI({
      scene: this.scene,
      navGraph: this.navGraph,
      schedule,
      hiding: this.hiding,
      doors: this.doors,
      bus: this.bus,
      player: this.player,
      getObstructionMeshes: () => [
        ...this.structure.solidMeshes,
        ...this.doors.all().filter((d) => !d.isOpen).map((d) => d.mesh),
        ...(this.garageWindow.isBroken() ? [] : [this.garageWindow.mesh]),
      ],
      getDayHour: () => this.dayNight.getHour(),
      getLightLevelAt: (pos) => this.getLightLevelAt(pos),
      breakerBoxPosition: new THREE.Vector3(5, 1, -19),
      startNodeId: "bedroom",
      memory: this.memory,
      flagWatchNodes: {
        playerFrequentlyUsesBackDoor: ["hallway"],
        playerUsedWindowEntrance: ["garage"],
      },
    });
  }

  getLightLevelAt(position: THREE.Vector3): number {
    let level = this.dayNight.getDaylightFactor() * 0.18;
    for (const lamp of this.lamps) {
      const d = lamp.position.distanceTo(position);
      const contribution = THREE.MathUtils.clamp(lamp.intensity * (1 - d / lamp.radius), 0, 1);
      if (contribution > level) level = contribution;
    }
    return THREE.MathUtils.clamp(level, 0, 1);
  }

  isInSecretRoom(pos: THREE.Vector3): boolean {
    return pos.x > -4 && pos.x < 4 && pos.z > -24 && pos.z < -20 && pos.y < -1;
  }

  /** Roughly "back outside, near the street" - used to detect a successful escape. */
  isOutsideHouse(pos: THREE.Vector3): boolean {
    return pos.z > -4 && pos.y > -1;
  }

  update(dt: number): void {
    this.doors.update(dt);
    this.items.syncMeshesFromPhysics();
    this.enemyAI.update(dt);
  }
}
