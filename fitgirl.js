const fs = require('fs');
const JSDOM = require('jsdom').JSDOM;
const window = new JSDOM('').window;
const $ = require('jquery')(window);
const log = require('@vladmandic/pilogger');

// configurable
const file = 'fitgirl.json';
const debug = false;

// internal counter
let id = 1;

// gets html content of an uri
async function html(uri) {
  try {
    const res = await fetch(uri);
    if (!res?.ok) return '';
    const blob = await res.blob();
    const html = await blob.text();
    return html;
  } catch {
    if (debug) log.warn('fetch', uri);
    return '';
  }
}

// gets details for a given game
async function details(game) {
  if (game.verified) return [game, false];
  const page = await html(game.link);
  const el = $(page).find('.entry-date');
  if (!el) {
    log.warn('details', { id: game.id, failed: true, game: game.name });
    return [game, false];
  }
  const date = $(el)[1];
  game.date = new Date($(date).attr('datetime'));
  const content = $(page).find('.entry-content');
  const extra = content.html(content.html().replace(/<br>/g, '<br>\n'));
  const lines = extra.text().split(/\n|<br>/g);
  for (const line of lines) {
    if (line.startsWith('Genres/Tags:')) game.tags = line.replace('Genres/Tags: ', '').split(', ');
    if (line.startsWith('Companies:')) game.creator = line.replace('Companies: ', '').split(', ');
    if (line.startsWith('Original Size:')) game.original = line.replace('Original Size: ', '');
    if (line.startsWith('Repack Size:')) game.packed = line.replace('Repack Size: ', '').replace(' [Selective Download]', '');
  }
  const packed = game.packed ? Number(game.packed.replace(',', '.').match(/(\+|-)?((\d+(\.\d+)?)|(\.\d+))/)?.[0] || 0) : 0;
  const original = game.original ? Number(game.original.replace(',', '.').match(/(\+|-)?((\d+(\.\d+)?)|(\.\d+))/)?.[0] || 0) : 0;
  game.size = Math.max(game.size, packed, original);
  if ((game?.size > 0) && game.original.includes('MB')) game.size /= 1024;
  game.verified = (game.size > 0) ? true : false;
  log.data('details', { id: game.id, verified: game.verified, game: game.name, link: game.link });
  if (!game.verified && debug) {
    // log.debug('content', extra.html());
    log.debug('lines', lines);
    log.debug('sizes', packed, original);
    log.debug('game', game);
  }
  const hrefs = $(content).find('a');
  for (href of hrefs) {
    const a = $(href).attr('href');
    if (a?.startsWith('magnet')) game.magnet = $(href).attr('href');
  }
  return [game, game.verified];
}

// load game database from json
async function load() {
  const res = fs.readFileSync(file);
  data = JSON.parse(res);
  filtered = data.filter((d) => d.id);
  for (const game of filtered) {
    game.date = new Date(game.date);
    game.verified = (game.verified === true) && (game.size > 0);
    game.size = Math.round(10 * game.size) / 10;
  }
  log.data('load', { file, games: filtered.length, verified: filtered.filter((g) => g.verified).length });
  return filtered;
}

// save game database to json
async function save(games) {
  const json = JSON.stringify(games, null, 2);
  fs.writeFileSync(file, json);
  log.data('save', { games: games.length, verified: games.filter((g) => g.verified).length });
}

// update list of games in game database
async function update(games) {
  const content = await html('https://fitgirl-repacks.site/all-my-repacks-a-z');
  const lcp = content.match(/lcp_page0=[0-9]+#/g);
  const numPages = lcp ? Number(lcp[lcp.length - 2].replace('lcp_page0=', '').replace('#', '')) : 0;
  log.data('pages', { total: numPages });
  let newGames = [];
  for (let i = 1; i <= numPages; i++) {
    log.data('pages', { page: i, total: numPages });
    const page = await html(`https://fitgirl-repacks.site/all-my-repacks-a-z/?lcp_page0=${i}`);
    const gamesElements = $(page).find('#lcp_instance_0').children();
    for (const li of gamesElements) {
      const a = $(li).children()[0];
      const name = $(a).text();
      if (!games.find((game) => game.name === name)) newGames.push({ id: id++, name, link: $(a).attr('href') });
    }
    if (newGames.length === 0) break;
  }
  const updated = [...games, ...newGames];
  log.data('details', { pages: numPages, existing: games.length, new: newGames.length, total: updated.length, todo: updated.filter((g) => !g.verified).length });
  return updated;
}

// main function
async function main() {
  log.configure({ inspect: { breakLength: 500 } });
  log.headerJson();
  const games = await load(); // load game database
  const updated = await update(games); // update with list of new games
  if (games.length !== updated.length) await save(updated); // if new games save database
  for (let i = 0; i < updated.length; i++) {
    const [game, update] = await details(updated[i]); // get details for any games which we dont have
    updated[i] = game;
    if (update) await save(updated); // if new details save immediately
  }
  await save(updated);
}

if (require.main === module) {
  // standalone mode
  main();
} else {
  // when used as module
  exports.load = load;
  exports.save = save;
  exports.update = update;
  exports.details = details;
}
