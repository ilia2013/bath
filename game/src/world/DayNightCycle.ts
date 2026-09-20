import * as THREE from "three";

const DAY_LENGTH_SECONDS = 8 * 60; // one full 24h cycle takes 8 real minutes
const START_HOUR = 20; // game opens at night, matching the "strange nightly sounds" hook

/**
 * Drives the sun/moon light and exposes the current hour-of-day so
 * ScheduleSystem and lighting queries stay in sync with a single clock.
 */
export class DayNightCycle {
  private hour = START_HOUR;
  readonly sun: THREE.DirectionalLight;
  readonly ambient: THREE.AmbientLight;
  readonly hemisphere: THREE.HemisphereLight;
  private sunDistance = 60;

  constructor(scene: THREE.Scene) {
    this.sun = new THREE.DirectionalLight(0xffffff, 0);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -30;
    this.sun.shadow.camera.right = 30;
    this.sun.shadow.camera.top = 30;
    this.sun.shadow.camera.bottom = -30;
    this.sun.shadow.camera.far = 120;
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.ambient = new THREE.AmbientLight(0x223344, 0.25);
    scene.add(this.ambient);

    this.hemisphere = new THREE.HemisphereLight(0x30405a, 0x0a0a10, 0.3);
    scene.add(this.hemisphere);
  }

  setHour(hour: number): void {
    this.hour = hour;
  }

  getHour(): number {
    return this.hour;
  }

  isNight(): boolean {
    return this.hour < 6.5 || this.hour >= 19.5;
  }

  update(dt: number): void {
    this.hour += (dt / DAY_LENGTH_SECONDS) * 24;
    if (this.hour >= 24) this.hour -= 24;

    const angle = (this.hour / 24) * Math.PI * 2 - Math.PI / 2;
    const height = Math.sin(angle);
    const x = Math.cos(angle) * this.sunDistance;
    const y = Math.max(height, -0.15) * this.sunDistance;
    this.sun.position.set(x, y, 20);
    this.sun.target.position.set(0, 0, 0);

    const dayFactor = THREE.MathUtils.clamp((height + 0.15) / 0.5, 0, 1);
    this.sun.intensity = THREE.MathUtils.lerp(0.0, 3.2, dayFactor);
    this.ambient.intensity = THREE.MathUtils.lerp(0.22, 0.5, dayFactor);
    this.hemisphere.intensity = THREE.MathUtils.lerp(0.28, 0.75, dayFactor);

    const warm = new THREE.Color(0xfff2d8);
    const cold = new THREE.Color(0x3a4f7a);
    this.sun.color.copy(cold).lerp(warm, dayFactor);
  }

  /** Rough 0..1 daylight factor usable by rooms without their own lamp. */
  getDaylightFactor(): number {
    const angle = (this.hour / 24) * Math.PI * 2 - Math.PI / 2;
    const height = Math.sin(angle);
    return THREE.MathUtils.clamp((height + 0.15) / 0.5, 0, 1);
  }

  serialize(): number {
    return this.hour;
  }

  deserialize(hour: number): void {
    this.hour = hour;
  }
}
