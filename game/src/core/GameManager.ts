import * as THREE from "three";
import { EventBus } from "./EventBus";
import type { GameEventMap } from "./GameEvents";
import { InputManager } from "./InputManager";
import { PhysicsWorld } from "../physics/PhysicsWorld";
import { NoiseSystem } from "../systems/NoiseSystem";
import { InventorySystem } from "../systems/InventorySystem";
import { InteractionSystem } from "../systems/InteractionSystem";
import { ObjectiveSystem } from "../systems/ObjectiveSystem";
import { CaptureSystem } from "../systems/CaptureSystem";
import { PuzzleSystem } from "../puzzle/PuzzleSystem";
import { PlayerController } from "../player/PlayerController";
import { DayNightCycle } from "../world/DayNightCycle";
import { Level } from "../world/Level";
import { SaveSystem, type SaveData, type GameSettings } from "../save/SaveSystem";
import { AudioManager } from "../audio/AudioManager";
import { HUD } from "../ui/HUD";
import { MainMenu } from "../ui/MainMenu";
import type { ItemId } from "../items/ItemTypes";

type GameState = "menu" | "playing" | "paused";

const AUTOSAVE_INTERVAL = 20;

export class GameManager {
  private readonly scene = new THREE.Scene();
  private readonly renderer: THREE.WebGLRenderer;
  private readonly physics = new PhysicsWorld();
  private readonly bus = new EventBus<GameEventMap>();
  private readonly input: InputManager;
  private readonly noise: NoiseSystem;
  private readonly inventory: InventorySystem;
  private readonly saveSystem = new SaveSystem();
  private readonly player: PlayerController;
  private readonly dayNight: DayNightCycle;
  private readonly level: Level;
  private readonly interaction: InteractionSystem;
  private readonly objective: ObjectiveSystem;
  private readonly puzzle: PuzzleSystem;
  private readonly capture: CaptureSystem;
  private readonly audio: AudioManager;
  private readonly hud: HUD;
  private readonly menu: MainMenu;

  private state: GameState = "menu";
  private secretFound = false;
  private escaped = false;
  private autosaveTimer = 0;
  private clock = new THREE.Clock();

  constructor(private readonly canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
    this.scene.fog = new THREE.Fog(0x0a0d12, 18, 70);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.resize();

    this.input = new InputManager(canvas);
    this.noise = new NoiseSystem(this.bus);
    this.inventory = new InventorySystem(this.bus);

    const settings = this.saveSystem.loadSettings();

    this.player = new PlayerController(this.input, this.physics, this.noise, new THREE.Vector3(0, 0.6, 10));
    this.player.setHeadbobEnabled(settings.headbob);
    this.input.setSensitivity(settings.sensitivity);
    this.player.camera.fov = settings.fov;
    this.player.camera.updateProjectionMatrix();

    this.dayNight = new DayNightCycle(this.scene);
    this.level = new Level(this.scene, this.physics, this.noise, this.bus, this.inventory, this.player, this.dayNight);

    this.interaction = new InteractionSystem(
      this.player.camera,
      this.scene,
      this.input,
      this.level.items,
      this.inventory,
      this.level.doors,
      this.level.locks,
      this.level.hiding,
      this.bus,
    );

    this.objective = new ObjectiveSystem(this.bus);
    this.puzzle = new PuzzleSystem(this.objective, this.bus);
    this.capture = new CaptureSystem(this.player, this.level.items, this.level.playerHouseSpawn, this.bus);
    this.capture.onBlackoutStart = () => this.hud.showFade(true);
    this.capture.onBlackoutEnd = () => this.hud.showFade(false);

    this.audio = new AudioManager(this.bus, settings);

    this.hud = new HUD(uiRoot, this.inventory, this.bus);
    this.hud.setVisible(false);
    this.hud.setObjectiveText(this.objective.get().description);

    this.menu = new MainMenu(uiRoot, this.saveSystem, {
      onNewGame: () => this.startNewGame(),
      onContinue: () => this.continueGame(),
      onSettingsChanged: (s) => this.applySettings(s),
      onQuit: () => this.menu.showScreen("main"),
    });

    this.bus.on("player-caught", () => this.hud.setDanger(false));
    this.bus.on("ai-state-changed", ({ state }) => this.hud.setDanger(state === "CHASE"));

    this.hud.onPointerLockHintClick(() => {
      if (this.state === "playing") this.input.requestPointerLock();
    });

    window.addEventListener("resize", () => this.resize());
    window.addEventListener("beforeunload", () => {
      if (this.state !== "menu") this.saveGame();
    });
    document.addEventListener("pointerlockchange", () => {
      const locked = this.input.isPointerLocked();
      this.hud.setPointerLockHintVisible(this.state === "playing" && !locked);
    });

    this.menu.show(this.saveSystem.hasSave());
    requestAnimationFrame(() => this.loop());
  }

