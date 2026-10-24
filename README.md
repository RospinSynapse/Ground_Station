# SYNAPSE Ground Station

## Preview the updated app

Download this branch with **Code → Download ZIP**, extract it into a separate folder, and double-click **START-PREVIEW.cmd** on Windows. Requires Node.js 22 LTS or newer. On any supported system:

```sh
node synapse/scripts/preview.mjs
```

Wait for **Ready**, then open **http://localhost:3030** and click **Load demo packets**. This uses a separate `preview.db`; radio commands are disabled.

[Step-by-step preview instructions](synapse/docs/TRY-THE-PREVIEW.md) · [New requirements and packet examples](synapse/docs/NEW-REQUIREMENTS.md)

## Wireless balloon connection

The app now supports **Wi-Fi to the ground LoRa receiver**. The balloon-to-ground leg uses **LoRa**, not Wi-Fi or a USB cable. Matched reference firmware for ESP32 + SX1276/SX1278 bridges is in [firmware/](firmware/README.md). Confirm your board model/settings and integrate the onboard UART with the actual OBC before hardware use.

Incoming packets also appear in the original **Pachete** table.

## Normal application

The active TypeScript / Next.js application is in `synapse/`, separate from the outer Vite starter.

```sh
cd synapse
npm ci
npm run db:init
npm run dev
```

Normal mode: http://localhost:3000. [Detailed balloon link guide](synapse/docs/BALLOON-LINK.md).

The provided main-radio protocol requires matching bridge firmware and OBC integration. GSM/TinyGS native adapters remain separate; software tests do not establish real radio range or hardware compatibility.
