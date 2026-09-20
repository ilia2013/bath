import { EventBus } from "../core/EventBus";
import type { GameEventMap } from "../core/GameEvents";
import { ObjectiveSystem } from "../systems/ObjectiveSystem";

type Phase = "get-in" | "explore" | "basement-key-found" | "secret-found" | "escape";

/**
 * The one place that turns "the fuse->power->workshop->key->basement" chain
 * of mechanical unlocks into the vague, non-spoiling objective text the
 * design brief asks for. It owns no mechanics itself - only sequencing.
 */
export class PuzzleSystem {
  private phase: Phase = "get-in";

  constructor(
    private readonly objective: ObjectiveSystem,
    private readonly bus: EventBus<GameEventMap>,
  ) {
    this.objective.set(
      "Get inside the house across the street.",
      "The front door is locked tight. Voss must use another way in - so can you.",
    );

    bus.on("door-state-changed", ({ doorId, open }) => {
      if (open && (doorId === "back-door") && this.phase === "get-in") this.advanceToExplore();
    });
    bus.on("memory-flag", ({ flag }) => {
      if (flag === "playerUsedWindowEntrance" && this.phase === "get-in") this.advanceToExplore();
    });
    bus.on("item-collected", ({ itemId }) => {
      if (itemId === "key_basement" && this.phase !== "secret-found" && this.phase !== "escape") {
        this.phase = "basement-key-found";
        this.objective.set(
          "Find the locked door in the basement.",
          "That heavy key has to open something. Somewhere below.",
        );
      }
    });
    bus.on("secret-found", () => {
      this.phase = "escape";
      this.objective.set("Get out. Now.", "You've seen enough. Don't let him find you on your way out.");
    });
  }

  private advanceToExplore(): void {
    this.phase = "explore";
    this.objective.set(
      "Find a way into the basement.",
      "The house is bigger and stranger inside than it looks. Keep quiet, keep looking.",
    );
  }

  getPhase(): Phase {
    return this.phase;
  }

  serialize(): Phase {
    return this.phase;
  }

  deserialize(phase: Phase): void {
    this.phase = phase;
  }
}
