// Builds an interactive page proposing 4 openly licensed illustrations per object
// (Fluent 3D, Fluent Flat, Noto, Fluent High Contrast) so the user can pick one each.
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const out = process.argv[2];
const SETS = [
  { key: 'a', pkg: 'fluent-emoji', label: 'Fluent 3D' },
  { key: 'b', pkg: 'fluent-emoji-flat', label: 'Fluent Flat' },
  { key: 'c', pkg: 'noto', label: 'Noto' },
  { key: 'd', pkg: 'fluent-emoji-high-contrast', label: 'Blanc mono' },
].map((s) => ({ ...s, icons: require(`@iconify-json/${s.pkg}/icons.json`) }));

const ASSETS = [
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

function resolve(set, name) {
  let n = name;
  for (let i = 0; i < 4 && !set.icons.icons[n] && set.icons.aliases?.[n]; i++) n = set.icons.aliases[n].parent;
  const icon = set.icons.icons[n];
  if (!icon) throw new Error(`${set.pkg}: ${name} not found`);
  return { body: icon.body, w: icon.width ?? set.icons.width ?? 16, h: icon.height ?? set.icons.height ?? 16 };
}
const scope = (body, p) => body.replace(/\bid="([^"]+)"/g, `id="${p}$1"`).replace(/url\(#([^)]+)\)/g, `url(#${p}$1)`).replace(/href="#([^"]+)"/g, `href="#${p}$1"`);

const data = ASSETS.map(([asset, label, emoji]) => ({
  asset,
  label,
  emoji,
  options: SETS.map((s) => {
    const r = resolve(s, emoji);
    return { key: s.key, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r.w} ${r.h}">${scope(r.body, `${asset}-${s.key}-`)}</svg>` };
  }),
}));

