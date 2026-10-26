// Dictionary: Thai source text -> [English, Burmese, Khmer]. "{n}" stands for a number, "{x}" for any value the code puts in (see ../lookup.js).
// Loaded only when a language other than Thai is chosen; every part file is its own chunk, downloaded together.
const parts = import.meta.glob("./part*.js");

export const loadDictionary = async () => {
  const keys = Object.keys(parts).sort();
  const mods = await Promise.all(keys.map((k) => parts[k]()));
  const dictionary = {};
  mods.forEach((m) => Object.assign(dictionary, m.default));
  return dictionary;
};
