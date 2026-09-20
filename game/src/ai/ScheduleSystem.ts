export type ScheduleActivity = "patrol" | "work" | "eat" | "sleep";

export interface SchedulePhase {
  name: string;
  startHour: number;
  endHour: number;
  activity: ScheduleActivity;
  /** Nav node ids Elias may pick between for this phase - picking is randomized a little. */
  locationNodeIds: string[];
}

/**
 * Elias's daily routine. Deliberately not a single fixed path: each phase
 * offers a handful of valid nodes and EnemyAI (re)rolls among them with a
 * randomized dwell time, so the player can learn the pattern without being
 * able to perfectly script around it.
 */
export class ScheduleSystem {
  constructor(private readonly phases: SchedulePhase[]) {}

  getPhaseAtHour(hour: number): SchedulePhase {
    const h = ((hour % 24) + 24) % 24;
    for (const phase of this.phases) {
      if (phase.startHour <= phase.endHour) {
        if (h >= phase.startHour && h < phase.endHour) return phase;
      } else {
        // Wraps midnight, e.g. 23 -> 6.
        if (h >= phase.startHour || h < phase.endHour) return phase;
      }
    }
    return this.phases[0];
  }

  pickRandomNode(phase: SchedulePhase, excludeId?: string): string {
    const options = phase.locationNodeIds.filter((id) => id !== excludeId);
    const pool = options.length > 0 ? options : phase.locationNodeIds;
    return pool[Math.floor(Math.random() * pool.length)];
  }
}
