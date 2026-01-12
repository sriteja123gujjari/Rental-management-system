
import React, { useState, useEffect } from 'react';
import AuthPage from './components/AuthPage';
import Dashboard from './components/Dashboard';

const App = () => {
  const [auth, setAuth] = useState(() => {
    const saved = localStorage.getItem('rentManager_auth');
    return saved ? JSON.parse(saved) : { user: null, token: null };
  });

  useEffect(() => {
    if (auth.user) {
      localStorage.setItem('rentManager_auth', JSON.stringify(auth));
    } else {
      localStorage.removeItem('rentManager_auth');
    }
  }, [auth]);

  const handleLogin = (user, token) => {
    setAuth({ user, token });
  };

  const handleLogout = () => {
    setAuth({ user: null, token: null });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {auth.user ? (
        <Dashboard user={auth.user} onLogout={handleLogout} />
      ) : (
        <AuthPage onLogin={handleLogin} />
      )}
    </div>
  );
};

export default App;
