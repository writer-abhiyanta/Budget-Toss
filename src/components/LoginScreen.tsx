import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { loginWithGoogle } from '../lib/firebase';
import { BookOpen, AlertCircle } from 'lucide-react';

export default function LoginScreen() {
  const { loading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    try {
      setError(null);
      await loginWithGoogle();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Login failed.');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-4">
      <div className="anime-card max-w-md w-full text-center space-y-6 !p-8">
        <div className="mx-auto w-20 h-20 bg-emerald-200 border-4 border-emerald-900 rounded-full flex items-center justify-center mb-4">
          <BookOpen className="w-10 h-10 text-emerald-900" />
        </div>
        <h1 className="text-4xl font-bold uppercase tracking-widest text-emerald-900">Budget Toss</h1>
        <p className="text-emerald-700 font-sans font-medium text-sm">
          Manage your daily spends, avoid bad buys, and plan your EMI. AI-powered financial learning tool.
        </p>
        
        {error && (
          <div className="bg-red-100 border border-red-300 text-red-700 p-3 rounded-lg text-sm flex items-start text-left gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button 
          className="anime-button w-full text-lg flex items-center justify-center gap-2"
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? 'Opening Book...' : 'Log In with Google'}
        </button>
      </div>
    </div>
  );
}
