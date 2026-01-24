import React, { useState } from 'react';
import { api } from '../services/api'; 
import { User, Mail, Lock, LogIn, UserPlus, Building2, Loader2, Users } from 'lucide-react';

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
  const [familyId, setFamilyId] = useState(''); // ✅ Stores the Family/Group Name

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        // --- LOGIN LOGIC ---
        console.log("Logging in...", { email });
        
        // 1. Call Login API (Passing Object)
        const user = await api.login({ 
            email: email, 
            password: password 
        });
        
        onLogin(user, 'session-token');

      } else {
        // --- REGISTER LOGIC ---
        console.log("Registering...", { name, email, familyId });

        // 2. Call Register API (Passing Object with Family ID)
        await api.register({ 
            name: name, 
            email: email, 
            password: password,
            familyId: familyId // ✅ Sending the dynamic group name
        });

        alert("Registration Successful! Logging you in...");
        
        // 3. Auto-Login after success
        const user = await api.login({ email, password });
        onLogin(user, 'session-token');
      }
    } catch (err: any) {
      console.error("Auth Error:", err);
      alert(err.message || "Authentication failed. Please check your inputs.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        
        {/* Header Section */}
        <div className="bg-slate-900 p-8 text-center">
          <div className="inline-flex p-3 bg-white/10 rounded-xl text-white mb-4 backdrop-blur-sm">
            <Building2 size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            {isLogin ? 'Sign in to manage your rentals' : 'Create a new rental group'}
          </p>
        </div>

        {/* Form Section */}
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* REGISTER ONLY FIELDS */}
            {!isLogin && (
              <>
                {/* Name Input */}
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Full Name"
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 font-bold text-slate-700 transition-all"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                {/* Family ID Input */}
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Group Name (e.g. Gujjari Family)"
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 font-bold text-slate-700 transition-all"
                    value={familyId}
                    onChange={(e) => setFamilyId(e.target.value)}
                    required
                  />
                </div>
              </>
            )}

            {/* Email Input (Always Visible) */}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="email"
                placeholder="Email Address"
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 font-bold text-slate-700 transition-all"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Password Input (Always Visible) */}
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="password"
                placeholder="Password"
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 font-bold text-slate-700 transition-all"
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
              className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 mt-4 shadow-lg shadow-slate-200 disabled:opacity-70 active:scale-95 transform duration-100"
            >
              {loading ? (
                <Loader2 className="animate-spin" />
              ) : isLogin ? (
                <><LogIn size={20} /> Sign In</>
              ) : (
                <><UserPlus size={20} /> Sign Up</>
              )}
            </button>
          </form>

          {/* Toggle Switch */}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                // Clear errors/inputs on toggle
                setName('');
                setEmail('');
                setPassword('');
                setFamilyId('');
              }}
              className="text-slate-500 text-sm font-medium hover:text-slate-900 transition-colors"
            >
              {isLogin ? (
                <>Don't have an account? <span className="font-bold underline">Create one</span></>
              ) : (
                <>Already have an account? <span className="font-bold underline">Log In</span></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
