export interface Vec3 { x: number; y: number; z: number; }

export interface AABB {
  min: Vec3;
  max: Vec3;
}

export interface RigidBody {
  id: string;
  position: Vec3;
  velocity: Vec3;
  rotation: Vec3;
  angularVelocity: Vec3;
  mass: number;
  inverseMass: number;
  restitution: number;
  friction: number;
  size: Vec3;
  anchored: boolean;
  canCollide: boolean;
  onFloor: boolean;
  userData?: Record<string, unknown>;
}

export interface CollisionResult {
  bodyA: string;
  bodyB: string;
  normal: Vec3;
  penetration: number;
  contactPoint: Vec3;
}

export interface RaycastResult {
  hit: boolean;
  bodyId?: string;
  point?: Vec3;
  normal?: Vec3;
  distance?: number;
}

export class PhysicsEngine {
  private _bodies: Map<string, RigidBody> = new Map();
  private _gravity: Vec3 = { x: 0, y: -196.2, z: 0 };
  private _accumulator = 0;
  private _fixedStep = 1 / 60;
  private _collisionCallbacks: ((result: CollisionResult) => void)[] = [];

  setGravity(g: Vec3): void { this._gravity = g; }
  getGravity(): Vec3 { return { ...this._gravity }; }

  createBody(id: string, options: Partial<RigidBody> = {}): RigidBody {
    const body: RigidBody = {
      id,
      position: options.position ?? { x: 0, y: 0, z: 0 },
      velocity: options.velocity ?? { x: 0, y: 0, z: 0 },
      rotation: options.rotation ?? { x: 0, y: 0, z: 0 },
      angularVelocity: options.angularVelocity ?? { x: 0, y: 0, z: 0 },
      mass: options.mass ?? 1,
      inverseMass: options.anchored ? 0 : 1 / (options.mass ?? 1),
      restitution: options.restitution ?? 0.3,
      friction: options.friction ?? 0.8,
      size: options.size ?? { x: 1, y: 1, z: 1 },
      anchored: options.anchored ?? false,
      canCollide: options.canCollide ?? true,
      onFloor: false,
      userData: options.userData ?? {},
    };
    this._bodies.set(id, body);
    return body;
  }

  removeBody(id: string): void { this._bodies.delete(id); }
  getBody(id: string): RigidBody | null { return this._bodies.get(id) ?? null; }
  getAllBodies(): RigidBody[] { return Array.from(this._bodies.values()); }

  update(deltaTime: number): CollisionResult[] {
    this._accumulator += deltaTime;
    const collisions: CollisionResult[] = [];

    while (this._accumulator >= this._fixedStep) {
      const stepCollisions = this._step(this._fixedStep);
      collisions.push(...stepCollisions);
      this._accumulator -= this._fixedStep;
    }

    return collisions;
  }

  private _step(dt: number): CollisionResult[] {
    for (const body of this._bodies.values()) {
      if (body.anchored || body.inverseMass === 0) continue;
      body.velocity.x += this._gravity.x * dt;
      body.velocity.y += this._gravity.y * dt;
      body.velocity.z += this._gravity.z * dt;
      body.velocity.x *= 0.99;
      body.velocity.z *= 0.99;
      body.position.x += body.velocity.x * dt;
      body.position.y += body.velocity.y * dt;
      body.position.z += body.velocity.z * dt;
    }

    const collisions = this._detectCollisions();
    for (const col of collisions) {
      this._resolveCollision(col);
    }

    for (const body of this._bodies.values()) {
      if (!body.anchored) {
        body.onFloor = false;
      }
    }

    for (const col of collisions) {
      const bodyA = this._bodies.get(col.bodyA);
      const bodyB = this._bodies.get(col.bodyB);
      if (bodyA && col.normal.y > 0.5) bodyA.onFloor = true;
      if (bodyB && col.normal.y < -0.5) bodyB.onFloor = true;
    }

    for (const cb of this._collisionCallbacks) {
      for (const col of collisions) cb(col);
    }

    return collisions;
  }

  private _getAABB(body: RigidBody): AABB {
    const half = {
      x: body.size.x / 2,
      y: body.size.y / 2,
      z: body.size.z / 2,
    };
    return {
      min: { x: body.position.x - half.x, y: body.position.y - half.y, z: body.position.z - half.z },
      max: { x: body.position.x + half.x, y: body.position.y + half.y, z: body.position.z + half.z },
    };
  }

  private _aabbOverlap(a: AABB, b: AABB): boolean {
    return a.min.x <= b.max.x && a.max.x >= b.min.x &&
           a.min.y <= b.max.y && a.max.y >= b.min.y &&
           a.min.z <= b.max.z && a.max.z >= b.min.z;
  }

  private _detectCollisions(): CollisionResult[] {
    const results: CollisionResult[] = [];
    const bodies = Array.from(this._bodies.values()).filter(b => b.canCollide);

    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i];
        const b = bodies[j];
        if (a.anchored && b.anchored) continue;

        const aabb1 = this._getAABB(a);
        const aabb2 = this._getAABB(b);

        if (!this._aabbOverlap(aabb1, aabb2)) continue;

        const overlapX = Math.min(aabb1.max.x - aabb2.min.x, aabb2.max.x - aabb1.min.x);
        const overlapY = Math.min(aabb1.max.y - aabb2.min.y, aabb2.max.y - aabb1.min.y);
        const overlapZ = Math.min(aabb1.max.z - aabb2.min.z, aabb2.max.z - aabb1.min.z);

        let normal: Vec3;
        let penetration: number;

