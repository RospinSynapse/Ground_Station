# SYNAPSE ground station

[Try the isolated preview first](docs/TRY-THE-PREVIEW.md): `npm run preview`, then open http://localhost:3030 and load demo packets.

[Spreadsheet and GS-design additions](docs/NEW-REQUIREMENTS.md).

The TypeScript / Next.js application is this `synapse/` directory. Run commands here, not in the outer Vite starter.

```sh
npm ci
npm run db:init
npm run dev
```

Open http://localhost:3000 and click **Load demo packets** to test without hardware.

[Balloon connection, packet formats and beginner guide](docs/BALLOON-LINK.md)

The USB protocol is a proposed bridge interface, pending agreement with the ESP32 firmware team; the DDD does not define a byte-level RF protocol. Real radio compatibility has not been tested.

Checks: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
