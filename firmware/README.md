# Wireless balloon link

This folder supplies a matched reference pair for an **ESP32 + SX1276/SX1278** radio bridge. It is not compatible with arbitrary existing balloon firmware or SX1262/Heltec V3 boards without adapting the radio driver. The exact boards used by SYNAPSE have not been supplied. Do not replace an existing flight controller with this firmware: the flight build is a communications bridge, not the OBC's sensor/control application.

## What connects to what

Balloon side: **OBC UART → onboard bridge ESP32 → LoRa radio/antenna**.

Ground side: **LoRa radio/antenna → ground ESP32 → Wi-Fi → laptop running SYNAPSE**.

The balloon carries its own power source. The ground receiver also needs power, from a battery or local USB supply. USB is needed initially to flash a board; it is not a cable between the balloon and ground. An optional USB data cable between the laptop and ground receiver continues to work locally.

The flight bridge uses a short internal 3.3 V UART connection to the OBC: OBC TX to bridge RX, OBC RX to bridge TX, common ground. Set pins and baud to match the actual hardware. The bridge's UART is not a 5 V tolerant interface. If the OBC already owns the LoRa radio, integrate the framing/driver into that firmware instead of adding a competing SPI owner. Its source is needed to do that integration here.

## Configure both bridges

1. Install PlatformIO, either its VS Code extension or `python -m pip install platformio`.
2. Copy `include/config.example.h` to `include/config.h`. The real config is ignored by Git.
3. Check the actual radio model and all SPI/reset/DIO0 pins. The sample pin numbers are a **Heltec V2-style starting profile**, not verified wiring for your boards. `esp32dev` selects a generic ESP32 compile target; adjust the board target if necessary.
4. Agree and set frequency, bandwidth, spreading factor, coding rate, sync word and TX power on both ends. Values in the example are proposed bench settings, not recovered from flight firmware. Both ends enable LoRa hardware CRC. DIO0 must be connected for asynchronous transmit completion.
5. Set `GATEWAY_AP_PASSWORD` to your chosen Wi-Fi password (8+ characters) and `GATEWAY_ACCESS_TOKEN` to your chosen application token (16+ characters). Keep both out of Git.
6. Set `FLIGHT_MISSION_ID` and the internal OBC UART pins/baud. Every telemetry packet and command must use that same mission ID.
7. Set `RADIO_CONFIGURED` to `true` only after checking the settings against the actual boards. The committed configuration intentionally does not transmit as-is.

Build and upload from this `firmware` folder:

```sh
python -m platformio run -e ground
python -m platformio run -e ground -t upload --upload-port COM5
python -m platformio run -e flight_bridge
python -m platformio run -e flight_bridge -t upload --upload-port COM6
```

Replace COM5/COM6 with the actual ports. On Linux those are commonly `/dev/ttyUSB...`; select the ports your computer reports. The two commands flash two separate boards, not both roles onto one board. Leave the dedicated TinyGS board running TinyGS; this pair is for the **main LoRa path**.

## Connect the app

1. Power the configured ground receiver. Its serial startup output reports the AP IP and any radio initialization failure.
2. Connect the laptop to the receiver's `SYNAPSE-Ground` Wi-Fi network using your configured password. This is the **local ground connection**; Wi-Fi is not expected to reach the balloon.
3. Run the SYNAPSE app locally. Choose **Wi-Fi** under Ground receiver connection.
4. Enter `ws://192.168.4.1:81/` (or the IP actually reported by the receiver), enter the configured gateway token, and click **Connect ground receiver**.
5. The UI reports gateway authentication, radio initialization, count of complete received RF messages and last RSSI separately. Radio initialization and Wi-Fi connection do not establish that the balloon is in range.
6. Valid balloon JSON packets appear in **Pachete**, the detailed receive log and relevant telemetry/map panels.

Use the app over localhost HTTP with this local `ws://` gateway. An HTTPS-hosted app may block unencrypted WebSockets; it would require a TLS-capable gateway/proxy. Allow local-network access if the browser asks. The dedicated AP has no internet uplink, so externally hosted map tiles may not load. Packet reception and local database storage do not require internet.

## OBC interface

