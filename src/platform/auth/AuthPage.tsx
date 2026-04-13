import { useState } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../../supabase/client';
import { Gamepad2, Zap, Globe, Users, Shield, Eye, EyeOff, ChevronLeft, Mail, Lock, CheckCircle2 } from 'lucide-react';

export function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (mode === 'signin') {
      const { error } = await signIn(email, password);
      if (error) setError(error);
    } else if (mode === 'signup') {
      if (username.length < 3) {
        setError('Username must be at least 3 characters');
        setLoading(false);
        return;
      }
      const { error } = await signUp(email, password, username);
      if (error) setError(error);
    } else if (mode === 'forgot') {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth?reset=true`,
        });
        if (error) throw error;
        setResetSent(true);
        setSuccess('Password reset link sent to your email!');
      } catch (e: any) {
        setError(e.message || 'Failed to send reset email');
      }
    }
    setLoading(false);
  }

  const features = [
    { icon: Globe, label: 'Infinite Worlds', desc: 'Explore thousands of player-created experiences' },
    { icon: Users, label: 'Play Together', desc: 'Real-time multiplayer with friends worldwide' },
    { icon: Zap, label: 'Build & Create', desc: 'Studio with Lua scripting and physics engine' },
    { icon: Shield, label: 'Safe Platform', desc: 'Anti-cheat, moderation, and secure economy' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex overflow-hidden">
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
          {[...Array(15)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full opacity-[0.02] bg-blue-400"
              style={{
                width: Math.random() * 300 + 100,
                height: Math.random() * 300 + 100,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animation: `pulse ${3 + Math.random() * 4}s infinite`,
              }}
            />
          ))}
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Gamepad2 className="w-8 h-8 text-white" />
            </div>
            <div>
              <span className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 tracking-tight">
                NexaVerse
              </span>
              <p className="text-slate-400 text-xs">Next Generation Gaming Platform</p>
            </div>
          </div>
          <p className="text-slate-300 text-lg max-w-sm font-light">Experience the future of multiplayer game creation and play.</p>
        </div>

        <div className="relative z-10 space-y-5">
          {features.map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex items-start gap-4 group">
              <div className="w-12 h-12 bg-slate-800/50 rounded-xl flex items-center justify-center shrink-0 border border-slate-700/50 group-hover:border-blue-500/30 transition-colors">
                <Icon className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <p className="text-slate-100 font-semibold text-sm">{label}</p>
                <p className="text-slate-400 text-xs leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="relative z-10">
          <p className="text-slate-600 text-xs">© 2025 NexaVerse. Where imagination becomes reality.</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 md:p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 justify-center mb-10">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
              <Gamepad2 className="w-7 h-7 text-white" />
            </div>
            <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
              NexaVerse
            </span>
          </div>

          <div className="bg-slate-900/60 backdrop-blur border border-slate-800/50 rounded-2xl p-8 shadow-2xl">
            {mode === 'forgot' && (
              <div className="mb-6">
                <button
                  onClick={() => {
                    setMode('signin');
                    setError('');
                    setSuccess('');
                    setResetSent(false);
                  }}
                  className="flex items-center gap-2 text-slate-400 hover:text-blue-400 text-sm transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back to Sign In
                </button>
              </div>
            )}

            <h2 className="text-2xl font-bold text-slate-100 mb-2">
              {mode === 'signin' && 'Welcome back'}
              {mode === 'signup' && 'Create your account'}
              {mode === 'forgot' && 'Reset your password'}
            </h2>
            <p className="text-slate-400 text-sm mb-8">
              {mode === 'signin' && 'Sign in to your NexaVerse account'}
              {mode === 'signup' && 'Join millions of players worldwide'}
              {mode === 'forgot' && 'Enter your email to receive a reset link'}
            </p>

            {mode !== 'forgot' && (
              <div className="flex gap-2 bg-slate-800/50 rounded-xl p-1 mb-8">
                <button
                  onClick={() => {
                    setMode('signin');
                    setError('');
                  }}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                    mode === 'signin'
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    setMode('signup');
                    setError('');
                  }}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                    mode === 'signup'
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Sign Up
                </button>
              </div>
            )}

            {resetSent ? (
              <div className="bg-emerald-900/20 border border-emerald-800/50 rounded-xl p-4 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-emerald-300 font-semibold text-sm">Check your email</p>
                  <p className="text-emerald-200/60 text-xs mt-1">
                    We've sent a password reset link to <strong>{email}</strong>
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'signup' && (
                  <div>
                    <label className="block text-sm text-slate-400 mb-2 font-medium">Username</label>
                    <input
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="CoolPlayer123"
                      className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:bg-slate-800/80 transition-all text-sm"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm text-slate-400 mb-2 font-medium">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="player@example.com"
                      className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3 pl-11 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:bg-slate-800/80 transition-all text-sm"
                      required
                    />
                  </div>
                </div>

                {mode !== 'forgot' && (
                  <div>
                    <label className="block text-sm text-slate-400 mb-2 font-medium">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3 pl-11 pr-11 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:bg-slate-800/80 transition-all text-sm"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-3 flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <div className="w-2 h-2 bg-red-400 rounded-full" />
                    </div>
                    <p className="text-red-300 text-sm">{error}</p>
                  </div>
                )}

                {success && (
                  <div className="bg-emerald-900/20 border border-emerald-800/50 rounded-xl p-3 flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
                    <p className="text-emerald-300 text-sm">{success}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:from-slate-700 disabled:to-slate-700 text-white font-semibold py-3 rounded-xl transition-all duration-200 text-sm mt-6 shadow-lg hover:shadow-blue-500/20"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Processing...
                    </span>
                  ) : mode === 'signin' ? (
                    'Sign In'
                  ) : mode === 'signup' ? (
                    'Create Account'
                  ) : (
                    'Send Reset Link'
                  )}
                </button>

                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => setMode('forgot')}
                    className="w-full text-blue-400 hover:text-blue-300 text-sm font-medium py-2 transition-colors"
                  >
                    Forgot your password?
                  </button>
                )}
              </form>
            )}

            {mode === 'signin' && !resetSent && (
              <p className="text-slate-400 text-sm text-center mt-6">
                No account yet?{' '}
                <button onClick={() => setMode('signup')} className="text-blue-400 hover:text-blue-300 font-semibold transition-colors">
                  Create one
                </button>
              </p>
            )}
          </div>

          <p className="text-slate-600 text-xs text-center mt-6">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