  private resize(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.player?.camera && (this.player.camera.aspect = window.innerWidth / window.innerHeight);
    this.player?.camera.updateProjectionMatrix();
  }

  private applySettings(settings: GameSettings): void {
    this.player.setHeadbobEnabled(settings.headbob);
    this.input.setSensitivity(settings.sensitivity);
    this.player.camera.fov = settings.fov;
    this.player.camera.updateProjectionMatrix();
    this.audio.applySettings(settings);
    if (settings.fullscreen && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => undefined);
    } else if (!settings.fullscreen && document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
    }
  }

  private startNewGame(): void {
    this.saveSystem.clear();
    this.enterPlaying();
  }

  private continueGame(): void {
    const data = this.saveSystem.load();
    if (data) this.applySave(data);
    this.enterPlaying();
  }

  private enterPlaying(): void {
    this.state = "playing";
    this.menu.hide();
    this.hud.setVisible(true);
    this.audio.start();
    this.input.requestPointerLock();
    this.input.setEnabled(true);
    this.clock.getDelta();
  }

  private pause(): void {
    this.state = "paused";
    this.input.exitPointerLock();
    this.menu.show(this.saveSystem.hasSave());
    this.menu.showScreen("main");
    this.hud.setVisible(false);
  }

  private resume(): void {
    this.state = "playing";
    this.menu.hide();
    this.hud.setVisible(true);
    this.input.requestPointerLock();
  }

  // ------------------------------------------------------------- game loop
  private loop(): void {
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(this.clock.getDelta(), 0.1);

    if (this.state === "playing") {
      if (this.input.wasJustPressed("Escape")) {
        this.pause();
      } else {
        this.updateGameplay(dt);
      }
    } else if (this.state === "paused" && this.input.wasJustPressed("Escape")) {
      this.resume();
    }

    this.input.endFrame();
    this.renderer.render(this.scene, this.player.camera);
  }

  private updateGameplay(dt: number): void {
    this.physics.step(dt);
    this.dayNight.update(dt);
    this.audio.setNightIntensity(this.dayNight.isNight() ? 1 : 0);

    if (!this.level.hiding.isHiding()) {
      this.player.update(dt);
      this.interaction.update();
    } else {
      this.updateHidingInput();
    }

    this.handleInventoryInput();
    this.level.update(dt);

    const hideId = this.interaction.consumeHideRequest();
    if (hideId) this.tryEnterHiding(hideId);

    this.hud.setStamina(this.player.getStamina());
    this.hud.setPrompt(this.level.hiding.isHiding() ? "E — Leave hiding spot" : null);

    this.checkSecretAndEscape();

    this.autosaveTimer += dt;
    if (this.autosaveTimer > AUTOSAVE_INTERVAL) {
      this.autosaveTimer = 0;
      this.saveGame();
    }
  }

  private tryEnterHiding(spotId: string): void {
    const spot = this.level.hiding.get(spotId);
    if (!spot) return;
    const witnessed = this.level.enemyAI.witnessHideAttempt(spot.interiorPosition);
    this.level.hiding.enter(spotId);
    if (witnessed) this.level.hiding.markCompromised(spotId);
    this.player.setFrozen(true);
    this.player.teleport(spot.interiorPosition, this.player.getYaw());
    this.hud.setHiding(true);
  }

  private updateHidingInput(): void {
    if (this.input.wasJustPressed("KeyE")) {
      const spot = this.level.hiding.exit();
      if (spot) {
        this.player.setFrozen(false);
        this.player.teleport(spot.exitPosition, this.player.getYaw());
      }
      this.hud.setHiding(false);
    }
  }

  private handleInventoryInput(): void {
    for (let i = 0; i < 4; i++) {
      if (this.input.wasJustPressed(`Digit${i + 1}`)) this.inventory.setActiveSlot(i);
    }
    const wheel = this.input.consumeWheel();
    if (wheel !== 0) this.inventory.cycleSlot(Math.sign(wheel));

    if (this.input.wasJustPressed("KeyG")) this.level.items.dropHeld();
    if (this.input.consumeMouseDown()) this.level.items.throwHeld();
    if (this.input.wasJustPressed("KeyF")) this.useActiveItem();
  }

  private flashlightOn = false;
  private flashlightSpot: THREE.SpotLight | null = null;

  private useActiveItem(): void {
    const active: ItemId | null = this.inventory.getActiveItem();
    if (active === "flashlight") {
      this.flashlightOn = !this.flashlightOn;
      if (!this.flashlightSpot) {
        this.flashlightSpot = new THREE.SpotLight(0xfff4d6, 90, 18, Math.PI / 7, 0.4, 1.2);
        this.flashlightSpot.castShadow = false;
        this.player.camera.add(this.flashlightSpot);
        this.flashlightSpot.position.set(0, 0, 0);
        this.flashlightSpot.target.position.set(0, 0, -1);
        this.player.camera.add(this.flashlightSpot.target);
      }
      this.flashlightSpot.visible = this.flashlightOn;
      this.bus.emit("notify", { text: this.flashlightOn ? "Flashlight on" : "Flashlight off" });
    }
  }

  private checkSecretAndEscape(): void {
    const pos = this.player.getPosition();
    if (!this.secretFound && this.level.isInSecretRoom(pos)) {
      this.secretFound = true;
      this.bus.emit("secret-found", {});
    }
    if (this.secretFound && this.puzzle.getPhase() === "escape" && !this.escaped && this.level.isOutsideHouse(pos)) {
      this.escaped = true;
      this.bus.emit("notify", { text: "You made it out. For now." });
      this.saveGame();
    }
  }

  // ----------------------------------------------------------------- save
  private saveGame(): void {
    const pos = this.player.getPosition();
    const data: SaveData = {
      version: 1,
      playerPosition: [pos.x, pos.y, pos.z],
      playerYaw: this.player.getYaw(),
      dayHour: this.dayNight.serialize(),
      doors: this.level.doors.serialize(),
      unlockedLocks: this.level.locks.serialize(),
      inventory: this.inventory.serialize(),
      memory: this.level.memory.serialize(),
      power: this.level.power.serialize(),
      windowBroken: this.level.garageWindow.serialize(),
      puzzlePhase: this.puzzle.serialize(),
      objective: this.objective.serialize(),
      secretFound: this.secretFound,
    };
    this.saveSystem.save(data);
  }

  /** Dev-only introspection hook for automated smoke testing - see main.ts. */
  debugGetInternals() {
    return {
      player: this.player,
      level: this.level,
      inventory: this.inventory,
      bus: this.bus,
      puzzle: this.puzzle,
      objective: this.objective,
      interaction: this.interaction,
      input: this.input,
      state: this.state,
      scene: this.scene,
    };
  }

  private applySave(data: SaveData): void {
    this.player.teleport(new THREE.Vector3(...data.playerPosition), data.playerYaw);
    this.dayNight.deserialize(data.dayHour);
    this.level.doors.deserialize(data.doors);
    this.level.locks.deserialize(data.unlockedLocks);
    this.inventory.deserialize(data.inventory as never);
    this.level.memory.deserialize(data.memory as never);
    this.level.power.deserialize(data.power);
    this.level.garageWindow.deserialize(data.windowBroken);
    this.puzzle.deserialize(data.puzzlePhase as never);
    this.objective.deserialize(data.objective);
    this.secretFound = data.secretFound;
  }
}
