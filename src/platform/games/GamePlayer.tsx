import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../../supabase/client';
import { useAuth } from '../auth/AuthContext';
import { Game, PlayerState } from '../../types';
import { GameRenderer } from '../../engine/rendering/Renderer';
import { GameSession } from '../../engine/services/GameSession';
import { X, Users, MessageSquare, Send, Heart, Shield, Wifi, WifiOff, Maximize2, Minimize2 } from 'lucide-react';

interface GamePlayerProps {
  game: Game;
  serverId?: string;
  channelId?: string;
  onLeave: () => void;
}

interface ChatEntry {
  id: string;
  username: string;
  message: string;
  timestamp: number;
  type: 'chat' | 'system';
}

export function GamePlayer({ game, serverId, channelId, onLeave }: GamePlayerProps) {
  const { profile } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const sessionRef = useRef<GameSession | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const mouseRef = useRef({ x: 0, y: 0, locked: false });
  const yawRef = useRef(0);
  const inputUpdateRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [connecting, setConnecting] = useState(true);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const [players, setPlayers] = useState<PlayerState[]>([]);
  const [localHealth, setLocalHealth] = useState(100);
  const [chatMessages, setChatMessages] = useState<ChatEntry[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(true);
  const [showPlayers, setShowPlayers] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [ping, setPing] = useState(0);
  const pingStartRef = useRef(0);

  useEffect(() => {
    if (!canvasRef.current || !profile) return;
    initGame();
    return () => cleanup();
  }, [profile]);

  async function initGame() {
    if (!canvasRef.current || !profile) return;

    const canvas = canvasRef.current;
    const renderer = new GameRenderer({
      canvas,
      width: canvas.clientWidth || 1280,
      height: canvas.clientHeight || 720,
      shadows: true,
      antialias: true,
    });
    rendererRef.current = renderer;

    const session = new GameSession();
    sessionRef.current = session;

    session.onConnected.connect(() => {
      setConnecting(false);
      setConnected(true);
      appendSystemMessage(`Connected to ${game.title}`);
      pingStartRef.current = Date.now();
    });

    session.onDisconnected.connect(() => {
      setConnected(false);
      appendSystemMessage('Disconnected from server');
    });

    session.onPlayerJoined.connect((state) => {
      renderer.createPlayerMesh(state.id, state.avatar_data);
      appendSystemMessage(`${state.username} joined the game`);
      setPlayers(prev => [...prev.filter(p => p.id !== state.id), state]);
    });

    session.onPlayerLeft.connect((id) => {
      renderer.removePlayerMesh(id);
      setPlayers(prev => {
        const leaving = prev.find(p => p.id === id);
        if (leaving) appendSystemMessage(`${leaving.username} left the game`);
        return prev.filter(p => p.id !== id);
      });
    });

    session.onPlayerUpdated.connect((state) => {
      renderer.updatePlayerMesh(state.id, state);
      setPlayers(prev => prev.map(p => p.id === state.id ? state : p));
    });

    session.onChatMessage.connect((_, username, message) => {
      appendChatMessage(username, message);
    });

    renderer.onRender((dt) => {
      const s = sessionRef.current;
      if (!s) return;
      const localState = s.getLocalPlayerState();
      renderer.updatePlayerMesh(localState.id, localState);
      renderer.setLocalPlayer(localState.id);
      setLocalHealth(localState.health);
    });

    renderer.start();

    const effectiveChannelId = channelId ?? `${game.id}_default_${Date.now()}`;
    const effectiveServerId = serverId ?? 'local';

    try {
      renderer.loadScene(game.scene_data);
      await session.join({
        game,
        serverId: effectiveServerId,
        channelId: effectiveChannelId,
        userId: profile.id,
        username: profile.username,
        avatarData: profile.avatar_data ?? {},
      });
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
      setConnecting(false);
    }

    setupInputHandlers(canvas);
    startInputLoop();
    trackGameSession();
  }

  function setupInputHandlers(canvas: HTMLCanvasElement) {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.code);
      if (e.code === 'KeyC') setShowChat(v => !v);
      if (e.code === 'Tab') { e.preventDefault(); setShowPlayers(v => !v); }
    };
    const handleKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.code);

    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === canvas) {
        yawRef.current -= e.movementX * 0.15;
      }
    };

    canvas.addEventListener('click', () => {
      canvas.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
      mouseRef.current.locked = document.pointerLockElement === canvas;
    });

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);

    const resizeObserver = new ResizeObserver(() => {
      if (rendererRef.current && canvas) {
        rendererRef.current.resize(canvas.clientWidth, canvas.clientHeight);
      }
    });
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      resizeObserver.disconnect();
    };
  }

  function startInputLoop() {
    inputUpdateRef.current = setInterval(() => {
      const keys = keysRef.current;
      sessionRef.current?.setInput({
        forward: keys.has('KeyW') || keys.has('ArrowUp'),
        backward: keys.has('KeyS') || keys.has('ArrowDown'),
        left: keys.has('KeyA') || keys.has('ArrowLeft'),
        right: keys.has('KeyD') || keys.has('ArrowRight'),
        jump: keys.has('Space'),
        sprint: keys.has('ShiftLeft'),
        yaw: yawRef.current,
      });
    }, 1000 / 60);
  }

  async function trackGameSession() {
    if (!profile || !game.id) return;
    await supabase.from('game_sessions').insert({
      game_id: game.id,
      server_id: serverId ?? null,
      user_id: profile.id,
    });
    await supabase.from('games').update({
      visit_count: (game.visit_count ?? 0) + 1,
      active_players: (game.active_players ?? 0) + 1,
    }).eq('id', game.id);
  }

  async function cleanup() {
    if (inputUpdateRef.current) clearInterval(inputUpdateRef.current);
    await sessionRef.current?.leave();
    rendererRef.current?.dispose();
    if (document.pointerLockElement) document.exitPointerLock();
    if (game.id && profile) {
      await supabase.from('games').update({ active_players: Math.max(0, (game.active_players ?? 1) - 1) }).eq('id', game.id);
    }
  }

  function appendChatMessage(username: string, message: string) {
    setChatMessages(prev => [...prev.slice(-49), {
      id: Math.random().toString(36), username, message,
      timestamp: Date.now(), type: 'chat',
    }]);
  }

  function appendSystemMessage(message: string) {
    setChatMessages(prev => [...prev.slice(-49), {
      id: Math.random().toString(36), username: '', message,
      timestamp: Date.now(), type: 'system',
    }]);
  }

  async function sendChat() {
    if (!chatInput.trim() || !sessionRef.current) return;
    sessionRef.current.sendChatMessage(chatInput.trim());
    appendChatMessage(profile?.username ?? 'You', chatInput.trim());
    setChatInput('');
  }

  async function handleLeave() {
    await cleanup();
    onLeave();
  }

  useEffect(() => {
    const interval = setInterval(() => {
      pingStartRef.current = Date.now();
      setTimeout(() => setPing(Date.now() - pingStartRef.current), 10);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div ref={containerRef} className={`relative bg-black flex flex-col ${fullscreen ? 'fixed inset-0 z-50' : 'h-screen'}`}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {connecting && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-950/90 z-10">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white font-bold text-lg">{game.title}</p>
            <p className="text-gray-400 text-sm mt-1">Connecting to server...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-950/90 z-10">
          <div className="bg-gray-900 border border-red-800 rounded-2xl p-8 max-w-md text-center">
            <WifiOff className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="text-white font-bold text-lg mb-2">Connection Failed</p>
            <p className="text-gray-400 text-sm mb-4">{error}</p>
            <button onClick={handleLeave}
              className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors">
              Return to Hub
            </button>
          </div>
        </div>
      )}

      {!connecting && !error && (
        <>
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 z-10 pointer-events-none">
            <div className="flex items-center gap-2">
              <button onClick={handleLeave} className="pointer-events-auto bg-gray-900/80 backdrop-blur border border-gray-700/50 rounded-xl px-3 py-1.5 text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-gray-800 transition-colors">
                <X className="w-3.5 h-3.5" /> Leave
              </button>
              <div className="bg-gray-900/80 backdrop-blur border border-gray-700/50 rounded-xl px-3 py-1.5 text-white text-xs font-semibold flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                {game.title}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="bg-gray-900/80 backdrop-blur border border-gray-700/50 rounded-xl px-3 py-1.5 text-white text-xs flex items-center gap-2">
                <Wifi className="w-3 h-3 text-emerald-400" />
                {ping}ms
                <span className="text-gray-500">|</span>
                <Users className="w-3 h-3" />
                {players.length + 1}
              </div>
              <button onClick={() => setShowPlayers(!showPlayers)}
                className="pointer-events-auto bg-gray-900/80 backdrop-blur border border-gray-700/50 rounded-xl p-1.5 text-gray-400 hover:text-white transition-colors">
                <Users className="w-4 h-4" />
              </button>
              <button onClick={() => setFullscreen(!fullscreen)}
                className="pointer-events-auto bg-gray-900/80 backdrop-blur border border-gray-700/50 rounded-xl p-1.5 text-gray-400 hover:text-white transition-colors">
                {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10">
            <div className="w-2 h-2 rounded-full border-2 border-white/70 bg-white/20" />
          </div>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10">
            <div className="bg-gray-900/80 backdrop-blur border border-gray-700/50 rounded-xl px-6 py-2">
              <div className="flex items-center gap-2 mb-1">
                <Heart className="w-3.5 h-3.5 text-red-400" />
                <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full transition-all"
                    style={{ width: `${localHealth}%` }}
                  />
                </div>
                <span className="text-white text-xs font-semibold">{localHealth}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>WASD: Move</span>
                <span>Space: Jump</span>
                <span>Shift: Sprint</span>
                <span>Click: Lock Mouse</span>
                <span>C: Chat</span>
              </div>
            </div>
          </div>

          {showPlayers && (
            <div className="absolute top-16 right-4 bg-gray-900/90 backdrop-blur border border-gray-700 rounded-xl w-56 z-10">
              <div className="px-4 py-3 border-b border-gray-700">
                <span className="text-white text-sm font-semibold flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-400" />
                  Players ({players.length + 1})
                </span>
              </div>
              <div className="max-h-64 overflow-y-auto p-2 space-y-1">
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-blue-900/20 border border-blue-700/30">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                  <span className="text-blue-300 text-xs font-medium">{profile?.username} (You)</span>
                  <span className="ml-auto text-red-400 text-xs flex items-center gap-1">
                    <Heart className="w-2.5 h-2.5" />{localHealth}
                  </span>
                </div>
                {players.map(p => (
                  <div key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-800">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                    <span className="text-gray-300 text-xs">{p.username}</span>
                    <span className="ml-auto text-red-400 text-xs flex items-center gap-1">
                      <Heart className="w-2.5 h-2.5" />{p.health}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showChat && (
            <div className="absolute bottom-24 left-4 w-72 z-10">
              <div className="bg-gray-900/80 backdrop-blur border border-gray-700/50 rounded-xl overflow-hidden">
                <div className="h-36 overflow-y-auto p-3 space-y-1">
                  {chatMessages.slice(-20).map(msg => (
                    <div key={msg.id} className="text-xs leading-relaxed">
                      {msg.type === 'system' ? (
                        <span className="text-gray-500 italic">{msg.message}</span>
                      ) : (
                        <>
                          <span className="text-blue-400 font-semibold">{msg.username}: </span>
                          <span className="text-gray-300">{msg.message}</span>
                        </>
                      )}
                    </div>
                  ))}
                  {chatMessages.length === 0 && (
                    <p className="text-gray-600 text-xs italic">No messages yet</p>
                  )}
                </div>
                <form onSubmit={(e) => { e.preventDefault(); sendChat(); }}
                  className="flex border-t border-gray-700">
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    placeholder="Chat..."
                    className="flex-1 bg-transparent text-white text-xs px-3 py-2 focus:outline-none placeholder-gray-600"
                    maxLength={200}
                  />
                  <button type="submit" className="px-3 text-blue-400 hover:text-blue-300 transition-colors">
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
