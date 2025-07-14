import React, { useState, useEffect } from 'react';
import { generateBoosters } from '../lib/boosterGenerator';
import type { Booster } from '../lib/boosterGenerator';

// Fallback-Liste
const STATIC_SETS = [
  { code: 'OTJ', name: 'Outlaws of Thunder Junction' },
  { code: 'MH3', name: 'Modern Horizons 3' },
  { code: 'WOE', name: 'Wilds of Eldraine' },
  { code: 'MOM', name: 'March of the Machine' },
  { code: 'ONE', name: 'Phyrexia: All Will Be One' },
];

type SetSelectorProps = {
  // Entferne onBoostersGenerated, da die Booster nicht mehr hier generiert werden
  onSetSelected?: (setCode: string) => void;
};

export const SetSelector: React.FC<SetSelectorProps> = ({ onSetSelected }) => {
  const [sets, setSets] = useState(STATIC_SETS);
  const [selectedSet, setSelectedSet] = useState(STATIC_SETS[0].code);
  const [setsLoading, setSetsLoading] = useState(true);

  useEffect(() => {
    async function fetchSets() {
      setSetsLoading(true);
      try {
        const res = await fetch('https://api.scryfall.com/sets');
        const data = await res.json();
        const filtered = data.data
          .filter((set: any) => set.set_type === 'expansion' || set.set_type === 'core')
          .sort((a: any, b: any) => (b.released_at || '').localeCompare(a.released_at || ''))
          .map((set: any) => ({ code: set.code, name: set.name }));
        if (filtered.length > 0) {
          setSets(filtered);
          setSelectedSet(filtered[0].code);
          if (onSetSelected) onSetSelected(filtered[0].code);
        }
      } catch (e) {
        setSets(STATIC_SETS);
        setSelectedSet(STATIC_SETS[0].code);
        if (onSetSelected) onSetSelected(STATIC_SETS[0].code);
      } finally {
        setSetsLoading(false);
      }
    }
    fetchSets();
    // eslint-disable-next-line
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSet(e.target.value);
    if (onSetSelected) onSetSelected(e.target.value);
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <label className="text-lg font-semibold">Set auswählen:</label>
      {setsLoading ? (
        <div>Lade Sets...</div>
      ) : (
        <select
          className="border rounded px-3 py-2 text-base"
          value={selectedSet}
          onChange={handleChange}
        >
          {sets.map((set) => (
            <option key={set.code} value={set.code}>
              {set.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}; 