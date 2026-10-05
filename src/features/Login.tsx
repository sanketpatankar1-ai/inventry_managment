import { useState } from 'react';

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [mobile, setMobile] = useState('9999999999');
  const [pin, setPin] = useState('1234');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (mobile === '9999999999' && pin === '1234') {
      localStorage.setItem('salesman_session', 'true');
      onLogin();
    } else {
      setError('Invalid mobile or PIN. Try 9999999999 / 1234');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 border border-gray-100 dark:border-gray-800">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">Salesman App</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to start your day</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mobile Number</label>
            <input 
              type="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-950 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">PIN</label>
            <input 
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-950 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
            />
          </div>
          
          {error && <p className="text-red-500 text-sm font-medium">{error}</p>}
          
          <button 
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors active:scale-95"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
}
