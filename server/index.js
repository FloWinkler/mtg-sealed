const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { generateBoosters } = require('./boosterGenerator.js');
const fetch = require('node-fetch');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// In-Memory-Store für User und Lobby
let users = {};
let lobby = {
  players: [], // { email, socketId, ready, set }
  set: null
};

// Game-State für laufende Spiele
let game = null;
let playerRoles = {}; // email -> 'bottom' | 'top'

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Login-Event
  socket.on('login', (email) => {
    console.log('Login received from', email, 'Socket:', socket.id);
    if (!email) return;
    users[socket.id] = { email };
    // Füge Spieler zur Lobby hinzu, wenn Platz
    if (lobby.players.length < 2 && !lobby.players.find(p => p.email === email)) {
      lobby.players.push({ email, socketId: socket.id, ready: false, set: null });
    }
    // Sende Login-Bestätigung
    socket.emit('login_success', { email });
    io.emit('lobby_update', lobby);
  });

  // Ready-Status setzen
  socket.on('set_ready', async (ready) => {
    const player = lobby.players.find(p => p.socketId === socket.id);
    if (player) {
      player.ready = ready;
      io.emit('lobby_update', lobby);
      // Wenn beide bereit, Booster generieren und Spiel starten
      if (lobby.players.length === 2 && lobby.players.every(p => p.ready)) {
        const set = lobby.set;
        console.log('Beide Spieler bereit, generiere Booster für Set:', set);
        for (const p of lobby.players) {
          try {
            console.log('Generiere Booster für', p.email);
            const boosters = await generateBoosters(set);
            console.log('Booster generiert für', p.email, 'Anzahl Booster:', boosters.length);
            io.to(p.socketId).emit('booster_data', boosters);
          } catch (err) {
            console.error('Fehler beim Generieren der Booster für', p.email, err);
            io.to(p.socketId).emit('booster_error', 'Fehler beim Generieren der Booster');
          }
        }
        io.emit('start_deckbuilding');
      }
    }
  });

  // Set-Auswahl
  socket.on('select_set', (set) => {
    const player = lobby.players.find(p => p.socketId === socket.id);
    if (player) {
      player.set = set;
      lobby.set = set; // Für MVP: beide spielen das gleiche Set
      io.emit('lobby_update', lobby);
    }
  });

  // Deck-Übermittlung nach Deckbau
  socket.on('submit_deck', (deck) => {
    const player = lobby.players.find(p => p.socketId === socket.id);
    if (!player) return;
    if (!game) {
      game = {
        players: {},
        battlefield: [],
        turn: 1,
        playerRoles: {},
        counters: [],
        tokens: [], // <--- Token-Array
      };
      // Assign roles: first player is bottom, second is top
      if (lobby.players.length === 2) {
        game.playerRoles[lobby.players[0].email] = 'bottom';
        game.playerRoles[lobby.players[1].email] = 'top';
      }
    }
    game.players[player.email] = {
      deck,
      hand: deck.slice(0, 7),
      library: deck.slice(7),
      graveyard: [],
      exile: [],
      socketId: socket.id,
      life: 20,
    };
    if (Object.keys(game.players).length === 2) {
      io.emit('game_start', game);
    }
  });

  // Lebenspunkte-Update
  socket.on('update_life', ({ email, life }) => {
    if (game && game.players[email]) {
      game.players[email].life = life;
      io.emit('game_update', game);
    }
  });

  // Karte aufs Spielfeld legen
  socket.on('play_card_to_battlefield', ({ email, card, x, y }) => {
    if (!game || !game.players[email]) return;
    ['hand', 'graveyard', 'exile'].forEach(zone => {
      game.players[email][zone] = game.players[email][zone].filter(c => c.instanceId !== card.instanceId);
    });
    // Entferne alle Instanzen der Karte vom Battlefield
    game.battlefield = game.battlefield.filter(c => c.instanceId !== card.instanceId);
    game.battlefield.push({ ...card, x, y, tapped: false, owner: email });
    io.emit('game_update', game);
  });

  // Karte in Graveyard, Exile, Hand oder Deck bewegen (inkl. Deck-Optionen)
  socket.on('move_card_zone', ({ email, card, target, deckOption }) => {
    if (!game || !game.players[email]) return;
    // Entferne Karte aus allen Zonen
    ['hand', 'graveyard', 'exile'].forEach(zone => {
      game.players[email][zone] = game.players[email][zone].filter(c => c.instanceId !== card.instanceId);
    });
    game.battlefield = game.battlefield.filter(c => c.instanceId !== card.instanceId);
    // Füge Karte in Zielzone ein
    if (target === 'hand') game.players[email].hand.push(card);
    if (target === 'graveyard') game.players[email].graveyard.push(card);
    if (target === 'exile') game.players[email].exile.push(card);
    if (target === 'deck') {
      if (deckOption === 'top') game.players[email].library = [card, ...game.players[email].library];
      else if (deckOption === 'bottom') game.players[email].library = [...game.players[email].library, card];
      else if (deckOption === 'shuffle') {
        const lib = [...game.players[email].library, card];
        for (let i = lib.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [lib[i], lib[j]] = [lib[j], lib[i]];
        }
        game.players[email].library = lib;
      }
    }
    io.emit('game_update', game);
  });

  // Karte auf dem Battlefield verschieben
  socket.on('move_battlefield_card', ({ instanceId, x, y }) => {
    if (!game) return;
    game.battlefield = game.battlefield.map(c => c.instanceId === instanceId ? { ...c, x, y } : c);
    io.emit('game_update', game);
  });

  // Karte tappen/untappen
  socket.on('tap_card', ({ instanceId }) => {
    if (!game) return;
    game.battlefield = game.battlefield.map(c => c.instanceId === instanceId ? { ...c, tapped: !c.tapped } : c);
    io.emit('game_update', game);
  });

  // Karte flippen
  socket.on('flip_card', ({ instanceId }) => {
    if (!game) return;
    game.battlefield = game.battlefield.map(c => c.instanceId === instanceId ? { ...c, flipped: !c.flipped } : c);
    io.emit('game_update', game);
  });

  // Karte ziehen
  socket.on('draw_card', ({ email }) => {
    if (!game || !game.players[email]) return;
    const player = game.players[email];
    if (player.library.length === 0) return;
    const card = player.library[0];
    player.library = player.library.slice(1);
    player.hand.push(card);
    io.emit('game_update', game);
  });

  // Deck action request (shuffle, scry, surveil)
  socket.on('deck_action_request', ({ email, action, n }) => {
    if (!game || !game.players[email]) return;
    // Find opponent
    const opponentEmail = Object.keys(game.players).find(e => e !== email);
    if (!opponentEmail) return;
    const opponentSocketId = game.players[opponentEmail].socketId;
    // Send request to opponent
    io.to(opponentSocketId).emit('deck_action_request', { from: email, action, n });
  });

  // Deck action response (approval or denial)
  socket.on('deck_action_response', ({ from, to, action, n, approved }) => {
    if (!game || !game.players[from]) return;
    const requesterSocketId = game.players[from].socketId;
    // Notify original player (requester) of approval/denial
    io.to(requesterSocketId).emit('deck_action_response', { from, to: from, action, n, approved });
  });

  // Scry result: update deck order
  socket.on('scry_result', ({ email, newDeck }) => {
    if (!game || !game.players[email]) return;
    game.players[email].library = newDeck;
    io.emit('game_update', game);
  });

  // Surveil result: update deck and graveyard
  socket.on('surveil_result', ({ email, newDeck, newGraveyard }) => {
    if (!game || !game.players[email]) return;
    game.players[email].library = newDeck;
    game.players[email].graveyard = newGraveyard;
    io.emit('game_update', game);
  });

  // Shuffle deck: shuffle player's library
  socket.on('shuffle_deck', ({ email }) => {
    if (!game || !game.players[email]) return;
    const lib = [...game.players[email].library];
    for (let i = lib.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [lib[i], lib[j]] = [lib[j], lib[i]];
    }
    game.players[email].library = lib;
    io.emit('game_update', game);
  });

  // Counter hinzufügen
  socket.on('add_counter', ({ id, value, x, y }) => {
    if (!game) return;
    game.counters = game.counters || [];
    game.counters.push({ id, value, x, y });
    io.emit('game_update', game);
  });

  // Counter bewegen oder Wert ändern
  socket.on('move_counter', ({ id, x, y, value }) => {
    if (!game || !game.counters) return;
    game.counters = game.counters.map(c =>
      c.id === id ? { ...c, x, y, value: value !== undefined ? value : c.value } : c
    );
    io.emit('game_update', game);
  });

  // Counter entfernen
  socket.on('remove_counter', ({ id }) => {
    if (!game || !game.counters) return;
    game.counters = game.counters.filter(c => c.id !== id);
    io.emit('game_update', game);
  });

  // Token hinzufügen
  socket.on('add_token', ({ id, name, type, power, toughness, x, y, tapped = false, flipped = false }) => {
    if (!game) return;
    game.tokens = game.tokens || [];
    game.tokens.push({ id, name, type, power, toughness, x, y, tapped, flipped });
    io.emit('game_update', game);
  });

  // Token bewegen
  socket.on('move_token', ({ id, x, y }) => {
    if (!game || !game.tokens) return;
    game.tokens = game.tokens.map(t => t.id === id ? { ...t, x, y } : t);
    io.emit('game_update', game);
  });

  // Token tappen/untappen
  socket.on('tap_token', ({ id }) => {
    if (!game || !game.tokens) return;
    game.tokens = game.tokens.map(t => t.id === id ? { ...t, tapped: !t.tapped } : t);
    io.emit('game_update', game);
  });

  // Token flippen
  socket.on('flip_token', ({ id }) => {
    if (!game || !game.tokens) return;
    game.tokens = game.tokens.map(t => t.id === id ? { ...t, flipped: !t.flipped } : t);
    io.emit('game_update', game);
  });

  // Token entfernen
  socket.on('remove_token', ({ id }) => {
    if (!game || !game.tokens) return;
    game.tokens = game.tokens.filter(t => t.id !== id);
    io.emit('game_update', game);
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    lobby.players = lobby.players.filter(p => p.socketId !== socket.id);
    delete users[socket.id];
    io.emit('lobby_update', lobby);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
}); 