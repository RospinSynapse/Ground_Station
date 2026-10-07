# SYNAPSE Ground Station

## Preview the updated app

Download this branch with **Code → Download ZIP**, extract it into a separate folder, and double-click **START-PREVIEW.cmd** on Windows. Requires Node.js 22 LTS or newer. On any supported system:

```sh
node synapse/scripts/preview.mjs
```

Wait for **Ready**, then open **http://localhost:3030** and click **Load demo packets**. This uses a separate `preview.db`; radio commands are disabled.

[Step-by-step preview instructions](synapse/docs/TRY-THE-PREVIEW.md) · [New requirements and packet examples](synapse/docs/NEW-REQUIREMENTS.md)

## Normal application

The active TypeScript / Next.js application is in `synapse/`, separate from the outer Vite starter.

```sh
cd synapse
npm ci
npm run db:init
npm run dev
```

Normal mode: http://localhost:3000. [Detailed balloon link guide](synapse/docs/BALLOON-LINK.md).

Hardware protocols still require matching firmware/adapters; the demo and normalized JSON reception do not establish native GSM/TinyGS or LoRa compatibility.
