import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ScryfallCard } from '../lib/boosterGenerator';
import magicBack from '../assets/magic-back.jpeg';
import { socket } from '../socket';
import battlefieldArt from '../assets/battlefield_art.jpg';

// --- TokenData und TokenCard müssen direkt nach den Imports stehen ---
interface TokenData {
  id: string;
  name: string;
  type: string;
  power: string;
  toughness: string;
  x: number;
  y: number;
  tapped?: boolean;
  flipped?: boolean;
}
const TokenCard: React.FC<{
  token: TokenData;
  style?: React.CSSProperties;
  isDragging?: boolean;
  onTap?: () => void;
  onFlip?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onMouseEnter?: () => void;
  onMouseMove?: () => void;
  onMouseLeave?: () => void;
}> = ({ token, style, isDragging, onTap, onFlip, onDragStart, onDragEnd, onContextMenu, onMouseEnter, onMouseMove, onMouseLeave }) => {
  // Flip/Tap-Visualisierung
  let transform = '';
  if (token.tapped) transform += ' rotate-90';
  if (token.flipped) transform += ' rotate-180';
  return (
    <div
      className={
        'absolute bg-white border border-black rounded shadow flex flex-col items-center justify-between p-1 cursor-move select-none' +
        (isDragging ? ' opacity-50' : '')
      }
      style={{ width: 60, height: 84, ...style, transform: (style?.transform || '') + transform, zIndex: 21 }}
      draggable
      onDoubleClick={onTap}
      onContextMenu={e => {
        if (onFlip) onFlip();
        if (onContextMenu) onContextMenu(e);
      }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      title={token.type}
      onMouseEnter={onMouseEnter}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      <div className="w-full text-xs font-bold text-center truncate border-b border-gray-200 pb-0.5">{token.name}</div>
      <div className="w-full text-[10px] text-center truncate border-b border-gray-100 py-0.5">{token.type}</div>
      <div className="flex flex-row items-center justify-center mt-1">
        <span className="w-6 text-xs text-center font-bold border border-gray-300 rounded bg-white">{token.power}</span>
        <span className="mx-1 text-xs font-bold">/</span>
        <span className="w-6 text-xs text-center font-bold border border-gray-300 rounded bg-white">{token.toughness}</span>
      </div>
    </div>
  );
};

// --- Card Preview Modal ---
const CardPreviewModal: React.FC<{ card: ScryfallCard; flipped?: boolean; onClose: () => void }> = ({ card, flipped = false, onClose }) => {
  let img = card.image_uris?.normal;
  if (card.card_faces && card.card_faces.length > 1) {
    img = flipped
      ? card.card_faces[1]?.image_uris?.normal
      : card.card_faces[0]?.image_uris?.normal;
    if (!img) img = card.image_uris?.normal;
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
      <div className="relative" onClick={e => e.stopPropagation()}>
        <img
          src={img}
          alt={card.name}
          className="rounded shadow-2xl"
          style={{ width: '360px', height: '540px', objectFit: 'contain' }}
        />
        <button
          className="absolute top-2 right-2 bg-white bg-opacity-80 rounded-full px-3 py-1 text-xl font-bold hover:bg-opacity-100"
          onClick={onClose}
        >
          ×
        </button>
      </div>
    </div>
  );
};

// --- Floating Card Preview (no background) ---
const FloatingCardPreview: React.FC<{ card: ScryfallCard; flipped?: boolean; position?: { x: number; y: number } }> = ({ card, flipped = false }) => {
  let img = card.image_uris?.normal;
  if (card.card_faces && card.card_faces.length > 1) {
    img = flipped
      ? card.card_faces[1]?.image_uris?.normal
      : card.card_faces[0]?.image_uris?.normal;
    if (!img) img = card.image_uris?.normal;
  }
  // Render fixed on the left, vertically centered
  const style: React.CSSProperties = {
    position: 'fixed',
    left: 32,
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 1000,
    pointerEvents: 'none',
    width: 300,
    height: 420, // Correct MTG card proportion: 300 * (7/5) = 420
  };
  return createPortal(
    <img src={img} alt={card.name} style={style} className="rounded shadow-2xl" />,
    document.body
  );
};

// FloatingTokenPreview-Komponente für große Vorschau von Tokens
const FloatingTokenPreview: React.FC<{ token: TokenData; position?: { x: number; y: number } }> = ({ token }) => {
  const style: React.CSSProperties = {
    position: 'fixed',
    left: 32,
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 1000,
    pointerEvents: 'none',
    width: 240,
    height: 336,
    background: 'white',
    border: '2px solid black',
    borderRadius: 8,
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  };
  return (
    <div style={style}>
      <div className="w-full text-2xl font-bold text-center truncate border-b border-gray-300 pb-2">{token.name}</div>
      <div className="w-full text-lg text-center truncate border-b border-gray-200 py-2">{token.type}</div>
      <div className="flex flex-row items-center justify-center mt-4">
        <span className="w-16 text-2xl text-center font-bold border border-gray-400 rounded bg-white">{token.power}</span>
        <span className="mx-4 text-2xl font-bold">/</span>
        <span className="w-16 text-2xl text-center font-bold border border-gray-400 rounded bg-white">{token.toughness}</span>
      </div>
    </div>
  );
};

// DeckZone-Komponente mit Bild und Overlay und Rahmen wie HandZone
const DeckZone: React.FC<{
  deck: ScryfallCard[];
  onShuffle: () => void;
  onSearch: () => void;
  onDraw: () => void;
  onDropCardToDeck?: (card: ScryfallCard, x: number, y: number) => void;
  onDeckDropOption?: (option: string) => void;
  showActionMenu?: boolean;
  onDeckAction?: (action: { type: 'shuffle' | 'scry' | 'surveil' | 'search'; n?: number }) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}> = ({ deck, onShuffle, onSearch, onDraw, onDropCardToDeck, onDeckDropOption, showActionMenu = false, onDeckAction, onDragOver, onDrop, onContextMenu }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [droppedCard, setDroppedCard] = useState<ScryfallCard | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [actionMenuPos, setActionMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [scryN, setScryN] = useState(0);
  const [surveilN, setSurveilN] = useState(0);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setDroppedCard(null);
        setMenuPos(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  // For action menu (right-click deck)
  useEffect(() => {
    if (!actionMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActionMenuOpen(false);
        setActionMenuPos(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [actionMenuOpen]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (showActionMenu) {
      setActionMenuOpen(true);
      setActionMenuPos({ x: e.clientX, y: e.clientY });
    } else {
      setMenuOpen(true);
    }
  };

  // Accept drop from battlefield or other zones
  const handleDrop = (e: React.DragEvent) => {
    if (!onDropCardToDeck) return;
    e.preventDefault();
    const data = e.dataTransfer.getData('card');
    if (!data) return;
    const card: ScryfallCard = JSON.parse(data);
    setDroppedCard(card);
    setMenuOpen(true);
    setMenuPos({ x: e.clientX, y: e.clientY });
  };

  const handleDeckOption = (option: string) => {
    if (droppedCard && onDropCardToDeck && onDeckDropOption) {
      onDropCardToDeck(droppedCard, 0, 0); // x/y not used for deck
      setMenuOpen(false);
      setDroppedCard(null);
      setMenuPos(null);
      onDeckDropOption(option);
    }
  };

  // Action menu handlers
  const handleAction = (type: 'shuffle' | 'scry' | 'surveil' | 'search') => {
    if (onDeckAction) {
      let n = 0;
      if (type === 'scry') n = scryN;
      if (type === 'surveil') n = surveilN;
      onDeckAction({ type, n });
    }
    setActionMenuOpen(false);
    setActionMenuPos(null);
  };

  return (
    <div
      className="relative flex flex-col items-center justify-center h-[120px] w-[140px] rounded select-none"
      style={{ userSelect: 'none' }}
      onDragOver={onDropCardToDeck ? (e) => e.preventDefault() : undefined}
      onDrop={onDropCardToDeck ? handleDrop : undefined}
      onContextMenu={handleContextMenu}
    >
      {/* Magic-Back als Deck-Stapel */}
      <img
        src={magicBack}
        alt="Deck"
        className="w-[60px] h-[84px] object-contain rounded shadow cursor-pointer"
        style={{ width: '60px', height: '84px' }}
        draggable={false}
        onClick={onDraw}
      />
      {/* Overlay für Kartenzahl */}
      <span className="absolute bottom-1 right-2 bg-white bg-opacity-80 px-2 py-1 rounded text-sm font-bold">
        {deck.length}
      </span>
      {/* Rechtsklick-Menü oben rechts auf der Karte oder bei Drop */}
      {menuOpen && (
        <div
          ref={menuRef}
          className="absolute z-50 bg-white border border-gray-400 rounded shadow-md text-base font-normal"
          style={menuPos ? { left: menuPos.x, top: menuPos.y, position: 'fixed' } : {}}
        >
          <button className="block w-full px-4 py-2 hover:bg-gray-200 text-left" onClick={() => handleDeckOption('top')}>On Top</button>
          <button className="block w-full px-4 py-2 hover:bg-gray-200 text-left" onClick={() => handleDeckOption('bottom')}>On Bottom</button>
          <button className="block w-full px-4 py-2 hover:bg-gray-200 text-left" onClick={() => handleDeckOption('shuffle')}>Shuffle</button>
          <button className="block w-full px-4 py-2 hover:bg-gray-200 text-left" onClick={() => handleAction('search')}>Search</button>
        </div>
      )}
      {/* Action menu for right-click on own deck */}
      {actionMenuOpen && (
        <div
          ref={menuRef}
          className="absolute z-50 bg-white border border-gray-400 rounded shadow-md text-base font-normal"
          style={{ bottom: '100%', left: 0, marginBottom: '8px' }}
        >
          <button className="block w-full px-4 py-2 hover:bg-gray-200 text-left" onClick={() => handleAction('shuffle')}>Shuffle</button>
          <div className="flex flex-row items-center px-4 py-2">
            <span className="flex-1 text-left">Scry</span>
            <button className="px-2" onClick={() => setScryN(Math.max(0, scryN - 1))}>-</button>
            <span className="w-6 text-center">{scryN}</span>
            <button className="px-2" onClick={() => setScryN(Math.min(deck.length, scryN + 1))}>+</button>
            <button className="ml-2 px-2 py-1 bg-blue-100 rounded hover:bg-blue-200" onClick={() => handleAction('scry')}>Go</button>
          </div>
          <div className="flex flex-row items-center px-4 py-2">
            <span className="flex-1 text-left">Surveil</span>
            <button className="px-2" onClick={() => setSurveilN(Math.max(0, surveilN - 1))}>-</button>
            <span className="w-6 text-center">{surveilN}</span>
            <button className="px-2" onClick={() => setSurveilN(Math.min(deck.length, surveilN + 1))}>+</button>
            <button className="ml-2 px-2 py-1 bg-blue-100 rounded hover:bg-blue-200" onClick={() => handleAction('surveil')}>Go</button>
          </div>
          <button className="block w-full px-4 py-2 hover:bg-gray-200 text-left" onClick={() => handleAction('search')}>Search</button>
        </div>
      )}
    </div>
  );
};

// HandZone als Card-Komponenten mit Drag
interface HandZoneProps {
  hand: ScryfallCard[];
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
  onDropCardToHand?: (card: ScryfallCard) => void;
  draggable?: boolean;
  flipped?: Record<string, boolean>;
  onCardDoubleClick?: (card: ScryfallCard) => (e: React.MouseEvent) => void;
  onMouseEnterCard: (card: ScryfallCard, flipped: boolean) => (e: React.MouseEvent) => void;
  onMouseMoveCard: (card: ScryfallCard, flipped: boolean) => (e: React.MouseEvent) => void;
  onMouseLeaveCard: () => void;
}
const HandZone: React.FC<HandZoneProps> = ({ hand, isDragging, setIsDragging, onDropCardToHand, draggable = true, flipped = {}, onCardDoubleClick, onMouseEnterCard, onMouseMoveCard, onMouseLeaveCard }) => (
  <div
    className="flex flex-row justify-center gap-0.5 w-[600px] h-[120px] items-center relative overflow-x-auto overflow-y-visible whitespace-nowrap border-2 border-black rounded bg-white"
    onDragOver={e => onDropCardToHand && e.preventDefault()}
    onDrop={e => {
      if (!onDropCardToHand) return;
      e.preventDefault();
      const data = e.dataTransfer.getData('card');
      if (!data) return;
      const card: ScryfallCard = JSON.parse(data);
      onDropCardToHand(card);
    }}
  >
    {hand.map(card => (
      <Card
        key={card.instanceId}
        card={card}
        draggable={draggable}
        zone="hand"
        isDragging={isDragging}
        flipped={flipped[card.instanceId] || false}
        onDoubleClick={onCardDoubleClick ? onCardDoubleClick(card) : undefined}
        onDragStart={(e) => {
          if (!draggable) return;
          setIsDragging(true);
          e.dataTransfer.setData('card', JSON.stringify(card));
        }}
        onDragEnd={() => setIsDragging(false)}
        onMouseEnter={onMouseEnterCard(card, flipped[card.instanceId] || false)}
        onMouseMove={onMouseMoveCard(card, flipped[card.instanceId] || false)}
        onMouseLeave={onMouseLeaveCard}
      />
    ))}
  </div>
);

// Card-Komponente für Drag & Drop, Tap/Untap, freie Platzierung
interface CardProps {
  card: ScryfallCard;
  style?: React.CSSProperties;
  onDoubleClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onDragStart?: (e: React.DragEvent, card: ScryfallCard) => void;
  onDragEnd?: (e: React.DragEvent, card: ScryfallCard) => void;
  draggable?: boolean;
  tapped?: boolean;
  zone?: 'battlefield' | 'hand';
  userEmail?: string;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseMove?: (e: React.MouseEvent) => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
}

const Card: React.FC<CardProps & { isDragging?: boolean; flipped?: boolean; onClick?: (e: React.MouseEvent) => void }> = ({ card, style, onDoubleClick, onContextMenu, onDragStart, onDragEnd, draggable = false, tapped = false, zone, isDragging = false, flipped = false, userEmail, onClick, onMouseEnter, onMouseMove, onMouseLeave }) => {
  const base = "w-[60px] h-[84px] flex-none object-contain rounded shadow cursor-pointer";
  
  // Double-Faced Karten Logik
  let imgSrc = card.image_uris?.normal;
  if (card.card_faces && card.card_faces.length > 1) {
    imgSrc = flipped 
      ? card.card_faces[1].image_uris?.normal 
      : card.card_faces[0].image_uris?.normal;
  } else {
    imgSrc = flipped ? magicBack : card.image_uris?.normal;
  }
  // Drag-Image-Workaround für alle Zonen
  const handleDragStart = (e: React.DragEvent) => {
    // Kleines Drag-Image setzen
    const dragImg = document.createElement('img');
    dragImg.src = imgSrc || '';
    dragImg.width = 60;
    dragImg.height = 84;
    dragImg.style.width = '60px';
    dragImg.style.height = '84px';
    dragImg.style.position = 'absolute';
    dragImg.style.pointerEvents = 'none';
    document.body.appendChild(dragImg);
    e.dataTransfer.setDragImage(dragImg, 30, 42);
    setTimeout(() => document.body.removeChild(dragImg), 0);
    if (onDragStart) onDragStart(e, card);
  };
  // Battlefield: Hover-Effekt nur wenn nicht isDragging
  if (zone === 'battlefield') {
    const battlefieldHover = isDragging ? "" : " transition-all duration-200 z-10";
    // Rotate opponent's cards 180deg
    let transform = tapped ? 'rotate(90deg)' : '';
    if (card.owner && userEmail && card.owner !== userEmail) {
      transform = (transform ? transform + ' ' : '') + 'rotate(180deg)';
    }
    return (
      <img
        src={imgSrc}
        alt={card.name}
        style={{
          ...style,
          transform: transform || undefined,
          transition: 'transform 0.2s',
          zIndex: 10,
          position: 'absolute',
          left: style?.left,
          top: style?.top,
        }}
        className={base + battlefieldHover}
        draggable={draggable}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
        onDragStart={handleDragStart}
        onDragEnd={e => onDragEnd && onDragEnd(e, card)}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      />
    );
  }
  // Handkarten und Modal: Hover-Effekt immer aktiv, Drag-Image-Workaround
  const handHover = " transition-all duration-200 mx-1 origin-bottom z-10";
  return (
    <img
      src={imgSrc}
      alt={card.name}
      className={base + handHover}
      draggable={draggable}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onDragStart={handleDragStart}
      onDragEnd={e => onDragEnd && onDragEnd(e, card)}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    />
  );
};

// Battlefield-Komponente mit freier Platzierung
interface BattlefieldCard extends ScryfallCard {
  x: number;
  y: number;
  tapped?: boolean;
  flipped?: boolean;
}

const CARD_WIDTH = 60; // px, as used in Card component
const CARD_HEIGHT = 84; // px, as used in Card component

// Typ für Counter auf dem Battlefield
interface BattlefieldCounter {
  id: string;
  value: number;
  x: number;
  y: number;
}

interface BattlefieldProps {
  cards: BattlefieldCard[];
  onDropCard: (card: ScryfallCard, x: number, y: number) => void;
  onTapToggle: (instanceId: string) => void;
  onFlip: (instanceId: string) => void;
  onMoveCard: (instanceId: string, x: number, y: number) => void;
  userIsTopPlayer?: boolean;
  userEmail: string;
  onMouseEnterCard: (card: ScryfallCard, flipped: boolean) => (e: React.MouseEvent) => void;
  onMouseMoveCard: (card: ScryfallCard, flipped: boolean) => (e: React.MouseEvent) => void;
  onMouseLeaveCard: () => void;
  counters: BattlefieldCounter[];
  tokens: TokenData[];
  onDropCounter: (counter: { id: string; value: number }, x: number, y: number) => void;
  onMoveCounter: (id: string, x: number, y: number) => void;
  draggedCounterId: string | null;
  setDraggedCounterId: (id: string | null) => void;
  setFloatingPreview: (v: any) => void;
}
const Battlefield: React.FC<BattlefieldProps> = ({ cards, onDropCard, onTapToggle, onFlip, onMoveCard, userIsTopPlayer = false, userEmail, onMouseEnterCard, onMouseMoveCard, onMouseLeaveCard, counters, tokens, onDropCounter, onMoveCounter, draggedCounterId, setDraggedCounterId, setFloatingPreview }) => {
  const fieldRef = useRef<HTMLDivElement>(null);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [fieldHeight, setFieldHeight] = useState<number>(0);
  const [fieldWidth, setFieldWidth] = useState<number>(0);

  // Measure battlefield height and width as soon as possible
  React.useLayoutEffect(() => {
    const updateSize = () => {
      if (fieldRef.current) {
        setFieldHeight(fieldRef.current.offsetHeight);
        setFieldWidth(fieldRef.current.offsetWidth);
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);
  // Fallback: update size on every render if needed
  React.useEffect(() => {
    if (fieldRef.current) {
      if (fieldRef.current.offsetHeight !== fieldHeight) setFieldHeight(fieldRef.current.offsetHeight);
      if (fieldRef.current.offsetWidth !== fieldWidth) setFieldWidth(fieldRef.current.offsetWidth);
    }
  });

  // Drag & Drop: Drop-Handler
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const cardData = e.dataTransfer.getData('card');
    const counterData = e.dataTransfer.getData('counter');
    const battlefieldCounterId = e.dataTransfer.getData('battlefieldCounterId');
    const tokenData = e.dataTransfer.getData('token');
    const battlefieldTokenId = e.dataTransfer.getData('battlefieldTokenId');
    const rect = fieldRef.current?.getBoundingClientRect();
    if (!rect) return;
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;
    // Clamp x/y to keep inside battlefield
    if (fieldWidth > 0 && fieldHeight > 0) {
      x = Math.max(0, Math.min(x, fieldWidth - CARD_WIDTH));
      y = Math.max(0, Math.min(y, fieldHeight - CARD_HEIGHT));
    }
    if (userIsTopPlayer && fieldHeight > 0) {
      y = fieldHeight - y - CARD_HEIGHT;
    }
    if (cardData) {
      const card: ScryfallCard = JSON.parse(cardData);
      onDropCard(card, x, y);
      setDraggedCardId(null);
    } else if (counterData) {
      const counter = JSON.parse(counterData);
      onDropCounter(counter, x, y);
    } else if (battlefieldCounterId) {
      onMoveCounter(battlefieldCounterId, x, y);
      setDraggedCounterId(null);
    } else if (tokenData) {
      const token = JSON.parse(tokenData);
      socket.emit('add_token', { ...token, x, y, tapped: false, flipped: false });
    } else if (battlefieldTokenId) {
      // Token auf Battlefield verschieben
      socket.emit('move_token', { id: battlefieldTokenId, x, y });
    }
  };

  return (
    <div
      ref={fieldRef}
      className="relative w-full h-full bg-white border-2 border-black rounded"
      onDragOver={e => e.preventDefault()}
      onDrop={handleDrop}
      style={{
        boxSizing: 'border-box',
        backgroundImage: `url(${battlefieldArt})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'white',
          opacity: 0.6,
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
      {/* Only render cards if fieldHeight is known */}
      {fieldHeight > 0 && cards.map(card => {
        let y = card.y;
        // Always render in local view: flip for top player
        if (userIsTopPlayer) {
          y = fieldHeight - card.y - CARD_HEIGHT;
        }
        return (
          <Card
            key={card.instanceId}
            card={card}
            style={{ left: card.x, top: y, opacity: draggedCardId === card.instanceId ? 0 : 1 }}
            tapped={card.tapped}
            flipped={card.flipped}
            zone="battlefield"
            isDragging={draggedCardId === card.instanceId}
            userEmail={userEmail}
            onDoubleClick={() => onTapToggle(card.instanceId)}
            onContextMenu={e => {
              e.preventDefault();
              onFlip(card.instanceId);
            }}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('card', JSON.stringify(card));
              setDraggedCardId(card.instanceId);
            }}
            onDragEnd={() => setDraggedCardId(null)}
            onMouseEnter={onMouseEnterCard(card, card.flipped || false)}
            onMouseMove={onMouseMoveCard(card, card.flipped || false)}
            onMouseLeave={onMouseLeaveCard}
          />
        );
      })}
      {/* Render Counters */}
      {fieldHeight > 0 && counters.map(counter => {
        let y = counter.y;
        if (userIsTopPlayer) {
          y = fieldHeight - counter.y - 32;
        }
        return (
          <div
            key={counter.id}
            className="absolute flex items-center justify-center w-8 h-8 bg-yellow-300 border-2 border-yellow-600 rounded text-lg font-bold shadow cursor-move select-none"
            style={{ left: counter.x, top: y, zIndex: 20, opacity: draggedCounterId === counter.id ? 0.5 : 1 }}
            draggable
            onDragStart={e => {
              e.dataTransfer.setData('battlefieldCounterId', counter.id);
              setDraggedCounterId(counter.id);
            }}
            onDragEnd={() => setDraggedCounterId(null)}
            onClick={e => {
              e.stopPropagation();
              // Wert erhöhen
              socket.emit('move_counter', { id: counter.id, x: counter.x, y: counter.y, value: (counter.value || 1) + 1 });
            }}
            onContextMenu={e => {
              e.preventDefault();
              e.stopPropagation();
              // Wert verringern (mind. 1)
              socket.emit('move_counter', { id: counter.id, x: counter.x, y: counter.y, value: Math.max(1, (counter.value || 1) - 1) });
            }}
          >
            {counter.value}
          </div>
        );
      })}
      {fieldHeight > 0 && (tokens || []).map((token: TokenData) => {
        let y = token.y;
        if (userIsTopPlayer) {
          y = fieldHeight - token.y - CARD_HEIGHT;
        }
        return (
          <TokenCard
            key={token.id}
            token={token}
            style={{ left: token.x, top: y, opacity: 1 }}
            isDragging={false}
            onTap={() => socket.emit('tap_token', { id: token.id })}
            onFlip={() => socket.emit('flip_token', { id: token.id })}
            onDragStart={(e: React.DragEvent) => {
              e.dataTransfer.setData('battlefieldTokenId', token.id);
            }}
            onDragEnd={() => {}}
            onMouseEnter={() => setFloatingPreview({ token, position: { x: 0, y: 0 } })}
            onMouseMove={() => setFloatingPreview((prev: any) => prev ? { ...prev } : null)}
            onMouseLeave={() => setFloatingPreview(null)}
          />
        );
      })}
    </div>
  );
};

// Gestapelte Zone (Friedhof/Exil)
const StackedZone: React.FC<{ 
  label: string; 
  cards: ScryfallCard[]; 
  onShow: () => void;
  flipped?: Record<string, boolean>;
}> = ({ label, cards, onShow, flipped = {} }) => {
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onShow();
  };
  // Show only the top card (last in array), like DeckZone
  const topCard = cards.length > 0 ? cards[cards.length - 1] : null;
  let img = topCard?.image_uris?.normal;
  if (topCard && topCard.card_faces && topCard.card_faces.length > 1) {
    img = flipped[topCard.instanceId]
      ? topCard.card_faces[1].image_uris?.normal
      : topCard.card_faces[0].image_uris?.normal;
  }
  return (
    <div className="relative flex flex-col items-center justify-center h-[120px] w-[140px] rounded select-none bg-white">
      {/* Stack (show only top card) */}
      {topCard && (
        <img
          src={img}
          alt={topCard.name}
          className="w-[60px] h-[84px] object-contain rounded shadow cursor-pointer"
          draggable={false}
        />
      )}
      {/* Overlay for card count */}
      <span className="absolute bottom-1 right-2 bg-white bg-opacity-80 px-2 py-1 rounded text-sm font-bold">
        {cards.length}
      </span>
    </div>
  );
};

// Lebenspunkte mit Plus/Minus im Zonen-Stil
const LifeBox: React.FC<{ life: number; onChange: (v: number) => void }> = ({ life, onChange }) => (
  <div className="flex flex-col items-center justify-center w-full h-full">
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Colored circle with life number */}
      <div className="absolute z-10 bg-gray-700 text-white rounded-full w-12 h-12 flex items-center justify-center text-lg font-bold shadow-md border-2 border-black">
        {life}
      </div>
      
      {/* Center line */}
      <div className="absolute z-5 w-0.5 h-full bg-black"></div>
      
      {/* Left side (minus) - invisible clickable area */}
      <div 
        className="absolute left-2 top-0 w-1/2 h-full cursor-pointer flex items-center justify-start pl-2"
        onClick={() => onChange(life - 1)}
      >
        <span className="text-gray-600 text-2xl font-bold">−</span>
      </div>
      
      {/* Right side (plus) - invisible clickable area */}
      <div 
        className="absolute right-2 top-0 w-1/2 h-full cursor-pointer flex items-center justify-end pr-2"
        onClick={() => onChange(life + 1)}
      >
        <span className="text-gray-600 text-2xl font-bold">+</span>
      </div>
    </div>
  </div>
);

// --- Modal Drop-Zonen ---
const ModalDropTargets = [
  { id: 'hand', label: 'Hand' },
  { id: 'battlefield', label: 'Battlefield' },
  { id: 'deck', label: 'Deck' },
  { id: 'graveyard', label: 'Graveyard' },
  { id: 'exile', label: 'Exile' },
];

// Modal für Zone-Anzeige mit Drag & Drop
const ZoneModal: React.FC<{
  cards: ScryfallCard[];
  label: string;
  onClose: () => void;
  onMoveCard: (card: ScryfallCard, target: string, deckOption?: string) => void;
}> = ({ cards, label, onClose, onMoveCard }) => {
  const [modalCards, setModalCards] = useState(cards); // local state for cards
  const [draggedCard, setDraggedCard] = useState<ScryfallCard | null>(null);
  const [showDeckMenu, setShowDeckMenu] = useState<{ card: ScryfallCard; x: number; y: number } | null>(null);
  const [flipped, setFlipped] = useState<Record<string, boolean>>({}); // instanceId -> flipped

  // Keep modalCards in sync with cards prop
  useEffect(() => {
    setModalCards(cards);
  }, [cards]);

  // Handler für Drop auf Ziel
  const handleDrop = (target: string) => (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedCard) return;
    if (target === 'deck') {
      // Menü anzeigen
      setShowDeckMenu({ card: draggedCard, x: e.clientX, y: e.clientY });
    } else {
      setModalCards(prev => prev.filter(c => c.instanceId !== draggedCard.instanceId)); // remove immediately
      onMoveCard(draggedCard, target);
      setDraggedCard(null);
    }
  };

  // Handler für Deck-Option
  const handleDeckOption = (option: string) => {
    if (showDeckMenu) {
      setModalCards(prev => prev.filter(c => c.instanceId !== showDeckMenu.card.instanceId)); // remove immediately
      onMoveCard(showDeckMenu.card, 'deck', option);
      setShowDeckMenu(null);
      setDraggedCard(null);
    }
  };

  // Drop-Ziel-Liste ohne aktuelle Zone
  const filteredTargets = ModalDropTargets.filter(tgt => tgt.label.toLowerCase() !== label.toLowerCase());
  // Ref für Deck-Drop-Feld
  const deckDropRef = useRef<HTMLDivElement>(null);

  // Deck-Menü-Position relativ zum Modal-Div
  let deckMenuStyle: React.CSSProperties = {};
  if (showDeckMenu && deckDropRef.current && deckDropRef.current.offsetParent) {
    const parentRect = (deckDropRef.current.offsetParent as HTMLElement).getBoundingClientRect();
    const deckRect = deckDropRef.current.getBoundingClientRect();
    deckMenuStyle = {
      left: deckRect.left - parentRect.left,
      top: deckRect.top - parentRect.top + deckRect.height,
    };
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" onClick={onClose}>
      <div className="bg-white rounded-lg p-6 shadow-lg relative min-w-[400px] min-h-[200px]" onClick={e => e.stopPropagation()}>
        <button className="absolute top-2 right-2 text-xl font-bold" onClick={onClose}>×</button>
        <div className="text-lg font-semibold mb-4">{label}</div>
        <div className="flex flex-row gap-1 items-center justify-center mb-4">
          {modalCards.map(card => {
            let img = card.image_uris?.normal;
            if (card.card_faces && card.card_faces.length > 1) {
              img = flipped[card.instanceId]
                ? card.card_faces[1].image_uris?.normal
                : card.card_faces[0].image_uris?.normal;
            }
            return (
              <img
                key={card.instanceId}
                src={img}
                alt={card.name}
                className="w-[60px] h-[84px] object-contain rounded shadow cursor-pointer transition-all duration-200 hover:w-[120px] hover:h-[168px] z-10"
                draggable
                onDoubleClick={(e) => {
                  if (card.card_faces && card.card_faces.length > 1) {
                    e.preventDefault();
                    setFlipped(f => ({ ...f, [card.instanceId]: !f[card.instanceId] }));
                  }
                }}
                onDragStart={() => setDraggedCard(card)}
                onDragEnd={() => setDraggedCard(null)}
                title={card.card_faces && card.card_faces.length > 1 ? 'Doppelklick: Karte umdrehen' : ''}
              />
            );
          })}
        </div>
        <div className="flex flex-row gap-4 items-center justify-center mt-2">
          {filteredTargets.map(tgt => (
            <div
              key={tgt.id}
              ref={tgt.id === 'deck' ? deckDropRef : undefined}
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop(tgt.id)}
              className="px-4 py-2 border border-gray-400 rounded bg-gray-100 cursor-pointer text-center min-w-[80px]"
            >
              {tgt.label}
            </div>
          ))}
        </div>
        {/* Deck-Optionen als Menü */}
        {showDeckMenu && (
          <div
            className="absolute z-50 bg-white border border-gray-400 rounded shadow-md"
            style={deckMenuStyle}
          >
            <button className="block w-full px-4 py-2 hover:bg-gray-200 text-left" onClick={() => handleDeckOption('top')}>On Top</button>
            <button className="block w-full px-4 py-2 hover:bg-gray-200 text-left" onClick={() => handleDeckOption('bottom')}>On Bottom</button>
            <button className="block w-full px-4 py-2 hover:bg-gray-200 text-left" onClick={() => handleDeckOption('shuffle')}>Shuffle</button>
          </div>
        )}
      </div>
    </div>
  );
};

// Spielphasen-Leiste
const PHASES = [
  'Untap',
  'Upkeep',
  'Draw',
  'Main 1',
  'Combat',
  'Main 2',
  'End',
];

const PhaseBar: React.FC<{
  currentPhase: number;
  setCurrentPhase: (idx: number) => void;
  currentPlayer: 'top' | 'bottom';
  onNextPhase: () => void;
  onPrevPhase: () => void;
  onSwitchPlayer: () => void;
}> = ({ currentPhase, setCurrentPhase, currentPlayer, onNextPhase, onPrevPhase, onSwitchPlayer }) => (
  <div className="flex flex-row items-center w-full mb-2 whitespace-nowrap overflow-x-auto px-2 py-1">
    {/* Current Player ganz links */}
    <div className="flex flex-row items-center bg-blue-100 rounded px-3 py-1 min-w-[160px] mr-4">
      <span className="text-sm font-semibold mr-2">Current Player:</span>
      <span className={currentPlayer === 'top' ? 'text-blue-600 font-bold' : 'text-green-600 font-bold'}>{currentPlayer === 'top' ? 'Top' : 'Bottom'}</span>
    </div>
    {/* Phasen-Buttons mittig */}
    <div className="flex flex-row items-center gap-x-2 mx-auto">
      <button className="px-2 py-1 bg-gray-200 rounded" onClick={onPrevPhase}>&lt;</button>
      {PHASES.map((phase, idx) => (
        <button
          key={phase}
          className={
            'px-3 py-1 rounded border ' +
            (idx === currentPhase ? 'bg-yellow-200 border-yellow-500 font-bold' : 'bg-white border-gray-300')
          }
          onClick={() => setCurrentPhase(idx)}
        >
          {phase}
        </button>
      ))}
      <button className="px-2 py-1 bg-gray-200 rounded" onClick={onNextPhase}>&gt;</button>
    </div>
    {/* Switch Player ganz rechts */}
    <button
      className="bg-blue-100 px-3 py-1 rounded font-semibold text-blue-800 hover:bg-blue-200 transition ml-4 min-w-[120px]"
      onClick={onSwitchPlayer}
    >
      Switch Player
    </button>
  </div>
);

// Approval modal component
const ApprovalModal: React.FC<{ action: string; n?: number; onApprove: () => void; onDeny: () => void }> = ({ action, n, onApprove, onDeny }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
    <div className="bg-white rounded-lg p-6 shadow-lg relative min-w-[320px] min-h-[120px] flex flex-col items-center">
      <div className="text-lg font-semibold mb-4 text-center">
        Your opponent wants to {action}{typeof n === 'number' && n > 0 ? ` ${n}` : ''}.<br />Do you approve?
      </div>
      <div className="flex flex-row gap-4 mt-2">
        <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" onClick={onApprove}>OK</button>
        <button className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400" onClick={onDeny}>NO</button>
      </div>
    </div>
  </div>
);

// Scry modal component
const ScryModal: React.FC<{
  cards: ScryfallCard[];
  onConfirm: (top: ScryfallCard[], bottom: ScryfallCard[]) => void;
  onCancel: () => void;
}> = ({ cards, onConfirm, onCancel }) => {
  const [top, setTop] = useState(cards);
  const [bottom, setBottom] = useState<ScryfallCard[]>([]);

  // Move card to bottom
  const moveToBottom = (idx: number) => {
    setBottom([...bottom, top[idx]]);
    setTop(top.filter((_, i) => i !== idx));
  };
  // Move card back to top
  const moveToTop = (idx: number) => {
    setTop([...top, bottom[idx]]);
    setBottom(bottom.filter((_, i) => i !== idx));
  };
  // Reorder top cards
  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const newTop = [...top];
    [newTop[idx - 1], newTop[idx]] = [newTop[idx], newTop[idx - 1]];
    setTop(newTop);
  };
  const moveDown = (idx: number) => {
    if (idx === top.length - 1) return;
    const newTop = [...top];
    [newTop[idx + 1], newTop[idx]] = [newTop[idx], newTop[idx + 1]];
    setTop(newTop);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
      <div className="bg-white rounded-lg p-6 shadow-lg relative min-w-[400px] min-h-[200px] flex flex-col items-center">
        <div className="text-lg font-semibold mb-4 text-center">Scry: Reorder or move cards to bottom</div>
        <div className="flex flex-row gap-8">
          <div>
            <div className="font-bold mb-2 text-center">Top of Deck</div>
            {top.map((card, idx) => (
              <div key={card.instanceId} className="flex flex-row items-center mb-1">
                <img src={card.image_uris?.normal} alt={card.name} className="w-12 h-16 rounded shadow mr-2" />
                <span className="w-32 truncate">{card.name}</span>
                <button className="ml-2 px-2 py-1 bg-gray-200 rounded hover:bg-gray-300" onClick={() => moveToBottom(idx)}>To Bottom</button>
                <button className="ml-1 px-2 py-1 bg-gray-100 rounded hover:bg-gray-200" onClick={() => moveUp(idx)} disabled={idx === 0}>↑</button>
                <button className="ml-1 px-2 py-1 bg-gray-100 rounded hover:bg-gray-200" onClick={() => moveDown(idx)} disabled={idx === top.length - 1}>↓</button>
              </div>
            ))}
          </div>
          <div>
            <div className="font-bold mb-2 text-center">Bottom of Deck</div>
            {bottom.map((card, idx) => (
              <div key={card.instanceId} className="flex flex-row items-center mb-1">
                <img src={card.image_uris?.normal} alt={card.name} className="w-12 h-16 rounded shadow mr-2" />
                <span className="w-32 truncate">{card.name}</span>
                <button className="ml-2 px-2 py-1 bg-gray-200 rounded hover:bg-gray-300" onClick={() => moveToTop(idx)}>To Top</button>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-row gap-4 mt-6">
          <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" onClick={() => onConfirm(top, bottom)}>Confirm</button>
          <button className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

// Surveil modal component
const SurveilModal: React.FC<{
  cards: ScryfallCard[];
  onConfirm: (top: ScryfallCard[], grave: ScryfallCard[]) => void;
  onCancel: () => void;
}> = ({ cards, onConfirm, onCancel }) => {
  const [top, setTop] = useState(cards);
  const [grave, setGrave] = useState<ScryfallCard[]>([]);

  // Move card to graveyard
  const moveToGrave = (idx: number) => {
    setGrave([...grave, top[idx]]);
    setTop(top.filter((_, i) => i !== idx));
  };
  // Move card back to top
  const moveToTop = (idx: number) => {
    setTop([...top, grave[idx]]);
    setGrave(grave.filter((_, i) => i !== idx));
  };
  // Reorder top cards
  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const newTop = [...top];
    [newTop[idx - 1], newTop[idx]] = [newTop[idx], newTop[idx - 1]];
    setTop(newTop);
  };
  const moveDown = (idx: number) => {
    if (idx === top.length - 1) return;
    const newTop = [...top];
    [newTop[idx + 1], newTop[idx]] = [newTop[idx], newTop[idx + 1]];
    setTop(newTop);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
      <div className="bg-white rounded-lg p-6 shadow-lg relative min-w-[400px] min-h-[200px] flex flex-col items-center">
        <div className="text-lg font-semibold mb-4 text-center">Surveil: Move any to graveyard, reorder the rest</div>
        <div className="flex flex-row gap-8">
          <div>
            <div className="font-bold mb-2 text-center">Top of Deck</div>
            {top.map((card, idx) => (
              <div key={card.instanceId} className="flex flex-row items-center mb-1">
                <img src={card.image_uris?.normal} alt={card.name} className="w-12 h-16 rounded shadow mr-2" />
                <span className="w-32 truncate">{card.name}</span>
                <button className="ml-2 px-2 py-1 bg-gray-200 rounded hover:bg-gray-300" onClick={() => moveToGrave(idx)}>To Graveyard</button>
                <button className="ml-1 px-2 py-1 bg-gray-100 rounded hover:bg-gray-200" onClick={() => moveUp(idx)} disabled={idx === 0}>↑</button>
                <button className="ml-1 px-2 py-1 bg-gray-100 rounded hover:bg-gray-200" onClick={() => moveDown(idx)} disabled={idx === top.length - 1}>↓</button>
              </div>
            ))}
          </div>
          <div>
            <div className="font-bold mb-2 text-center">Graveyard</div>
            {grave.map((card, idx) => (
              <div key={card.instanceId} className="flex flex-row items-center mb-1">
                <img src={card.image_uris?.normal} alt={card.name} className="w-12 h-16 rounded shadow mr-2" />
                <span className="w-32 truncate">{card.name}</span>
                <button className="ml-2 px-2 py-1 bg-gray-200 rounded hover:bg-gray-300" onClick={() => moveToTop(idx)}>To Top</button>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-row gap-4 mt-6">
          <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" onClick={() => onConfirm(top, grave)}>Confirm</button>
          <button className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

// CounterZone-Komponente für +1/+1 Counter
const CounterZone: React.FC<{ onDragCounter?: (counter: { id: string; value: number }) => void }> = ({ onDragCounter }) => {
  const [value, setValue] = useState(1);
  const counterIdRef = useRef(0);

  const handleDragStart = (e: React.DragEvent) => {
    const counter = { id: `counter-${counterIdRef.current++}`, value };
    e.dataTransfer.setData('counter', JSON.stringify(counter));
    if (onDragCounter) onDragCounter(counter);
  };

  return (
    <div className="flex flex-col items-center justify-center w-[140px] h-[120px] border-2 border-black rounded bg-white mr-0 relative">
      {/* Colored square with counter number */}
      <div
        className="absolute z-10 bg-yellow-300 text-gray-900 rounded w-12 h-12 flex items-center justify-center text-lg font-bold shadow-md border-2 border-yellow-600 select-none cursor-move"
        style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
        draggable
        onDragStart={handleDragStart}
        title="Drag to battlefield"
      >
        {value}
      </div>
      {/* Center line */}
      <div className="absolute z-5 w-0.5 h-full bg-black"></div>
      {/* Left side (minus) - invisible clickable area */}
      <div 
        className="absolute left-2 top-0 w-1/2 h-full cursor-pointer flex items-center justify-start pl-2"
        onClick={() => setValue(v => Math.max(1, v - 1))}
      >
        <span className="text-gray-600 text-2xl font-bold">−</span>
      </div>
      {/* Right side (plus) - invisible clickable area */}
      <div 
        className="absolute right-2 top-0 w-1/2 h-full cursor-pointer flex items-center justify-end pr-2"
        onClick={() => setValue(v => v + 1)}
      >
        <span className="text-gray-600 text-2xl font-bold">+</span>
      </div>
    </div>
  );
};

// Game-Komponente erwartet das finale Deck als Prop
interface GameProps {
  deck: ScryfallCard[];
  gameState: any;
  user: string;
}

const ZONE_LABELS_TOP = ['EXILE', 'GRAVE', 'HAND', 'DECK'];
const ZONE_LABELS_BOTTOM = ['DECK', 'HAND', 'GRAVE', 'EXILE'];

const Game: React.FC<GameProps> = ({ deck: initialDeck, gameState, user }) => {
  // Finde eigenen und gegnerischen State
  const myState = gameState.players[user];
  const opponentEmail = Object.keys(gameState.players).find(e => e !== user) || '';
  const oppState = gameState.players[opponentEmail] || { hand: [], library: [], graveyard: [], exile: [] };
  const isTopPlayer = gameState.playerRoles && gameState.playerRoles[user] === 'top';
  const battlefield = gameState.battlefield || [];

  // Drag-Status für Hover-Effekt und gezogene Karte
  const [isDragging, setIsDragging] = useState(false);
  const [modalZone, setModalZone] = useState<null | { label: string; cards: ScryfallCard[] }>(null);
  const [flipped, setFlipped] = useState<Record<string, boolean>>({}); // instanceId -> flipped
  const [pendingDeckDrop, setPendingDeckDrop] = useState<{ card: ScryfallCard; option: string | null } | null>(null);

  // Approval modal state
  const [pendingApproval, setPendingApproval] = useState<{ from: string; action: string; n?: number } | null>(null);
  // Track if waiting for approval response
  const [waitingApproval, setWaitingApproval] = useState<{ action: string; n?: number } | null>(null);

  // Scry modal state
  const [scryModal, setScryModal] = useState<{ n: number; cards: ScryfallCard[] } | null>(null);

  // Surveil modal state
  const [surveilModal, setSurveilModal] = useState<{ n: number; cards: ScryfallCard[] } | null>(null);

  // Search modal state
  const [searchModal, setSearchModal] = useState<boolean>(false);

  // Floating preview state
  const [floatingPreview, setFloatingPreview] = useState<null | { card?: ScryfallCard; token?: TokenData; flipped?: boolean; position: { x: number; y: number } }>(null);

  // Modal-Kartenliste nach Game-State-Update aktualisieren
  useEffect(() => {
    if (!modalZone) return;
    let cards: ScryfallCard[] = [];
    if (modalZone.label.toLowerCase().includes('grave')) cards = myState.graveyard;
    else if (modalZone.label.toLowerCase().includes('exile')) cards = myState.exile;
    else if (modalZone.label.toLowerCase().includes('hand')) cards = myState.hand;
    else if (modalZone.label.toLowerCase().includes('deck')) cards = myState.library;
    setModalZone({ ...modalZone, cards });
  }, [gameState]);

  // Listen for deck action requests and responses
  useEffect(() => {
    socket.off('deck_action_request');
    socket.off('deck_action_response');
    socket.on('deck_action_request', ({ from, action, n }) => {
      setPendingApproval({ from, action, n });
    });
    socket.on('deck_action_response', ({ from, to, action, n, approved }) => {
      setWaitingApproval(null);
      if (user !== from) return; // Only show modal for the player who requested the action
      if (approved) {
        if (action === 'scry') {
          const myDeck = gameState.players[user].library;
          setScryModal({ n, cards: myDeck.slice(0, n) });
        } else if (action === 'surveil') {
          const myDeck = gameState.players[user].library;
          setSurveilModal({ n, cards: myDeck.slice(0, n) });
        } else if (action === 'shuffle') {
          socket.emit('shuffle_deck', { email: user });
        } else if (action === 'search') {
          setSearchModal(true);
        } else {
          alert(`Opponent approved: ${action}${n ? ' ' + n : ''}`);
        }
      } else {
        alert('Opponent denied your request.');
      }
    });
    return () => {
      socket.off('deck_action_request');
      socket.off('deck_action_response');
    };
  }, []);

  // Search modal drag/drop logic
  const handleSearchMoveCard = (card: ScryfallCard, target: string) => {
    // Move card to target zone (emit to server)
    socket.emit('move_card_zone', { email: user, card, target });
    // Optionally, update local state or close modal if needed
  };
  const handleSearchShuffle = () => {
    socket.emit('shuffle_deck', { email: user });
    setSearchModal(false);
  };
  const handleSearchClose = () => setSearchModal(false);

  // Search modal component (UI matches grave/exile modal, local-only until shuffle)
  const SearchModal = ({ deck }: { deck: ScryfallCard[] }) => {
    // Local state for all zones during search
    const [modalDeck, setModalDeck] = useState(deck);
    const [modalHand, setModalHand] = useState<ScryfallCard[]>([]);
    const [modalGraveyard, setModalGraveyard] = useState<ScryfallCard[]>([]);
    const [modalExile, setModalExile] = useState<ScryfallCard[]>([]);
    const [modalBattlefield, setModalBattlefield] = useState<ScryfallCard[]>([]);
    const [draggedCard, setDraggedCard] = useState<ScryfallCard | null>(null);
    const [flipped, setFlipped] = useState<Record<string, boolean>>({});

    // On open, initialize local state from backend deck
    useEffect(() => {
      setModalDeck(deck);
      setModalHand([]);
      setModalGraveyard([]);
      setModalExile([]);
      setModalBattlefield([]);
      setFlipped({});
    }, [deck]);

    // Move card between zones locally
    const moveCard = (card: ScryfallCard, from: string, to: string) => {
      if (from === to) return;
      if (from === 'deck') setModalDeck(prev => prev.filter(c => c.instanceId !== card.instanceId));
      if (from === 'hand') setModalHand(prev => prev.filter(c => c.instanceId !== card.instanceId));
      if (from === 'graveyard') setModalGraveyard(prev => prev.filter(c => c.instanceId !== card.instanceId));
      if (from === 'exile') setModalExile(prev => prev.filter(c => c.instanceId !== card.instanceId));
      if (from === 'battlefield') setModalBattlefield(prev => prev.filter(c => c.instanceId !== card.instanceId));
      if (to === 'deck') setModalDeck(prev => [...prev, card]);
      if (to === 'hand') setModalHand(prev => [...prev, card]);
      if (to === 'graveyard') setModalGraveyard(prev => [...prev, card]);
      if (to === 'exile') setModalExile(prev => [...prev, card]);
      if (to === 'battlefield') setModalBattlefield(prev => [...prev, card]);
    };

    // Drag and drop handlers for each zone
    const handleDrop = (to: string) => (e: React.DragEvent) => {
      e.preventDefault();
      if (!draggedCard) return;
      // Find which zone the card is currently in
      let from = 'deck';
      if (modalHand.find(c => c.instanceId === draggedCard.instanceId)) from = 'hand';
      else if (modalGraveyard.find(c => c.instanceId === draggedCard.instanceId)) from = 'graveyard';
      else if (modalExile.find(c => c.instanceId === draggedCard.instanceId)) from = 'exile';
      else if (modalBattlefield.find(c => c.instanceId === draggedCard.instanceId)) from = 'battlefield';
      moveCard(draggedCard, from, to);
      setDraggedCard(null);
    };

    // Shuffle handler: send all changes to backend and close modal
    const handleShuffle = () => {
      if (modalHand.length > 0) {
        modalHand.forEach(card => socket.emit('move_card_zone', { email: user, card, target: 'hand' }));
      }
      if (modalGraveyard.length > 0) {
        modalGraveyard.forEach(card => socket.emit('move_card_zone', { email: user, card, target: 'graveyard' }));
      }
      if (modalExile.length > 0) {
        modalExile.forEach(card => socket.emit('move_card_zone', { email: user, card, target: 'exile' }));
      }
      if (modalBattlefield.length > 0) {
        modalBattlefield.forEach(card => socket.emit('play_card_to_battlefield', { email: user, card, x: 100, y: 50 }));
      }
      socket.emit('scry_result', { email: user, newDeck: modalDeck });
      setSearchModal(false);
    };

    // Prevent closing by clicking outside
    const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

    // Render deck as horizontal scrollable row
    const renderDeck = () => (
      <div className="flex flex-row gap-2 overflow-x-auto mb-4 max-w-[800px] p-2 border rounded bg-gray-50 justify-center" onDragOver={e => e.preventDefault()} onDrop={handleDrop('deck')}>
        {modalDeck.map(card => {
          let img = card.image_uris?.normal;
          if (card.card_faces && card.card_faces.length > 1) {
            img = flipped[card.instanceId]
              ? card.card_faces[1].image_uris?.normal
              : card.card_faces[0].image_uris?.normal;
          }
          return (
            <img
              key={card.instanceId}
              src={img}
              alt={card.name}
              className="w-16 h-24 object-contain rounded shadow cursor-move transition-all duration-200 hover:w-32 hover:h-48 z-10"
              draggable
              onDoubleClick={e => {
                if (card.card_faces && card.card_faces.length > 1) {
                  e.preventDefault();
                  setFlipped(f => ({ ...f, [card.instanceId]: !f[card.instanceId] }));
                }
              }}
              onDragStart={() => setDraggedCard(card)}
              onDragEnd={() => setDraggedCard(null)}
              title={card.card_faces && card.card_faces.length > 1 ? 'Doppelklick: Karte umdrehen' : card.name}
            />
          );
        })}
      </div>
    );

    // Render drop zone as a stack (like grave/exile modal)
    const renderStackedZone = (zone: ScryfallCard[], zoneName: string) => (
      <div
        className="flex flex-col items-center justify-center border border-gray-400 rounded text-xl font-semibold select-none mx-2 relative min-h-[100px] min-w-[80px] bg-gray-100"
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop(zoneName)}
        style={{ userSelect: 'none' }}
      >
        <div className="mb-1 text-base font-bold">{zoneName.charAt(0).toUpperCase() + zoneName.slice(1)}</div>
        <div className="relative w-[60px] h-[84px]">
          {zone.map((card, i) => {
            let img = card.image_uris?.normal;
            if (card.card_faces && card.card_faces.length > 1) {
              img = flipped[card.instanceId]
                ? card.card_faces[1].image_uris?.normal
                : card.card_faces[0].image_uris?.normal;
            }
            return (
              <img
                key={card.instanceId}
                src={img}
                alt={card.name}
                className="w-[60px] h-[84px] object-contain rounded shadow absolute"
                style={{ left: i * 4, top: i * 4, zIndex: i }}
                draggable={false}
              />
            );
          })}
        </div>
        <div className="mt-1 text-xs">{zone.length}</div>
      </div>
    );

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" onClick={stopPropagation}>
        <div className="bg-white rounded-lg p-6 shadow-lg relative min-w-[700px] min-h-[400px] flex flex-col items-center" onClick={stopPropagation}>
          <div className="text-lg font-semibold mb-4 text-center">Search Deck</div>
          {renderDeck()}
          <div className="flex flex-row gap-4 items-end justify-center w-full mt-6">
            {renderStackedZone(modalHand, 'hand')}
            {renderStackedZone(modalGraveyard, 'graveyard')}
            {renderStackedZone(modalExile, 'exile')}
            {renderStackedZone(modalBattlefield, 'battlefield')}
          </div>
          <button className="mt-8 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" onClick={handleShuffle}>Shuffle & Close</button>
        </div>
      </div>
    );
  };

  // Scry modal confirm handler (for now, just update local deck state)
  const handleScryConfirm = (top: ScryfallCard[], bottom: ScryfallCard[]) => {
    // Update deck: top cards first, then rest, then bottom
    const myDeck = gameState.players[user].library;
    const rest = myDeck.slice((scryModal?.n || 0));
    const newDeck = [...top, ...rest, ...bottom];
    socket.emit('scry_result', { email: user, newDeck });
    setScryModal(null);
  };
  const handleScryCancel = () => setScryModal(null);

  // Surveil modal confirm handler (for now, just update local deck/graveyard state)
  const handleSurveilConfirm = (top: ScryfallCard[], grave: ScryfallCard[]) => {
    // Update deck: top cards first, then rest
    const myDeck = gameState.players[user].library;
    const rest = myDeck.slice((surveilModal?.n || 0));
    const newDeck = [...top, ...rest];
    const myGrave = gameState.players[user].graveyard;
    const newGrave = [...myGrave, ...grave];
    socket.emit('surveil_result', { email: user, newDeck, newGraveyard: newGrave });
    setSurveilModal(null);
  };
  const handleSurveilCancel = () => setSurveilModal(null);

  // Handler für Lebenspunkte
  const handleLifeChange = (life: number) => {
    socket.emit('update_life', { email: user, life });
  };

  // Handler: Karte aufs Spielfeld legen
  const handleDropBattlefield = (card: ScryfallCard, x: number, y: number) => {
    socket.emit('play_card_to_battlefield', { email: user, card, x, y });
  };

  // Handler: Karte vom Battlefield ins Deck bewegen (mit Menü)
  const handleDropBattlefieldToDeck = (card: ScryfallCard) => {
    setPendingDeckDrop({ card, option: null });
  };

  // Callback for when deck option is selected
  const handleDeckDropOption = (option: string) => {
    if (pendingDeckDrop && option) {
      socket.emit('move_card_zone', { email: user, card: pendingDeckDrop.card, target: 'deck', deckOption: option });
      setPendingDeckDrop(null);
    }
  };

  // Handler: Karte auf dem Battlefield verschieben
  const handleMoveBattlefieldCard = (instanceId: string, x: number, y: number) => {
    socket.emit('move_battlefield_card', { instanceId, x, y });
  };

  // Handler: Tap/Untap
  const handleTapToggle = (instanceId: string) => {
    socket.emit('tap_card', { instanceId });
  };

  // Handler: Flip
  const handleFlip = (instanceId: string) => {
    socket.emit('flip_card', { instanceId });
  };

  // Handler für Double-Click (Karte umdrehen)
  const handleCardDoubleClick = (card: ScryfallCard) => (e: React.MouseEvent) => {
    if (card.card_faces && card.card_faces.length > 1) {
      e.preventDefault();
      setFlipped(f => ({ ...f, [card.instanceId]: !f[card.instanceId] }));
    }
  };

  // Handler for floating preview
  const handleCardMouseEnter = (card: ScryfallCard, flipped: boolean) => (e: React.MouseEvent) => {
    setFloatingPreview({ card, flipped, position: { x: e.clientX, y: e.clientY } });
  };
  const handleCardMouseMove = (card: ScryfallCard, flipped: boolean) => (e: React.MouseEvent) => {
    setFloatingPreview(prev => prev ? { ...prev, position: { x: e.clientX, y: e.clientY } } : null);
  };
  const handleCardMouseLeave = () => setFloatingPreview(null);

  // Handler: Karte in Graveyard/Exile/Hand bewegen (Drop-Zonen)
  const handleDropZone = (zone: 'graveyard' | 'exile') => (e: React.DragEvent) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('card');
    if (!data) return;
    const card: ScryfallCard = JSON.parse(data);
    socket.emit('move_card_zone', { email: user, card, target: zone });
  };
  const handleDropToHand = (card: ScryfallCard) => {
    socket.emit('move_card_zone', { email: user, card, target: 'hand' });
  };

  // Handler: Karte ziehen (nur für eigenen Spieler)
  const handleDraw = () => {
    socket.emit('draw_card', { email: user });
  };

  // Handler für Modal-Drag & Drop (Karte aus Modal in Zone ziehen)
  const handleModalDrop = (card: ScryfallCard, target: string, deckOption?: string) => {
    if (!myState.hand.find((c: ScryfallCard) => c.instanceId === card.instanceId) &&
        !myState.graveyard.find((c: ScryfallCard) => c.instanceId === card.instanceId) &&
        !myState.exile.find((c: ScryfallCard) => c.instanceId === card.instanceId)) return;
    if (target === 'battlefield') {
      socket.emit('play_card_to_battlefield', { email: user, card, x: 100, y: 50 });
      setModalZone(null); // Modal nur bei Battlefield-Drop schließen
    } else if (target === 'deck') {
      socket.emit('move_card_zone', { email: user, card, target, deckOption });
    } else {
      socket.emit('move_card_zone', { email: user, card, target });
    }
  };

  // Handler für eigene Aktionen (z.B. Karte spielen, ziehen, etc.)
  // ... (hier können später Socket-Events eingebaut werden) ...



  // Counter-Drag-Status für Battlefield (lokal, nur ID)
  const [draggedCounterId, setDraggedCounterId] = useState<string | null>(null);
  // Handler: Counter aus CounterZone auf Battlefield droppen
  const handleDropCounter = (counter: { id: string; value: number }, x: number, y: number) => {
    socket.emit('add_counter', { ...counter, x, y });
  };
  // Handler: Counter auf Battlefield verschieben
  const handleMoveCounter = (id: string, x: number, y: number) => {
    socket.emit('move_counter', { id, x, y });
  };

  // TokenZone-Komponente als "Karte" mit Drag & Drop
  const TokenZone: React.FC<{ onDragToken: (token: { id: string; name: string; type: string; power: string; toughness: string }) => void }> = ({ onDragToken }) => {
    const [name, setName] = useState('');
    const [type, setType] = useState('');
    const [power, setPower] = useState('1');
    const [toughness, setToughness] = useState('1');
    const tokenIdRef = useRef(0);

    // Token-Objekt für Drag
    const getToken = () => ({
      id: `token-${tokenIdRef.current++}-${Date.now()}`,
      name: name.trim(),
      type: type.trim(),
      power: power.trim(),
      toughness: toughness.trim(),
    });

    // Drag-Handler
    const handleDragStart = (e: React.DragEvent) => {
      const token = getToken();
      e.dataTransfer.setData('token', JSON.stringify(token));
      onDragToken(token);
    };

    // Drop-Handler: Token löschen
    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      const battlefieldTokenId = e.dataTransfer.getData('battlefieldTokenId');
      if (battlefieldTokenId) {
        socket.emit('remove_token', { id: battlefieldTokenId });
      }
    };

    return (
      <div className="flex flex-col items-center justify-center w-[140px] h-[120px] border-2 border-black rounded bg-white ml-0 relative"
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
      >
        {/* Token-Karte */}
        <div
          className="absolute left-1/2 top-1/2 w-[80px] h-[110px] -translate-x-1/2 -translate-y-1/2 bg-white border border-black rounded shadow flex flex-col items-center justify-between p-1 cursor-move"
          draggable
          onDragStart={handleDragStart}
          style={{ userSelect: 'none' }}
        >
          <input
            className="w-full text-xs font-bold text-center border-b border-gray-300 mb-0.5 bg-white"
            placeholder="Name"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ outline: 'none' }}
          />
          <input
            className="w-full text-[10px] text-center border-b border-gray-200 mb-0.5 bg-white"
            placeholder="Type"
            value={type}
            onChange={e => setType(e.target.value)}
            style={{ outline: 'none' }}
          />
          <div className="flex flex-row items-center justify-center mt-1">
            <input
              className="w-6 text-xs text-center border border-gray-300 rounded bg-white"
              placeholder="P"
              value={power}
              onChange={e => setPower(e.target.value)}
              style={{ outline: 'none' }}
            />
            <span className="mx-1 text-xs font-bold">/</span>
            <input
              className="w-6 text-xs text-center border border-gray-300 rounded bg-white"
              placeholder="T"
              value={toughness}
              onChange={e => setToughness(e.target.value)}
              style={{ outline: 'none' }}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen w-full border-2 border-black rounded px-4 pt-4 pb-4 bg-gray-700">
      {/* Obere Spielerreihe: Gegner */}
      <div className="flex flex-col items-center w-full">
        <div className="flex flex-row items-end mx-auto max-w-fit mx-8">
          {/* CounterZone ganz links (Gegner, leer) */}
          <div className="flex flex-col items-center justify-center w-[140px] h-[120px] mr-0">
            <CounterZone />
          </div>
          {/* LifeBox links */}
          <div className="flex flex-col items-center justify-center w-[140px] h-[120px] border-2 border-black rounded bg-white mr-0">
            <LifeBox life={oppState.life} onChange={() => {}} />
          </div>
          {/* Deck */}
          <div className="flex flex-col items-center justify-center w-[140px] h-[120px] border-2 border-black rounded bg-white">
            <DeckZone deck={oppState.library} onShuffle={() => {}} onSearch={() => {}} onDraw={() => {}} />
          </div>
          {/* Hand (verdeckt) */}
          <div className="flex flex-col items-center justify-center flex-1">
            <HandZone 
              hand={oppState.hand.map((c: any) => ({ ...c, image_uris: { normal: magicBack } }))} 
              isDragging={false} 
              setIsDragging={() => {}} 
              draggable={false}
              flipped={{}}
              onMouseEnterCard={handleCardMouseEnter}
              onMouseMoveCard={handleCardMouseMove}
              onMouseLeaveCard={handleCardMouseLeave}
            />
          </div>
          {/* Grave und Exile */}
          <div className="flex flex-row items-center ml-0">
            <div className="flex flex-col items-center justify-center w-[140px] h-[120px] border-2 border-black rounded bg-white" onContextMenu={(e) => { e.preventDefault(); setModalZone({ label: 'Gegner Graveyard', cards: oppState.graveyard }); }}>
              <StackedZone label="GRAVE" cards={oppState.graveyard} onShow={() => setModalZone({ label: 'Gegner Graveyard', cards: oppState.graveyard })} flipped={{}} />
            </div>
            <div className="flex flex-col items-center justify-center w-[140px] h-[120px] border-2 border-black rounded bg-white" onContextMenu={(e) => { e.preventDefault(); setModalZone({ label: 'Gegner Exile', cards: oppState.exile }); }}>
              <StackedZone label="EXILE" cards={oppState.exile} onShow={() => setModalZone({ label: 'Gegner Exile', cards: oppState.exile })} flipped={{}} />
            </div>
          </div>
        </div>
      </div>
      {/* Battlefield (gemeinsam) */}
      <div className="relative w-full h-full bg-white">
        <Battlefield
          cards={battlefield}
          onDropCard={handleDropBattlefield}
          onTapToggle={handleTapToggle}
          onFlip={handleFlip}
          onMoveCard={handleMoveBattlefieldCard}
          userIsTopPlayer={isTopPlayer}
          userEmail={user}
          onMouseEnterCard={handleCardMouseEnter}
          onMouseMoveCard={handleCardMouseMove}
          onMouseLeaveCard={handleCardMouseLeave}
          counters={gameState.counters || []}
          tokens={gameState.tokens || []}
          onDropCounter={handleDropCounter}
          onMoveCounter={handleMoveCounter}
          draggedCounterId={draggedCounterId}
          setDraggedCounterId={setDraggedCounterId}
          setFloatingPreview={setFloatingPreview}
        />
      </div>
      {/* Untere Spielerreihe: Du */}
      <div className="flex flex-col items-center w-full">
        <div className="flex flex-row items-start mx-auto max-w-fit mx-8">
          {/* CounterZone ganz links */}
          <div className="flex flex-col items-center justify-center w-[140px] h-[120px] mr-0">
            <CounterZone onDragCounter={() => {}} />
          </div>
          {/* LifeBox links */}
          <div className="flex flex-col items-center justify-center w-[140px] h-[120px] border-2 border-black rounded bg-white mr-0">
            <LifeBox life={myState.life} onChange={handleLifeChange} />
          </div>
          {/* Deck */}
          <div 
            className="flex flex-col items-center justify-center w-[140px] h-[120px] border-2 border-black rounded bg-white"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const data = e.dataTransfer.getData('card');
              if (!data) return;
              const card: ScryfallCard = JSON.parse(data);
              handleDropBattlefieldToDeck(card);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              // Trigger deck action menu
            }}
            style={{ userSelect: 'none' }}
          >
            <DeckZone deck={myState.library} onShuffle={() => {}} onSearch={() => {}} onDraw={handleDraw} onDropCardToDeck={handleDropBattlefieldToDeck} onDeckDropOption={handleDeckDropOption} showActionMenu={true} onDeckAction={(action) => {
              setWaitingApproval({ action: action.type, n: action.n });
              socket.emit('deck_action_request', { email: user, action: action.type, n: action.n });
            }} />
          </div>
          {/* Hand */}
          <div className="flex flex-col items-center justify-center flex-1">
            <HandZone 
              hand={myState.hand} 
              isDragging={isDragging} 
              setIsDragging={setIsDragging} 
              onDropCardToHand={handleDropToHand} 
              draggable
              flipped={flipped}
              onCardDoubleClick={handleCardDoubleClick}
              onMouseEnterCard={handleCardMouseEnter}
              onMouseMoveCard={handleCardMouseMove}
              onMouseLeaveCard={handleCardMouseLeave}
            />
          </div>
          {/* Grave und Exile */}
          <div className="flex flex-row items-center ml-0">
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleDropZone('graveyard')}
              className="flex flex-col items-center justify-center w-[140px] h-[120px] border-2 border-black rounded bg-white"
              onContextMenu={(e) => { e.preventDefault(); setModalZone({ label: 'Dein Graveyard', cards: myState.graveyard }); }}
            >
              <StackedZone label="GRAVE" cards={myState.graveyard} onShow={() => setModalZone({ label: 'Dein Graveyard', cards: myState.graveyard })} flipped={flipped} />
            </div>
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleDropZone('exile')}
              className="flex flex-col items-center justify-center w-[140px] h-[120px] border-2 border-black rounded bg-white"
              onContextMenu={(e) => { e.preventDefault(); setModalZone({ label: 'Dein Exile', cards: myState.exile }); }}
            >
              <StackedZone label="EXILE" cards={myState.exile} onShow={() => setModalZone({ label: 'Dein Exile', cards: myState.exile })} flipped={flipped} />
            </div>
            {/* TokenZone ganz rechts */}
            <TokenZone onDragToken={() => {}} />
          </div>
        </div>
      </div>
      {/* Modal für Grave/Exile */}
      {modalZone && (
        <ZoneModal
          cards={modalZone.cards}
          label={modalZone.label}
          onClose={() => setModalZone(null)}
          onMoveCard={handleModalDrop}
        />
      )}
      {/* Approval modal for opponent */}
      {pendingApproval && (
        <ApprovalModal
          action={pendingApproval.action}
          n={pendingApproval.n}
          onApprove={() => {
            socket.emit('deck_action_response', { from: pendingApproval.from, to: user, action: pendingApproval.action, n: pendingApproval.n, approved: true });
            setPendingApproval(null);
          }}
          onDeny={() => {
            socket.emit('deck_action_response', { from: pendingApproval.from, to: user, action: pendingApproval.action, n: pendingApproval.n, approved: false });
            setPendingApproval(null);
          }}
        />
      )}
      {/* Scry modal */}
      {scryModal && (
        <ScryModal
          cards={scryModal.cards}
          onConfirm={handleScryConfirm}
          onCancel={handleScryCancel}
        />
      )}
      {/* Surveil modal */}
      {surveilModal && (
        <SurveilModal
          cards={surveilModal.cards}
          onConfirm={handleSurveilConfirm}
          onCancel={handleSurveilCancel}
        />
      )}
      {/* Search modal */}
      {searchModal && (
        <SearchModal deck={gameState.players[user].library} />
      )}
      {/* Floating preview */}
      {floatingPreview && floatingPreview.card && <FloatingCardPreview card={floatingPreview.card} flipped={floatingPreview.flipped} position={floatingPreview.position} />}
      {floatingPreview && floatingPreview.token && <FloatingTokenPreview token={floatingPreview.token} position={floatingPreview.position} />}
    </div>
  );
};

export default Game; 