import { Instance, Vector3Value, Color3Value } from './Instance';
import { Signal } from './Signal';

export class Part extends Instance {
  constructor(name = 'Part') {
    super('Part', name);
  }

  protected _initDefaultProperties(): void {
    this.setProperty('Size', { x: 4, y: 1.2, z: 4 } as Vector3Value);
    this.setProperty('Position', { x: 0, y: 0.6, z: 0 } as Vector3Value);
    this.setProperty('Rotation', { x: 0, y: 0, z: 0 } as Vector3Value);
    this.setProperty('Color', { r: 0.639, g: 0.635, b: 0.647 } as Color3Value);
    this.setProperty('Material', 'SmoothPlastic');
    this.setProperty('Anchored', true);
    this.setProperty('CanCollide', true);
    this.setProperty('Transparency', 0);
    this.setProperty('Shape', 'Block');
    this.setProperty('CastShadow', true);
    this.setProperty('Reflectance', 0);
  }

  get size(): Vector3Value { return this.getProperty('Size') as Vector3Value; }
  set size(v: Vector3Value) { this.setProperty('Size', v); }

  get position(): Vector3Value { return this.getProperty('Position') as Vector3Value; }
  set position(v: Vector3Value) { this.setProperty('Position', v); }

  get rotation(): Vector3Value { return this.getProperty('Rotation') as Vector3Value; }
  set rotation(v: Vector3Value) { this.setProperty('Rotation', v); }

  get color(): Color3Value { return this.getProperty('Color') as Color3Value; }
  set color(v: Color3Value) { this.setProperty('Color', v); }

  get anchored(): boolean { return this.getProperty('Anchored') as boolean; }
  set anchored(v: boolean) { this.setProperty('Anchored', v); }

  get canCollide(): boolean { return this.getProperty('CanCollide') as boolean; }
  set canCollide(v: boolean) { this.setProperty('CanCollide', v); }

  get transparency(): number { return this.getProperty('Transparency') as number; }
  set transparency(v: number) { this.setProperty('Transparency', v); }

  get material(): string { return this.getProperty('Material') as string; }
  set material(v: string) { this.setProperty('Material', v); }
}

export class SpawnLocation extends Part {
  constructor(name = 'SpawnLocation') {
    super(name);
    this.setProperty('TeamColor', { r: 0.106, g: 0.165, b: 0.208 } as Color3Value);
    this.setProperty('AllowTeamChangeOnTouch', true);
    this.setProperty('Enabled', true);
    this.setProperty('Duration', 0);
    this.setProperty('Color', { r: 0.294, g: 0.592, b: 0.294 } as Color3Value);
  }
}

export class Model extends Instance {
  constructor(name = 'Model') {
    super('Model', name);
  }

  getPrimaryPart(): Part | null {
    const primary = this.getProperty('PrimaryPart') as string | null;
    if (!primary) return null;
    return this.findFirstChild(primary) as Part | null;
  }
}

export class Script extends Instance {
  readonly _type: 'ServerScript' | 'LocalScript' | 'ModuleScript';

  constructor(scriptType: 'ServerScript' | 'LocalScript' | 'ModuleScript' = 'ServerScript', name?: string) {
    super(scriptType, name ?? scriptType);
    this._type = scriptType;
    this.setProperty('Source', '');
    this.setProperty('Enabled', true);
  }

  get source(): string { return this.getProperty('Source') as string; }
  set source(v: string) { this.setProperty('Source', v); }

  get enabled(): boolean { return this.getProperty('Enabled') as boolean; }
  set enabled(v: boolean) { this.setProperty('Enabled', v); }
}

export class BaseLightInstance extends Instance {
  constructor(className: string, name?: string) {
    super(className, name ?? className);
    this.setProperty('Brightness', 1);
    this.setProperty('Color', { r: 1, g: 1, b: 1 } as Color3Value);
    this.setProperty('Enabled', true);
    this.setProperty('Shadows', true);
  }
}

export class PointLight extends BaseLightInstance {
  constructor(name = 'PointLight') {
    super('PointLight', name);
    this.setProperty('Range', 16);
  }
}

export class SpotLight extends BaseLightInstance {
  constructor(name = 'SpotLight') {
    super('SpotLight', name);
    this.setProperty('Angle', 45);
    this.setProperty('Range', 16);
  }
}

export class DirectionalLight extends BaseLightInstance {
  constructor(name = 'DirectionalLight') {
    super('DirectionalLight', name);
  }
}

export class RemoteEvent extends Instance {
  readonly OnServerEvent = new Signal<[string, ...unknown[]]>();
  readonly OnClientEvent = new Signal<[...unknown[]]>();

  constructor(name = 'RemoteEvent') {
    super('RemoteEvent', name);
  }

  fireServer(...args: unknown[]): void {
    this.OnServerEvent.fire('client', ...args);
  }

  fireClient(player: string, ...args: unknown[]): void {
    this.OnClientEvent.fire(...args);
  }

  fireAllClients(...args: unknown[]): void {
    this.OnClientEvent.fire(...args);
  }
}

