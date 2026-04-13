import { useState, useEffect } from 'react';
import { supabase } from '../../supabase/client';
import { useAuth } from '../auth/AuthContext';
import { Game } from '../../types';
import { SAMPLE_GAMES } from '../../data/SampleGames';
import { Search, Star, Users, TrendingUp, Gamepad2, Play, Clock, Flame, Sparkles } from 'lucide-react';

const GENRES = ['All', 'Adventure', 'Obby', 'RPG', 'Simulator', 'Tycoon', 'FPS', 'Horror', 'Racing', 'Social'];

const MOCK_THUMBNAILS = [
  'https://images.pexels.com/photos/3165335/pexels-photo-3165335.jpeg?w=400&h=225&fit=crop',
  'https://images.pexels.com/photos/1174746/pexels-photo-1174746.jpeg?w=400&h=225&fit=crop',
  'https://images.pexels.com/photos/2244746/pexels-photo-2244746.jpeg?w=400&h=225&fit=crop',
  'https://images.pexels.com/photos/3761504/pexels-photo-3761504.jpeg?w=400&h=225&fit=crop',
  'https://images.pexels.com/photos/1670977/pexels-photo-1670977.jpeg?w=400&h=225&fit=crop',
  'https://images.pexels.com/photos/2846814/pexels-photo-2846814.jpeg?w=400&h=225&fit=crop',
  'https://images.pexels.com/photos/1670732/pexels-photo-1670732.jpeg?w=400&h=225&fit=crop',
  'https://images.pexels.com/photos/3165335/pexels-photo-3165335.jpeg?w=400&h=225&fit=crop',
];

interface HubPageProps {
  onPlayGame: (game: Game) => void;
  onEditGame: (game: Game) => void;
  onCreateGame: () => void;
}

