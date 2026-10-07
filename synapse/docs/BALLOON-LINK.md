# Balloon link: initial contract and compatibility

**Updated requirements:** Read [NEW-REQUIREMENTS.md](NEW-REQUIREMENTS.md) for source-aware reception, variable image sizes, extrema, logs and additional modes. For the quickest demo, use [TRY-THE-PREVIEW.md](TRY-THE-PREVIEW.md). The 2,028-label size below is the original DDD default; newer packets can supply `totalSegments`.

## What works, and what still needs firmware

This adds the ground-station side of telemetry/classification reception and an experimental mode-command sender. It is a proposed USB bridge contract, not a claim that the current balloon firmware already speaks this format. The DDD V1 does not contain a wire protocol. No radio firmware was supplied in this repository, and no physical radio was available for testing.

Read the live UI as follows: **USB connected** means the PC opened the ground ESP32's serial port. **Stored** means a packet passed validation and reached the database. Neither means the balloon received a command. Only a matching `command_ack` reports the firmware's response; `accepted` is not `executed`.

## Requirements traced to SYNAPSE Detailed Design Document V1

Page numbers below are printed document page numbers.

| DDD source | Required information | Implementation |
| --- | --- | --- |
| pp. 19–20, COM-001 | Nominal telemetry every 10 minutes | Telemetry schema records the actual averaging window; dashboard displays receive time and age. Flight firmware controls transmission cadence. |
| p. 20 | Exterior/interior temperatures, light, barometer, current: 10-minute averages | Explicit fields with units; averages calculated on board, not from sparse ground samples. |
| p. 20 | Latest GPS and IMU | Coordinates/altitude and acceleration/angular velocity; unavailable readings use null. |
| p. 20 | OBC and Raspberry Pi internal parameters | Mode, phase, battery voltage plus bounded key/value parameter records. Parameter names beyond the explicit fields need firmware agreement. |
| p. 20, COM-002 | GPS plus 2,028 classification labels, 10 classes, 4 bits each | Nibble decoding, indexed fragments, conflict detection, partial/completed image reconstruction, GPS markers. |
| p. 18, COM-005/009 | Monitor communication and display classification results | Receive log, rejection events, serial state, image completion, class grid and GPS markers. |
| pp. 13–15, OBC-11 / COM-003 | Bidirectional communication and mode change | Explicit USB command write and correlated acknowledgement display; proposed command vocabulary requires firmware confirmation. |
| pp. 24–27 | 64×64 image patches; choose up to five images | Keep all received image IDs; display latest 20. Selection of up to five happens on the payload. Class grid is a label reconstruction, not recovery of the original RGB photo. |

### DDD ambiguities to resolve

- The communications section says telemetry every 600 s; p. 14 describes 60 s in Safe Mode. Reception accepts both and displays the sender's averaging window. That window is not automatically treated as the transmission interval.
- The document uses normal/low-power/safe and also init/nominal/safe/recovery. Commands expose a proposed vocabulary, not firmware opcode assignments.
- It writes “433Hz”; confirm the intended RF frequency and exact module. Do not configure a radio from this apparent typo.
- 2,028 × 4 + 64 = **8,176 bits = 1,022 bytes per photo** before headers. Five such photos are **40,880 bits**, rather than the stated approximately 40,624. USB JSON is larger; it is not an RF bandwidth estimate.
- Two GPS numbers totalling 64 bits do not establish float representation, byte order or scaling.
- Numeric class-to-name mapping, grid dimensions/order, camera attitude and ground footprint are missing. Class names and geographical tile polygons must not be guessed. Existing manual polygons are legacy test data; incoming images use point markers.

## Physical connection

1. Flight sensors and Pi populate the flight ESP32/OBC datapool.
2. Flight ESP32 encodes the team's agreed binary radio packets and sends them through its LoRa module (SPI).
3. Ground LoRa module receives them. Its ground ESP32 validates/decodes the RF packets.
4. Connect that ground ESP32 to the operator PC using USB. Its firmware emits one JSON record followed by a newline for each decoded packet, using the contract below.
5. Open the local app, click **Connect ESP32**, and select its serial port. The browser validates each record, posts it to `/api/ground`, and the server stores it in SQLite (or the configured Turso database).
6. A mode command follows the reverse route. The ground firmware translates the USB JSON to the real RF opcode/layout, and relays the balloon acknowledgement back as JSON.

