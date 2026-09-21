# Deploying Blackjack Dojo (GitHub Pages → iPhone home screen)

The app is a static folder: no server, no build step, no network calls at runtime. Everything
(`engine/`, `data/edges.json`, all screens) is precached by the service worker on first load, so it
works in airplane mode afterwards.

## 0. Before every deploy

```bash
cd ~/blackjack-dojo
node engine/verify.js --quick     # ~1 min; must end with "RESULT: GREEN"
node tools/stamp.js               # REQUIRED: rewrites the service-worker cache version + file list
```

`stamp.js` is what makes phones pick up a new version. If you skip it after changing any file, an
installed app keeps serving the old cached copy.

## 1. Put it on GitHub Pages

GitHub Pages is free for **public** repositories. The app holds no personal data (your progress lives
only on your phone), so public is fine.

1. On github.com: **New repository** → name it `blackjack-dojo` → Public → *don't* add a README → Create.
2. In the terminal:

   ```bash
   cd ~/blackjack-dojo
   git init -b main
   git add -A
   git commit -m "Blackjack Dojo"
   git remote add origin https://github.com/<your-username>/blackjack-dojo.git
   git push -u origin main
   ```
3. Repo → **Settings → Pages** → *Build and deployment* → Source: **Deploy from a branch** →
   Branch: **main**, folder **/ (root)** → **Save**.
4. Wait ~1 minute. Your URL is `https://<your-username>.github.io/blackjack-dojo/`.
   (The `.nojekyll` file in the folder stops GitHub from post-processing it.)

The site is served over HTTPS, which service workers require.

## 2. Install on the iPhone

1. On the iPhone open **Safari** → go to your URL. Let it fully load (about 10 seconds; the service
   worker downloads the whole app in the background).
2. Tap **Share** (square with arrow) → **Add to Home Screen** → **Add**.
3. Open it **from the home-screen icon** from now on.

Requirements: iOS 16.4 or newer is recommended (module web workers and modern CSS colors; older versions may lose some styling).

Important iOS facts:
- The home-screen app has its **own storage**, separate from Safari. Use it only from the icon, and
  **export your progress regularly** (Stats → Data → Export). That file is your safety net.
- The first launch from the icon should be **online** once, so its cache is filled.
- If you ever delete the app from the home screen, its stored progress goes with it.

## 3. Offline test checklist (do this once, on the phone)

1. Open the app from the icon while online. Wait until Drill shows no "warming up" line.
2. Turn on **Airplane Mode**. Fully close the app (swipe up, flick it away) and reopen it.
3. ☐ Learn tab loads; the spine and honest-claim card show a house edge (0.33%).
4. ☐ Tier 0 lessons open; Tier 2 lesson numbers appear (no `{{…}}`).
5. ☐ Learn → Tier 2 → Drill: a hand appears and answering shows the reason + EV table.
6. ☐ Drill → Flash Drill: ring counts down; "Time's up" appears if you wait.
7. ☐ Play → Live Table: sit down, deal, play a hand to the end.
8. ☐ Play → Trap Mode shows offers; Decline works.
9. ☐ Stats → Heatmap shows your answers; Stats → Settings → Change table rules → pick 4 decks +
   H17: the house-edge number updates (computed offline).
10. ☐ Stats → Data → Export gives you a file or a copy sheet.
11. ☐ Turn Airplane Mode off; everything still works.

If any step fails offline, the service worker did not finish installing. Open the app online, wait,
close it, and try again.

## 4. Updating later

```bash
node engine/verify.js --quick && node tools/stamp.js
git add -A && git commit -m "update" && git push
```

On the phone: open the app **online**, let it sit a few seconds, then close and reopen it. (The new
service worker installs in the background and takes over on the next launch.)

## 5. Things that need regenerating

- `data/edges.json` (exact house edges for the Rules Panel Reader / rules editor) is generated from the
  engine: `node tools/gen-edges.js` (about 9 minutes). Regenerate if `engine/ev.js` changes.
- If you change engine math, bump `ENGINE_VERSION` in `engine/strategy.js` so phones discard cached
  engine results.
- Icons: `node tools/make-icons.js`.

## 6. Verifying the math yourself

`node engine/verify.js` (about 4 minutes) asserts all 350 cells of the published 6-deck chart (and the
4- and 8-deck versions), 52 lesson claims, published dealer tables, published exact house edges for
13 rule sets, Monte Carlo agreement, and an end-to-end simulation. Output from the last run is in
`engine/verify-output.txt`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| App shows an old version | Run `node tools/stamp.js`, push, open online, close and reopen. |
| Stats → Chart says "unlocks in Tier 6" | Intentional. Settings → "Show the chart before Tier 6" overrides it. |
| Export shows a copy box instead of a file | Your browser blocked file sharing; copy the text and save it in Notes, import later with "Paste JSON". |
| Blank screen on first load | Not on HTTPS, or JavaScript modules blocked. Use the GitHub Pages URL. |
