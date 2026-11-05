# Porto, together

A minimal, full-screen spectator map for Porto Marathon, 8 November 2026. Floating name/bib search, a compact selected-runner card, and a leaderboard opened from a corner button. No login or backend required.

[Open the live map](https://porto-race-watch.vercel.app)

## Run locally

```sh
npm start
```

Open http://localhost:8765. Files are served directly from `public`; edits appear after a browser refresh. Run `npm test` for the timing and route projection checks.

## Deploy

The project is a static website. Vercel is configured in `vercel.json` with `public` as the output directory and no build step. Import this GitHub repository into Vercel for automatic deployments, or run `vercel --prod` from an authenticated CLI.

## Runner search and sharing

One input searches both registered names and bib numbers against fresh public results. Results show whatever bib, category, team and country the organiser has published. Each entry is selectable. A selected runner's public participant ID is stored in `?runner=…`; a published bib is also included in `?bib=…`. Use the Share button to copy or share that URL.

The default watch looks for bib 6297 and offers a Francisco Silva name search until the bib mapping becomes available. Multiple runners can have identical names and categories. The site shows their distinct entry IDs and never silently chooses one of those entries. Entry IDs distinguish records; they do not prove which record belongs to your friend. Once bibs are published, search for 6297 to confirm.

## Data and accuracy

This is an independent, unofficial viewer. It does not scrape private profiles, authenticate as a runner, bypass access restrictions, or use GPS subscription features.

The public TRACX browser API was inspected on 5 November 2026. The official event is **2250**, marathon race **6220**, and overall/men/women rankings **25156 / 25157 / 25158**. The code reads the same public endpoints used by the TRACX web UI:

```
https://api.tracx.events/v1/web/events/2250
/rankings/25156/results?search=…&itemsPerPage=50
/participants/{public-participant-id}?include=splits,last_passing
```

- Timing mat passings are measured observations. The runner dot between mats is an **estimate**, never labelled live GPS.
- Estimates use only a valid last passing and the speed attached to it. Scheduled starts and pre-race default speeds do not create movement.
- Estimates stop just before the next timing checkpoint and require another measured passing to advance. An overdue read returns the marker to the last confirmed checkpoint.
- Finished, DNS, DNF, disqualified, private and unavailable states are handled without inventing progress.
- Split durations and pace arrive in milliseconds. Last-passing timestamps are UTC; display clocks use Europe/Lisbon.
- Rankings follow the feed's published positions. Unranked pre-race entries are not presented as leaders. The top five ranked runners can be selected and their positions appear on the map when timing data exists.
- Athlete data refreshes every minute during the race and every five minutes before it. Leaderboards refresh every two minutes. Hidden tabs pause polling. A stale feed disables extrapolation and stale leader markers are removed on refresh failure.
- Course geometry is bundled from the public race configuration so the map can load even when timing is unavailable. The API labels the race as 42,200 metres, which is the distance used for projection. The certified marathon distance is 42.195 km.
- Official checkpoint path indices are inconsistent with the supplied geometry. Projection therefore matches geographic checkpoints within their ordered course-distance neighbourhood, including outbound/return sections.

The API is undocumented and may change; race-day live behavior cannot be fully verified before the start. This page has no guarantee of continuous service. Confirm race results with the organiser.

## Map and dependencies

Leaflet 1.9.4 is pinned and bundled in `public/vendor` under its BSD 2-Clause licence (included in `LICENSE-leaflet`). Map tiles are standard OpenStreetMap tiles; visible attribution is retained. This small spectator site does not preload tiles or support offline map downloads. Typography uses Google Fonts with system fallbacks.

## Sources

- [Official app page](https://www.maratonadoporto.com/app-edp-maratona-do-porto-2026/)
- [Official course page](https://www.maratonadoporto.com/pt/percursos-2026/)
- [TRACX event](https://tracx.events/en/events/2250)
- [Public event configuration](https://api.tracx.events/v1/web/events/2250?include=races)
- [Public marathon configuration](https://api.tracx.events/v1/web/events/2250/races/6220?include=route,timelines,rankings)

This app sends search queries and participant requests directly to TRACX and map tile requests to OpenStreetMap. It does not run its own analytics or store a runner database.
