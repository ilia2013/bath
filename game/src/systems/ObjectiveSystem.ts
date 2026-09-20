import { EventBus } from "../core/EventBus";
import type { GameEventMap } from "../core/GameEvents";

/**
 * Holds exactly one active objective at a time - deliberately vague per the
 * design brief ("find a way into the basement", never a numbered checklist).
 * PuzzleSystem is the only thing that calls `set`; this class just stores
 * and broadcasts.
 */
export class ObjectiveSystem {
  private title = "";
  private description = "";

  constructor(private readonly bus: EventBus<GameEventMap>) {}

  set(title: string, description: string): void {
    this.title = title;
    this.description = description;
    this.bus.emit("objective-changed", { title, description });
  }

  get(): { title: string; description: string } {
    return { title: this.title, description: this.description };
  }

  serialize(): { title: string; description: string } {
    return this.get();
  }

  deserialize(data: { title: string; description: string }): void {
    this.set(data.title, data.description);
  }
}
