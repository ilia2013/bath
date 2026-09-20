import { EventBus } from "../core/EventBus";
import type { GameEventMap } from "../core/GameEvents";
import { ITEM_DEFS, type ItemId } from "../items/ItemTypes";

export interface InventorySlot {
  itemId: ItemId;
  count: number;
}

const SLOT_COUNT = 4;

/**
 * Small abstract 4-slot inventory for keys/tools. Physical props (boxes,
 * chairs, stones) never enter here - they stay carried in-hand via ItemSystem.
 */
export class InventorySystem {
  private slots: (InventorySlot | null)[] = new Array(SLOT_COUNT).fill(null);
  private activeSlot = 0;
  readonly journal: ItemId[] = [];

  constructor(private readonly bus: EventBus<GameEventMap>) {}

  add(itemId: ItemId): boolean {
    const def = ITEM_DEFS[itemId];
    if (def.category === "lore") {
      if (!this.journal.includes(itemId)) this.journal.push(itemId);
      this.bus.emit("inventory-changed", {});
      return true;
    }

    // Stack identical stackable consumables (fuse/battery), otherwise find a slot.
    const existing = this.slots.find((s) => s?.itemId === itemId);
    if (existing && (itemId === "fuse" || itemId === "battery")) {
      existing.count++;
      this.bus.emit("inventory-changed", {});
      return true;
    }

    const freeIndex = this.slots.findIndex((s) => s === null);
    if (freeIndex === -1) return false;
    this.slots[freeIndex] = { itemId, count: 1 };
    this.bus.emit("inventory-changed", {});
    return true;
  }

  has(itemId: ItemId): boolean {
    return this.slots.some((s) => s?.itemId === itemId && s.count > 0);
  }

  /** Consume one unit of an item (e.g. placing a fuse). Returns true if consumed. */
  consume(itemId: ItemId): boolean {
    const slot = this.slots.find((s) => s?.itemId === itemId);
    if (!slot) return false;
    slot.count--;
    if (slot.count <= 0) {
      const idx = this.slots.indexOf(slot);
      this.slots[idx] = null;
    }
    this.bus.emit("inventory-changed", {});
    return true;
  }

  getSlots(): (InventorySlot | null)[] {
    return this.slots;
  }

  getActiveSlot(): number {
    return this.activeSlot;
  }

  setActiveSlot(index: number): void {
    if (index < 0 || index >= SLOT_COUNT) return;
    this.activeSlot = index;
    this.bus.emit("inventory-changed", {});
  }

  cycleSlot(delta: number): void {
    this.activeSlot = (this.activeSlot + delta + SLOT_COUNT) % SLOT_COUNT;
    this.bus.emit("inventory-changed", {});
  }

  getActiveItem(): ItemId | null {
    return this.slots[this.activeSlot]?.itemId ?? null;
  }

  serialize(): { slots: (InventorySlot | null)[]; journal: ItemId[] } {
    return { slots: this.slots.map((s) => (s ? { ...s } : null)), journal: [...this.journal] };
  }

  deserialize(data: { slots: (InventorySlot | null)[]; journal: ItemId[] }): void {
    this.slots = data.slots.map((s) => (s ? { ...s } : null));
    this.journal.length = 0;
    this.journal.push(...data.journal);
    this.bus.emit("inventory-changed", {});
  }
}
