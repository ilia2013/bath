/**
 * Central keyboard/mouse state. Systems poll this rather than each attaching
 * their own DOM listeners, so pointer-lock and pause state stay consistent.
 */
export class InputManager {
  private keys = new Set<string>();
  private justPressedKeys = new Set<string>();
  private mouseDeltaX = 0;
  private mouseDeltaY = 0;
  private mouseSensitivity = 0.0022;
  private locked = false;
  private enabled = true;
  private wheelDelta = 0;
  private mouseJustDown = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", (e) => {
      if (!this.enabled) return;
      if (!this.keys.has(e.code)) this.justPressedKeys.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
    });
    window.addEventListener("blur", () => {
      this.keys.clear();
    });

    document.addEventListener("mousemove", (e) => {
      if (!this.locked || !this.enabled) return;
      this.mouseDeltaX += e.movementX;
      this.mouseDeltaY += e.movementY;
    });

    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === this.canvas;
    });

    canvas.addEventListener("mousedown", () => {
      if (this.enabled) this.mouseJustDown = true;
    });

    canvas.addEventListener("wheel", (e) => {
      if (!this.enabled) return;
      this.wheelDelta += Math.sign(e.deltaY);
    });
  }

  requestPointerLock(): void {
    this.canvas.requestPointerLock();
  }

  exitPointerLock(): void {
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  isPointerLocked(): boolean {
    return this.locked;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.keys.clear();
  }

  isDown(code: string): boolean {
    return this.enabled && this.keys.has(code);
  }

  wasJustPressed(code: string): boolean {
    return this.justPressedKeys.has(code);
  }

  consumeMouseDown(): boolean {
    const v = this.mouseJustDown;
    this.mouseJustDown = false;
    return v;
  }

  /** Call once per frame after all systems read this frame's deltas. */
  endFrame(): void {
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.wheelDelta = 0;
    this.justPressedKeys.clear();
  }

  consumeMouseDelta(): { x: number; y: number } {
    const x = this.mouseDeltaX * this.mouseSensitivity;
    const y = this.mouseDeltaY * this.mouseSensitivity;
    return { x, y };
  }

  consumeWheel(): number {
    return this.wheelDelta;
  }

  setSensitivity(v: number): void {
    this.mouseSensitivity = v;
  }

  getSensitivity(): number {
    return this.mouseSensitivity;
  }
}
