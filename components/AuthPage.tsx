import React, { useState } from 'react';
import { api } from '../services/api';
import { 
  User, Mail, Lock, 
  Building2, Loader2, Users, ArrowRight 
} from 'lucide-react';

interface AuthPageProps {
  onLogin: (user: any, token?: string) => void;
  key?: React.Key;
}

// ✅ Inline Google SVG — no external image, never fails to load
const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M47.532 24.552c0-1.636-.132-3.2-.396-4.704H24.48v9.02h12.984c-.576 2.964-2.268 5.484-4.812 7.152v5.916h7.776c4.56-4.2 7.104-10.404 7.104-17.384z" fill="#4285F4"/>
    <path d="M24.48 48c6.48 0 11.928-2.148 15.9-5.832l-7.776-5.916c-2.148 1.44-4.908 2.292-8.124 2.292-6.24 0-11.532-4.224-13.428-9.888H3.024v6.12C6.996 42.948 15.168 48 24.48 48z" fill="#34A853"/>
    <path d="M11.052 28.656A14.86 14.86 0 0 1 10.2 24c0-1.62.276-3.204.852-4.656v-6.12H3.024A23.964 23.964 0 0 0 .48 24c0 3.876.924 7.548 2.544 10.776l7.776-6.12h.252z" fill="#FBBC05"/>
    <path d="M24.48 9.456c3.516 0 6.672 1.212 9.156 3.576l6.852-6.852C36.396 2.4 30.96 0 24.48 0 15.168 0 6.996 5.052 3.024 13.224l8.028 6.12c1.896-5.664 7.188-9.888 13.428-9.888z" fill="#EA4335"/>
  </svg>
);

const AuthPage = ({ onLogin }: AuthPageProps) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [familyId, setFamilyId] = useState('');

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await api.signInWithGoogle();
    } catch (err: any) {
      alert(`Google Login Error: ${err.message}\nName: ${err.name}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await api.login({ email, password }).then(user => onLogin(user, 'token'));
      } else {
        await api.register({ name, email, password, familyId });
        await api.login({ email, password }).then(user => onLogin(user, 'token'));
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden font-sans selection:bg-indigo-100 selection:text-indigo-900 p-4">
      
      {/* Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[100px]"></div>
      </div>

      <div className="bg-white w-full max-w-[480px] rounded-[2.5rem] shadow-2xl shadow-indigo-100/60 border border-white/50 relative z-10 overflow-hidden backdrop-blur-sm">
        
        {/* Header */}
        <div className="text-center pt-10 pb-6 px-8 bg-gradient-to-b from-white to-slate-50/50">
          <div className="inline-flex p-3.5 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-500/30 mb-6 ring-4 ring-indigo-50">
            <Building2 size={32} strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">
            {isLogin ? 'Welcome Back' : 'Get Started'}
          </h1>
          <p className="text-slate-500 font-medium text-sm">
            {isLogin ? 'Enter your credentials to access your dashboard' : 'Create your family rental group in seconds'}
          </p>
        </div>

        <div className="px-8 pb-10">
          
          {/* Toggle */}
          <div className="grid grid-cols-2 p-1.5 bg-slate-100 rounded-2xl gap-2 mb-6">
            <button
              type="button"
              onClick={() => setIsLogin(true)}
              className={`py-3 text-sm font-bold rounded-xl transition-all duration-300 ${
                isLogin 
                  ? 'bg-white text-slate-900 shadow-md shadow-slate-200 ring-1 ring-black/5' 
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200/50'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setIsLogin(false)}
              className={`py-3 text-sm font-bold rounded-xl transition-all duration-300 ${
                !isLogin 
                  ? 'bg-white text-slate-900 shadow-md shadow-slate-200 ring-1 ring-black/5' 
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200/50'
              }`}
            >
              Register
            </button>
          </div>

          {/* ✅ Google Button — uses inline SVG, always visible */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full h-14 bg-white border-2 border-slate-100 hover:border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl font-bold transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-70 mb-6"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          {/* Divider */}
          <div className="relative flex items-center mb-6">
            <div className="flex-grow border-t border-slate-100"></div>
            <span className="flex-shrink mx-4 text-slate-400 text-xs font-bold uppercase tracking-wider">or email</span>
            <div className="flex-grow border-t border-slate-100"></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            
            {!isLogin && (
              <div className="space-y-5 animate-in slide-in-from-top-4 fade-in duration-300">
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
                  <input
                    type="text"
                    placeholder="Full Name"
                    className="w-full h-14 pl-12 pr-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-indigo-500 font-bold text-slate-700 transition-all placeholder:text-slate-400"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="relative group">
                  <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
                  <input
                    type="text"
                    placeholder="Group Name (e.g. Gujjari)"
                    className="w-full h-14 pl-12 pr-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-indigo-500 font-bold text-slate-700 transition-all placeholder:text-slate-400"
                    value={familyId}
                    onChange={(e) => setFamilyId(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
              <input
                type="email"
                placeholder="Email Address"
                className="w-full h-14 pl-12 pr-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-indigo-500 font-bold text-slate-700 transition-all placeholder:text-slate-400"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
              <input
                type="password"
                placeholder="Password"
                className="w-full h-14 pl-12 pr-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-indigo-500 font-bold text-slate-700 transition-all placeholder:text-slate-400"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-slate-900 hover:bg-black text-white rounded-2xl font-bold transition-all shadow-xl shadow-slate-900/20 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3 active:scale-[0.98] mt-6 group"
            >
              {loading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <>
                  <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
};

export default AuthPage;