const html = `<title>Choix des icônes</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;800;900&display=swap">
<style>
/* Layout: a single dark board, one row per object, four tiles shown on video-black so picks are judged in context. */
:root {
  color-scheme: dark;
  --page: #0b0b0e; --tile: #000000; --line: #26262e; --ink: #f3f3f6; --muted: #9a9aa6;
  --pick: #ffd60a; --pick-ink: #151100; --ok: #32d74b;
  --font: 'Montserrat', 'Segoe UI', system-ui, sans-serif;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--page); color: var(--ink); font-family: var(--font);
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 20px 60px; }
.wrap { max-width: 1040px; margin: 0 auto; display: flex; flex-direction: column; gap: 18px; }
header { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; background: var(--page); padding-block: 10px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px 20px; border-bottom: 1px solid var(--line); }
body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 10; background: var(--page); }
h1 { margin: 0; font-size: 1.45rem; font-weight: 900; text-wrap: balance; }
.sub { margin: 4px 0 0; color: var(--muted); font-size: .9rem; font-weight: 600; max-width: 62ch; }
.status { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; font-weight: 800; font-size: .9rem; }
.count { font-variant-numeric: tabular-nums; }
.save { color: var(--muted); font-size: .78rem; font-weight: 600; }
.save.ok { color: var(--ok); }
.legend { display: grid; grid-template-columns: minmax(150px, 1.1fr) repeat(4, minmax(0, 1fr)) minmax(70px, .6fr); gap: 10px; color: var(--muted); font-size: .72rem; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
.row { display: grid; grid-template-columns: minmax(150px, 1.1fr) repeat(4, minmax(0, 1fr)) minmax(70px, .6fr); gap: 10px; align-items: stretch; }
.name { display: flex; flex-direction: column; justify-content: center; gap: 3px; min-width: 0; }
.name b { font-size: 1rem; font-weight: 800; }
.name code { color: var(--muted); font-size: .72rem; }
button.opt { background: var(--tile); border: 2px solid var(--line); border-radius: 12px; padding: 12px; cursor: pointer; aspect-ratio: 1; max-width: 100%; display: grid; place-items: center; position: relative; transition: border-color .15s, transform .1s; }
button.opt svg { width: 78%; height: 78%; }
button.opt:hover { border-color: #55555f; }
button.opt:focus-visible, button.keep:focus-visible { outline: 3px solid var(--pick); outline-offset: 2px; }
button.opt[aria-pressed="true"] { border-color: var(--pick); box-shadow: 0 0 0 3px rgba(255,214,10,.25); }
button.opt[aria-pressed="true"]::after { content: "✓"; position: absolute; top: 6px; right: 8px; background: var(--pick); color: var(--pick-ink); font-weight: 900; font-size: .75rem; width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; }
button.keep { background: transparent; border: 2px dashed var(--line); border-radius: 12px; color: var(--muted); font: 800 .74rem/1.2 var(--font); cursor: pointer; padding: 8px; }
button.keep[aria-pressed="true"] { border-style: solid; border-color: var(--pick); color: var(--ink); }
.foot { color: var(--muted); font-size: .8rem; font-weight: 600; line-height: 1.5; max-width: 70ch; }
@media (max-width: 640px) {
  .legend { display: none; }
  .row { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .name { grid-column: 1 / -1; }
  button.keep { grid-column: 1 / -1; aspect-ratio: auto; }
}
@media (prefers-reduced-motion: reduce) { button.opt { transition: none; } }
</style>
<div class="wrap">
  <header>
    <div>
      <h1>Choix des icônes</h1>
      <p class="sub">Une icône par objet. Cliquez celle que vous préférez : elle est enregistrée tout de suite. Les fonds noirs montrent le rendu dans la vidéo.</p>
    </div>
    <div class="status"><span class="count" id="count">0 / ${data.length} choisis</span><span class="save" id="save">Chargement de vos choix…</span></div>
  </header>
  <div class="legend" aria-hidden="true"><span>Objet</span><span>A · Fluent 3D</span><span>B · Fluent Flat</span><span>C · Noto</span><span>D · Blanc mono</span><span>Actuel</span></div>
  <div id="rows" style="display:flex;flex-direction:column;gap:14px"></div>
  <p class="foot">Sources : Microsoft Fluent Emoji (licence MIT) et Google Noto Emoji (licence Apache 2.0) — libres d'usage commercial, sans mention obligatoire dans les vidéos. « Actuel » garde l'icône déjà dans l'application. Quand vous avez fini, dites-le simplement dans la conversation.</p>
</div>
<script>
const DATA = ${JSON.stringify(data)};
const picks = {};
const rowsEl = document.getElementById('rows');
const countEl = document.getElementById('count');
const saveEl = document.getElementById('save');
function render() {
  rowsEl.textContent = '';
  for (const item of DATA) {
    const row = document.createElement('div');
    row.className = 'row';
    const name = document.createElement('div');
    name.className = 'name';
    const b = document.createElement('b'); b.textContent = item.label;
    const c = document.createElement('code'); c.textContent = item.asset;
    name.append(b, c);
    row.append(name);
    item.options.forEach((o, i) => {
      const btn = document.createElement('button');
      btn.className = 'opt';
      btn.type = 'button';
      btn.id = 'opt-' + item.asset + '-' + o.key;
      btn.setAttribute('aria-label', item.label + ' — option ' + 'ABCD'[i]);
      btn.setAttribute('aria-pressed', String(picks[item.asset] === o.key));
      btn.innerHTML = o.svg;
      btn.addEventListener('click', () => choose(item.asset, o.key));
      row.append(btn);
    });
    const keep = document.createElement('button');
    keep.className = 'keep'; keep.type = 'button'; keep.id = 'keep-' + item.asset;
    keep.textContent = 'Garder l’actuel';
    keep.setAttribute('aria-pressed', String(picks[item.asset] === 'keep'));
    keep.addEventListener('click', () => choose(item.asset, 'keep'));
    row.append(keep);
    rowsEl.append(row);
  }
  countEl.textContent = Object.keys(picks).length + ' / ' + DATA.length + ' choisis';
}
function update(asset) {
  for (const k of ['a','b','c','d']) {
    const el = document.getElementById('opt-' + asset + '-' + k);
    if (el) el.setAttribute('aria-pressed', String(picks[asset] === k));
  }
  const keep = document.getElementById('keep-' + asset);
  if (keep) keep.setAttribute('aria-pressed', String(picks[asset] === 'keep'));
  countEl.textContent = Object.keys(picks).length + ' / ' + DATA.length + ' choisis';
}
let db = null, saveTimer = null, saving = false, pending = false;
async function persist() {
  if (!db) { saveEl.textContent = 'Enregistrement indisponible ici : notez vos lettres dans la conversation.'; saveEl.className = 'save'; return; }
  if (saving) { pending = true; return; }
  saving = true;
  saveEl.textContent = 'Enregistrement…'; saveEl.className = 'save';
  try {
    await db.doc('picks/choices').set({ ...picks, updatedAt: new Date().toISOString() });
    saveEl.textContent = 'Enregistré'; saveEl.className = 'save ok';
  } catch (e) {
    saveEl.textContent = 'Échec de l’enregistrement : ' + (e && e.message ? e.message : e);
    saveEl.className = 'save';
  } finally {
    saving = false;
    if (pending) { pending = false; persist(); }
  }
}
function choose(asset, key) {
  picks[asset] = key;
  update(asset);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 400);
}
render();
(async () => {
  const timeout = setTimeout(() => { if (!db) { saveEl.textContent = 'Vos choix précédents n’ont pas pu être chargés.'; } }, 10000);
  try {
    db = await window.claude?.use?.('db');
    if (!db) { clearTimeout(timeout); saveEl.textContent = 'Enregistrement indisponible ici : notez vos lettres dans la conversation.'; return; }
    const snap = await db.doc('picks/choices').get();
    clearTimeout(timeout);
    const saved = snap && (snap.data ? (typeof snap.data === 'function' ? snap.data() : snap.data) : null);
    if (saved) for (const item of DATA) if (saved[item.asset]) picks[item.asset] = saved[item.asset];
    render();
    saveEl.textContent = Object.keys(picks).length ? 'Choix précédents chargés' : 'Prêt — cliquez pour choisir';
    saveEl.className = 'save' + (Object.keys(picks).length ? ' ok' : '');
  } catch (e) {
    clearTimeout(timeout);
    saveEl.textContent = 'Lecture impossible : ' + (e && e.message ? e.message : e);
  }
})();
</script>
`;
fs.writeFileSync(out, html);
console.log(`Wrote ${out} (${(fs.statSync(out).size / 1024 / 1024).toFixed(2)} MB)`);