The ground ESP32 needs to implement steps 3–4 and the reverse translation. This PR does not invent an RF driver or firmware pinout. Exact LoRa model, pins, frequency, spreading factor, bandwidth, coding rate, sync word, CRC, payload size and retry policy must match on both radios. USB baud (default proposal: 115200, 8N1) is separate from the LoRa air rate.

Keep Arduino Serial Monitor closed while using the port. Keep the browser tab open and the PC awake during reception. Browser-only reception is not an unattended acquisition daemon. Closing/reloading/disconnecting drops incomplete serial lines, while fragments already stored in the database survive restart. An HTTP/storage failure is visible in the event log; this version has no durable offline USB spool or automatic retransmission. Request a resend with identical packet IDs from the firmware if needed.

## Proposed USB contract v1

Transport: UTF-8 **newline-delimited JSON** (one object per line, LF or CRLF). Do not pretty-print serial records. Maximum line/request size: 32,768. Debug text should use a different channel; non-JSON lines are rejected. USB uses JSON for debugging convenience; this is not the compact radio format.

Every received packet includes:

| Field | Meaning |
| --- | --- |
| `version` | Exactly `1` |
| `type` | `telemetry`, `classification`, `classification_point`, `gps_backup`, `system_log`, `state`, or `command_ack` |
| `missionId` | Unique flight/session ID; reserve `demo-` for synthetic data |
| `packetId` | Unique within a source and mission; retransmit unchanged content with the same ID |
| `timestamp` | Sender UTC ISO timestamp, e.g. `2026-10-07T13:00:00Z` |
| `radio` | Optional `{rssiDbm, snrDb}`; metadata, not proof of integrity |

IDs are 1–80 characters from letters, digits, `_ . : -`. Unknown fields, stringified numbers, invalid coordinates, missing required fields and unsupported versions are rejected. Sensor numbers must be finite. `null` means unavailable, whereas `0` means a measured zero. Database receive time is recorded separately from sender time. Identical duplicates return 200, a new record returns 201, and reused IDs with changed content return 409. Retransmitted USB records must retain their metadata as well as payload. An RF adapter with new reception metadata must handle this consistently.

### Telemetry example

```json
{
  "version": 1,
  "missionId": "flight-001",
  "packetId": "tm-0001",
  "type": "telemetry",
  "timestamp": "2026-10-07T13:00:00Z",
  "averagingWindowSeconds": 600,
  "exteriorTemperatureC": -45,
  "interiorTemperaturesC": [18, 20],
  "lightLux": 85000,
  "pressureHpa": 16,
  "currentA": 0.8,
  "gps": {"latitude": 44.4323, "longitude": 26.1074, "altitudeM": 28000},
  "imu": {"accelerationMps2": {"x": 0.1, "y": 0, "z": 9.8}, "angularVelocityDps": null},
  "obc": {"mode": "nominal", "flightPhase": "float", "batteryVoltageV": 15.2, "parameters": {"uptimeSeconds": 7200}},
  "raspberryPi": {"parameters": {"cpuTemperatureC": 48}},
  "radio": {"rssiDbm": -110, "snrDb": 4}
}
```

`gps` and `imu` may be null. Interior temperature array allows 0–16 sensors, each number or null. An IMU may have either vector null. Each internal parameter record allows up to 32 entries (number/string/boolean/null); do not substitute invented readings for an unavailable sensor.

### Classification fragment example

```json
{"version":1,"missionId":"flight-001","packetId":"image-001-frag-0","type":"classification","timestamp":"2026-10-07T13:00:00Z","imageId":"image-001","gps":{"latitude":44.4323,"longitude":26.1074,"altitudeM":28000},"segmentOffset":0,"segmentCount":4,"labelsHex":"0192"}
```

This describes labels `[0,1,9,2]` starting at segment zero. High nibble comes first. Fragment size is **1–128 labels**, with exactly `ceil(segmentCount/2)` bytes represented as hex. Odd counts require a zero low padding nibble. This size is a proposed USB chunk limit; the RF team must choose its own payload framing/overhead.

Offsets index `totalSegments` labels (2,028 when omitted for legacy compatibility). Fragments can arrive out of order. Identical overlaps are allowed; contradictory overlaps or different GPS/grid metadata for an image are rejected transactionally. Images are keyed by source + mission + image ID. All fragments of an image must agree on optional `columns`; it must divide the declared total. If omitted, the app stores ordered labels and shows progress but does not invent a grid. If supplied, order is row-major, left-to-right then top-to-bottom. The demo uses 52 × 39 solely as a demonstration. Class IDs remain 0–9 until the trained model's mapping is supplied.

