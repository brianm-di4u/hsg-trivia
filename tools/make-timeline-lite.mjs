// Builds data/timeline-lite.json from research/timeline.json: confirmed events only, 1541–2025,
// trimmed to the fields the game shows (Time Warp ordering and Postcards). Sensitive history
// (civil-rights entries, killings, lynchings, bombings, slavery) is excluded: the corpus rules say it is
// never used as gameplay, and Time Warp/Postcards are gameplay. Same-year duplicates are dropped so
// every ordering puzzle has one right answer.
//   node games/trivia/tools/make-timeline-lite.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SENSITIVE = /lynch|murder|kill|shoot|gunfight|bomb|enslaved|slave|died|dies|death/i;
const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, '../../../research/timeline.json');
const out = path.resolve(here, '../data/timeline-lite.json');
const t = JSON.parse(fs.readFileSync(src, 'utf8'));
const events = t.events
  .filter((e) => e.confidence === 'confirmed' && e.year >= 1541 && e.year <= 2025 && e.event && e.event.length <= 110)
  .filter((e) => e.category !== 'civil-rights' && !SENSITIVE.test(e.event))
  .map((e) => ({ y: e.year, era: e.era, e: e.event, s: e.source }));
const eras = t.eras.map(({ id, name, start, end, summary }) => ({ id, name, start, end, summary }));
fs.writeFileSync(out, JSON.stringify({ eras, events }));
console.log(`timeline-lite: ${events.length} events, ${eras.length} eras → ${path.relative(process.cwd(), out)}`);
