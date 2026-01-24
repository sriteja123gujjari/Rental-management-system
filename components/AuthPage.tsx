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
        alert("Registration Successful! Logging you in...");
        await api.login({ email, password }).then(user => onLogin(user, 'token'));
      }
    } catch (err: any) {
      alert(err.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* LEFT SIDE - BRANDING / VISUAL (Hidden on Mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-slate-900 overflow-hidden flex-col justify-between p-12 text-white">
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-br from-indigo-600 to-violet-600 rounded-full blur-3xl opacity-20 -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-blue-600 to-cyan-500 rounded-full blur-3xl opacity-20 translate-y-1/3 -translate-x-1/3"></div>
        
        {/* Content */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10">
            <Building2 size={24} className="text-indigo-300" />
            <span className="font-bold tracking-wide text-sm">GUJJARI RENTALS</span>
          </div>
        </div>

        <div className="relative z-10 max-w-lg">
          <h1 className="text-5xl font-black tracking-tight leading-tight mb-6">
            Manage your <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
              Commercial Assets
            </span>
            <br/> with confidence.
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed">
            Track rents, manage expenses, and generate reports for your family group in one unified dashboard.
          </p>
        </div>

        <div className="relative z-10 text-xs font-medium text-slate-500 uppercase tracking-widest">
          © 2024 Gujjari System v2.0
        </div>
      </div>

      {/* RIGHT SIDE - FORM */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative">
        <div className="w-full max-w-[420px] space-y-8">
          
          {/* Mobile Logo (Visible only on Mobile) */}
          <div className="lg:hidden flex justify-center mb-6">
            <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-200">
              <Building2 size={32} />
            </div>
          </div>

          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              {isLogin ? 'Welcome back' : 'Create an account'}
            </h2>
            <p className="text-slate-500 mt-2 font-medium">
              {isLogin ? 'Please enter your details to sign in.' : 'Start your journey with a free account.'}
            </p>
          </div>

          {/* TOGGLE SWITCH (Side by Side) */}
          <div className="grid grid-cols-2 p-1.5 bg-slate-100 rounded-2xl gap-2">
            <button
              onClick={() => setIsLogin(true)}
              className={`py-2.5 text-sm font-bold rounded-xl transition-all ${
                isLogin 
                  ? 'bg-white text-slate-900 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`py-2.5 text-sm font-bold rounded-xl transition-all ${
                !isLogin 
                  ? 'bg-white text-slate-900 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Register Fields */}
            {!isLogin && (
              <div className="space-y-4 animate-in slide-in-from-top-4 fade-in duration-300">
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
                  <input
                    type="text"
                    placeholder="Full Name"
                    className="w-full h-14 pl-12 pr-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-indigo-500 font-bold text-slate-700 transition-all placeholder:text-slate-400 focus:shadow-xl focus:shadow-indigo-100/50"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                
                <div className="relative group">
                  <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
                  <input
                    type="text"
                    placeholder="Family Group Name"
                    className="w-full h-14 pl-12 pr-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-indigo-500 font-bold text-slate-700 transition-all placeholder:text-slate-400 focus:shadow-xl focus:shadow-indigo-100/50"
                    value={familyId}
                    onChange={(e) => setFamilyId(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            {/* Common Fields */}
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
              <input
                type="email"
                placeholder="Email Address"
                className="w-full h-14 pl-12 pr-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-indigo-500 font-bold text-slate-700 transition-all placeholder:text-slate-400 focus:shadow-xl focus:shadow-indigo-100/50"
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
                className="w-full h-14 pl-12 pr-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-indigo-500 font-bold text-slate-700 transition-all placeholder:text-slate-400 focus:shadow-xl focus:shadow-indigo-100/50"
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
              className="w-full h-14 bg-slate-900 hover:bg-black text-white rounded-2xl font-bold transition-all shadow-xl shadow-slate-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3 active:scale-[0.98] mt-4 group"
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
