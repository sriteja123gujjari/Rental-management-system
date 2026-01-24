import React, { useState } from 'react';
import { api } from '../services/api';
import { 
  User, Mail, Lock, LogIn, UserPlus, 
  Building2, Loader2, Users, ArrowRight 
} from 'lucide-react';

interface AuthPageProps {
  onLogin: (user: any, token: string) => void;
}

const AuthPage = ({ onLogin }: AuthPageProps) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [familyId, setFamilyId] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        // --- LOGIN ---
        await api.login({ email, password }).then(user => onLogin(user, 'token'));
      } else {
        // --- REGISTER ---
        await api.register({ name, email, password, familyId });
        //alert("Registration Successful! Logging you in...");
        await api.login({ email, password }).then(user => onLogin(user, 'token'));
      }
    } catch (err: any) {
      alert(err.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden font-sans selection:bg-indigo-100 selection:text-indigo-900 p-4">
      
      {/* Background Decoration (Ambient Glows) */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[100px]"></div>
      </div>

      <div className="bg-white w-full max-w-[480px] rounded-[2.5rem] shadow-2xl shadow-indigo-100/60 border border-white/50 relative z-10 overflow-hidden backdrop-blur-sm">
        
        {/* Header Section */}
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

        {/* Content Section */}
        <div className="px-8 pb-10">
          
          {/* Toggle Switch */}
          <div className="grid grid-cols-2 p-1.5 bg-slate-100 rounded-2xl gap-2 mb-8">
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

          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Register Fields (Animated In) */}
            {!isLogin && (
              <div className="space-y-5 animate-in slide-in-from-top-4 fade-in duration-300">
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
                  <input
                    type="text"
                    placeholder="Full Name"
                    className="w-full h-14 pl-12 pr-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-indigo-500 font-bold text-slate-700 transition-all placeholder:text-slate-400 focus:shadow-xl focus:shadow-indigo-100/20"
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
                    className="w-full h-14 pl-12 pr-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-indigo-500 font-bold text-slate-700 transition-all placeholder:text-slate-400 focus:shadow-xl focus:shadow-indigo-100/20"
                    value={familyId}
                    onChange={(e) => setFamilyId(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            {/* Email Field */}
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
              <input
                type="email"
                placeholder="Email Address"
                className="w-full h-14 pl-12 pr-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-indigo-500 font-bold text-slate-700 transition-all placeholder:text-slate-400 focus:shadow-xl focus:shadow-indigo-100/20"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Password Field */}
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
              <input
                type="password"
                placeholder="Password"
                className="w-full h-14 pl-12 pr-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-indigo-500 font-bold text-slate-700 transition-all placeholder:text-slate-400 focus:shadow-xl focus:shadow-indigo-100/20"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            {/* Submit Button */}
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
