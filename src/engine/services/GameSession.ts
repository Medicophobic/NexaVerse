import { supabase } from '../../supabase/client';
import { ReplicationLayer } from '../networking/ReplicationLayer';
import { PhysicsEngine } from '../physics/PhysicsEngine';
import { LuaEngine } from '../scripting/LuaEngine';
import { Signal } from '../core/Signal';
import { Game, PlayerState, SceneData, AvatarData } from '../../types';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface JoinGameOptions {
  game: Game;
  serverId: string;
  channelId: string;
  userId: string;
  username: string;
  avatarData: AvatarData;
}

export class GameSession {
  readonly onPlayerJoined = new Signal<[PlayerState]>();
  readonly onPlayerLeft = new Signal<[string]>();
  readonly onPlayerUpdated = new Signal<[PlayerState]>();
  readonly onChatMessage = new Signal<[string, string, string]>();
  readonly onConnected = new Signal<[]>();
  readonly onDisconnected = new Signal<[]>();
  readonly onError = new Signal<[string]>();

  private _game: Game | null = null;
  private _serverId: string = '';
  private _channelId: string = '';
  private _userId: string = '';
  private _username: string = '';
  private _players: Map<string, PlayerState> = new Map();
  private _channel: RealtimeChannel | null = null;
  private _replication: ReplicationLayer | null = null;
  private _physics: PhysicsEngine;
  private _luaEngine: LuaEngine;
  private _localPlayerState: PlayerState;
  private _connected = false;
  private _physicsUpdateInterval: ReturnType<typeof setInterval> | null = null;
  private _stateUpdateInterval: ReturnType<typeof setInterval> | null = null;
  private _inputState = {
    forward: false, backward: false, left: false, right: false, jump: false, sprint: false,
    pitch: 0, yaw: 0,
  };

  constructor() {
    this._physics = new PhysicsEngine();
    this._luaEngine = new LuaEngine();
    this._localPlayerState = this._createDefaultPlayerState('', '');
  }

