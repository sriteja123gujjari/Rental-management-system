import React, { useState } from 'react';
import { api } from '../services/api';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, Loader2, Building2 } from 'lucide-react';

const Register = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 🔍 DEBUGGING: Check your console (F12) to see this log
      console.log("Sending registration data:", { email, password, name });

      // ✅ THE FIX: Wrap variables in an OBJECT { } 
      await api.register({ 
        name: name, 
        email: email, 
        password: password 
      });

      alert("Registration Successful! Please check your email to confirm.");
      navigate('/login');
      
    } catch (err: any) {
      console.error("Registration failed:", err);
      // Show the specific error from Supabase
      alert(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 w-full max-w-md border border-slate-100">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex p-3 bg-indigo-50 rounded-2xl text-indigo-600 mb-4 shadow-sm">
            <Building2 size={32} />
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Create Account</h1>
          <p className="text-slate-400 text-sm font-medium mt-1">Join Gujjari's Rental System</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Full Name</label>
            <input 
              type="text" 
              required
              className="w-full h-14 px-5 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold text-slate-700 transition-all placeholder:text-slate-300"
              placeholder="e.g. Anjaneyulu"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Email Address</label>
            <input 
              type="email" 
              required
              className="w-full h-14 px-5 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold text-slate-700 transition-all placeholder:text-slate-300"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Password</label>
            <input 
              type="password" 
              required
              minLength={6}
              className="w-full h-14 px-5 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold text-slate-700 transition-all placeholder:text-slate-300"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full h-14 bg-slate-900 text-white rounded-2xl font-bold hover:bg-black transition-all shadow-xl shadow-slate-200 disabled:opacity-70 flex items-center justify-center gap-2 active:scale-95 mt-4"
          >
            {loading ? <Loader2 className="animate-spin" /> : <UserPlus size={20} />}
            <span>Sign Up</span>
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-slate-400 text-sm font-medium">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-600 font-bold hover:text-indigo-700 hover:underline">
              Log In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
