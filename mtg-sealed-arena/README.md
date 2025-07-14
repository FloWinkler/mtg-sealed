// Projekt: MTG Sealed Arena Clone (1v1)
// Stack: React + TailwindCSS + Scryfall API

// === Projektstruktur ===

// src/
// ├── components/
// │   ├── Card.tsx              // Karte mit Bild, Tap, Flip, Drag
// │   ├── Zone.tsx              // Friedhof, Hand, Exil etc.
// │   ├── PlayerBoard.tsx       // Spielfeldhälfte eines Spielers
// │   ├── DeckBuilder.tsx       // Sealed-Deck-Erstellung mit 6 Boostern
// │   └── SetSelector.tsx       // Auswahlmenü für Set (Dropdown)
// ├── views/
// │   ├── Home.tsx              // Startseite mit Set-Auswahl und Spielstart
// │   └── Game.tsx              // Hauptspielansicht (Board, Karten, Phasen)
// ├── lib/
// │   ├── boosterGenerator.ts   // Booster-Simulation (Scryfall API)
// │   └── utils.ts              // Hilfsfunktionen: shufflen, ziehen etc.
// ├── App.tsx
// ├── main.tsx
// └── index.css

// === Funktionale Module ===

// 1. SetSelector.tsx
// Dropdown zur Auswahl eines MTG-Sets (z. B. "OTJ", "MH3")
// Holt verfügbare Sets von Scryfall oder nutzt festgelegte Liste
// Bei Auswahl wird boosterGenerator aufgerufen

// 2. boosterGenerator.ts
// Für das gewählte Set:
// - Hole 10 zufällige Commons
// - 3 Uncommons
// - 1 Rare oder Mythic (1:8 Wahrscheinlichkeit für Mythic)
// Nutzt Scryfall API: `https://api.scryfall.com/cards/search?q=set:SETCODE+rarity:TYPE`

// 3. DeckBuilder.tsx
// Zeigt Karten aus 6 Boostern in Spalten
// Erlaubt Drag & Drop in Deck-Zone
// Zeigt Deckgröße (max. 40)
// Zeigt Mana-Verteilung (Farb-Chart)
// Lokale Speicherung via localStorage

// 4. Card.tsx
// Props: cardData (von Scryfall), Zustand (getappt, faceDown)
// Features:
// - Tap durch Klick (Rotation per CSS transform)
// - Flip (Rückseite zeigen)
// - Drag & Drop
// - Kontextmenü bei Rechtsklick: tap/flip/exile/graveyard etc.

// 5. PlayerBoard.tsx
// Zeigt alle Zonen für einen Spieler:
// - Deck (ziehbar, mischen, durchsuchen)
// - Hand (verdeckt für Gegner)
// - Battlefield
// - Friedhof (Stapelanzeige)
// - Exil-Zone
// - Lebenspunkte (manuell veränderbar)

// 6. Game.tsx
// Zeigt Spielfeld für beide Spieler (oben/unten)
// Spielphasen-Leiste (Draw, Main1, Combat, Main2, End)
// Aktueller Spieler wird hervorgehoben

// 7. utils.ts
// Hilfsfunktionen: Shuffle, Karte ziehen, Karte verschieben

// 8. main.tsx & App.tsx
// Routing: Home → DeckBuilder → Game
// Zustand global via Context oder Zustand

// === Optionaler Multiplayer ===
// Socket.IO Integration vorbereiten: Verbindungsaufbau, Room-Code, Sync von Moves
// Fokus aktuell auf manuelle Steuerung durch Spieler (kein Auto-Regelwerk)

// === Ziel ===
// Cursor soll basierend auf dieser Struktur automatisch:
// - API Calls erstellen (boosterGenerator)
// - UI-Komponenten bauen (Zonen, Karten, Spielerbereiche)
// - Drag & Drop + Interaktionen einbauen
// - Spielbar als manuelle Arena-Alternative funktionieren

// Bitte beginne mit boosterGenerator.ts und SetSelector.tsx
// Danach DeckBuilder.tsx und Card.tsx
// Dann Game.tsx und PlayerBoard.tsx mit allen Zonen
// Verwende Tailwind für alle Styles, ohne externe CSS-Frameworks
// Bilder und Kartendaten über Scryfall laden
// Karten-ID oder UUID als Schlüssel verwenden
