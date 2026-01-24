// src/App.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from './services/api';
import AuthPage from './components/AuthPage'; // ✅ Ensure this path matches where you put AuthPage
import Dashboard from './components/Dashboard';     // ✅ Ensure this path matches where you put Dashboard
import { Loader2 } from 'lucide-react';

const App = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-indigo-600" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {user ? (
        <Dashboard user={user} onLogout={handleLogout} />
      ) : (
        // We pass a dummy function because AuthPage handles the logic internally now,
        // but we still update the user state here just in case.
        <AuthPage onLogin={(user) => setUser(user)} />
      )}
    </div>
  );
};

export default App;
