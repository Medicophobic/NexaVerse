import { Signal } from './Signal';

let _instanceIdCounter = 0;

export type PropertyValue = string | number | boolean | Vector3Value | Color3Value | null | undefined;

export interface Vector3Value { x: number; y: number; z: number; }
export interface Color3Value { r: number; g: number; b: number; }

export class Instance {
  readonly instanceId: number;
  private _name: string;
  private _parent: Instance | null = null;
  private _children: Instance[] = [];
  private _properties: Map<string, PropertyValue> = new Map();
  private _destroyed: boolean = false;
  private _tags: Set<string> = new Set();
  private _attributes: Map<string, PropertyValue> = new Map();

  readonly ChildAdded = new Signal<[Instance]>();
  readonly ChildRemoved = new Signal<[Instance]>();
  readonly Changed = new Signal<[string, PropertyValue, PropertyValue]>();
  readonly Destroying = new Signal<[]>();
  readonly AncestryChanged = new Signal<[Instance, Instance | null]>();

  constructor(public readonly className: string, name?: string) {
    this.instanceId = ++_instanceIdCounter;
    this._name = name ?? className;
    this._initDefaultProperties();
  }

  protected _initDefaultProperties(): void {}

  get name(): string { return this._name; }
  set name(value: string) {
    const old = this._name;
    this._name = value;
    if (old !== value) this.Changed.fire('Name', old, value);
  }

  get parent(): Instance | null { return this._parent; }
  set parent(newParent: Instance | null) {
    if (this._parent === newParent) return;
    if (this._destroyed) throw new Error(`Cannot set parent of destroyed instance ${this._name}`);

    const oldParent = this._parent;
    if (oldParent) {
      oldParent._children = oldParent._children.filter(c => c !== this);
      oldParent.ChildRemoved.fire(this);
    }
    this._parent = newParent;
    if (newParent) {
      newParent._children.push(this);
      newParent.ChildAdded.fire(this);
    }
    this.AncestryChanged.fire(this, newParent);
    this._propagateAncestryChanged(this, newParent);
  }

  private _propagateAncestryChanged(instance: Instance, newParent: Instance | null): void {
    for (const child of instance._children) {
      child.AncestryChanged.fire(child, newParent);
      child._propagateAncestryChanged(child, newParent);
    }
  }

  getProperty(name: string): PropertyValue {
    return this._properties.get(name) ?? null;
  }

  setProperty(name: string, value: PropertyValue): void {
    const old = this._properties.get(name) ?? null;
    if (old === value) return;
    this._properties.set(name, value);
    this.Changed.fire(name, old, value);
  }

  getAttribute(name: string): PropertyValue {
    return this._attributes.get(name) ?? null;
  }

  setAttribute(name: string, value: PropertyValue): void {
    this._attributes.set(name, value);
  }

  addTag(tag: string): void { this._tags.add(tag); }
  removeTag(tag: string): void { this._tags.delete(tag); }
  hasTag(tag: string): boolean { return this._tags.has(tag); }
  getTags(): string[] { return Array.from(this._tags); }

  getChildren(): Instance[] { return [...this._children]; }
  getDescendants(): Instance[] {
    const result: Instance[] = [];
    const stack = [...this._children];
    while (stack.length) {
      const inst = stack.pop()!;
      result.push(inst);
      stack.push(...inst._children);
    }
    return result;
  }

  findFirstChild(name: string, recursive = false): Instance | null {
    if (recursive) {
      for (const desc of this.getDescendants()) {
        if (desc.name === name) return desc;
      }
      return null;
    }
    return this._children.find(c => c.name === name) ?? null;
  }

  findFirstChildOfClass(className: string, recursive = false): Instance | null {
    if (recursive) {
      for (const desc of this.getDescendants()) {
        if (desc.className === className) return desc;
      }
      return null;
    }
    return this._children.find(c => c.className === className) ?? null;
  }

  findFirstAncestor(name: string): Instance | null {
    let current = this._parent;
    while (current) {
      if (current.name === name) return current;
      current = current._parent;
    }
    return null;
  }

  isAncestorOf(instance: Instance): boolean {
    let current = instance._parent;
    while (current) {
      if (current === this) return true;
      current = current._parent;
    }
    return false;
  }

  isDescendantOf(instance: Instance): boolean {
    return instance.isAncestorOf(this);
  }

  waitForChild(name: string, timeout = 10): Promise<Instance> {
    const existing = this.findFirstChild(name);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`WaitForChild: '${name}' timed out`)), timeout * 1000);
      const conn = this.ChildAdded.connect((child) => {
        if (child.name === name) {
          clearTimeout(timer);
          conn.disconnect();
          resolve(child);
        }
      });
    });
  }

  clone(): Instance {
    const cloned = new Instance(this.className, this._name);
    for (const [k, v] of this._properties) cloned._properties.set(k, v);
    for (const [k, v] of this._attributes) cloned._attributes.set(k, v);
    for (const tag of this._tags) cloned._tags.add(tag);
    for (const child of this._children) {
      const childClone = child.clone();
      childClone.parent = cloned;
    }
    return cloned;
  }

  destroy(): void {
    if (this._destroyed) return;
    this.Destroying.fire();
    this._destroyed = true;
    const childrenCopy = [...this._children];
    for (const child of childrenCopy) child.destroy();
    if (this._parent) {
      this._parent._children = this._parent._children.filter(c => c !== this);
      this._parent.ChildRemoved.fire(this);
      this._parent = null;
    }
    this.ChildAdded.disconnectAll();
    this.ChildRemoved.disconnectAll();
    this.Changed.disconnectAll();
    this.Destroying.disconnectAll();
    this.AncestryChanged.disconnectAll();
  }

  get isDestroyed(): boolean { return this._destroyed; }

  toJSON(): Record<string, unknown> {
    return {
      instanceId: this.instanceId,
      className: this.className,
      name: this._name,
      properties: Object.fromEntries(this._properties),
      attributes: Object.fromEntries(this._attributes),
      tags: Array.from(this._tags),
      children: this._children.map(c => c.toJSON()),
    };
  }

  toString(): string { return `${this.className}(${this._name})`; }
}
