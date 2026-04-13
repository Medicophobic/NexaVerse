import { useState, useEffect } from 'react';
import { supabase } from '../../supabase/client';
import { useAuth } from '../auth/AuthContext';
import { MarketplaceListing, Wallet, Transaction } from '../../types';
import {
  ShoppingBag, Coins, TrendingUp, Package, Palette, Music, Code2,
  Search, Filter, Star, ShoppingCart, X, CheckCircle2,
} from 'lucide-react';

const ITEM_TYPES = ['All', 'model', 'texture', 'audio', 'script', 'avatar', 'gamepass'];
const SORT_OPTIONS = ['newest', 'popular', 'cheapest', 'expensive'];

interface MarketplacePageProps {
  onClose: () => void;
}

export function MarketplacePage({ onClose }: MarketplacePageProps) {
  const { profile, refreshProfile } = useAuth();
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'browse' | 'sell' | 'wallet'>('browse');
  const [selectedType, setSelectedType] = useState('All');
  const [sortBy, setSortBy] = useState('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [purchaseModal, setPurchaseModal] = useState<MarketplaceListing | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);

  const [newListing, setNewListing] = useState({ title: '', description: '', price: 100, item_type: 'model' });

  useEffect(() => {
    loadData();
  }, [profile]);

  async function loadData() {
    setLoading(true);
    const [listingsRes, walletRes, txRes] = await Promise.all([
      supabase.from('marketplace_listings')
        .select('*, seller:profiles(username, display_name, avatar_url)')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(48),
      profile ? supabase.from('wallets').select('*').eq('user_id', profile.id).maybeSingle() : Promise.resolve({ data: null }),
      profile ? supabase.from('transactions').select('*').eq('from_user_id', profile.id).order('created_at', { ascending: false }).limit(20) : Promise.resolve({ data: [] }),
    ]);
    setListings(listingsRes.data ?? []);
    setWallet(walletRes.data as Wallet | null);
    setTransactions(txRes.data ?? []);
    setLoading(false);
  }

  async function handlePurchase(listing: MarketplaceListing) {
    if (!profile || !wallet) return;
    if (wallet.nexacoins < listing.price) return;
    setPurchasing(true);
    try {
      const { error } = await supabase.from('wallets').update({
        nexacoins: wallet.nexacoins - listing.price,
        total_spent: (wallet.total_spent ?? 0) + listing.price,
      }).eq('user_id', profile.id);
      if (error) throw error;

      await supabase.from('purchases').insert({
        buyer_id: profile.id,
        listing_id: listing.id,
        seller_id: listing.seller_id,
        amount_paid: listing.price,
        currency: 'nexacoins',
      });

      await supabase.from('transactions').insert({
        from_user_id: profile.id,
        to_user_id: listing.seller_id,
        amount: listing.price,
        currency: 'nexacoins',
        transaction_type: 'purchase',
        description: `Purchase: ${listing.title}`,
        reference_id: listing.id,
      });

      await supabase.from('marketplace_listings').update({
        total_sales: (listing.total_sales ?? 0) + 1,
      }).eq('id', listing.id);

      setWallet(prev => prev ? { ...prev, nexacoins: prev.nexacoins - listing.price } : prev);
      setPurchaseSuccess(true);
      await refreshProfile();
      setTimeout(() => { setPurchaseSuccess(false); setPurchaseModal(null); }, 1500);
    } catch (e) {
      console.error('Purchase failed:', e);
    }
    setPurchasing(false);
  }

  async function createListing() {
    if (!profile || !newListing.title) return;
    const { error } = await supabase.from('marketplace_listings').insert({
      seller_id: profile.id,
      title: newListing.title,
      description: newListing.description,
      item_type: newListing.item_type,
      price: newListing.price,
      currency: 'nexacoins',
      is_active: true,
    });
    if (!error) {
      setNewListing({ title: '', description: '', price: 100, item_type: 'model' });
      loadData();
    }
  }

  const typeIcon = (type: string) => {
    switch (type) {
      case 'model': return <Package className="w-3.5 h-3.5" />;
      case 'texture': return <Palette className="w-3.5 h-3.5" />;
      case 'audio': return <Music className="w-3.5 h-3.5" />;
      case 'script': return <Code2 className="w-3.5 h-3.5" />;
      default: return <Star className="w-3.5 h-3.5" />;
    }
  };

  const filteredListings = listings.filter(l => {
    if (selectedType !== 'All' && l.item_type !== selectedType) return false;
    if (searchQuery && !l.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === 'cheapest') return a.price - b.price;
    if (sortBy === 'expensive') return b.price - a.price;
    if (sortBy === 'popular') return b.total_sales - a.total_sales;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center">
        <div className="flex items-center gap-3">
          <ShoppingBag className="w-5 h-5 text-blue-400" />
          <h1 className="text-white font-bold text-lg">NexaMarket</h1>
        </div>
        {wallet && (
          <div className="ml-6 flex items-center gap-2 bg-gray-800 rounded-xl px-3 py-1.5">
            <Coins className="w-4 h-4 text-amber-400" />
            <span className="text-amber-400 font-bold text-sm">{wallet.nexacoins.toLocaleString()}</span>
            <span className="text-gray-500 text-xs">NC</span>
          </div>
        )}
        <div className="ml-auto flex gap-2">
          {(['browse', 'sell', 'wallet'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-xl text-sm font-medium capitalize transition-colors ${
                activeTab === tab ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}>
              {tab}
            </button>
          ))}
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1.5 ml-2">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'browse' && (
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search marketplace..."
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none">
                {SORT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
              {ITEM_TYPES.map(type => (
                <button key={type} onClick={() => setSelectedType(type)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    selectedType === type ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}>
                  {typeIcon(type)}
                  {type === 'All' ? 'All Items' : type.charAt(0).toUpperCase() + type.slice(1) + 's'}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="bg-gray-900 rounded-xl overflow-hidden animate-pulse">
                    <div className="aspect-square bg-gray-800" />
                    <div className="p-2 space-y-1">
                      <div className="h-3 bg-gray-800 rounded" />
                      <div className="h-3 bg-gray-800 rounded w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {filteredListings.map(listing => (
                  <div key={listing.id}
                    onClick={() => setPurchaseModal(listing)}
                    className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden cursor-pointer hover:border-gray-600 transition-all hover:-translate-y-0.5 group">
                    <div className="aspect-square bg-gradient-to-br from-gray-800 to-gray-700 flex items-center justify-center">
                      <div className="text-gray-600 group-hover:scale-110 transition-transform">
                        {typeIcon(listing.item_type)}
                      </div>
                    </div>
                    <div className="p-2">
                      <p className="text-white text-xs font-medium truncate">{listing.title}</p>
                      <p className="text-gray-500 text-xs truncate">{(listing as MarketplaceListing & { seller?: { username: string } }).seller?.username}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="flex items-center gap-1 text-amber-400 text-xs font-bold">
                          <Coins className="w-3 h-3" />{listing.price.toLocaleString()}
                        </span>
                        <span className="text-gray-600 text-xs">{listing.total_sales} sold</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && filteredListings.length === 0 && (
              <div className="text-center py-20">
                <ShoppingBag className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500">No items found</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'sell' && (
          <div className="max-w-lg mx-auto px-6 py-8">
            <h2 className="text-white font-bold text-lg mb-1">Sell on NexaMarket</h2>
            <p className="text-gray-500 text-sm mb-6">Earn NexaCoins by selling your creations</p>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Item Title</label>
                <input value={newListing.title} onChange={e => setNewListing(p => ({ ...p, title: e.target.value }))}
                  placeholder="Enter item name..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Description</label>
                <textarea value={newListing.description} onChange={e => setNewListing(p => ({ ...p, description: e.target.value }))}
                  rows={3} placeholder="Describe your item..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Type</label>
                  <select value={newListing.item_type} onChange={e => setNewListing(p => ({ ...p, item_type: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none">
                    {['model', 'texture', 'audio', 'script', 'avatar', 'gamepass'].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Price (NC)</label>
                  <input type="number" value={newListing.price} min={0}
                    onChange={e => setNewListing(p => ({ ...p, price: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="bg-gray-800 rounded-xl p-3 flex items-center justify-between text-sm">
                <span className="text-gray-400">You receive (after 30% fee):</span>
                <span className="text-amber-400 font-bold flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5" />
                  {Math.floor(newListing.price * 0.7).toLocaleString()} NC
                </span>
              </div>
              <button onClick={createListing}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-colors">
                List Item for Sale
              </button>
            </div>
          </div>
        )}

        {activeTab === 'wallet' && (
          <div className="max-w-2xl mx-auto px-6 py-8">
            <h2 className="text-white font-bold text-lg mb-6">Wallet</h2>
            {wallet ? (
              <>
                <div className="grid grid-cols-3 gap-4 mb-8">
                  <div className="bg-gradient-to-br from-amber-900/40 to-amber-950/40 border border-amber-800/40 rounded-2xl p-4 text-center">
                    <Coins className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                    <p className="text-2xl font-black text-amber-400">{wallet.nexacoins.toLocaleString()}</p>
                    <p className="text-gray-500 text-xs mt-0.5">NexaCoins</p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-900/40 to-blue-950/40 border border-blue-800/40 rounded-2xl p-4 text-center">
                    <TrendingUp className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                    <p className="text-2xl font-black text-blue-400">{wallet.total_earned.toLocaleString()}</p>
                    <p className="text-gray-500 text-xs mt-0.5">Total Earned</p>
                  </div>
                  <div className="bg-gradient-to-br from-red-900/40 to-red-950/40 border border-red-800/40 rounded-2xl p-4 text-center">
                    <ShoppingCart className="w-6 h-6 text-red-400 mx-auto mb-2" />
                    <p className="text-2xl font-black text-red-400">{wallet.total_spent.toLocaleString()}</p>
                    <p className="text-gray-500 text-xs mt-0.5">Total Spent</p>
                  </div>
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-800">
                    <h3 className="text-white font-semibold text-sm">Recent Transactions</h3>
                  </div>
                  {transactions.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 text-sm">No transactions yet</div>
                  ) : (
                    <div className="divide-y divide-gray-800">
                      {transactions.map(tx => (
                        <div key={tx.id} className="flex items-center justify-between px-4 py-3">
                          <div>
                            <p className="text-white text-sm">{tx.description || tx.transaction_type}</p>
                            <p className="text-gray-500 text-xs">{new Date(tx.created_at).toLocaleDateString()}</p>
                          </div>
                          <span className={`font-bold text-sm ${tx.from_user_id === profile?.id ? 'text-red-400' : 'text-emerald-400'}`}>
                            {tx.from_user_id === profile?.id ? '-' : '+'}{tx.amount.toLocaleString()} NC
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">Loading wallet...</div>
            )}
          </div>
        )}
      </div>

      {purchaseModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm">
            {purchaseSuccess ? (
              <div className="text-center py-4">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <p className="text-white font-bold">Purchase Successful!</p>
                <p className="text-gray-400 text-sm mt-1">{purchaseModal.title} is yours</p>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-white font-bold">{purchaseModal.title}</h3>
                  <button onClick={() => setPurchaseModal(null)} className="text-gray-500 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-gray-400 text-sm mb-4">{purchaseModal.description || 'No description'}</p>
                <div className="bg-gray-800 rounded-xl p-3 mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Price</span>
                    <span className="text-amber-400 font-bold flex items-center gap-1">
                      <Coins className="w-3.5 h-3.5" />{purchaseModal.price.toLocaleString()} NC
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Your Balance</span>
                    <span className={`font-bold ${(wallet?.nexacoins ?? 0) >= purchaseModal.price ? 'text-emerald-400' : 'text-red-400'}`}>
                      {(wallet?.nexacoins ?? 0).toLocaleString()} NC
                    </span>
                  </div>
                  {(wallet?.nexacoins ?? 0) < purchaseModal.price && (
                    <p className="text-red-400 text-xs mt-2">Insufficient NexaCoins</p>
                  )}
                </div>
                <button
                  onClick={() => handlePurchase(purchaseModal)}
                  disabled={purchasing || (wallet?.nexacoins ?? 0) < purchaseModal.price}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors">
                  {purchasing ? 'Processing...' : `Buy for ${purchaseModal.price.toLocaleString()} NC`}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
