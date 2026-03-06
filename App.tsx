import React, { useState, useEffect } from 'react';
import { supabase } from './services/api';
import AuthPage from './components/AuthPage';
import Dashboard from './components/Dashboard';
import { Loader2 } from 'lucide-react';

const App = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [logoutKey, setLogoutKey] = useState(0);

  useEffect(() => {
    // ✅ Register listener FIRST before getSession
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('AUTH EVENT:', event, '| USER:', session?.user?.email ?? 'null');

      if (event === 'SIGNED_OUT') {
        // ✅ Clean URL completely
        window.history.replaceState({}, '', window.location.pathname);
        setUser(null);
        setLoading(false);
        setLogoutKey(prev => prev + 1);
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        // ✅ Only set user if we actually have one
        if (session?.user) {
          // ✅ Clean URL after OAuth redirect
          window.history.replaceState({}, '', window.location.pathname);
          setUser(session.user);
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    });

    // ✅ Fallback: if no auth event fires within 2 seconds, stop loading
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 2000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // ✅ Full page reload — guarantees AuthPage remounts 100% fresh
    // with Google button visible, no stale state from previous session
    window.location.href = window.location.pathname;
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
        <AuthPage key={`auth-${logoutKey}`} onLogin={(u) => setUser(u)} />
      )}
    </div>
  );
};

export default App;