export class RemoteFunction extends Instance {
  onServerInvoke: ((...args: unknown[]) => unknown) | null = null;
  onClientInvoke: ((...args: unknown[]) => unknown) | null = null;

  constructor(name = 'RemoteFunction') {
    super('RemoteFunction', name);
  }

  invokeServer(...args: unknown[]): Promise<unknown> {
    return new Promise(resolve => {
      if (this.onServerInvoke) {
        resolve(this.onServerInvoke(...args));
      } else {
        resolve(null);
      }
    });
  }

  invokeClient(...args: unknown[]): Promise<unknown> {
    return new Promise(resolve => {
      if (this.onClientInvoke) {
        resolve(this.onClientInvoke(...args));
      } else {
        resolve(null);
      }
    });
  }
}

export class BindableEvent extends Instance {
  readonly Event = new Signal<unknown[]>();

  constructor(name = 'BindableEvent') {
    super('BindableEvent', name);
  }

  fire(...args: unknown[]): void {
    this.Event.fire(...args);
  }
}

export class BindableFunction extends Instance {
  onInvoke: ((...args: unknown[]) => unknown) | null = null;

  constructor(name = 'BindableFunction') {
    super('BindableFunction', name);
  }

  invoke(...args: unknown[]): unknown {
    if (this.onInvoke) return this.onInvoke(...args);
    return null;
  }
}

export class StringValue extends Instance {
  constructor(name = 'StringValue') {
    super('StringValue', name);
    this.setProperty('Value', '');
  }
  get value(): string { return this.getProperty('Value') as string; }
  set value(v: string) { this.setProperty('Value', v); }
}

export class NumberValue extends Instance {
  constructor(name = 'NumberValue') {
    super('NumberValue', name);
    this.setProperty('Value', 0);
  }
  get value(): number { return this.getProperty('Value') as number; }
  set value(v: number) { this.setProperty('Value', v); }
}

export class BoolValue extends Instance {
  constructor(name = 'BoolValue') {
    super('BoolValue', name);
    this.setProperty('Value', false);
  }
  get value(): boolean { return this.getProperty('Value') as boolean; }
  set value(v: boolean) { this.setProperty('Value', v); }
}

export class IntValue extends NumberValue {
  constructor(name = 'IntValue') {
    super(name);
  }
}

export class Humanoid extends Instance {
  readonly Died = new Signal<[]>();
  readonly HealthChanged = new Signal<[number]>();
  readonly Running = new Signal<[number]>();
  readonly Jumping = new Signal<[]>();
  readonly Landed = new Signal<[]>();

  constructor(name = 'Humanoid') {
    super('Humanoid', name);
    this.setProperty('Health', 100);
    this.setProperty('MaxHealth', 100);
    this.setProperty('WalkSpeed', 16);
    this.setProperty('JumpPower', 50);
    this.setProperty('AutoRotate', true);
  }

  get health(): number { return this.getProperty('Health') as number; }
  set health(v: number) {
    const old = this.health;
    const clamped = Math.max(0, Math.min(v, this.maxHealth));
    this.setProperty('Health', clamped);
    this.HealthChanged.fire(clamped);
    if (clamped <= 0 && old > 0) this.Died.fire();
  }

  get maxHealth(): number { return this.getProperty('MaxHealth') as number; }
  set maxHealth(v: number) { this.setProperty('MaxHealth', v); }

  get walkSpeed(): number { return this.getProperty('WalkSpeed') as number; }
  set walkSpeed(v: number) { this.setProperty('WalkSpeed', v); }

  get jumpPower(): number { return this.getProperty('JumpPower') as number; }
  set jumpPower(v: number) { this.setProperty('JumpPower', v); }

  takeDamage(amount: number): void {
    this.health = this.health - amount;
  }
}

export class Character extends Model {
  readonly humanoid: Humanoid;

  constructor(name = 'Character') {
    super(name);
    this.humanoid = new Humanoid();
    this.humanoid.parent = this;
  }
}

export function createInstance(className: string, name?: string): Instance {
  switch (className) {
    case 'Part': return new Part(name);
    case 'SpawnLocation': return new SpawnLocation(name);
    case 'Model': return new Model(name);
    case 'ServerScript': return new Script('ServerScript', name);
    case 'LocalScript': return new Script('LocalScript', name);
    case 'ModuleScript': return new Script('ModuleScript', name);
    case 'RemoteEvent': return new RemoteEvent(name);
    case 'RemoteFunction': return new RemoteFunction(name);
    case 'BindableEvent': return new BindableEvent(name);
    case 'BindableFunction': return new BindableFunction(name);
    case 'PointLight': return new PointLight(name);
    case 'SpotLight': return new SpotLight(name);
    case 'DirectionalLight': return new DirectionalLight(name);
    case 'StringValue': return new StringValue(name);
    case 'NumberValue': return new NumberValue(name);
    case 'BoolValue': return new BoolValue(name);
    case 'IntValue': return new IntValue(name);
    case 'Humanoid': return new Humanoid(name);
    case 'Character': return new Character(name);
    default: return new Instance(className, name);
  }
}
