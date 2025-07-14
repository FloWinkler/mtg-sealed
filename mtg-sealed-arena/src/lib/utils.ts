// utils.ts
// Hilfsfunktionen für das MTG-Projekt

/*
 * Mischt ein Array mit dem Fisher-Yates-Algorithmus (in-place).
 * Gibt eine neue, gemischte Kopie des Arrays zurück.
 * @param arr Array beliebiger Elemente
 */
// export function shuffle<T>(arr: T[]): T[] {
//   const copy = [...arr]; // Kopie, um Original nicht zu verändern
//   for (let i = copy.length - 1; i > 0; i--) {
//     // Wähle zufälligen Index von 0 bis i
//     const j = Math.floor(Math.random() * (i + 1));
//     // Tausche copy[i] und copy[j]
//     [copy[i], copy[j]] = [copy[j], copy[i]];
//   }
//   return copy;
// } 