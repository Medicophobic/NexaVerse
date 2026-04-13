import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../../supabase/client';
import { Game, GameServer, Profile, Notification } from '../../types';
import { HubPage } from '../hub/HubPage';
import { StudioEditor } from '../studio/StudioEditor';
import { GamePlayer } from '../games/GamePlayer';
import { ServerBrowser } from '../games/ServerBrowser';
import { MarketplacePage } from '../marketplace/MarketplacePage';
import { SocialPage } from '../social/SocialPage';
import {
  Gamepad2, Home, Code2, ShoppingBag, Users, Bell, Settings,
  LogOut, Coins, Crown, ChevronRight, Maximize2, Star, Zap, Menu, X,
} from 'lucide-react';

type AppView =
  | { type: 'hub' }
  | { type: 'studio'; game?: Game }
  | { type: 'server-browser'; game: Game }
  | { type: 'game'; game: Game; serverId: string; channelId: string }
  | { type: 'marketplace' }
  | { type: 'social' }
  | { type: 'profile' };

export function PlatformShell() {
  const { profile, signOut, refreshProfile } = useAuth();
  const [view, setView] = useState<AppView>({ type: 'hub' });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [onlineFriendsCount, setOnlineFriendsCount] = useState(0);

  useEffect(() => {
    if (profile) {
      loadNotifications();
    }
  }, [profile]);

  async function loadNotifications() {
    const { data } = await supabase.from('notifications')
      .select('*').eq('user_id', profile!.id).eq('is_read', false)
      .order('created_at', { ascending: false }).limit(10);
    setNotifications(data ?? []);
  }

  async function markNotificationsRead() {
    if (!profile || notifications.length === 0) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', profile.id).eq('is_read', false);
    setNotifications([]);
  }

  function handlePlayGame(game: Game) {
    setView({ type: 'server-browser', game });
  }

  function handleJoinServer(game: Game, server: GameServer) {
    setView({ type: 'game', game, serverId: server.id, channelId: server.channel_id });
  }

  function handleCreateServer(game: Game, region: string) {
    const channelId = `${game.id}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    setView({ type: 'game', game, serverId: 'auto', channelId });
  }

  function handleEditGame(game: Game) {
    setView({ type: 'studio', game });
  }

  function handleCreateGame() {
    setView({ type: 'studio' });
  }

  function handlePlaytest(game: Game) {
    const channelId = `playtest_${Date.now()}`;
    setView({ type: 'game', game, serverId: 'playtest', channelId });
  }

  const unreadCount = notifications.length;
  const avatarLetter = (profile?.username?.[0] ?? 'U').toUpperCase();
  const nexacoins = profile?.nexacoins ?? 0;

  if (view.type === 'game') {
    return (
      <GamePlayer
        game={view.game}
        serverId={view.serverId}
        channelId={view.channelId}
        onLeave={() => setView({ type: 'hub' })}
      />
    );
  }

  if (view.type === 'studio') {
    return (
      <StudioEditor
        game={view.game}
        onClose={() => setView({ type: 'hub' })}
        onPlaytest={handlePlaytest}
      />
    );
  }

  if (view.type === 'server-browser' && view.game) {
    return (
      <ServerBrowser
        game={view.game}
        onJoinServer={(server) => handleJoinServer(view.game, server)}
        onCreateServer={(region) => handleCreateServer(view.game, region)}
        onBack={() => setView({ type: 'hub' })}
      />
    );
  }

  if (view.type === 'marketplace') {
    return <MarketplacePage onClose={() => setView({ type: 'hub' })} />;
  }

  if (view.type === 'social') {
    return <SocialPage onClose={() => setView({ type: 'hub' })} />;
  }

  const navItems = [
    { icon: Home, label: 'Home', view: 'hub' as const, badge: null },
    { icon: Code2, label: 'Studio', view: 'studio' as const, badge: null },
    { icon: ShoppingBag, label: 'Marketplace', view: 'marketplace' as const, badge: null },
    { icon: Users, label: 'Social', view: 'social' as const, badge: onlineFriendsCount > 0 ? String(onlineFriendsCount) : null },
  ];

  return (
    <div className="h-screen bg-gray-950 flex overflow-hidden">
      <aside className={`${sidebarOpen ? 'w-56' : 'w-16'} bg-gray-900 border-r border-gray-800 flex flex-col shrink-0 transition-all duration-200 overflow-hidden`}>
        <div className="h-14 flex items-center px-4 border-b border-gray-800 gap-3 shrink-0">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <Gamepad2 className="w-4 h-4 text-white" />
          </div>
          {sidebarOpen && <span className="text-white font-black text-lg tracking-tight">NexaVerse</span>}
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ icon: Icon, label, view: navView, badge }) => {
            const isActive = view.type === navView || (navView === 'hub' && view.type === 'hub');
            return (
              <button
                key={label}
                onClick={() => setView({ type: navView as AppView['type'] } as AppView)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
                    : 'text-gray-500 hover:text-white hover:bg-gray-800'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {sidebarOpen && (
                  <>
                    <span className="text-sm font-medium flex-1 text-left">{label}</span>
                    {badge && (
                      <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {badge}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-800 space-y-2">
          <div className={`flex items-center gap-3 px-3 py-2 ${sidebarOpen ? '' : 'justify-center'}`}>
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 cursor-pointer"
              onClick={() => setShowUserMenu(!showUserMenu)}>
              {avatarLetter}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold truncate">{profile?.display_name || profile?.username}</p>
                <div className="flex items-center gap-1 text-amber-400 text-xs">
                  <Coins className="w-2.5 h-2.5" />
                  {nexacoins.toLocaleString()} NC
                </div>
              </div>
            )}
          </div>
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center justify-center p-2 text-gray-600 hover:text-gray-400 transition-colors">
            <Menu className="w-3.5 h-3.5" />
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center px-4 gap-3 shrink-0">
          <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-xl px-3 py-1.5">
            <Coins className="w-4 h-4 text-amber-400" />
            <span className="text-amber-400 font-bold text-sm">{nexacoins.toLocaleString()}</span>
            <span className="text-gray-500 text-xs">NC</span>
          </div>

          {profile?.is_premium && (
            <div className="flex items-center gap-1 bg-amber-900/30 border border-amber-700/50 rounded-xl px-3 py-1.5">
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-amber-400 font-bold text-xs">Premium</span>
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications) markNotificationsRead(); }}
                className="relative p-2 text-gray-500 hover:text-white bg-gray-800 rounded-xl border border-gray-700 transition-colors"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 top-10 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-80 z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                    <span className="text-white font-semibold text-sm">Notifications</span>
                    <button onClick={() => setShowNotifications(false)} className="text-gray-500 hover:text-white">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-gray-500 text-sm">No new notifications</div>
                    ) : notifications.map(n => (
                      <div key={n.id} className="px-4 py-3 border-b border-gray-800 hover:bg-gray-800 transition-colors">
                        <p className="text-white text-sm font-medium">{n.title}</p>
                        <p className="text-gray-400 text-xs mt-0.5">{n.body}</p>
                        <p className="text-gray-600 text-xs mt-1">{new Date(n.created_at).toLocaleTimeString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-xl px-3 py-1.5 hover:bg-gray-700 transition-colors"
              >
                <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center text-white font-bold text-xs">
                  {avatarLetter}
                </div>
                <span className="text-white text-sm font-medium">{profile?.username}</span>
                <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 top-10 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-48 z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-800">
                    <p className="text-white font-semibold text-sm">{profile?.display_name || profile?.username}</p>
                    <p className="text-gray-500 text-xs">@{profile?.username}</p>
                  </div>
                  <div className="p-2 space-y-1">
                    <button className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 text-sm transition-colors">
                      <Settings className="w-3.5 h-3.5" /> Settings
                    </button>
                    {!profile?.is_premium && (
                      <button className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-amber-400 hover:bg-amber-900/20 text-sm transition-colors">
                        <Crown className="w-3.5 h-3.5" /> Get Premium
                      </button>
                    )}
                    <button
                      onClick={async () => { setShowUserMenu(false); await signOut(); }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-red-400 hover:bg-red-900/20 text-sm transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-hidden flex flex-col">
          <HubPage
            onPlayGame={handlePlayGame}
            onEditGame={handleEditGame}
            onCreateGame={handleCreateGame}
          />
        </main>
      </div>

      {(showNotifications || showUserMenu) && (
        <div className="fixed inset-0 z-40" onClick={() => { setShowNotifications(false); setShowUserMenu(false); }} />
      )}
    </div>
  );
}