        if (overlapX < overlapY && overlapX < overlapZ) {
          penetration = overlapX;
          normal = { x: a.position.x < b.position.x ? -1 : 1, y: 0, z: 0 };
        } else if (overlapY < overlapZ) {
          penetration = overlapY;
          normal = { x: 0, y: a.position.y < b.position.y ? -1 : 1, z: 0 };
        } else {
          penetration = overlapZ;
          normal = { x: 0, y: 0, z: a.position.z < b.position.z ? -1 : 1 };
        }

        results.push({
          bodyA: a.id,
          bodyB: b.id,
          normal,
          penetration,
          contactPoint: {
            x: (a.position.x + b.position.x) / 2,
            y: (a.position.y + b.position.y) / 2,
            z: (a.position.z + b.position.z) / 2,
          },
        });
      }
    }

    return results;
  }

  private _resolveCollision(col: CollisionResult): void {
    const a = this._bodies.get(col.bodyA);
    const b = this._bodies.get(col.bodyB);
    if (!a || !b) return;

    const totalInvMass = a.inverseMass + b.inverseMass;
    if (totalInvMass === 0) return;

    const separation = col.penetration / totalInvMass;
    a.position.x -= col.normal.x * separation * a.inverseMass;
    a.position.y -= col.normal.y * separation * a.inverseMass;
    a.position.z -= col.normal.z * separation * a.inverseMass;
    b.position.x += col.normal.x * separation * b.inverseMass;
    b.position.y += col.normal.y * separation * b.inverseMass;
    b.position.z += col.normal.z * separation * b.inverseMass;

    const relVelX = a.velocity.x - b.velocity.x;
    const relVelY = a.velocity.y - b.velocity.y;
    const relVelZ = a.velocity.z - b.velocity.z;
    const relVelNorm = relVelX * col.normal.x + relVelY * col.normal.y + relVelZ * col.normal.z;

    if (relVelNorm > 0) return;

    const restitution = Math.min(a.restitution, b.restitution);
    const impulseScalar = -(1 + restitution) * relVelNorm / totalInvMass;

    a.velocity.x += col.normal.x * impulseScalar * a.inverseMass;
    a.velocity.y += col.normal.y * impulseScalar * a.inverseMass;
    a.velocity.z += col.normal.z * impulseScalar * a.inverseMass;
    b.velocity.x -= col.normal.x * impulseScalar * b.inverseMass;
    b.velocity.y -= col.normal.y * impulseScalar * b.inverseMass;
    b.velocity.z -= col.normal.z * impulseScalar * b.inverseMass;
  }

  raycast(origin: Vec3, direction: Vec3, maxDistance = 1000): RaycastResult {
    const norm = this._normalize(direction);
    let closestT = maxDistance;
    let hitBody: RigidBody | null = null;
    let hitNormal: Vec3 = { x: 0, y: 1, z: 0 };

    for (const body of this._bodies.values()) {
      if (!body.canCollide) continue;
      const aabb = this._getAABB(body);
      const result = this._rayAABB(origin, norm, aabb);
      if (result !== null && result.t < closestT) {
        closestT = result.t;
        hitBody = body;
        hitNormal = result.normal;
      }
    }

    if (!hitBody) return { hit: false };

    return {
      hit: true,
      bodyId: hitBody.id,
      point: {
        x: origin.x + norm.x * closestT,
        y: origin.y + norm.y * closestT,
        z: origin.z + norm.z * closestT,
      },
      normal: hitNormal,
      distance: closestT,
    };
  }

  private _rayAABB(origin: Vec3, dir: Vec3, aabb: AABB): { t: number; normal: Vec3 } | null {
    let tmin = -Infinity, tmax = Infinity;
    let hitNormal: Vec3 = { x: 0, y: 0, z: 0 };

    const axes: Array<'x' | 'y' | 'z'> = ['x', 'y', 'z'];
    for (const axis of axes) {
      const invD = 1 / dir[axis];
      let t0 = (aabb.min[axis] - origin[axis]) * invD;
      let t1 = (aabb.max[axis] - origin[axis]) * invD;
      let axisNormal: Vec3 = { x: 0, y: 0, z: 0 };

      if (invD < 0) {
        [t0, t1] = [t1, t0];
        axisNormal[axis] = 1;
      } else {
        axisNormal[axis] = -1;
      }

      if (t0 > tmin) { tmin = t0; hitNormal = axisNormal; }
      tmax = Math.min(tmax, t1);
      if (tmin > tmax) return null;
    }

    if (tmin < 0) return null;
    return { t: tmin, normal: hitNormal };
  }

  private _normalize(v: Vec3): Vec3 {
    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    if (len === 0) return { x: 0, y: 0, z: 0 };
    return { x: v.x / len, y: v.y / len, z: v.z / len };
  }

  onCollision(callback: (result: CollisionResult) => void): () => void {
    this._collisionCallbacks.push(callback);
    return () => { this._collisionCallbacks = this._collisionCallbacks.filter(c => c !== callback); };
  }

  applyImpulse(bodyId: string, impulse: Vec3): void {
    const body = this._bodies.get(bodyId);
    if (!body || body.anchored) return;
    body.velocity.x += impulse.x * body.inverseMass;
    body.velocity.y += impulse.y * body.inverseMass;
    body.velocity.z += impulse.z * body.inverseMass;
  }

  applyForce(bodyId: string, force: Vec3, dt: number): void {
    const body = this._bodies.get(bodyId);
    if (!body || body.anchored) return;
    body.velocity.x += (force.x * body.inverseMass) * dt;
    body.velocity.y += (force.y * body.inverseMass) * dt;
    body.velocity.z += (force.z * body.inverseMass) * dt;
  }
}
