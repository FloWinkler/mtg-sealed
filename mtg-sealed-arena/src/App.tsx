import { useState } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { SetSelector } from './components/SetSelector';
import { DeckBuilder } from './components/DeckBuilder';
import { generateBoosters } from './lib/boosterGenerator';
import type { Booster, ScryfallCard } from './lib/boosterGenerator';
import './App.css';
import Game from './components/Game';
import { Login } from './components/Login';
import { useEffect } from 'react';
import { socket } from './socket';
import { Lobby } from './components/Lobby';
import { AppRoutes } from './AppRoutes';

interface LobbyPlayer {
  email: string;
  ready: boolean;
}

interface LobbyState {
  players: LobbyPlayer[];
  set: string | null;
}

function Home({ onStart }: { onStart: (boosters: Booster[], playerCount: number) => void }) {
  const [playerCount, setPlayerCount] = useState(1);
  const [selectedSet, setSelectedSet] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePlay = async () => {
    if (!selectedSet) return;
    setLoading(true);
    setError(null);
    try {
      const boosters = await generateBoosters(selectedSet);
      onStart(boosters, playerCount);
    } catch (err) {
      setError('Fehler beim Generieren der Booster.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-6">
      <div className="flex flex-col gap-6 items-center w-full max-w-md">
        <div className="w-full">
          <label className="block mb-2 font-semibold">Anzahl Spieler</label>
          <select
            className="border rounded px-3 py-2 w-full"
            value={playerCount}
            onChange={e => setPlayerCount(Number(e.target.value))}
          >
            <option value={1}>1 Spieler</option>
            <option value={2}>2 Spieler (später)</option>
          </select>
        </div>
        <SetSelector onSetSelected={setSelectedSet} />
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 w-full"
          disabled={!selectedSet || loading}
          onClick={handlePlay}
        >
          {loading ? 'Lade Booster...' : 'Play'}
        </button>
        {error && <div className="text-red-600">{error}</div>}
      </div>
    </div>
  );
}

function App() {
  const [boosters, setBoosters] = useState<Booster[] | null>(null);
  const [playerCount, setPlayerCount] = useState(1);
  const [finalDeck, setFinalDeck] = useState<ScryfallCard[] | null>(null);
  const [user, setUser] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [lobby, setLobby] = useState<LobbyState | null>(null);

  useEffect(() => {
    const onLoginSuccess = (data: { email: string }) => {
      setUser(data.email);
      setLoginLoading(false);
    };
    socket.on('login_success', onLoginSuccess);
    socket.on('lobby_update', (lobbyState) => {
      setLobby(lobbyState);
    });
    socket.on('booster_data', (boosters) => {
      setBoosters(boosters);
    });
    socket.on('booster_error', (msg) => {
      alert(msg);
    });
    return () => {
      socket.off('login_success', onLoginSuccess);
      socket.off('connect');
      socket.off('connect_error');
      socket.off('lobby_update');
      socket.off('booster_data');
      socket.off('booster_error');
    };
  }, []);

  const handleLogin = (email: string) => {
    setLoginLoading(true);
    if (socket) {
      socket.emit('login', email);
    }
  };

  const handleSetSelect = (set: string) => {
    socket.emit('select_set', set);
  };

  const handleReadyToggle = (ready: boolean) => {
    socket.emit('set_ready', ready);
  };

  if (!user) {
    return <Login onLogin={handleLogin} loading={loginLoading} />;
  }

  if (!lobby) {
    return <div className="flex items-center justify-center min-h-screen">Lobby wird geladen...</div>;
  }

  return (
    <Router>
      <AppRoutes
        user={user}
        lobby={lobby}
        boosters={boosters}
        finalDeck={finalDeck}
        handleSetFinalDeck={setFinalDeck}
        handleSetSelect={handleSetSelect}
        handleReadyToggle={handleReadyToggle}
      />
    </Router>
  );
}

export default App;
