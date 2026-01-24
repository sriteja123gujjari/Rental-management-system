import React, { useState } from 'react';
import { api } from '../services/api'; 
import { User, Mail, Lock, LogIn, UserPlus, Building2, Loader2, Users } from 'lucide-react';

const AuthPage = ({ onLogin }: { onLogin: (user: any, token: string) => void }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // ✅ NEW STATE: Family ID
  const [familyId, setFamilyId] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        // --- LOGIN ---
        console.log("Logging in...", { email });
        const user = await api.login({ email, password });
        onLogin(user, 'session-token');

      } else {
        // --- REGISTER ---
        console.log("Registering...", { name, email, familyId });

        await api.register({ 
            name: name, 
            email: email, 
            password: password,
            familyId: familyId // ✅ PASSING THE INPUT VALUE
        });

        alert("Registration Successful! Signing you in...");
        const user = await api.login({ email, password });
        onLogin(user, 'session-token');
      }
    } catch (err: any) {
      console.error("Auth Error:", err);
      alert(err.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        
        {/* Header */}
        <div className="bg-slate-900 p-8 text-center">
          <div className="inline-flex p-3 bg-white/10 rounded-xl text-white mb-4 backdrop-blur-sm">
            <Building2 size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h1>
        </div>

        {/* Form */}
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* REGISTER FIELDS */}
            {!isLogin && (
              <>
                {/* Full Name */}
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Full Name"
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 font-bold text-slate-700"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                {/* Family / Group Name Input */}
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Family Group Name (e.g. Gujjari)"
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 font-bold text-slate-700"
                    value={familyId}
                    onChange={(e) => setFamilyId(e.target.value)}
                    required
                  />
                  <p className="text-[10px] text-gray-400 mt-1 ml-1">This ID links all your family members together.</p>
                </div>
              </>
            )}

            {/* Email (Login & Register) */}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="email"
                placeholder="Email Address"
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 font-bold text-slate-700"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Password (Login & Register) */}
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="password"
                placeholder="Password"
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 font-bold text-slate-700"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 mt-2 shadow-lg shadow-slate-200 disabled:opacity-70"
            >
              {loading ? <Loader2 className="animate-spin" /> : (isLogin ? <><LogIn size={20} /> Sign In</> : <><UserPlus size={20} /> Sign Up</>)}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-slate-500 text-sm font-semibold hover:text-indigo-600"
            >
              {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Log In"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
