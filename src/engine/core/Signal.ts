export type SignalCallback<T extends unknown[] = unknown[]> = (...args: T) => void;

export interface SignalConnection {
  disconnect(): void;
  connected: boolean;
}

export class Signal<T extends unknown[] = unknown[]> {
  private _callbacks: Map<symbol, SignalCallback<T>> = new Map();
  private _onceCallbacks: Map<symbol, SignalCallback<T>> = new Map();
  private _firing: boolean = false;
  private _pendingDisconnects: symbol[] = [];

  connect(callback: SignalCallback<T>): SignalConnection {
    const id = Symbol();
    this._callbacks.set(id, callback);
    return {
      disconnect: () => {
        if (this._firing) {
          this._pendingDisconnects.push(id);
        } else {
          this._callbacks.delete(id);
        }
      },
      get connected() {
        return true;
      },
    };
  }

  once(callback: SignalCallback<T>): SignalConnection {
    const id = Symbol();
    this._onceCallbacks.set(id, callback);
    return {
      disconnect: () => {
        this._onceCallbacks.delete(id);
      },
      get connected() {
        return true;
      },
    };
  }

  fire(...args: T): void {
    this._firing = true;
    for (const [, cb] of this._callbacks) {
      try { cb(...args); } catch (e) { console.error('[Signal] Error in callback:', e); }
    }
    for (const [id, cb] of this._onceCallbacks) {
      try { cb(...args); } catch (e) { console.error('[Signal] Error in once callback:', e); }
      this._onceCallbacks.delete(id);
    }
    this._firing = false;
    for (const id of this._pendingDisconnects) {
      this._callbacks.delete(id);
    }
    this._pendingDisconnects = [];
  }

  wait(): Promise<T> {
    return new Promise(resolve => {
      this.once((...args: T) => resolve(args));
    });
  }

  disconnectAll(): void {
    this._callbacks.clear();
    this._onceCallbacks.clear();
  }

  get connectionCount(): number {
    return this._callbacks.size + this._onceCallbacks.size;
  }
}
