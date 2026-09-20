import { SaveSystem, type GameSettings } from "../save/SaveSystem";

export interface MainMenuCallbacks {
  onNewGame: () => void;
  onContinue: () => void;
  onSettingsChanged: (settings: GameSettings) => void;
  onQuit: () => void;
}

/**
 * The pre-game menu tree: Main -> {Settings, Credits}. Also doubles as the
 * pause menu (GameManager just calls showMain() again mid-run). All widget
 * state lives in the DOM; this class only reads/writes GameSettings.
 */
export class MainMenu {
  readonly root: HTMLElement;
  private readonly mainScreen: HTMLElement;
  private readonly settingsScreen: HTMLElement;
  private readonly creditsScreen: HTMLElement;
  private readonly continueBtn: HTMLButtonElement;
  private settings: GameSettings;

  constructor(
    container: HTMLElement,
    private readonly saveSystem: SaveSystem,
    private readonly callbacks: MainMenuCallbacks,
  ) {
    this.settings = saveSystem.loadSettings();

    this.root = document.createElement("div");
    this.root.className = "clickable";
    this.root.innerHTML = `
      <div class="menu-screen main-screen">
        <div class="menu-title">The House<span>Across The Street</span></div>
        <div class="menu-buttons">
          <button class="menu-btn" data-action="continue">Continue</button>
          <button class="menu-btn" data-action="new-game">New Game</button>
          <button class="menu-btn" data-action="settings">Settings</button>
          <button class="menu-btn" data-action="credits">Credits</button>
          <button class="menu-btn" data-action="quit">Quit</button>
        </div>
      </div>
      <div class="menu-screen settings-screen hidden">
        <div class="menu-title" style="font-size:26px">Settings</div>
        <div class="settings-panel">
          ${slider("master", "Master Volume", 0, 1, 0.01)}
          ${slider("music", "Music Volume", 0, 1, 0.01)}
          ${slider("sfx", "SFX Volume", 0, 1, 0.01)}
          ${slider("sensitivity", "Mouse Sensitivity", 0.0008, 0.006, 0.0001)}
          ${slider("fov", "Field of View", 60, 100, 1)}
          <div class="settings-row">
            <label>Head Bob</label>
            <input type="checkbox" id="setting-headbob" />
          </div>
          <div class="settings-row">
            <label>Fullscreen</label>
            <input type="checkbox" id="setting-fullscreen" />
          </div>
        </div>
        <div class="menu-buttons">
          <button class="menu-btn" data-action="back-from-settings">Back</button>
        </div>
      </div>
      <div class="menu-screen credits-screen hidden">
        <div class="menu-title" style="font-size:26px">Credits</div>
        <div class="credits-text">
          <p><strong>The House Across the Street</strong> is an original stealth-horror
          vertical slice: an entirely original setting, character (Elias Voss) and
          mystery, built with Three.js and cannon-es.</p>
          <p>Design, systems and placeholder art: this project's build.</p>
        </div>
        <div class="menu-buttons">
          <button class="menu-btn" data-action="back-from-credits">Back</button>
        </div>
      </div>
    `;
    container.appendChild(this.root);

    this.mainScreen = this.root.querySelector(".main-screen")!;
    this.settingsScreen = this.root.querySelector(".settings-screen")!;
    this.creditsScreen = this.root.querySelector(".credits-screen")!;
    this.continueBtn = this.root.querySelector('[data-action="continue"]')!;

    this.root.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      const action = target.dataset.action;
      if (!action) return;
      switch (action) {
        case "continue":
          callbacks.onContinue();
          break;
        case "new-game":
          callbacks.onNewGame();
          break;
        case "settings":
          this.showScreen("settings");
          break;
        case "credits":
          this.showScreen("credits");
          break;
        case "quit":
          callbacks.onQuit();
          break;
        case "back-from-settings":
        case "back-from-credits":
          this.showScreen("main");
          break;
      }
    });

    this.bindSettingsInputs();
    this.applySettingsToInputs();
  }

  private bindSettingsInputs(): void {
    const bind = (id: string, key: keyof GameSettings, isCheckbox = false) => {
      const el = this.root.querySelector<HTMLInputElement>(`#setting-${id}`)!;
      el.addEventListener("input", () => {
        const value = isCheckbox ? el.checked : parseFloat(el.value);
        (this.settings as unknown as Record<string, number | boolean>)[key] = value;
        this.saveSystem.saveSettings(this.settings);
        this.callbacks.onSettingsChanged(this.settings);
      });
    };
    bind("master", "masterVolume");
    bind("music", "musicVolume");
    bind("sfx", "sfxVolume");
    bind("sensitivity", "sensitivity");
    bind("fov", "fov");
    bind("headbob", "headbob", true);
    bind("fullscreen", "fullscreen", true);
  }

  private applySettingsToInputs(): void {
    const set = (id: string, value: number | boolean) => {
      const el = this.root.querySelector<HTMLInputElement>(`#setting-${id}`)!;
      if (typeof value === "boolean") el.checked = value;
      else el.value = String(value);
    };
    set("master", this.settings.masterVolume);
    set("music", this.settings.musicVolume);
    set("sfx", this.settings.sfxVolume);
    set("sensitivity", this.settings.sensitivity);
    set("fov", this.settings.fov);
    set("headbob", this.settings.headbob);
    set("fullscreen", this.settings.fullscreen);
  }

  getSettings(): GameSettings {
    return this.settings;
  }

  showScreen(which: "main" | "settings" | "credits"): void {
    this.mainScreen.classList.toggle("hidden", which !== "main");
    this.settingsScreen.classList.toggle("hidden", which !== "settings");
    this.creditsScreen.classList.toggle("hidden", which !== "credits");
  }

  show(hasSave: boolean): void {
    this.continueBtn.disabled = !hasSave;
    this.showScreen("main");
    this.root.style.display = "block";
  }

  hide(): void {
    this.root.style.display = "none";
  }
}

function slider(id: string, label: string, min: number, max: number, step: number): string {
  return `
    <div class="settings-row">
      <label>${label}</label>
      <input type="range" id="setting-${id}" min="${min}" max="${max}" step="${step}" />
    </div>
  `;
}
