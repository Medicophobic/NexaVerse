import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabase/client';
import { useAuth } from '../auth/AuthContext';
import { Profile, ChatMessage, FriendRequest, Group } from '../../types';
import {
  Users, MessageSquare, UserPlus, UserCheck, UserX, Search,
  Send, Crown, Hash, Globe, X, Plus, CheckCircle, Circle,
} from 'lucide-react';

interface SocialPageProps {
  onClose: () => void;
}

export function SocialPage({ onClose }: SocialPageProps) {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'friends' | 'chat' | 'groups'>('friends');
  const [friends, setFriends] = useState<Profile[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [globalMessages, setGlobalMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [globalChannelId, setGlobalChannelId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (profile) {
      loadFriends();
      loadFriendRequests();
      loadGroups();
      loadOrCreateGlobalChannel();
    }
  }, [profile]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [globalMessages]);

  async function loadOrCreateGlobalChannel() {
    let { data: channel } = await supabase.from('chat_channels')
      .select('*').eq('name', 'Global').eq('channel_type', 'global').maybeSingle();
    if (!channel) {
      const { data } = await supabase.from('chat_channels').insert({
        name: 'Global', channel_type: 'global',
      }).select().maybeSingle();
      channel = data;
    }
    if (!channel) return;
    setGlobalChannelId(channel.id);
    loadMessages(channel.id);
    subscribeToMessages(channel.id);
  }

  async function loadMessages(channelId: string) {
    const { data } = await supabase.from('chat_messages')
      .select('*, sender:profiles(username, display_name, avatar_url)')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false })
      .limit(50);
    setGlobalMessages((data ?? []).reverse() as ChatMessage[]);
  }

  function subscribeToMessages(channelId: string) {
    const sub = supabase
      .channel(`chat:${channelId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `channel_id=eq.${channelId}`,
      }, async (payload) => {
        const { data } = await supabase.from('chat_messages')
          .select('*, sender:profiles(username, display_name, avatar_url)')
          .eq('id', payload.new.id)
          .maybeSingle();
        if (data) setGlobalMessages(prev => [...prev.slice(-99), data as ChatMessage]);
      })
      .subscribe();
    return () => supabase.removeChannel(sub);
  }

  async function sendGlobalMessage() {
    if (!chatInput.trim() || !profile || !globalChannelId) return;
    await supabase.from('chat_messages').insert({
      channel_id: globalChannelId,
      sender_id: profile.id,
      content: chatInput.trim(),
      message_type: 'text',
    });
    setChatInput('');
  }

  async function loadFriends() {
    if (!profile) return;
    const { data } = await supabase.from('friendships')
      .select('*, user1:profiles!friendships_user_id_1_fkey(id,username,display_name,avatar_url), user2:profiles!friendships_user_id_2_fkey(id,username,display_name,avatar_url)')
      .or(`user_id_1.eq.${profile.id},user_id_2.eq.${profile.id}`);
    const friendProfiles = (data ?? []).map((f: Record<string, unknown>) => {
      const u1 = f.user1 as Profile;
      const u2 = f.user2 as Profile;
      return u1?.id === profile.id ? u2 : u1;
    }).filter(Boolean) as Profile[];
    setFriends(friendProfiles);
  }

  async function loadFriendRequests() {
    if (!profile) return;
    const { data } = await supabase.from('friend_requests')
      .select('*, from_user:profiles!friend_requests_from_user_id_fkey(id,username,display_name,avatar_url)')
      .eq('to_user_id', profile.id)
      .eq('status', 'pending');
    setFriendRequests((data ?? []) as FriendRequest[]);
  }

  async function loadGroups() {
    const { data } = await supabase.from('groups')
      .select('*, owner:profiles(username, display_name)')
      .eq('is_public', true)
      .order('member_count', { ascending: false })
      .limit(20);
    setGroups((data ?? []) as Group[]);
  }

  async function searchUsers(query: string) {
    if (!query.trim()) { setSearchResults([]); return; }
    setSearching(true);
    const { data } = await supabase.from('profiles')
      .select('id,username,display_name,avatar_url')
      .ilike('username', `%${query}%`)
      .neq('id', profile?.id ?? '')
      .limit(10);
    setSearchResults((data ?? []) as Profile[]);
    setSearching(false);
  }

  async function sendFriendRequest(userId: string) {
    if (!profile) return;
    await supabase.from('friend_requests').upsert({
      from_user_id: profile.id,
      to_user_id: userId,
      status: 'pending',
    }, { onConflict: 'from_user_id,to_user_id' });
    await supabase.from('notifications').insert({
      user_id: userId,
      notification_type: 'friend_request',
      title: 'Friend Request',
      body: `${profile.username} sent you a friend request`,
      data: { from_user_id: profile.id },
    });
  }

  async function respondToRequest(requestId: string, accept: boolean) {
    const request = friendRequests.find(r => r.id === requestId);
    if (!request || !profile) return;

    await supabase.from('friend_requests').update({
      status: accept ? 'accepted' : 'rejected',
    }).eq('id', requestId);

    if (accept) {
      const uid1 = request.from_user_id < profile.id ? request.from_user_id : profile.id;
      const uid2 = request.from_user_id < profile.id ? profile.id : request.from_user_id;
      await supabase.from('friendships').insert({ user_id_1: uid1, user_id_2: uid2 });
      await loadFriends();
    }
    setFriendRequests(prev => prev.filter(r => r.id !== requestId));
  }

  async function joinGroup(groupId: string) {
    if (!profile) return;
    await supabase.from('group_members').upsert({
      group_id: groupId, user_id: profile.id, role: 'member',
    }, { onConflict: 'group_id,user_id' });
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-blue-400" />
          <h1 className="text-white font-bold text-lg">Social Hub</h1>
        </div>
        <div className="ml-6 flex gap-2">
          {([
            { id: 'friends', icon: Users, label: 'Friends' },
            { id: 'chat', icon: MessageSquare, label: 'Chat' },
            { id: 'groups', icon: Hash, label: 'Groups' },
          ] as const).map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                activeTab === id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}>
              <Icon className="w-4 h-4" />{label}
              {id === 'friends' && friendRequests.length > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center ml-0.5">
                  {friendRequests.length}
                </span>
              )}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="ml-auto text-gray-500 hover:text-white p-1.5">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex">
        {activeTab === 'friends' && (
          <div className="flex-1 overflow-y-auto max-w-3xl mx-auto w-full px-6 py-6">
            {friendRequests.length > 0 && (
              <div className="mb-6">
                <h2 className="text-white font-semibold mb-3 flex items-center gap-2 text-sm">
                  <UserPlus className="w-4 h-4 text-blue-400" />
                  Friend Requests ({friendRequests.length})
                </h2>
                <div className="space-y-2">
                  {friendRequests.map(req => (
                    <div key={req.id} className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        {(req.from_user as Profile)?.username?.[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-medium text-sm">{(req.from_user as Profile)?.display_name || (req.from_user as Profile)?.username}</p>
                        <p className="text-gray-500 text-xs">@{(req.from_user as Profile)?.username}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => respondToRequest(req.id, true)}
                          className="p-1.5 bg-emerald-900/30 hover:bg-emerald-800/50 border border-emerald-700/50 rounded-lg text-emerald-400 transition-colors">
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button onClick={() => respondToRequest(req.id, false)}
                          className="p-1.5 bg-red-900/20 hover:bg-red-900/40 border border-red-800/30 rounded-lg text-red-400 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-6">
              <h2 className="text-white font-semibold mb-3 text-sm">Find Players</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); searchUsers(e.target.value); }}
                  placeholder="Search by username..."
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              {searchResults.length > 0 && (
                <div className="mt-2 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  {searchResults.map(user => (
                    <div key={user.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-800 transition-colors">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center text-white font-bold text-xs">
                        {user.username[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="text-white text-sm font-medium">{user.display_name || user.username}</p>
                        <p className="text-gray-500 text-xs">@{user.username}</p>
                      </div>
                      {friends.some(f => f.id === user.id) ? (
                        <span className="flex items-center gap-1 text-emerald-400 text-xs">
                          <UserCheck className="w-3.5 h-3.5" /> Friends
                        </span>
                      ) : (
                        <button onClick={() => sendFriendRequest(user.id)}
                          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                          <UserPlus className="w-3 h-3" /> Add
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h2 className="text-white font-semibold mb-3 text-sm">
                Friends ({friends.length})
              </h2>
              {friends.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  <Users className="w-10 h-10 text-gray-700 mx-auto mb-2" />
                  <p>No friends yet. Search for players above!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {friends.map(friend => (
                    <div key={friend.id} className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                      <div className="relative">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center text-white font-bold text-sm">
                          {friend.username[0]?.toUpperCase()}
                        </div>
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-gray-500 rounded-full border-2 border-gray-900" />
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-medium text-sm">{friend.display_name || friend.username}</p>
                        <p className="text-gray-500 text-xs">@{friend.username}</p>
                      </div>
                      {friend.is_premium && (
                        <span className="text-amber-400 text-xs flex items-center gap-1">
                          <Crown className="w-3 h-3" /> Premium
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full">
            <div className="px-4 py-2 border-b border-gray-800 bg-gray-900 flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-400" />
              <span className="text-white font-semibold text-sm">Global Chat</span>
              <span className="text-gray-500 text-xs">All players online</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {globalMessages.map(msg => (
                <div key={msg.id} className={`flex gap-3 ${(msg.sender as Profile)?.id === profile?.id ? 'flex-row-reverse' : ''}`}>
                  <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {(msg.sender as Profile)?.username?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className={`max-w-xs ${(msg.sender as Profile)?.id === profile?.id ? 'items-end' : 'items-start'} flex flex-col`}>
                    <span className="text-gray-500 text-xs mb-0.5">{(msg.sender as Profile)?.username}</span>
                    <div className={`rounded-2xl px-3 py-2 text-sm ${
                      (msg.sender as Profile)?.id === profile?.id
                        ? 'bg-blue-600 text-white rounded-tr-sm'
                        : 'bg-gray-800 text-gray-200 rounded-tl-sm'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); sendGlobalMessage(); }}
              className="p-4 border-t border-gray-800 flex gap-2"
            >
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Message global chat..."
                className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                maxLength={500}
              />
              <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-4 transition-colors">
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {activeTab === 'groups' && (
          <div className="flex-1 overflow-y-auto max-w-4xl mx-auto w-full px-6 py-6">
            <h2 className="text-white font-bold text-lg mb-1">Groups</h2>
            <p className="text-gray-500 text-sm mb-6">Join communities and connect with players</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.map(group => (
                <div key={group.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-600 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                      {group.name[0]}
                    </div>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {group.member_count.toLocaleString()}
                    </span>
                  </div>
                  <h3 className="text-white font-semibold text-sm mb-1">{group.name}</h3>
                  <p className="text-gray-500 text-xs mb-3 line-clamp-2">{group.description || 'No description'}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 text-xs">by {(group.owner as Profile)?.username}</span>
                    <button onClick={() => joinGroup(group.id)}
                      className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                      <Plus className="w-3 h-3" /> Join
                    </button>
                  </div>
                </div>
              ))}
              {groups.length === 0 && (
                <div className="col-span-3 text-center py-12 text-gray-500">
                  <Hash className="w-10 h-10 text-gray-700 mx-auto mb-2" />
                  <p>No groups yet</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
