// Booster Generator für MTG Sealed (Scryfall API)
// Liefert ein Array von 6 Boostern für ein gegebenes Set

const { v4: uuidv4 } = require('uuid');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Cache für Karten pro Set
const cardCache = {};

// Hilfsfunktion: Alle Karten einer Seltenheit laden
async function fetchAllCards(set, rarity) {
  let cards = [];
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const url = `https://api.scryfall.com/cards/search?q=set:${set}+rarity:${rarity}&unique=prints&include_extras=false&include_variations=false&page=${page}`;
    const res = await fetch(url);
    const data = await res.json();
    cards = cards.concat(data.data);
    hasMore = data.has_more;
    page++;
  }
  return cards;
}

// Hilfsfunktion: Alle Basic Lands laden
async function fetchAllBasicLands(set) {
  let cards = [];
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
async function ensureCache(set) {
  if (cardCache[set]) return;
  const [commons, uncommons, rares, mythics, lands] = await Promise.all([
    fetchAllCards(set, 'common'),
    fetchAllCards(set, 'uncommon'),
    fetchAllCards(set, 'rare'),
    fetchAllCards(set, 'mythic'),
    fetchAllBasicLands(set),
  ]);
  // Commons nach Farbe sortieren
  const commonsByColor = {
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

// Hilfsfunktion: Zufällige Auswahl ohne Duplikate
function getRandomUnique(arr, count, exclude = new Set()) {
  const filtered = arr.filter(card => !exclude.has(card.id));
  const result = [];
  const used = new Set(exclude);
  while (result.length < count && filtered.length > 0) {
    const idx = Math.floor(Math.random() * filtered.length);
    const card = filtered[idx];
    if (!used.has(card.id)) {
      result.push(card);
      used.add(card.id);
    }
    filtered.splice(idx, 1);
  }
  return result;
}

// Booster-Logik
async function generateBoosters(set, boosterCount = 6) {
  await ensureCache(set);
  const boosters = [];
  const { common, uncommon, rare, mythic, land, commonsByColor } = cardCache[set];
  for (let i = 0; i < boosterCount; i++) {
    // 1. Color Collation: 5 Commons, je eine pro Farbe
    const usedCommonIds = new Set();
    const colorOrder = ['W', 'U', 'B', 'R', 'G'];
    const colorCommons = colorOrder.map(color => {
      const pool = commonsByColor[color];
      const idx = Math.floor(Math.random() * pool.length);
      usedCommonIds.add(pool[idx].id);
      return { ...pool[idx], instanceId: uuidv4() };
    });
    // 2. Restliche 5 Commons zufällig (ohne Duplikate im Booster)
    const restCommons = getRandomUnique(common, 5, usedCommonIds).map(card => ({ ...card, instanceId: uuidv4() }));
    restCommons.forEach(card => usedCommonIds.add(card.id));
    // 3. 3 Uncommons (ohne Duplikate im Booster)
    const usedUncommonIds = new Set();
    const uncommons = getRandomUnique(uncommon, 3, usedUncommonIds).map(card => ({ ...card, instanceId: uuidv4() }));
    uncommons.forEach(card => usedUncommonIds.add(card.id));
    // 4. 1 Rare oder mit 1/8 Chance eine Mythic (ohne Duplikate im Booster)
    let rareOrMythic;
    if (mythic.length > 0 && Math.random() < 1/8) {
      rareOrMythic = getRandomUnique(mythic, 1)[0];
    } else {
      rareOrMythic = getRandomUnique(rare, 1)[0];
    }
    rareOrMythic = { ...rareOrMythic, instanceId: uuidv4() };
    // 5. Optional: 1 Land (z.B. 1/1 Chance, falls Lands vorhanden)
    let landCard = null;
    if (land.length > 0) {
      // In modernen Sets ist fast immer 1 Land pro Booster
      landCard = { ...getRandomUnique(land, 1)[0], instanceId: uuidv4() };
    }
    // Booster zusammenbauen
    const booster = [
      ...colorCommons,
      ...restCommons,
      ...uncommons,
      rareOrMythic
    ];
    if (landCard) booster.push(landCard);
    boosters.push(booster);
  }
  return boosters;
}

// Hole eine bestimmte Anzahl eines Basic Lands für ein Set (aus Cache)
async function fetchBasicLand(set, landType, count) {
  await ensureCache(set);
  const lands = cardCache[set]?.land.filter(card => card.name.toLowerCase().includes(landType.toLowerCase()));
  if (!lands || lands.length === 0) return [];
  // Nimm die ersten Karten, falls mehrere Prints vorhanden sind
  return Array(count).fill(0).map((_, i) => {
    const card = lands[i % lands.length];
    return { ...card, instanceId: uuidv4() };
  });
}

module.exports = {
  generateBoosters,
  fetchBasicLand
};
