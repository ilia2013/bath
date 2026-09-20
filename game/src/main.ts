import { GameManager } from "./core/GameManager";

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
const uiRoot = document.getElementById("ui-root") as HTMLElement;

const game = new GameManager(canvas, uiRoot);

if (import.meta.env.DEV) {
  (window as unknown as { __game: GameManager }).__game = game;
}
