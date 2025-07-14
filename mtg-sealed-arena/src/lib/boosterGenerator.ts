// Booster Generator für MTG Sealed (Scryfall API)
// Liefert ein Array von 6 Boostern für ein gegebenes Set

import { v4 as uuidv4 } from 'uuid';

export type ScryfallCard = {
  id: string;
  name: string;
  colors?: string[];
  image_uris?: { normal: string };
  rarity: string;
  [key: string]: any;
};

export type Booster = ScryfallCard[];

const SCRYFALL_API = 'https://api.scryfall.com/cards/search?q=';

// Cache für Karten pro Set
const cardCache: Record<string, {
  common: ScryfallCard[];
  uncommon: ScryfallCard[];
  rare: ScryfallCard[];
  mythic: ScryfallCard[];
  land: ScryfallCard[];
  commonsByColor: Record<string, ScryfallCard[]>;
}> = {};

// Hilfsfunktion: Alle Karten einer Seltenheit laden
async function fetchAllCards(set: string, rarity: string): Promise<ScryfallCard[]> {
  let cards: ScryfallCard[] = [];
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const url = `${SCRYFALL_API}set:${set}+rarity:${rarity}&unique=prints&include_extras=false&include_variations=false&page=${page}`;
    const res = await fetch(url);
    const data = await res.json();
    cards = cards.concat(data.data);
    hasMore = data.has_more;
    page++;
  }
  return cards;
}

// Hilfsfunktion: Alle Basic Lands laden
async function fetchAllBasicLands(set: string): Promise<ScryfallCard[]> {
  let cards: ScryfallCard[] = [];
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const url = `https://api.scryfall.com/cards/search?q=set:${set}+type:basic&unique=prints&page=${page}`;
    const res = await fetch(url);
    const data = await res.json();
    cards = cards.concat(data.data);
    hasMore = data.has_more;
    page++;
  }
  return cards;
}

// Initialisiere Cache für ein Set
async function ensureCache(set: string) {
  if (cardCache[set]) return;
  const [commons, uncommons, rares, mythics, lands] = await Promise.all([
    fetchAllCards(set, 'common'),
    fetchAllCards(set, 'uncommon'),
    fetchAllCards(set, 'rare'),
    fetchAllCards(set, 'mythic'),
    fetchAllBasicLands(set),
  ]);
  // Commons nach Farbe sortieren
  const commonsByColor: Record<string, ScryfallCard[]> = {
    W: [], U: [], B: [], R: [], G: []
  };
  for (const card of commons) {
    if (!card.colors) continue;
    for (const color of card.colors) {
      if (commonsByColor[color]) commonsByColor[color].push(card);
    }
  }
  cardCache[set] = {
    common: commons,
    uncommon: uncommons,
    rare: rares,
    mythic: mythics,
    land: lands,
    commonsByColor
  };
}

