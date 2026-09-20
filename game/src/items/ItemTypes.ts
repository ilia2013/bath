export type ItemId =
  | "key_workshop"
  | "key_basement"
  | "crowbar"
  | "hammer"
  | "screwdriver"
  | "fuse"
  | "battery"
  | "flashlight"
  | "magnet"
  | "rope"
  | "box"
  | "chair"
  | "stone"
  | "note_photo"
  | "note_letter";

export interface ItemDef {
  id: ItemId;
  name: string;
  description: string;
  /** Can the player throw this item to create a distraction noise? */
  throwable: boolean;
  /**
   * inventory: goes into one of the 4 abstract slots (keys/tools).
   * prop: stays a physical rigidbody the player carries in-hand (boxes, stones).
   * lore: never occupies a slot, just logs a journal entry on pickup.
   */
  category: "inventory" | "prop" | "lore";
}

export const ITEM_DEFS: Record<ItemId, ItemDef> = {
  key_workshop: { id: "key_workshop", name: "Workshop Key", description: "A small brass key, worn smooth.", throwable: false, category: "inventory" },
  key_basement: { id: "key_basement", name: "Basement Key", description: "Heavy iron, cold to the touch.", throwable: false, category: "inventory" },
  crowbar: { id: "crowbar", name: "Crowbar", description: "Good for prying open stuck things.", throwable: false, category: "inventory" },
  hammer: { id: "hammer", name: "Hammer", description: "Could break glass in a pinch.", throwable: false, category: "inventory" },
  screwdriver: { id: "screwdriver", name: "Screwdriver", description: "Removes vent covers and panels.", throwable: false, category: "inventory" },
  fuse: { id: "fuse", name: "Fuse", description: "Fits the breaker panel in the garage.", throwable: false, category: "inventory" },
  battery: { id: "battery", name: "Battery", description: "Powers the flashlight.", throwable: false, category: "inventory" },
  flashlight: { id: "flashlight", name: "Flashlight", description: "Cuts through the dark. Draws attention too.", throwable: false, category: "inventory" },
  magnet: { id: "magnet", name: "Magnet", description: "Might retrieve something through a gap.", throwable: false, category: "inventory" },
  rope: { id: "rope", name: "Rope", description: "Sturdy enough to climb or tie off.", throwable: false, category: "inventory" },
  box: { id: "box", name: "Wooden Box", description: "Stack it to reach higher places.", throwable: true, category: "prop" },
  chair: { id: "chair", name: "Chair", description: "Could wedge a door shut.", throwable: true, category: "prop" },
  stone: { id: "stone", name: "Stone", description: "Light. Good for throwing as a distraction.", throwable: true, category: "prop" },
  note_photo: { id: "note_photo", name: "Old Photograph", description: "A faded photo of a family that isn't Voss's.", throwable: false, category: "lore" },
  note_letter: { id: "note_letter", name: "Torn Letter", description: "\"...the readings from the third container were wrong again...\"", throwable: false, category: "lore" },
};
