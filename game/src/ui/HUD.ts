import { EventBus } from "../core/EventBus";
import type { GameEventMap } from "../core/GameEvents";
import { InventorySystem } from "../systems/InventorySystem";
import { ITEM_DEFS, type ItemId } from "../items/ItemTypes";

const SLOT_KEYS = ["1", "2", "3", "4"];

/**
 * All in-game (non-menu) DOM overlay: crosshair, interact prompt, inventory
 * bar, objective box, stamina/noise meters, notifications, danger vignette.
 * Pure presentation - every value it shows is pushed in by GameManager.
 */
export class HUD {
  readonly root: HTMLElement;
  private readonly crosshair: HTMLElement;
  private readonly prompt: HTMLElement;
  private readonly inventoryBar: HTMLElement;
  private readonly objectiveBox: HTMLElement;
  private readonly staminaFill: HTMLElement;
  private readonly noiseFill: HTMLElement;
  private readonly notifyStack: HTMLElement;
  private readonly dangerVignette: HTMLElement;
  private readonly hideVignette: HTMLElement;
  private readonly fadeOverlay: HTMLElement;
  private readonly pointerLockHint: HTMLElement;

  constructor(
    container: HTMLElement,
    private readonly inventory: InventorySystem,
    bus: EventBus<GameEventMap>,
  ) {
    this.root = document.createElement("div");
    this.root.innerHTML = `
      <div class="crosshair"></div>
      <div class="interact-prompt"></div>
      <div class="objective-box">
        <div class="objective-label">Objective</div>
        <div class="objective-text"></div>
      </div>
      <div class="inventory-bar"></div>
      <div class="meters">
        <div class="meter-bar"><div class="meter-fill stamina"></div></div>
        <div class="meter-bar"><div class="meter-fill noise"></div></div>
      </div>
      <div class="notify-stack"></div>
      <div class="danger-vignette"></div>
      <div class="hide-view-vignette"></div>
      <div class="fade-overlay"></div>
      <div class="pointer-lock-hint">Click to look around</div>
    `;
    container.appendChild(this.root);

    this.crosshair = this.root.querySelector(".crosshair")!;
    this.prompt = this.root.querySelector(".interact-prompt")!;
    this.objectiveBox = this.root.querySelector(".objective-text")!;
    this.inventoryBar = this.root.querySelector(".inventory-bar")!;
    this.staminaFill = this.root.querySelector(".meter-fill.stamina")!;
    this.noiseFill = this.root.querySelector(".meter-fill.noise")!;
    this.notifyStack = this.root.querySelector(".notify-stack")!;
    this.dangerVignette = this.root.querySelector(".danger-vignette")!;
    this.hideVignette = this.root.querySelector(".hide-view-vignette")!;
    this.fadeOverlay = this.root.querySelector(".fade-overlay")!;
    this.pointerLockHint = this.root.querySelector(".pointer-lock-hint")!;

    bus.on("objective-changed", ({ description }) => {
      this.objectiveBox.textContent = description;
    });
    bus.on("notify", ({ text }) => {
      if (text) this.pushNotification(text);
    });
    bus.on("inventory-changed", () => this.renderInventory());

    this.renderInventory();
  }

  setVisible(visible: boolean): void {
    this.root.style.display = visible ? "block" : "none";
  }

  setObjectiveText(text: string): void {
    this.objectiveBox.textContent = text;
  }

  setPrompt(text: string | null): void {
    if (!text) {
      this.prompt.classList.remove("visible");
      return;
    }
    this.prompt.classList.add("visible");
    this.prompt.textContent = text;
  }

  setStamina(fraction: number): void {
    this.staminaFill.style.width = `${Math.round(fraction * 100)}%`;
    this.staminaFill.style.background = fraction < 0.2 ? "#d8556a" : "#7cc576";
  }

  setNoiseLevel(fraction: number): void {
    this.noiseFill.style.width = `${Math.round(fraction * 100)}%`;
  }

  setDanger(active: boolean): void {
    this.dangerVignette.classList.toggle("active", active);
  }

  setHiding(active: boolean): void {
    this.hideVignette.classList.toggle("active", active);
  }

  showFade(active: boolean): void {
    this.fadeOverlay.classList.toggle("active", active);
  }

  setPointerLockHintVisible(visible: boolean): void {
    this.pointerLockHint.classList.toggle("visible", visible);
  }

  onPointerLockHintClick(cb: () => void): void {
    this.pointerLockHint.addEventListener("click", cb);
  }

  private renderInventory(): void {
    const slots = this.inventory.getSlots();
    const active = this.inventory.getActiveSlot();
    this.inventoryBar.innerHTML = "";
    slots.forEach((slot, i) => {
      const el = document.createElement("div");
      el.className = "inventory-slot" + (i === active ? " active" : "");
      const key = document.createElement("div");
      key.className = "slot-key";
      key.textContent = SLOT_KEYS[i];
      el.appendChild(key);
      if (slot) {
        const label = document.createElement("div");
        label.textContent = shortName(slot.itemId);
        el.appendChild(label);
      }
      this.inventoryBar.appendChild(el);
    });
  }

  private pushNotification(text: string): void {
    const el = document.createElement("div");
    el.className = "notify";
    el.textContent = text;
    this.notifyStack.appendChild(el);
    setTimeout(() => el.remove(), 3700);
  }
}

function shortName(id: ItemId): string {
  return ITEM_DEFS[id].name;
}
