import React, { useState, useEffect } from 'react';
import AuthPage from './components/AuthPage';
import Dashboard from './pages/Dashboard'; // Ensure this points to your Dashboard file
import { supabase } from './services/api';
import { Loader2 } from 'lucide-react';

const App = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check Active Session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for Auth Changes
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
        <Loader2 className="animate-spin text-slate-900" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {user ? (
        <Dashboard user={user} onLogout={handleLogout} />
      ) : (
        <AuthPage onLogin={(user) => setUser(user)} />
      )}
    </div>
  );
};

export default App;
