export type MemoryFlag =
  | "playerUsedWindowEntrance"
  | "playerFrequentlyUsesBackDoor"
  | "playerHidesInBedroomCloset"
  | "playerDisabledPower"
  | "playerUsedRoofEntrance"
  | "playerUsedGarageEntrance";

/**
 * Tracks only what Elias could plausibly have noticed - a witnessed event
 * or a pattern of them (counts, not a live GPS feed). EnemyAI reads these
 * to lean its routine differently over a playthrough, never to teleport
 * knowledge it never earned.
 */
export class MemorySystem {
  private flags = new Set<MemoryFlag>();
  private counters = new Map<string, number>();

  private readonly THRESHOLDS: Partial<Record<string, number>> = {
    backDoorUse: 3,
  };

  setFlag(flag: MemoryFlag): void {
    this.flags.add(flag);
  }

  hasFlag(flag: MemoryFlag): boolean {
    return this.flags.has(flag);
  }

  /** Increments a counter and auto-promotes it to a flag once it crosses its threshold. */
  incrementCounter(key: string, promoteToFlag?: MemoryFlag): void {
    const next = (this.counters.get(key) ?? 0) + 1;
    this.counters.set(key, next);
    const threshold = this.THRESHOLDS[key];
    if (promoteToFlag && threshold !== undefined && next >= threshold) {
      this.flags.add(promoteToFlag);
    }
  }

  getCounter(key: string): number {
    return this.counters.get(key) ?? 0;
  }

  serialize(): { flags: MemoryFlag[]; counters: [string, number][] } {
    return { flags: [...this.flags], counters: [...this.counters] };
  }

  deserialize(data: { flags: MemoryFlag[]; counters: [string, number][] }): void {
    this.flags = new Set(data.flags);
    this.counters = new Map(data.counters);
  }
}
