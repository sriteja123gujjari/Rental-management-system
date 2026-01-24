import React, { useState } from 'react';
import { api } from '../services/api'; // Ensure this path is correct
import { LogIn, UserPlus, Building2, Loader2, Mail, Lock, User } from 'lucide-react';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        // --- LOGIN LOGIC ---
        console.log("Logging in with:", { email, password });
        
        // ✅ FIX: Pass as an OBJECT { }
        const user = await api.login({ 
            email: email, 
            password: password 
        });
        
        onLogin(user, 'session-token'); // Update App state

      } else {
        // --- REGISTER LOGIC ---
        console.log("Registering:", { name, email, password });

        // ✅ FIX: Pass as an OBJECT { }
        await api.register({ 
            name: name, 
            email: email, 
            password: password 
        });

        alert("Registration Successful! Please check your email.");
        setIsLogin(true); // Switch to login view
      }
    } catch (err: any) {
      console.error("Auth Error:", err);
      alert(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 overflow-hidden border border-slate-100">
        
        {/* Header Section */}
        <div className="bg-slate-900 p-8 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-600/20 to-purple-600/20 z-0"></div>
          <div className="relative z-10">
            <div className="inline-flex p-3 bg-white/10 backdrop-blur-md rounded-2xl text-white mb-4 shadow-lg ring-1 ring-white/20">
              <Building2 size={32} />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">
              {isLogin ? 'Welcome Back' : 'Join Us'}
            </h1>
            <p className="text-slate-400 text-sm font-medium mt-2">
              {isLogin ? 'Manage your rentals with ease' : 'Create your rental dashboard'}
            </p>
          </div>
        </div>

        {/* Form Section */}
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Name Field (Only for Register) */}
            {!isLogin && (
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
                <input
                  type="text"
                  placeholder="Full Name"
                  className="w-full h-14 pl-12 pr-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-indigo-500 font-bold text-slate-700 transition-all placeholder:text-slate-400"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={!isLogin}
                />
              </div>
            )}

            {/* Email Field */}
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

            {/* Password Field */}
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

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-xl shadow-indigo-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95 mt-2"
            >
              {loading ? (
                <Loader2 className="animate-spin" />
              ) : isLogin ? (
                <><LogIn size={20} /> Login</>
              ) : (
                <><UserPlus size={20} /> Create Account</>
              )}
            </button>
          </form>

          {/* Toggle Login/Register */}
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setName('');
                setEmail('');
                setPassword('');
              }}
              className="text-slate-500 text-sm font-semibold hover:text-indigo-600 transition-colors"
            >
              {isLogin ? (
                <>Don't have an account? <span className="text-indigo-600 font-bold underline">Sign Up</span></>
              ) : (
                <>Already have an account? <span className="text-indigo-600 font-bold underline">Log In</span></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
