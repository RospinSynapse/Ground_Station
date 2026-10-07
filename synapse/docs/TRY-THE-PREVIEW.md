# See the updated app on your computer

You do not need to merge the pull request or know TypeScript.

## Easiest: separate download (Windows)

1. Open the preview branch while signed into GitHub:
   https://github.com/RospinSynapse/Ground_Station/tree/codex/balloon-packet-reception
2. Click the green **Code** button, then **Download ZIP**.
3. Right-click the ZIP and **Extract All** into a new folder, separate from your current project.
4. Install **Node.js 22 LTS or newer** if it is not installed. Close/reopen the terminal after installing.
5. Inside the extracted project folder, double-click **START-PREVIEW.cmd**.
6. Keep that terminal open. The launcher installs dependencies and creates `synapse/preview.db`. Wait for the server to say **Ready**.
7. Open **http://localhost:3030** in Chrome or Edge.
8. Click **Load demo packets (saved as demo)**. Wait a few seconds for the dashboard to refresh.

The first setup needs internet to install packages. Radio hardware is not needed to view the demo. Starting the preview again runs `npm ci` to ensure that installed dependencies match this branch; it preserves the preview database.

## What you should see

- A PREVIEW MODE banner; outbound radio command button disabled.
- Four source cards: Main LoRa, GSM backup, TinyGS backup, Ground wired.
- Demo telemetry including temperature/current extrema, GPS, battery and mode.
- GPS positions from the GSM and TinyGS demo packets on the map.
- A completed 2,028-label example grid and a separate 1/2,961 single-point example.
- A clearly synthetic critical event and a reported transmission/descent state.
- An expandable spreadsheet reference showing phase schedules and operational modes.
- A packet log and a normalized JSON/JSONL import control.

`preview.db` is separate from `local.db` or your Turso database; the launcher deliberately overrides database configuration only for its own child processes. It does not edit your `.env`. All demo packets use `demo-...` mission IDs. Map tiles require internet; a tile-loading failure does not stop packet storage.

To stop: press **Ctrl+C** in the terminal. Your original project and `main` remain unchanged when using a separate ZIP folder.

## If you already use Git

From your existing repository directory:

```sh
git fetch origin
git switch codex/balloon-packet-reception
git pull --ff-only origin codex/balloon-packet-reception
node synapse/scripts/preview.mjs
```

If Git refuses because of local edits or divergent history, stop: do not force/reset/discard. Use the separate ZIP preview instead. This branch contains both the original implementation and the spreadsheet/GS-design update.

On macOS/Linux you can also run `sh START-PREVIEW.sh`. On any supported system, `node synapse/scripts/preview.mjs` runs the same launcher. Port 3030 avoids the usual development server on 3000; if another process is already using 3030, stop that preview first.

## Updating the preview later

A ZIP download is a snapshot: download and extract a fresh ZIP for later updates. A Git checkout can be updated with the fetch/switch/pull commands above. Do not copy `node_modules`, `.next`, or database files between versions.

## Using the normal app after reviewing

```sh
cd synapse
npm ci
npm run db:init
npm run dev
```

Normal mode runs at http://localhost:3000 and uses `TURSO_DATABASE_URL` when configured, otherwise `file:local.db`. Commands remain opt-in and require matching firmware. Before integrating with flight hardware, read `NEW-REQUIREMENTS.md` and `BALLOON-LINK.md`.
