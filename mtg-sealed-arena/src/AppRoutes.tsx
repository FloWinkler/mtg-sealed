import { Routes, Route, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Lobby } from './components/Lobby';
import { DeckBuilder } from './components/DeckBuilder';
import Game from './components/Game';
import { socket } from './socket';

export function AppRoutes({ user, lobby, boosters, finalDeck, handleSetFinalDeck, handleSetSelect, handleReadyToggle }) {
  const navigate = useNavigate();
  const [gameState, setGameState] = useState(null);
  const [waitingForGame, setWaitingForGame] = useState(false);

  useEffect(() => {
    socket.on('start_deckbuilding', () => {
      navigate('/deckbuilder');
    });
    socket.on('game_start', (game) => {
      setGameState(game);
      setWaitingForGame(false);
      navigate('/game');
    });
    socket.on('game_update', (game) => {
      setGameState(game);
    });
    return () => {
      socket.off('start_deckbuilding');
      socket.off('game_start');
      socket.off('game_update');
    };
  }, [navigate]);

  const handleDeckReady = (deck) => {
    handleSetFinalDeck(deck); // Setzt das Deck im State
    socket.emit('submit_deck', deck);
    setWaitingForGame(true);
  };

  return (
    <Routes>
      <Route
        path="/"
        element={<Lobby user={user} lobby={lobby} onSetSelect={handleSetSelect} onReadyToggle={handleReadyToggle} />}
      />
      <Route
        path="/deckbuilder"
        element={boosters ? <DeckBuilder boosters={boosters} onReady={handleDeckReady} /> : <div>Keine Booster generiert.</div>}
      />
      <Route
        path="/game"
        element={
          !finalDeck || !gameState ? (
            <div className="flex items-center justify-center min-h-screen text-xl">{waitingForGame ? 'Warte auf den anderen Spieler...' : 'Kein Deck oder Game-State übergeben.'}</div>
          ) : (
            <Game deck={finalDeck} gameState={gameState} user={user} />
          )
        }
      />
    </Routes>
  );
} 