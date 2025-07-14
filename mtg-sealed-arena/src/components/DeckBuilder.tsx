import React, { useState } from 'react';
import type { Booster, ScryfallCard } from '../lib/boosterGenerator';
import { fetchBasicLand } from '../lib/boosterGenerator';
import { useNavigate } from 'react-router-dom';
import black from '../assets/black.svg';
import blue from '../assets/blue.svg';
import green from '../assets/green.svg';
import red from '../assets/red.svg';
import white from '../assets/white.svg';

interface DeckBuilderProps {
  boosters: Booster[];
  onReady: (deck: ScryfallCard[]) => void;
}

const BASIC_LANDS = [
  { name: 'Plains', label: 'Plains', icon: white },
  { name: 'Island', label: 'Island', icon: blue },
  { name: 'Swamp', label: 'Swamp', icon: black },
  { name: 'Mountain', label: 'Mountain', icon: red },
  { name: 'Forest', label: 'Forest', icon: green },
];

export const DeckBuilder: React.FC<DeckBuilderProps> = ({ boosters, onReady }) => {
  const pool: ScryfallCard[] = boosters.flat();
  const [deck, setDeck] = useState<ScryfallCard[]>([]);
  const [poolCards, setPoolCards] = useState<ScryfallCard[]>(pool);
  const [basicCounts, setBasicCounts] = useState<{ [key: string]: number }>({ Plains: 0, Island: 0, Swamp: 0, Mountain: 0, Forest: 0 });
  const [loadingLand, setLoadingLand] = useState<string | null>(null);
  const [flipped, setFlipped] = useState<Record<string, boolean>>({}); // instanceId -> flipped
  const navigate = useNavigate();

  // Add state for deck card positions
  const [deckPositions, setDeckPositions] = useState<Record<string, { x: number; y: number }>>({});

  // Helper to initialize positions for new cards in deck
  React.useEffect(() => {
    setDeckPositions(prev => {
      const updated = { ...prev };
      let i = 0;
      for (const card of deck) {
        if (!updated[card.instanceId]) {
          updated[card.instanceId] = { x: 40 + i * 40, y: 40 };
          i++;
        }
      }
      // Remove positions for cards no longer in deck
      for (const id in updated) {
        if (!deck.find(c => c.instanceId === id)) {
          delete updated[id];
        }
      }
      return updated;
    });
  }, [deck]);

  // Drag state for deck line
  const [draggedDeckCard, setDraggedDeckCard] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Handler for drag in deck line
  const onDeckCardDrag = (card: ScryfallCard) => (e: React.DragEvent) => {
    if (draggedDeckCard === card.instanceId && e.clientX && e.clientY) {
      setDeckPositions(prev => ({
        ...prev,
        [card.instanceId]: {
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y,
        },
      }));
    }
  };
  // Handler for drag end in deck line
  const onDeckCardDragEnd = (card: ScryfallCard) => (e: React.DragEvent) => {
    setDraggedDeckCard(null);
  };

  // Drag & Drop Handler for pool line
  const onPoolCardDragStart = (card: ScryfallCard) => (e: React.DragEvent) => {
    e.dataTransfer.setData('instanceId', card.instanceId);
    e.dataTransfer.setData('sourceZone', 'pool');
  };

  // Drag & Drop Handler for deck line
  const onDeckCardDragStart = (card: ScryfallCard) => (e: React.DragEvent) => {
    e.dataTransfer.setData('instanceId', card.instanceId);
    e.dataTransfer.setData('sourceZone', 'deck');
  };

  // Drag & Drop Handler for manual zone
  const onManualCardDragStart = (card: ScryfallCard) => (e: React.DragEvent) => {
    e.dataTransfer.setData('instanceId', card.instanceId);
    e.dataTransfer.setData('sourceZone', 'manual');
    setDraggedManualCard(card.instanceId);
    const pos = manualPositions[card.instanceId] || { x: 0, y: 0 };
    setManualDragOffset({ x: e.clientX - pos.x, y: e.clientY - pos.y });
  };

  // Drop handler for deck line
  const onDeckLineDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const instanceId = e.dataTransfer.getData('instanceId');
    const sourceZone = e.dataTransfer.getData('sourceZone');
    let card: ScryfallCard | undefined;
    if (sourceZone === 'manual') {
      card = manualZone.find(c => c.instanceId === instanceId);
    } else if (sourceZone === 'pool') {
      card = poolCards.find(c => c.instanceId === instanceId);
    } else if (sourceZone === 'deck') {
      // Do nothing (already in deck)
      return;
    }
    if (card) {
      setManualZone(manualZone.filter(c => c.instanceId !== instanceId));
      setPoolCards(poolCards.filter(c => c.instanceId !== instanceId));
      setDeck([...deck, card]);
      setManualPositions(prev => {
        const updated = { ...prev };
        delete updated[instanceId];
        return updated;
      });
    }
  };

  // Drop handler for pool line
  const onPoolLineDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const instanceId = e.dataTransfer.getData('instanceId');
    const sourceZone = e.dataTransfer.getData('sourceZone');
    let card: ScryfallCard | undefined;
    if (sourceZone === 'manual') {
      card = manualZone.find(c => c.instanceId === instanceId);
    } else if (sourceZone === 'deck') {
      card = deck.find(c => c.instanceId === instanceId);
    } else if (sourceZone === 'pool') {
      // Do nothing (already in pool)
      return;
    }
    if (card) {
      setManualZone(manualZone.filter(c => c.instanceId !== instanceId));
      setDeck(deck.filter(c => c.instanceId !== instanceId));
      setPoolCards([...poolCards, card]);
      setManualPositions(prev => {
        const updated = { ...prev };
        delete updated[instanceId];
        return updated;
      });
    }
  };

  // Drop handler for manual zone
  const onManualZoneDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const instanceId = e.dataTransfer.getData('instanceId');
    const sourceZone = e.dataTransfer.getData('sourceZone');
    let card: ScryfallCard | undefined;
    // Calculate position relative to manual zone container
    let x = 40, y = 40;
    let maxX = 0, maxY = 0;
    const cardWidth = 160;
    const cardHeight = 240;
    if (manualZoneRef.current) {
      const rect = manualZoneRef.current.getBoundingClientRect();
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
      maxX = rect.width - cardWidth;
      maxY = rect.height - cardHeight;
      x = Math.max(0, Math.min(x, maxX));
      y = Math.max(0, Math.min(y, maxY));
    }
    if (sourceZone === 'manual') {
      // Only update position, do not touch arrays
      setManualPositions(prev => ({ ...prev, [instanceId]: { x, y } }));
      return;
    } else if (sourceZone === 'deck') {
      card = deck.find(c => c.instanceId === instanceId);
    } else if (sourceZone === 'pool') {
      card = poolCards.find(c => c.instanceId === instanceId);
    }
    if (card) {
      setDeck(deck.filter(c => c.instanceId !== instanceId));
      setPoolCards(poolCards.filter(c => c.instanceId !== instanceId));
      setManualZone([...manualZone, card]);
      setManualPositions(prev => ({ ...prev, [card!.instanceId]: { x, y } }));
    }
  };

  const handleAddBasic = async (land: string) => {
    setLoadingLand(land);
    const basics = await fetchBasicLand(poolCards[0]?.set || 'OTJ', land as any, 1);
    setDeck([...deck, ...basics]);
    setLoadingLand(null);
    setBasicCounts({ ...basicCounts, [land]: basicCounts[land] + 1 });
  };

  // Handler für Doppel-Links-Klick (Karte umdrehen)
  const handleCardDoubleClick = (card: ScryfallCard) => (e: React.MouseEvent) => {
    if (card.card_faces && card.card_faces.length > 1) {
      e.preventDefault();
      setFlipped(f => ({ ...f, [card.instanceId]: !f[card.instanceId] }));
    }
  };

  // State for manual arrangement zone
  const [manualZone, setManualZone] = useState<ScryfallCard[]>([]);
  const [manualPositions, setManualPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [draggedManualCard, setDraggedManualCard] = useState<string | null>(null);
  const [manualDragOffset, setManualDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Handler: Move card from deck to manual zone
  const moveToManualZone = (card: ScryfallCard) => {
    setDeck(deck.filter(c => c.instanceId !== card.instanceId));
    setManualZone([...manualZone, card]);
    setManualPositions(prev => ({ ...prev, [card.instanceId]: { x: 40, y: 40 + Object.keys(prev).length * 40 } }));
  };

  // Manual zone drag handlers
  const onManualCardDrag = (card: ScryfallCard) => (e: React.DragEvent) => {
    if (draggedManualCard === card.instanceId && e.clientX && e.clientY) {
      setManualPositions(prev => ({
        ...prev,
        [card.instanceId]: {
          x: e.clientX - manualDragOffset.x,
          y: e.clientY - manualDragOffset.y,
        },
      }));
    }
  };
  const onManualCardDragEnd = (card: ScryfallCard) => (e: React.DragEvent) => {
    setDraggedManualCard(null);
  };

  // Handler: Move card back to deck from manual zone
  const moveToDeckFromManual = (card: ScryfallCard) => {
    setManualZone(manualZone.filter(c => c.instanceId !== card.instanceId));
    setDeck([...deck, card]);
    setManualPositions(prev => {
      const updated = { ...prev };
      delete updated[card.instanceId];
      return updated;
    });
  };

  // Ref for manual zone container
  const manualZoneRef = React.useRef<HTMLDivElement>(null);

  return (
    <div className="flex flex-col  w-full max-w">
      {/* Removed Basic Land Auswahl section from top */}
      {/* Kartenpool oben */}
      <div className="flex flex-col w-full">
        {/* Removed Pool title */}
        <div className="flex flex-row items-center overflow-x-auto whitespace-nowrap bg-white rounded p-2 min-h-[380px]" onDragOver={e => e.preventDefault()} onDrop={onPoolLineDrop}>
          {[...poolCards]
            .filter(card => {
              const type = (card.type_line || '').toLowerCase();
              const basicNames = ['plains', 'island', 'swamp', 'mountain', 'forest'];
              return !(type.includes('land') && basicNames.includes((card.name || '').toLowerCase()));
            })
            .sort((a, b) => {
            // Helper to determine card group
            const getColors = (card: any) => {
              if (card.colors && card.colors.length > 0) return card.colors;
              if (card.card_faces && card.card_faces.length > 0 && card.card_faces[0].colors && card.card_faces[0].colors.length > 0) return card.card_faces[0].colors;
              return [];
            };
            const getGroup = (card: any) => {
              const type = (card.type_line || '').toLowerCase();
              const colors = getColors(card);
              if (colors.length === 1) {
                const colorOrder = ['W', 'U', 'B', 'R', 'G'];
                return colorOrder.indexOf(colors[0]);
              }
              if (colors.length > 1) return 5; // multicolor
              if (type.includes('land')) {
                // Basic lands: Plains, Island, Swamp, Mountain, Forest
                const basicNames = ['plains', 'island', 'swamp', 'mountain', 'forest'];
                if (basicNames.includes((card.name || '').toLowerCase())) return 8; // basic lands last
                return 7; // nonbasic lands
              }
              return 6; // colorless
            };
            const groupA = getGroup(a);
            const groupB = getGroup(b);
            if (groupA !== groupB) return groupA - groupB;
            // If same group, sort by name
            return (a.name || '').localeCompare(b.name || '');
          }).map(card => {
            let img = card.image_uris?.normal;
            if (card.card_faces && card.card_faces.length > 1) {
              if (flipped[card.instanceId]) {
                img = card.card_faces[1]?.image_uris?.normal;
              } else {
                img = card.card_faces[0]?.image_uris?.normal;
              }
              // Fallback: if still no img, try main card.image_uris
              if (!img) img = card.image_uris?.normal;
            }
            return (
              <div
                key={card.instanceId}
                className="flex flex-col items-center text-xs cursor-move p-1 bg-white rounded flex-shrink-0"
                draggable
                onDragStart={onPoolCardDragStart(card)}
                onDoubleClick={handleCardDoubleClick(card)}
                title={card.card_faces && card.card_faces.length > 1 ? 'Doppelklick: Karte umdrehen' : ''}
              >
                {img ? (
                  <img src={img} alt={card.name} style={{ width: '160px', height: '240px', objectFit: 'contain' }} className="rounded card-hover-scale" />
                ) : (
                  <div className="w-8 h-12 bg-gray-300 flex items-center justify-center rounded">No Image</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {/* Deck unten */}
      <div className="flex flex-col w-full mt-8">
        <div className="grid grid-cols-3 items-center mb-2 w-full">
          <div className="flex justify-center">
            <div className="flex flex-row gap-4 items-center">
              {BASIC_LANDS.map(land => (
                <div key={land.name} className="flex flex-col items-center">
                  <button
                    className="bg-gray-600 text-white px-2 py-1 rounded mb-1 disabled:opacity-50 flex items-center justify-center hover:bg-gray-400 focus:bg-gray-400"
                    onClick={() => handleAddBasic(land.name)}
                    disabled={loadingLand === land.name}
                    style={{ width: 40, height: 40 }}
                    title={land.label}
                  >
                    <img src={land.icon} alt={land.label} style={{ width: 24, height: 24 }} />
                  </button>
                  <span className="font-bold text-base uppercase text-center">{basicCounts[land.name]}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-center">
            <h2 className="font-bold text-xl uppercase text-center">Deck ({deck.length}/40)</h2>
          </div>
          <div className="flex justify-center">
            <button
              className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-400 focus:bg-gray-400 disabled:opacity-50 font-bold text-xl uppercase"
              disabled={deck.length <5}
              onClick={() => {
                onReady(deck);
                navigate('/game');
              }}
            >
              READY
            </button>
          </div>
        </div>
        <div
          className="flex flex-row items-center overflow-x-auto whitespace-nowrap bg-white rounded p-2 min-h-[380px]"
          onDragOver={e => e.preventDefault()}
          onDrop={onDeckLineDrop}
        >
          {[...deck]
            .sort((a, b) => {
              // Helper to determine card group (same as pool)
              const getColors = (card: any) => {
                if (card.colors && card.colors.length > 0) return card.colors;
                if (card.card_faces && card.card_faces.length > 0 && card.card_faces[0].colors && card.card_faces[0].colors.length > 0) return card.card_faces[0].colors;
                return [];
              };
              const getGroup = (card: any) => {
                const type = (card.type_line || '').toLowerCase();
                const colors = getColors(card);
                if (colors.length === 1) {
                  const colorOrder = ['W', 'U', 'B', 'R', 'G'];
                  return colorOrder.indexOf(colors[0]);
                }
                if (colors.length > 1) return 5; // multicolor
                if (type.includes('land')) {
                  // Basic lands: Plains, Island, Swamp, Mountain, Forest
                  const basicNames = ['plains', 'island', 'swamp', 'mountain', 'forest'];
                  if (basicNames.includes((card.name || '').toLowerCase())) return 8; // basic lands last
                  return 7; // nonbasic lands
                }
                return 6; // colorless
              };
              const groupA = getGroup(a);
              const groupB = getGroup(b);
              if (groupA !== groupB) return groupA - groupB;
              // If same group, sort by name
              return (a.name || '').localeCompare(b.name || '');
            })
            .map(card => {
              let img = card.image_uris?.normal;
              if (card.card_faces && card.card_faces.length > 1) {
                if (flipped[card.instanceId]) {
                  img = card.card_faces[1]?.image_uris?.normal;
                } else {
                  img = card.card_faces[0]?.image_uris?.normal;
                }
                if (!img) img = card.image_uris?.normal;
              }
              return (
                <div
                  key={card.instanceId}
                  className="flex flex-col items-center text-xs cursor-move p-1 bg-white rounded flex-shrink-0"
                  draggable
                  onDragStart={onDeckCardDragStart(card)}
                  onDoubleClick={handleCardDoubleClick(card)}
                  title={card.card_faces && card.card_faces.length > 1 ? 'Doppelklick: Karte umdrehen' : ''}
                >
                  {img ? (
                    <img src={img} alt={card.name} style={{ width: '160px', height: '240px', objectFit: 'contain' }} className="rounded card-hover-scale" />
                  ) : (
                    <div className="w-8 h-12 bg-gray-300 flex items-center justify-center rounded">No Image</div>
                  )}
                </div>
              );
            })}
        </div>
        {/* Manual arrangement zone */}
        <div
          className="relative bg-gray-100 rounded p-2 min-h-[1600px] mt-8 border border-dashed border-gray-400"
          onDragOver={e => e.preventDefault()}
          onDrop={onManualZoneDrop}
          ref={manualZoneRef}
        >
          {manualZone.map(card => {
            const pos = manualPositions[card.instanceId] || { x: 40, y: 40 };
            let img = card.image_uris?.normal;
            if (card.card_faces && card.card_faces.length > 1) {
              if (flipped[card.instanceId]) {
                img = card.card_faces[1]?.image_uris?.normal;
              } else {
                img = card.card_faces[0]?.image_uris?.normal;
              }
              if (!img) img = card.image_uris?.normal;
            }
            return (
              <div
                key={card.instanceId}
                className="absolute flex flex-col items-center text-xs cursor-move p-1 bg-white rounded shadow-lg"
                style={{ left: pos.x, top: pos.y, zIndex: draggedManualCard === card.instanceId ? 10 : 1 }}
                draggable
                onDragStart={onManualCardDragStart(card)}
                onDrag={onManualCardDrag(card)}
                onDragEnd={onManualCardDragEnd(card)}
                title={card.card_faces && card.card_faces.length > 1 ? 'Doppelklick: Karte zurücklegen' : ''}
              >
                {img ? (
                  <img src={img} alt={card.name} style={{ width: '160px', height: '240px', objectFit: 'contain' }} className="rounded card-hover-scale" />
                ) : (
                  <div className="w-8 h-12 bg-gray-300 flex items-center justify-center rounded">No Image</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}; 