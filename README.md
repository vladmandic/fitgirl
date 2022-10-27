# fitgirl

scraper and parser for <https://fitgirl-repacks.site>  
*why*? simply because its lacking decent search capabilities  

## usage

> npm install

- install dependencies

> npm start

- parses site and get updated pages
- get details for each games
- resumable: abort at any time and restart to resume
- only updates new and missing data
- saves results to `fitgirl.json`
- uses silly `jsdom` and `jquery` parsing so future breakages are possible

> npm run find `<search-string>`

- loads `fitgirl.json` prepared by main script
- finds all games matching search string
- if search string is omitted, prints sections with **newest** and **largest** games
