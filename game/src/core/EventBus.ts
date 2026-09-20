type Listener<T> = (payload: T) => void;

/**
 * Minimal typed pub/sub so systems (AI, noise, puzzles, UI) can react to
 * each other without holding direct references.
 */
export class EventBus<EventMap extends { [K in keyof EventMap]: unknown }> {
  private listeners: { [K in keyof EventMap]?: Set<Listener<EventMap[K]>> } = {};

  on<K extends keyof EventMap>(event: K, fn: Listener<EventMap[K]>): () => void {
    let set = this.listeners[event];
    if (!set) {
      set = new Set();
      this.listeners[event] = set;
    }
    set.add(fn);
    return () => set!.delete(fn);
  }

  off<K extends keyof EventMap>(event: K, fn: Listener<EventMap[K]>): void {
    this.listeners[event]?.delete(fn);
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const set = this.listeners[event];
    if (!set) return;
    for (const fn of [...set]) fn(payload);
  }
}
