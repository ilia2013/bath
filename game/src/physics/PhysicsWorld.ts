import * as CANNON from "cannon-es";

/**
 * Thin wrapper around a cannon-es world with named collision materials so
 * gameplay code can add bodies without re-deriving contact settings each time.
 */
export class PhysicsWorld {
  readonly world: CANNON.World;
  readonly groundMaterial = new CANNON.Material("ground");
  readonly playerMaterial = new CANNON.Material("player");
  readonly objectMaterial = new CANNON.Material("object");

  constructor() {
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -18, 0) });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;

    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.groundMaterial, this.playerMaterial, {
        friction: 0,
        restitution: 0,
      }),
    );
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.groundMaterial, this.objectMaterial, {
        friction: 0.5,
        restitution: 0.15,
      }),
    );
    this.world.addContactMaterial(
      new CANNON.ContactMaterial(this.objectMaterial, this.objectMaterial, {
        friction: 0.4,
        restitution: 0.1,
      }),
    );
  }

  step(dt: number): void {
    this.world.step(1 / 60, dt, 5);
  }

  addBody(body: CANNON.Body): void {
    this.world.addBody(body);
  }

  removeBody(body: CANNON.Body): void {
    this.world.removeBody(body);
  }
}