export function HubPage({ onPlayGame, onEditGame, onCreateGame }: HubPageProps) {
  const { profile } = useAuth();
  const [games, setGames] = useState<Game[]>([]);
  const [myGames, setMyGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [activeSection, setActiveSection] = useState<'featured' | 'trending' | 'new' | 'mine'>('featured');

  useEffect(() => {
    loadGames();
  }, [selectedGenre]);

  async function loadGames() {
    setLoading(true);
    let query = supabase.from('games')
      .select('*, creator:profiles(username, display_name, avatar_url)')
      .eq('is_published', true)
      .order('visit_count', { ascending: false })
      .limit(24);

    if (selectedGenre !== 'All') query = query.eq('genre', selectedGenre);
    const { data } = await query;

    // Combine DB games with sample games
    const sampleGamesToAdd = data && data.length > 0 ? [] : SAMPLE_GAMES.slice(0, 12);
    const allGames = (data ?? []).concat(sampleGamesToAdd) as Game[];

    const gamesWithThumbs = allGames.map((g, i) => ({
      ...g,
      thumbnail_url: g.thumbnail_url || MOCK_THUMBNAILS[i % MOCK_THUMBNAILS.length],
    })).filter(g => selectedGenre === 'All' || g.genre === selectedGenre);
    setGames(gamesWithThumbs as Game[]);

    if (profile) {
      const { data: myData } = await supabase.from('games')
        .select('*').eq('creator_id', profile.id).order('updated_at', { ascending: false });
      setMyGames((myData ?? []).map((g, i) => ({
        ...g,
        thumbnail_url: g.thumbnail_url || MOCK_THUMBNAILS[i % MOCK_THUMBNAILS.length],
      })) as Game[]);
    }

    setLoading(false);
  }

  const filteredGames = games.filter(g =>
    searchQuery === '' || g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const featuredGames = filteredGames.filter(g => g.is_featured).slice(0, 6);
  const trendingGames = [...filteredGames].sort((a, b) => b.active_players - a.active_players).slice(0, 12);
  const newGames = [...filteredGames].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 12);

  const displayedGames = activeSection === 'mine' ? myGames :
    activeSection === 'featured' ? featuredGames :
    activeSection === 'trending' ? trendingGames : newGames;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-950">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-8">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white mb-1">
              Welcome back, <span className="text-blue-400">{profile?.display_name ?? profile?.username ?? 'Player'}</span>
            </h1>
            <p className="text-gray-500 text-sm">Discover thousands of experiences created by the community</p>
          </div>
          <div className="flex gap-3">
            <button onClick={onCreateGame}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm">
              <Sparkles className="w-4 h-4" />
              Create Game
            </button>
          </div>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search games, experiences..."
            className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-11 pr-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors text-sm"
          />
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          {GENRES.map(g => (
            <button key={g} onClick={() => setSelectedGenre(g)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedGenre === g
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
              }`}>
              {g}
            </button>
          ))}
        </div>

        <div className="flex gap-1 mb-6 bg-gray-900 rounded-xl p-1 border border-gray-800 w-fit">
          {([
            { id: 'featured', label: 'Featured', icon: Star },
            { id: 'trending', label: 'Trending', icon: TrendingUp },
            { id: 'new', label: 'New', icon: Flame },
            { id: 'mine', label: 'My Games', icon: Gamepad2 },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveSection(id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeSection === id
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-500 hover:text-white'
              }`}>
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800 animate-pulse">
                <div className="aspect-video bg-gray-800" />
                <div className="p-3 space-y-2">
                  <div className="h-4 bg-gray-800 rounded w-3/4" />
                  <div className="h-3 bg-gray-800 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : displayedGames.length === 0 ? (
          <div className="text-center py-20">
            <Gamepad2 className="w-16 h-16 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">
              {activeSection === 'mine' ? 'You haven\'t created any games yet' : 'No games found'}
            </p>
            {activeSection === 'mine' && (
              <button onClick={onCreateGame}
                className="mt-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors text-sm">
                Create Your First Game
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {displayedGames.map(game => (
              <GameCard
                key={game.id}
                game={game}
                isOwn={game.creator_id === profile?.id}
                onPlay={() => onPlayGame(game)}
                onEdit={() => onEditGame(game)}
              />
            ))}
          </div>
        )}

        {activeSection !== 'mine' && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-900/40 to-blue-950/40 border border-blue-800/40 rounded-2xl p-6">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center mb-4">
                <Users className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-white font-bold mb-1">Active Players</h3>
              <p className="text-3xl font-black text-blue-400">
                {games.reduce((acc, g) => acc + g.active_players, 0).toLocaleString()}
              </p>
              <p className="text-gray-500 text-sm mt-1">playing right now</p>
            </div>
            <div className="bg-gradient-to-br from-emerald-900/40 to-emerald-950/40 border border-emerald-800/40 rounded-2xl p-6">
              <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center mb-4">
                <Gamepad2 className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-white font-bold mb-1">Total Games</h3>
              <p className="text-3xl font-black text-emerald-400">
                {games.length.toLocaleString()}
              </p>
              <p className="text-gray-500 text-sm mt-1">published experiences</p>
            </div>
            <div className="bg-gradient-to-br from-amber-900/40 to-amber-950/40 border border-amber-800/40 rounded-2xl p-6">
              <div className="w-10 h-10 bg-amber-600 rounded-xl flex items-center justify-center mb-4">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-white font-bold mb-1">Total Visits</h3>
              <p className="text-3xl font-black text-amber-400">
                {games.reduce((acc, g) => acc + g.visit_count, 0).toLocaleString()}
              </p>
              <p className="text-gray-500 text-sm mt-1">all-time plays</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GameCard({ game, isOwn, onPlay, onEdit }: { game: Game; isOwn: boolean; onPlay: () => void; onEdit: () => void }) {
  const [hovered, setHovered] = useState(false);
  const rating = game.like_count + game.dislike_count > 0
    ? Math.round((game.like_count / (game.like_count + game.dislike_count)) * 100)
    : null;

  return (
    <div
      className="group bg-gray-900 border border-gray-800 rounded-xl overflow-hidden cursor-pointer hover:border-gray-600 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onPlay}
    >
      <div className="relative aspect-video overflow-hidden bg-gray-800">
        <img
          src={game.thumbnail_url || 'https://images.pexels.com/photos/3165335/pexels-photo-3165335.jpeg?w=400&h=225&fit=crop'}
          alt={game.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className={`absolute inset-0 bg-black/50 flex items-center justify-center gap-2 transition-opacity ${hovered ? 'opacity-100' : 'opacity-0'}`}>
          <button onClick={(e) => { e.stopPropagation(); onPlay(); }}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm">
            <Play className="w-3.5 h-3.5 fill-white" />
            Play
          </button>
          {isOwn && (
            <button onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm">
              Edit
            </button>
          )}
        </div>
        {game.active_players > 0 && (
          <div className="absolute top-2 right-2 bg-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            {game.active_players}
          </div>
        )}
        {game.is_featured && (
          <div className="absolute top-2 left-2 bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <Star className="w-2.5 h-2.5 fill-white" />
            Featured
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="text-white font-semibold text-sm truncate mb-0.5">{game.title}</h3>
        <p className="text-gray-500 text-xs truncate mb-2">{(game as Game & { creator?: { username: string } }).creator?.username ?? 'Unknown'}</p>
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {game.visit_count.toLocaleString()}
          </span>
          {rating !== null && (
            <span className={`font-semibold ${rating >= 80 ? 'text-emerald-400' : rating >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
              {rating}% liked
            </span>
          )}
          <span className="bg-gray-800 px-2 py-0.5 rounded text-gray-500">{game.genre}</span>
        </div>
      </div>
    </div>
  );
}