### Command and acknowledgement examples

PC writes:

```json
{"version":1,"type":"set_mode","missionId":"flight-001","commandId":"cmd-001","timestamp":"2026-10-07T13:00:00Z","mode":"safe"}
```

Ground bridge relays a balloon response:

```json
{"version":1,"type":"command_ack","missionId":"flight-001","packetId":"ack-001","timestamp":"2026-10-07T13:00:01Z","commandId":"cmd-001","status":"executed","message":"Entered safe mode"}
```

Proposed modes: `init`, `nominal`, `photo`, `processing`, `transmission`, `low_power`, `safe`, `recovery`. Proposed ACK status: `accepted`, `executed`, `rejected`. A USB write is not an RF ACK. Commands are never sent on connect or retried automatically. The operator must enable the experimental control and enter the target mission. The outgoing command display is session-local; incoming ACKs are stored. This is not a durable command queue, RF authentication system, or mission-certified command system. Late ACKs outside the most recent 100 packets remain in the DB but may no longer appear in the live correlation view.

## Run it (no TypeScript knowledge needed)

Install Node.js 22 LTS or newer and Git. In a terminal at the repository root:

```sh
cd synapse
npm ci
npm run db:init
npm run dev
```

Open `http://localhost:3000`. Use desktop Chrome or Edge for serial reception. Web Serial needs localhost or HTTPS, a user-initiated port selection, and an available device. See the [Chrome Web Serial documentation](https://developer.chrome.com/docs/capabilities/serial).

Click **Load demo packets** first. You should see a DEMO telemetry record and a completed 2,028-tile image. The demo is saved with a new `demo-...` mission ID each time and can become the latest telemetry shown; it never claims to be live data. Do not run demos during operational acquisition. Afterward connect the ground ESP32 with matching bridge firmware.

No `.env` is needed for local use: database defaults to `file:local.db`. If using an existing database, keep its `TURSO_DATABASE_URL` and optional `TURSO_AUTH_TOKEN` in `synapse/.env`; the initializer creates missing legacy tables without deleting existing data. The new `received_packets` table and index initialize on first API use, also without dropping existing tables. It stores original validated JSON rather than flattening unknown OBC/Pi parameters.

The dev/start scripts bind to loopback because the existing manual-data APIs and new receiver API are for a local operator, not a public service. No user authentication is added here. Do not expose the app publicly without designing access control. The receiver POST checks same-origin requests. Map tiles still require internet; packet reception/storage does not require a remote server when using local SQLite.

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm start
```

## Where the TypeScript lives

- `lib/ground/protocol.ts`: the allowed message shapes, validation, packed-label decoder, reassembly, and serial line splitter. A TypeScript `type` describes a value to the editor/compiler; Zod also checks real incoming values at runtime.
- `lib/ground/serial.ts`: opens USB, reads split chunks into lines, writes commands, releases port locks on disconnect.
- `app/api/ground/route.ts`: HTTP doorway between browser and server. POST receives a packet; GET returns dashboard data.
- `lib/ground/store.ts`: saves packets and rebuilds images from stored fragments. Unique IDs make retries safe; transactions prevent contradictory fragment writes.
- `components/GroundStation.tsx`: buttons, telemetry display, images and logs. `.tsx` means TypeScript containing React UI markup.
- `components/Map.tsx`: keeps the existing manual map and adds GPS markers for classification images.
- `lib/ground/demo.ts`: synthetic sample data for testing without radio hardware.
- `tests/ground.test.ts`: automated packet/storage tests.

Zod validates messages. The browser supplies serial support, so there is no native `serialport` dependency to compile. Missing UI/map dependencies are now declared inside `synapse/package.json`, where this app actually runs. System font fallbacks remove the Google Fonts build-time network dependency.

## Hardware acceptance checklist

Before calling this an operational balloon link, supply the real flight/ground ESP32 firmware or its packet specification. Confirm RF framing, CRC, sequence resets, mission IDs, fragmentation/resends, class mapping/grid metadata, command IDs/ACK semantics, radio settings and serial baud. Then bench-test a known telemetry packet, a full image with a dropped/reordered/duplicate fragment, a disconnect/reconnect, a DB failure/resend and a confirmed mode command. Software tests alone do not verify radio range or the flight unit.