The bridge accepts one UTF-8 JSON line from the OBC at a time, followed by LF. These are the packet types already documented in `synapse/docs/NEW-REQUIREMENTS.md` and `BALLOON-LINK.md`. Required envelope fields are `version: 1`, `missionId`, `packetId`, `timestamp`, `type`; the browser applies full field validation. Maximum encoded message length is **4,096 bytes**. Keep classification fragments small; do not send all labels in one oversized JSON message.

UART responses from bridge to OBC:

- `{"type":"bridge_status","state":"queued"}`: accepted for local RF transmission.
- `{"type":"bridge_status","state":"sent"}`: all frames transmitted, not confirmation of ground reception.
- `{"type":"bridge_status","state":"busy"}`: not queued; retain the packet and submit after the pending transmission finishes.
- `{"type":"bridge_status","state":"error","message":"Radio transmit timeout"}`: transmission failed locally.

Only one outgoing message is buffered. The OBC must wait for `sent` or handle `busy`; there is no hidden unbounded queue. Invalid envelopes are rejected and reported on the debug serial port. Persist flight data on the OBC SD card as described in the project design.

Received uplink `set_mode` and `request_data` JSON commands are forwarded to the OBC UART only for the configured mission. The bridge does **not** execute them or fabricate an `executed` acknowledgement. The actual OBC must validate, authorize and deduplicate command IDs, apply the operation and emit a `command_ack` packet with the real outcome. That part cannot be integrated until the flight controller code is supplied.

## Radio frame specification

This is a newly implemented matched protocol, not an existing SYNAPSE wire specification. Both ends must run this framing or implement it exactly. Integer fields are little-endian.

| Byte offset | Length | Field |
| --- | --- | --- |
| 0 | 2 | ASCII `SY` |
| 2 | 1 | Protocol version 1 |
| 3 | 1 | Direction: 0 downlink, 1 uplink |
| 4 | 4 | Random boot session ID |
| 8 | 4 | Message sequence ID |
| 12 | 2 | Total JSON byte length, 1–4096 |
| 14 | 1 | Zero-based fragment index |
| 15 | 1 | Fragment count |
| 16 | 4 | IEEE CRC32 of the full message |
| 20 | 1–200 | Fragment bytes |

A radio frame is at most 220 bytes. Reassembly accepts reordered fragments, rejects malformed sizes/CRC failures and ignores identical repeats. One incomplete message per direction is held for at most 180 seconds; an interleaved different message replaces it. The sender emits all fragments consecutively. There is no RF automatic repeat request or delivery guarantee in this reference implementation. Missing fragments prevent the incomplete message from reaching the application.

The radio is half-duplex. Schedule command windows with the OBC; simultaneous downlink/uplink can collide. JSON framing is for interoperable first integration, not the compact payload budget in the DDD. At high spreading factors, airtime can be substantial. The configurable frame gap is not automatic regulatory duty-cycle control. Radio settings, airtime, link budget and antenna setup still require mission-specific bench/range testing.

The gateway authenticates local Wi-Fi clients with the configured token. The RF CRC detects corruption, not spoofing; this reference wire protocol does not provide RF encryption, cryptographic command authentication or replay protection. Those must be added at the OBC/protocol level before treating it as a flight-qualified command channel.

## Bench acceptance

- Confirm the selected radio initializes on both boards using the actual pin profile.
- Feed one real telemetry JSON line from the OBC UART. Confirm it appears in Pachete with the original packet ID and mission.
- Send enough classification fragments to complete an image, then intentionally omit one fragment and verify no false completion.
- Send an explicit request command. Check it arrives on the onboard UART and only an actual OBC response is shown as accepted/executed.
- Test Wi-Fi loss, radio loss, restart, busy handling and retained SD data.
- Remove programming USB from the flight side, power it independently and repeat the reception test.

Native framing tests can run without radio hardware:

```sh
g++ -std=c++17 -Wall -Wextra -Werror -Iinclude test/frames.cpp -o frames-test
./frames-test
```

The source APIs used are [Arduino-LoRa](https://github.com/sandeepmistry/arduino-LoRa/blob/master/API.md) and [arduinoWebSockets](https://github.com/Links2004/arduinoWebSockets). The exact PlatformIO/library versions are pinned in `platformio.ini`.
