import { useState } from 'react';

interface LoginProps {
  onLogin: (email: string) => void;
  loading?: boolean;
}

export function Login({ onLogin, loading }: LoginProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Bitte gib eine gültige E-Mail ein.');
      return;
    }
    setError(null);
    onLogin(email);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 items-center w-full max-w-xs mx-auto mt-12">
      <input
        type="email"
        placeholder="E-Mail"
        value={email}
        onChange={e => setEmail(e.target.value)}
        className="border rounded px-3 py-2 w-full"
        disabled={loading}
        required
      />
      <button
        type="submit"
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 w-full"
        disabled={loading}
      >
        {loading ? 'Einloggen...' : 'Login'}
      </button>
      {error && <div className="text-red-600">{error}</div>}
    </form>
  );
} 