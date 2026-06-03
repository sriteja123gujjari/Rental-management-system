import React, { useState, useEffect, useCallback } from 'react';
import { supabase, api } from './services/api';
import { MEMBERS as FALLBACK_MEMBERS, DEFAULT_PREDEFINED_EXPENSES } from './const';
import AuthPage from './components/AuthPage';
import Dashboard from './components/Dashboard';
import SetupPage from './components/SetupPage';
import { Loader2 } from 'lucide-react';

// ============================================================
// APP COMPONENT
// ============================================================
const App = () => {
  // --- AUTH STATE ---
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [logoutKey, setLogoutKey] = useState(0);

  // --- SETUP STATE ---
  // 'loading' = checking setup status, 'needed' = show SetupPage, 'complete' = show Dashboard
  const [setupStatus, setSetupStatus] = useState<'loading' | 'needed' | 'complete'>('loading');
  const [userMembers, setUserMembers] = useState<string[]>([]);
  const [userExpenses, setUserExpenses] = useState<string[]>([]);
  const [familyId, setFamilyId] = useState<string>('');

  // ============================================================
  // AUTH LISTENER
  // ============================================================
  useEffect(() => {
    // ✅ Register listener FIRST before getSession
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('AUTH EVENT:', event, '| USER:', session?.user?.email ?? 'null');

      if (event === 'SIGNED_OUT') {
        // ✅ Clean URL completely
        window.history.replaceState({}, '', window.location.pathname);
        setUser(null);
        setSetupStatus('loading');
        setUserMembers([]);
        setUserExpenses([]);
        setFamilyId('');
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

  // ============================================================
  // SETUP STATUS CHECK — runs whenever `user` changes
  // ============================================================
  const checkSetupStatus = useCallback(async (currentUser: any) => {
    if (!currentUser) {
      setSetupStatus('loading');
      return;
    }

    setSetupStatus('loading');

    try {
      // 1. Determine familyId
      const fId = currentUser.user_metadata?.family_id || currentUser.user_metadata?.familyId || '';
      setFamilyId(fId);

      // 2. If familyId is available, check for existing preferences
      if (fId) {
        const prefs = await api.getUserSetup(currentUser.id, fId);

        if (prefs && prefs.setup_complete) {
          // ✅ User has completed setup before — load their data
          setUserMembers(prefs.members || []);
          setUserExpenses(prefs.predefined_expenses || []);
          setSetupStatus('complete');
          return;
        }

        // 3. No preferences yet — check if this family has existing shop data (auto-migration)
        const hasExistingData = await api.checkExistingFamilyData(fId);

        if (hasExistingData) {
          // ✅ AUTO-MIGRATE: Existing user with shop data but no preferences
          // Save the fallback defaults as their preferences
          console.log('Auto-migrating existing user:', currentUser.email, '| familyId:', fId);

          await api.saveUserSetup(currentUser.id, fId, {
            members: FALLBACK_MEMBERS,
            predefinedExpenses: DEFAULT_PREDEFINED_EXPENSES,
            setupComplete: true,
          });

          setUserMembers(FALLBACK_MEMBERS);
          setUserExpenses(DEFAULT_PREDEFINED_EXPENSES);
          setSetupStatus('complete');
          return;
        }
      }

      // 4. No familyId OR no existing data → user needs setup
      setSetupStatus('needed');
    } catch (err) {
      console.error('Setup check failed:', err);
      // On error, show setup page as a safe fallback
      setSetupStatus('needed');
    }
  }, []);

  useEffect(() => {
    if (user) {
      checkSetupStatus(user);
    }
  }, [user, checkSetupStatus]);

  // ============================================================
  // HANDLERS
  // ============================================================
  const handleLogout = async () => {
    await supabase.auth.signOut();
    // ✅ Full page reload — guarantees AuthPage remounts 100% fresh
    // with Google button visible, no stale state from previous session
    window.location.href = window.location.pathname;
  };

  const handleSetupComplete = (members: string[], expenses: string[], newFamilyId: string) => {
    setUserMembers(members);
    setUserExpenses(expenses);
    setFamilyId(newFamilyId);
    setSetupStatus('complete');
  };

  // ============================================================
  // RENDER
  // ============================================================

  // Auth loading
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-indigo-600" size={48} />
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AuthPage key={`auth-${logoutKey}`} onLogin={(u) => setUser(u)} />
      </div>
    );
  }

  // Checking setup status
  if (setupStatus === 'loading') {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
        <Loader2 className="animate-spin text-indigo-600" size={48} />
        <p className="text-slate-500 font-medium animate-pulse">Setting up your account...</p>
      </div>
    );
  }

  // Needs setup
  if (setupStatus === 'needed') {
    return (
      <SetupPage
        user={user}
        familyId={familyId}
        onSetupComplete={handleSetupComplete}
      />
    );
  }

  // Setup complete → Dashboard
  return (
    <div className="min-h-screen bg-gray-50">
      <Dashboard
        user={user}
        onLogout={handleLogout}
        userMembers={userMembers}
        predefinedExpenses={userExpenses}
      />
    </div>
  );
};

export default App;