  private _createDefaultPlayerState(id: string, username: string): PlayerState {
    return {
      id, username,
      position: { x: 0, y: 5, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      health: 100, max_health: 100,
      is_jumping: false,
      animation_state: 'idle',
      avatar_data: {},
    };
  }

  async join(options: JoinGameOptions): Promise<void> {
    this._game = options.game;
    this._serverId = options.serverId;
    this._channelId = options.channelId;
    this._userId = options.userId;
    this._username = options.username;
    this._localPlayerState = this._createDefaultPlayerState(options.userId, options.username);
    this._localPlayerState.avatar_data = options.avatarData;

    const spawnPoints = options.game.scene_data?.spawn_points ?? [];
    if (spawnPoints.length > 0) {
      const spawn = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
      this._localPlayerState.position = { ...spawn.position, y: spawn.position.y + 1 };
    }

    this._physics.setGravity({ x: 0, y: options.game.settings.gravity ?? -196.2, z: 0 });

    const physicsBodyId = this._userId;
    this._physics.createBody(physicsBodyId, {
      position: { ...this._localPlayerState.position },
      size: { x: 1, y: 2.8, z: 1 },
      mass: 70,
      restitution: 0.05,
      friction: 0.9,
      canCollide: true,
      anchored: false,
    });

    for (const obj of options.game.scene_data?.objects ?? []) {
      if (obj.type === 'Part') {
        const props = obj.properties as Record<string, unknown>;
        const size = (props.Size as { x: number; y: number; z: number }) ?? obj.scale;
        this._physics.createBody(obj.id, {
          position: { ...obj.position },
          size: { x: size.x, y: size.y, z: size.z },
          anchored: Boolean(props.Anchored ?? true),
          canCollide: Boolean(props.CanCollide ?? true),
          mass: 100,
        });
      }
    }

    this._setupRealtime();
    this._startPhysicsLoop();
    this._startStateSync();
    this._runGameScripts(options.game);
  }

  private _setupRealtime(): void {
    this._replication = new ReplicationLayer({
      channelId: this._channelId,
      userId: this._userId,
      username: this._username,
      onSend: (packet) => {
        this._channel?.send({
          type: 'broadcast',
          event: 'game_packet',
          payload: packet,
        });
      },
    });

    this._channel = supabase.channel(`game:${this._channelId}`, {
      config: { broadcast: { self: false } },
    });

    this._channel
      .on('broadcast', { event: 'game_packet' }, ({ payload }) => {
        this._replication?.receivePacket(payload);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        for (const presence of newPresences) {
          const state = presence as unknown as PlayerState;
          if (state.id && state.id !== this._userId) {
            this._players.set(state.id, state);
            this.onPlayerJoined.fire(state);
          }
        }
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        for (const presence of leftPresences) {
          const state = presence as unknown as PlayerState;
          if (state.id) {
            this._players.delete(state.id);
            this.onPlayerLeft.fire(state.id);
          }
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          this._connected = true;
          await this._channel!.track(this._localPlayerState);
          this._replication?.start();
          this._replication?.sendJoin(this._localPlayerState);
          this.onConnected.fire();
        }
      });

    this._replication.onPlayerJoined.connect((state) => {
      this._players.set(state.id, state);
      this.onPlayerJoined.fire(state);
    });

    this._replication.onPlayerLeft.connect((id) => {
      this._players.delete(id);
      this.onPlayerLeft.fire(id);
    });

    this._replication.onStateUpdate.connect((id, state) => {
      this._players.set(id, state);
      this.onPlayerUpdated.fire(state);
    });

    this._replication.onChatMessage.connect((senderId, username, message) => {
      this.onChatMessage.fire(senderId, username, message);
    });
  }

  private _startPhysicsLoop(): void {
    let lastTime = performance.now();
    this._physicsUpdateInterval = setInterval(() => {
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      this._processInput(dt);
      this._physics.update(dt);

      const body = this._physics.getBody(this._userId);
      if (body) {
        this._localPlayerState.position = { ...body.position };
        this._localPlayerState.velocity = { ...body.velocity };
        this._localPlayerState.is_jumping = !body.onFloor;
        this._updateAnimationState(body.velocity, body.onFloor);
      }
    }, 1000 / 60);
  }

  private _processInput(dt: number): void {
    const body = this._physics.getBody(this._userId);
    if (!body) return;

    const speed = this._inputState.sprint ? 24 : 16;
    const yawRad = (this._inputState.yaw * Math.PI) / 180;
    const forward = { x: -Math.sin(yawRad), z: -Math.cos(yawRad) };

    const moveX = (this._inputState.right ? forward.z : 0) + (this._inputState.left ? -forward.z : 0) +
                  (this._inputState.forward ? forward.x : 0) + (this._inputState.backward ? -forward.x : 0);
    const moveZ = (this._inputState.right ? -forward.x : 0) + (this._inputState.left ? forward.x : 0) +
                  (this._inputState.forward ? forward.z : 0) + (this._inputState.backward ? -forward.z : 0);

    const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (len > 0) {
      body.velocity.x = (moveX / len) * speed;
      body.velocity.z = (moveZ / len) * speed;
    } else {
      body.velocity.x *= 0.85;
      body.velocity.z *= 0.85;
    }

    if (this._inputState.jump && body.onFloor) {
      body.velocity.y = 50;
      body.onFloor = false;
    }

    this._localPlayerState.rotation.y = this._inputState.yaw;
  }

  private _updateAnimationState(velocity: { x: number; y: number; z: number }, onFloor: boolean): void {
    const speed2d = Math.sqrt(velocity.x ** 2 + velocity.z ** 2);
    if (!onFloor) {
      this._localPlayerState.animation_state = 'jump';
    } else if (speed2d > 18) {
      this._localPlayerState.animation_state = 'run';
    } else if (speed2d > 2) {
      this._localPlayerState.animation_state = 'walk';
    } else {
      this._localPlayerState.animation_state = 'idle';
    }
  }

  private _startStateSync(): void {
    this._stateUpdateInterval = setInterval(() => {
      if (this._replication && this._connected) {
        this._replication.sendPlayerState({
          username: this._username,
          position: { ...this._localPlayerState.position },
          rotation: { ...this._localPlayerState.rotation },
          velocity: { ...this._localPlayerState.velocity },
          health: this._localPlayerState.health,
          max_health: this._localPlayerState.max_health,
          is_jumping: this._localPlayerState.is_jumping,
          animation_state: this._localPlayerState.animation_state,
          avatar_data: this._localPlayerState.avatar_data,
        });
      }
    }, 1000 / 20);
  }

  private _runGameScripts(game: Game): void {
    for (const script of game.scripts ?? []) {
      if (!script.enabled) continue;
      setTimeout(() => {
        try {
          this._luaEngine.execute(script.source, script.name);
        } catch (e) {
          console.error(`[GameSession] Script '${script.name}' error:`, e);
        }
      }, 100);
    }
  }

  setInput(input: Partial<typeof this._inputState>): void {
    Object.assign(this._inputState, input);
  }

  sendChatMessage(message: string): void {
    this._replication?.sendChatMessage(message);
  }

  getLocalPlayerState(): PlayerState { return { ...this._localPlayerState }; }
  getPlayers(): Map<string, PlayerState> { return new Map(this._players); }
  getGame(): Game | null { return this._game; }
  isConnected(): boolean { return this._connected; }

  async leave(): Promise<void> {
    if (this._physicsUpdateInterval) { clearInterval(this._physicsUpdateInterval); }
    if (this._stateUpdateInterval) { clearInterval(this._stateUpdateInterval); }
    this._replication?.sendLeave();
    this._replication?.stop();
    if (this._channel) {
      await this._channel.unsubscribe();
      this._channel = null;
    }
    this._connected = false;
    this.onDisconnected.fire();
  }
}
