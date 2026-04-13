import { useState, useEffect } from 'react';
import { supabase } from '../../supabase/client';
import { Game, GameServer } from '../../types';
import { Users, Globe, Clock, Zap, Play, ArrowLeft } from 'lucide-react';

const REGIONS = ['us-east', 'us-west', 'eu-west', 'asia-east', 'sa-east'];
const REGION_LABELS: Record<string, string> = {
  'us-east': 'North America East', 'us-west': 'North America West',
  'eu-west': 'Europe West', 'asia-east': 'Asia East', 'sa-east': 'South America',
};

interface ServerBrowserProps {
  game: Game;
  onJoinServer: (server: GameServer) => void;
  onCreateServer: (region: string) => void;
  onBack: () => void;
}

export function ServerBrowser({ game, onJoinServer, onCreateServer, onBack }: ServerBrowserProps) {
  const [servers, setServers] = useState<GameServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState('us-east');
  const [creatingServer, setCreatingServer] = useState(false);

  useEffect(() => {
    loadServers();
    const interval = setInterval(loadServers, 10000);
    return () => clearInterval(interval);
  }, [game.id]);

  async function loadServers() {
    const { data } = await supabase.from('game_servers')
      .select('*')
      .eq('game_id', game.id)
      .in('status', ['running', 'starting'])
      .order('current_players', { ascending: false });
    setServers(data ?? []);
    setLoading(false);
  }

  async function createServer() {
    setCreatingServer(true);
    try {
      const channelId = `${game.id}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const { data, error } = await supabase.from('game_servers').insert({
        game_id: game.id,
        region: selectedRegion,
        status: 'running',
        current_players: 0,
        max_players: game.max_players,
        channel_id: channelId,
      }).select().maybeSingle();
      if (error) throw error;
      if (data) onJoinServer(data as GameServer);
    } catch (e) {
      console.error('Failed to create server:', e);
    }
    setCreatingServer(false);
  }

  function timeSince(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  }

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={onBack} className="text-gray-500 hover:text-white transition-colors p-2 bg-gray-900 rounded-xl border border-gray-800">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">{game.title}</h1>
            <p className="text-gray-500 text-sm">Server Browser</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-gray-500 text-sm">{servers.length} server{servers.length !== 1 ? 's' : ''} available</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="md:col-span-2">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                <h2 className="text-white font-semibold text-sm">Active Servers</h2>
                <button onClick={loadServers} className="text-gray-500 hover:text-white text-xs transition-colors">Refresh</button>
              </div>
              {loading ? (
                <div className="p-8 text-center">
                  <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto" />
                </div>
              ) : servers.length === 0 ? (
                <div className="p-8 text-center">
                  <Globe className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No servers running</p>
                  <p className="text-gray-600 text-xs mt-1">Create one to start playing!</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-800">
                  {servers.map(server => (
                    <div key={server.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-800/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${
                          server.status === 'running' ? 'bg-emerald-400' :
                          server.status === 'starting' ? 'bg-amber-400 animate-pulse' : 'bg-gray-500'
                        }`} />
                        <div>
                          <p className="text-white text-sm font-medium">
                            {REGION_LABELS[server.region] ?? server.region}
                          </p>
                          <p className="text-gray-500 text-xs flex items-center gap-2">
                            <Clock className="w-3 h-3" />
                            {timeSince(server.started_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-sm text-white">
                            <Users className="w-3.5 h-3.5 text-gray-400" />
                            <span>{server.current_players}</span>
                            <span className="text-gray-600">/</span>
                            <span className="text-gray-400">{server.max_players}</span>
                          </div>
                          <div className="w-20 h-1.5 bg-gray-700 rounded-full overflow-hidden mt-1">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${(server.current_players / server.max_players) * 100}%` }}
                            />
                          </div>
                        </div>
                        <button
                          onClick={() => onJoinServer(server)}
                          disabled={server.current_players >= server.max_players}
                          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                          <Play className="w-3 h-3 fill-white" />
                          {server.current_players >= server.max_players ? 'Full' : 'Join'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-blue-400" />
                Create Server
              </h3>
              <div className="mb-3">
                <label className="block text-xs text-gray-500 mb-1.5">Region</label>
                {REGIONS.map(region => (
                  <button key={region} onClick={() => setSelectedRegion(region)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs mb-1 transition-colors ${
                      selectedRegion === region
                        ? 'bg-blue-900/40 text-blue-300 border border-blue-700/50'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                    }`}>
                    <span>{REGION_LABELS[region]}</span>
                    <Globe className="w-3 h-3" />
                  </button>
                ))}
              </div>
              <button onClick={createServer} disabled={creatingServer}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
                {creatingServer ? 'Creating...' : 'Create & Join'}
              </button>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <h3 className="text-white font-semibold text-sm mb-3">Game Info</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Max Players</span>
                  <span className="text-white">{game.max_players}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Genre</span>
                  <span className="text-white">{game.genre}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Visits</span>
                  <span className="text-white">{game.visit_count.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Active Players</span>
                  <span className="text-emerald-400">{game.active_players}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