// Helper: group cards by oracle_id (or name+set as fallback)
function groupByUniqueCard(cards: ScryfallCard[]): Record<string, ScryfallCard[]> {
  const groups: Record<string, ScryfallCard[]> = {};
  for (const card of cards) {
    const key = card.oracle_id || (card.name + '|' + (card.set || ''));
    if (!groups[key]) groups[key] = [];
    groups[key].push(card);
  }
  return groups;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Booster-Logik
export async function generateBoosters(set: string, boosterCount = 6): Promise<Booster[]> {
  await ensureCache(set);
  const boosters: Booster[] = [];
  const { common, uncommon, rare, mythic, land, commonsByColor } = cardCache[set];

  // Filter out back faces of double-faced cards (side === 'b') and non-playable layouts
  const nonPlayableLayouts = ['meld', 'token', 'emblem', 'art_series', 'double_faced_token'];
  const filterFrontFaces = (cards: ScryfallCard[]) =>
    cards.filter(card =>
      (!card.side || card.side !== 'b') &&
      (!card.layout || !nonPlayableLayouts.includes(card.layout))
    );

  // Group by unique card for each rarity, only using front faces
  const groupedCommons = groupByUniqueCard(filterFrontFaces(common));
  const groupedUncommons = groupByUniqueCard(filterFrontFaces(uncommon));
  const groupedRares = groupByUniqueCard(filterFrontFaces(rare));
  const groupedMythics = groupByUniqueCard(filterFrontFaces(mythic));
  const groupedCommonsByColor: Record<string, Record<string, ScryfallCard[]>> = {};
  for (const color of Object.keys(commonsByColor)) {
    groupedCommonsByColor[color] = groupByUniqueCard(filterFrontFaces(commonsByColor[color]));
  }

  for (let i = 0; i < boosterCount; i++) {
    // 1. Color Collation: 5 Commons, je eine pro Farbe (unique by oracle_id)
    const usedCommonKeys = new Set<string>();
    const colorOrder = ['W', 'U', 'B', 'R', 'G'];
    const colorCommons: ScryfallCard[] = colorOrder.map(color => {
      const group = groupedCommonsByColor[color];
      const keys = Object.keys(group).filter(k => !usedCommonKeys.has(k));
      const key = pickRandom(keys);
      usedCommonKeys.add(key);
      return { ...pickRandom(group[key]), instanceId: uuidv4() };
    });
    // 2. Restliche 5 Commons zufällig (unique by oracle_id)
    const allCommonKeys = Object.keys(groupedCommons).filter(k => !usedCommonKeys.has(k));
    const restCommonKeys = [];
    while (restCommonKeys.length < 5 && allCommonKeys.length > 0) {
      const idx = Math.floor(Math.random() * allCommonKeys.length);
      restCommonKeys.push(allCommonKeys[idx]);
      usedCommonKeys.add(allCommonKeys[idx]);
      allCommonKeys.splice(idx, 1);
    }
    const restCommons = restCommonKeys.map(key => ({ ...pickRandom(groupedCommons[key]), instanceId: uuidv4() }));
    // 3. 3 Uncommons (unique by oracle_id)
    const uncommonKeys = Object.keys(groupedUncommons);
    const usedUncommonKeys = new Set<string>();
    const uncommons: ScryfallCard[] = [];
    while (uncommons.length < 3 && uncommonKeys.length > 0) {
      const idx = Math.floor(Math.random() * uncommonKeys.length);
      const key = uncommonKeys[idx];
      if (!usedUncommonKeys.has(key)) {
        uncommons.push({ ...pickRandom(groupedUncommons[key]), instanceId: uuidv4() });
        usedUncommonKeys.add(key);
      }
      uncommonKeys.splice(idx, 1);
    }
    // 4. 1 Rare oder mit 1/8 Chance eine Mythic (unique by oracle_id)
    let rareOrMythic: ScryfallCard;
    if (Object.keys(groupedMythics).length > 0 && Math.random() < 1/8) {
      const mythicKeys = Object.keys(groupedMythics);
      const key = pickRandom(mythicKeys);
      rareOrMythic = { ...pickRandom(groupedMythics[key]), instanceId: uuidv4() };
    } else {
      const rareKeys = Object.keys(groupedRares);
      const key = pickRandom(rareKeys);
      rareOrMythic = { ...pickRandom(groupedRares[key]), instanceId: uuidv4() };
    }
    // Booster zusammenbauen
    const booster: Booster = [
      ...colorCommons,
      ...restCommons,
      ...uncommons,
      rareOrMythic
    ];
    boosters.push(booster);
  }
  return boosters;
}

// Hole eine bestimmte Anzahl eines Basic Lands für ein Set (aus Cache)
export async function fetchBasicLand(set: string, landType: 'Plains' | 'Island' | 'Swamp' | 'Mountain' | 'Forest', count: number): Promise<ScryfallCard[]> {
  await ensureCache(set);
  const lands = cardCache[set]?.land.filter(card => card.name.toLowerCase().includes(landType.toLowerCase()));
  if (!lands || lands.length === 0) return [];
  // Nimm die ersten Karten, falls mehrere Prints vorhanden sind
  return Array(count).fill(0).map((_, i) => {
    const card = lands[i % lands.length];
    return { ...card, instanceId: uuidv4() };
  });
}
