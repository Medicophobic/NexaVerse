import { ReplicationPacket, PlayerState } from '../../types';
import { Signal } from '../core/Signal';

export interface NetworkConfig {
  channelId: string;
  userId: string;
  username: string;
  onSend: (packet: ReplicationPacket) => void;
}

export interface DeltaState {
  sequence: number;
  timestamp: number;
  changes: Record<string, unknown>;
}

export class DeltaCompressor {
  private _lastState: Record<string, unknown> = {};

  compress(current: Record<string, unknown>): Record<string, unknown> {
    const delta: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(current)) {
      const last = this._lastState[key];
      if (!this._deepEqual(last, value)) {
        delta[key] = value;
      }
    }
    this._lastState = { ...current };
    return delta;
  }

  decompress(base: Record<string, unknown>, delta: Record<string, unknown>): Record<string, unknown> {
    return { ...base, ...delta };
  }

  private _deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (typeof a === 'object' && a !== null && b !== null) {
      const ka = Object.keys(a as Record<string, unknown>);
      const kb = Object.keys(b as Record<string, unknown>);
      if (ka.length !== kb.length) return false;
      for (const k of ka) {
        if (!this._deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
      }
      return true;
    }
    return false;
  }
}

export class InterpolationBuffer<T extends { timestamp: number }> {
  private _buffer: T[] = [];
  private _maxSize = 20;
  private _interpolationDelay = 100;

  push(state: T): void {
    this._buffer.push(state);
    while (this._buffer.length > this._maxSize) this._buffer.shift();
  }

  get(renderTime: number): T | null {
    const targetTime = renderTime - this._interpolationDelay;
    if (this._buffer.length < 2) return this._buffer[0] ?? null;

    for (let i = 0; i < this._buffer.length - 1; i++) {
      const a = this._buffer[i];
      const b = this._buffer[i + 1];
      if (a.timestamp <= targetTime && targetTime <= b.timestamp) {
        const t = (targetTime - a.timestamp) / (b.timestamp - a.timestamp);
        return this._interpolate(a, b, t);
      }
    }

    return this._buffer[this._buffer.length - 1];
  }

  private _interpolate(a: T, b: T, t: number): T {
    const result = { ...a };
    for (const key of Object.keys(b) as (keyof T)[]) {
      const av = a[key];
      const bv = b[key];
      if (typeof av === 'number' && typeof bv === 'number') {
        (result as Record<keyof T, unknown>)[key] = av + (bv - av) * t;
      } else if (typeof av === 'object' && av !== null && typeof bv === 'object' && bv !== null) {
        (result as Record<keyof T, unknown>)[key] = this._interpolateObj(
          av as Record<string, number>,
          bv as Record<string, number>,
          t
        );
      }
    }
    return result;
  }

  private _interpolateObj(a: Record<string, number>, b: Record<string, number>, t: number): Record<string, number> {
    const result: Record<string, number> = {};
    for (const key of Object.keys(b)) {
      result[key] = (a[key] ?? 0) + ((b[key] ?? 0) - (a[key] ?? 0)) * t;
    }
    return result;
  }
}

export class ReplicationLayer {
  readonly onPlayerJoined = new Signal<[PlayerState]>();
  readonly onPlayerLeft = new Signal<[string]>();
  readonly onStateUpdate = new Signal<[string, PlayerState]>();
  readonly onRemoteEvent = new Signal<[string, string, unknown[]]>();
  readonly onChatMessage = new Signal<[string, string, string]>();

