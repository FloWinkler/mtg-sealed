import { SetSelector } from './SetSelector';
import { socket } from '../socket';

interface LobbyPlayer {
  email: string;
  ready: boolean;
}

interface LobbyState {
  players: LobbyPlayer[];
  set: string | null;
}

interface LobbyProps {
  user: string;
  lobby: LobbyState;
  onSetSelect: (set: string) => void;
  onReadyToggle: (ready: boolean) => void;
}

export function Lobby({ user, lobby, onSetSelect, onReadyToggle }: LobbyProps) {
  const me = lobby.players.find(p => p.email === user);
  const other = lobby.players.find(p => p.email !== user);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-6">
      <div className="flex flex-col gap-6 items-center w-full max-w-md">
        <h2 className="text-2xl font-bold">Lobby</h2>
        <div className="w-full bg-white rounded shadow p-4 flex flex-col gap-2">
          <div><b>Du:</b> {me ? me.email : 'Unbekannt'} {me?.ready && '✅'}</div>
          <div><b>Gegner:</b> {other ? other.email : 'Warten...'} {other?.ready && '✅'}</div>
        </div>
        <div className="w-full">
          <label className="block mb-2 font-semibold">Set-Auswahl</label>
          <SetSelector onSetSelected={onSetSelect} selectedSet={lobby.set || undefined} />
          <div className="mt-2 text-gray-600">Aktuelles Set: <b>{lobby.set || 'Kein Set gewählt'}</b></div>
        </div>
        <button
          className={`bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 w-full ${me?.ready ? 'bg-green-600 hover:bg-green-700' : ''}`}
          onClick={() => onReadyToggle(!me?.ready)}
          disabled={!lobby.set}
        >
          {me?.ready ? 'Bereit!' : 'Bereit machen'}
        </button>
        <div className="text-gray-500 text-sm mt-4">Warte, bis beide Spieler bereit sind...</div>
        {lobby.players.length > 0 && (
          <button
            className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            onClick={() => socket.emit('reset_lobby')}
          >
            Lobby zurücksetzen
          </button>
        )}
      </div>
    </div>
  );
} 