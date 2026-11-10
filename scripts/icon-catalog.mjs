// Shared catalogue for the icon picker and the generator: openly licensed emoji sets
// and the emoji used for each app asset.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

export const SETS = [
  { key: 'a', pkg: 'fluent-emoji', label: 'Fluent 3D' },
  { key: 'b', pkg: 'fluent-emoji-flat', label: 'Fluent Flat' },
  { key: 'c', pkg: 'noto', label: 'Noto' },
  { key: 'd', pkg: 'fluent-emoji-high-contrast', label: 'Blanc mono' },
].map((s) => ({ ...s, icons: require(`@iconify-json/${s.pkg}/icons.json`) }));

export const ASSETS = [
  ['banknote', 'Billet', 'euro-banknote'],
  ['money-stack', 'Liasse / argent qui part', 'money-with-wings'],
  ['coin', 'Pièce', 'coin'],
  ['coin-stack', 'Pile de pièces', 'coin'],
  ['money-bag', "Sac d'argent", 'money-bag'],
  ['bank', 'Banque', 'classical-building'],
  ['house', 'Maison', 'house-with-garden'],
  ['mansion', 'Grande maison', 'house'],
  ['car', 'Voiture', 'automobile'],
  ['sports-car', 'Voiture de sport', 'racing-car'],
  ['phone', 'Téléphone', 'mobile-phone'],
  ['credit-card', 'Carte bancaire', 'credit-card'],
  ['laptop', 'Ordinateur', 'laptop'],
  ['chart-up', 'Courbe en hausse', 'chart-increasing'],
  ['chart-down', 'Courbe en baisse', 'chart-decreasing'],
  ['clock', 'Réveil / horloge', 'alarm-clock'],
  ['building', 'Immeuble', 'office-building'],
  ['shop', 'Magasin', 'convenience-store'],
  ['piggy-bank', 'Tirelire', 'pig-face'],
  ['calendar', 'Calendrier', 'tear-off-calendar'],
  ['gift', 'Cadeau', 'wrapped-gift'],
  ['wallet', 'Porte-monnaie', 'purse'],
  ['briefcase', 'Mallette', 'briefcase'],
  ['receipt', 'Facture / ticket', 'receipt'],
  ['plane', 'Avion', 'airplane'],
  ['diploma', 'Diplôme', 'scroll'],
  ['shopping-bag', 'Sac de shopping', 'shopping-bags'],
  ['percent-badge', 'Pourcentage', 'hundred-points'],
  ['lock', 'Cadenas', 'locked'],
  ['hourglass', 'Sablier', 'hourglass-not-done'],
  ['coffee', 'Café', 'hot-beverage'],
  ['yacht', 'Bateau', 'motor-boat'],
  ['question-mark', "Point d'interrogation", 'red-question-mark'],
  ['exclamation', "Point d'exclamation", 'red-exclamation-mark'],
  ['trophy', 'Trophée', 'trophy'],
  ['graduation-cap', 'Toque de diplômé', 'graduation-cap'],
];


/** Resolve an icon (following aliases) in a set. */
export function resolve(set, name) {
  let n = name;
  for (let i = 0; i < 4 && !set.icons.icons[n] && set.icons.aliases?.[n]; i++) n = set.icons.aliases[n].parent;
  const icon = set.icons.icons[n];
  if (!icon) throw new Error(`${set.pkg}: ${name} not found`);
  return { name: n, body: icon.body, w: icon.width ?? set.icons.width ?? 16, h: icon.height ?? set.icons.height ?? 16 };
}