  private _config: NetworkConfig;
  private _sequence = 0;
  private _compressor = new DeltaCompressor();
  private _playerBuffers: Map<string, InterpolationBuffer<PlayerState & { timestamp: number }>> = new Map();
  private _remoteEventHandlers: Map<string, ((...args: unknown[]) => void)[]> = new Map();
  private _pendingPackets: ReplicationPacket[] = [];
  private _sendRate = 20;
  private _sendInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: NetworkConfig) {
    this._config = config;
  }

  start(): void {
    this._sendInterval = setInterval(() => {
      this._flushPending();
    }, 1000 / this._sendRate);
  }

  stop(): void {
    if (this._sendInterval) {
      clearInterval(this._sendInterval);
      this._sendInterval = null;
    }
  }

  receivePacket(packet: ReplicationPacket): void {
    switch (packet.type) {
      case 'join': {
        const state = packet.data as PlayerState;
        if (!this._playerBuffers.has(state.id)) {
          this._playerBuffers.set(state.id, new InterpolationBuffer());
        }
        this.onPlayerJoined.fire(state);
        break;
      }
      case 'leave': {
        const playerId = packet.data as string;
        this._playerBuffers.delete(playerId);
        this.onPlayerLeft.fire(playerId);
        break;
      }
      case 'state_update': {
        const state = packet.data as PlayerState;
        let buffer = this._playerBuffers.get(state.id);
        if (!buffer) {
          buffer = new InterpolationBuffer();
          this._playerBuffers.set(state.id, buffer);
        }
        buffer.push({ ...state, timestamp: packet.timestamp });
        this.onStateUpdate.fire(state.id, state);
        break;
      }
      case 'remote_event': {
        const { eventName, args } = packet.data as { eventName: string; args: unknown[] };
        const handlers = this._remoteEventHandlers.get(eventName) ?? [];
        for (const handler of handlers) {
          try { handler(...args); } catch (e) { console.error('[ReplicationLayer] Remote event error:', e); }
        }
        this.onRemoteEvent.fire(packet.sender_id, eventName, args);
        break;
      }
      case 'chat': {
        const { message, username } = packet.data as { message: string; username: string };
        this.onChatMessage.fire(packet.sender_id, username, message);
        break;
      }
    }
  }

  sendPlayerState(state: Omit<PlayerState, 'id'>): void {
    const packet: ReplicationPacket = {
      type: 'state_update',
      sequence: ++this._sequence,
      timestamp: Date.now(),
      sender_id: this._config.userId,
      data: { ...state, id: this._config.userId },
    };
    this._pendingPackets.push(packet);
  }

  sendRemoteEvent(eventName: string, ...args: unknown[]): void {
    const packet: ReplicationPacket = {
      type: 'remote_event',
      sequence: ++this._sequence,
      timestamp: Date.now(),
      sender_id: this._config.userId,
      data: { eventName, args },
    };
    this._config.onSend(packet);
  }

  sendChatMessage(message: string): void {
    const packet: ReplicationPacket = {
      type: 'chat',
      sequence: ++this._sequence,
      timestamp: Date.now(),
      sender_id: this._config.userId,
      data: { message, username: this._config.username },
    };
    this._config.onSend(packet);
  }

  onRemoteEventFired(eventName: string, handler: (...args: unknown[]) => void): () => void {
    if (!this._remoteEventHandlers.has(eventName)) {
      this._remoteEventHandlers.set(eventName, []);
    }
    this._remoteEventHandlers.get(eventName)!.push(handler);
    return () => {
      const handlers = this._remoteEventHandlers.get(eventName);
      if (handlers) {
        const idx = handlers.indexOf(handler);
        if (idx >= 0) handlers.splice(idx, 1);
      }
    };
  }

  getInterpolatedState(playerId: string, renderTime: number): PlayerState | null {
    const buffer = this._playerBuffers.get(playerId);
    if (!buffer) return null;
    return buffer.get(renderTime);
  }

  private _flushPending(): void {
    for (const packet of this._pendingPackets) {
      this._config.onSend(packet);
    }
    this._pendingPackets = [];
  }

  sendJoin(state: PlayerState): void {
    const packet: ReplicationPacket = {
      type: 'join',
      sequence: ++this._sequence,
      timestamp: Date.now(),
      sender_id: this._config.userId,
      data: state,
    };
    this._config.onSend(packet);
  }

  sendLeave(): void {
    const packet: ReplicationPacket = {
      type: 'leave',
      sequence: ++this._sequence,
      timestamp: Date.now(),
      sender_id: this._config.userId,
      data: this._config.userId,
    };
    this._config.onSend(packet);
  }
}
