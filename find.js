const process = require('process');
const log = require('@vladmandic/pilogger');
const fitgirl = require('./fitgirl');

const topK = 40;

async function load() {
  const res = fs.readFileSync(file);
  data = JSON.parse(res);
  filtered = data.filter((d) => d.id);
  log.data('load', { file, games: filtered.length, verified: filtered.filter((g) => g.verified).length });
  return filtered;
}

async function main() {
  log.configure({ inspect: { breakLength: 500 } });
  log.headerJson();
  const loaded = await fitgirl.load();
  const games = loaded.map((l) => ({ name: l.name, size: l.size, date: l.date, tags: l.tags?.join(' '), link: l.link }));
  if (process.argv.length > 2) {
    const s = process.argv[2].toLowerCase();
    const found = games.filter((a) => a.name?.toLowerCase().includes(s) || a.tags?.toLowerCase().includes(s)); // .slice(0, Math.min(games.length, topK));
    const search = found?.sort((a, b) => b.date - a.date).slice(0, Math.min(games.length, topK)) || [];
    log.data({ search: process.argv[2].toLowerCase(), results: search });
  } else {
    const newest = games.sort((a, b) => b.date - a.date).slice(0, Math.min(games.length, topK));
    const largest = games.sort((a, b) => b.size - a.size).slice(0, Math.min(games.length, topK));
    log.data({ newest });
    log.data({ largest });
  }
}

main();
