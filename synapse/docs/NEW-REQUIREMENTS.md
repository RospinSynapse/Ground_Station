# Spreadsheet and ground-station design update

Sources: `Moduri operationale.xlsx`, Sheet1; `GS_Design.pdf`, pages 1–2; original `SYNAPSE Detailed Design Document V1.pdf`. None of these files supplies the exact RF frame, SIM modem protocol, or TinyGS payload schema. The normalized packets below are an application contract, not native hardware output.

## What changed

| Source | Requirement | Implementation |
| --- | --- | --- |
| GS_Design pp. 1–2 | Main LoRa + GSM GPS + separate TinyGS path | Distinct source IDs, source-aware packet deduplication, latest GPS fix per source, map markers and independent normalized serial inputs for backup adapters. |
| GS_Design p. 2 diagram | TinyGS has its own app and receiver board | Link to the separate TinyGS dashboard; no replacement of its firmware or invented subscription credentials. |
| Sheet1 B44, B55 | Interior temperature and current minima/maxima | `interiorTemperatureExtremaC` and `currentExtremaA`, validated min <= max, shown in telemetry. |
| Sheet1 B58, rows 22–23 | Info and critical logs | `system_log` packet with severity, subsystem, code and message; separate visible event list. |
| Sheet1 F14, C43 | GPS + single label, or an array of labels; 2,961/~3,000 entries | `classification_point` for individual GPS-tagged tiles; `totalSegments` for packed arrays. Legacy packets without a size still use the earlier DDD's 2,028. |
| Sheet1 rows 68–183 | Nominal, photo, processing, transmission, safe, recovery | Mode display and optional command choices; separate flight phase. Full reference activity table imported from the workbook. |
| Sheet1 rows 12–23 | Phase-dependent SD and TX rates | Read-only source reference. No ground-side sensor sampling or autonomous transition is claimed. |
| Sheet1 D42 | Request packet heading, contents blank | Proposed `request_data` command for telemetry/classification/status/critical_logs, explicitly pending firmware agreement. |
| Sheet1 rows 18–19 | IMU and separate accelerometers | Optional magnetic field vector (`magneticFieldUt`) and up to two `accelerometersMps2`; counts/units remain adapter contract decisions. |

## Conflicts kept explicit

The spreadsheet itself contains different planning stages. Its phase table has per-sensor transmission intervals, but B42 proposes a 10-minute info packet. Nominal/photo/processing tables list LoRa OFF; transmission mode turns it ON. Safe mode lists LoRa OFF (B163), while B59 mentions a brief ON transition message. Recovery mode specifies a 30-minute GPS transmission (B173/B183), distinct from the landed phase row's 60-second GPS rate (G16). The application displays packet timestamps and mode/phase independently and does not infer a single radio heartbeat timeout from these conflicting plans.

F14 says 2,961 GPS/label packets; C43 says approximately 3,000 labels per photo, up to five photos; the DDD says 2,028. `totalSegments` is per image and must be supplied by the payload adapter for a nonlegacy image. The receiver's 16,384-segment limit is an implementation resource bound, not a documented image count. Separate photos must have separate `imageId` values.

The referenced Google Doc in F14 was not needed to read the supplied spreadsheet and has not been treated as an additional protocol specification. Supply its content if it defines the final payload format.

The roughly 3 km GSM availability in the design is a project assumption, not a guaranteed coverage boundary. The app does not discard valid GSM fixes based on altitude.

## Packet additions to the proposed USB contract

All received packets retain `version`, `missionId`, `packetId`, `timestamp` and `type`. Add optional `source`: `main_lora`, `gsm`, `tinygs`, or `wired`. Omitted source means `main_lora` for backward compatibility. A backup GPS packet must explicitly use `gsm` or `tinygs`.

Source IDs identify the adapter path. They are metadata, not cryptographic authentication. A packet ID is now unique within **source + mission**; one receiver cannot accidentally suppress another receiver's packet with the same ID. Existing `flight_packets` rows are copied idempotently to `received_packets` as `main_lora`, without deleting the old table.

### Telemetry extras (optional for compatibility)

```json
{
  "interiorTemperatureExtremaC": [{"min":17,"max":19},{"min":19,"max":21}],
  "currentExtremaA": {"min":0.6,"max":1.1},
  "accelerometersMps2": [{"x":0,"y":0,"z":9.81}]
}
```

Merge these fields into a complete telemetry packet; this fragment alone is not a valid packet. The interior extrema array must align by sensor index and length with `interiorTemperaturesC`. Legacy averages/readings are retained separately. Null extrema indicate unavailable data. No extrema are calculated from sparse received samples.

### Backup GPS

```json
{"version":1,"source":"gsm","missionId":"flight-001","packetId":"fix-1","timestamp":"2026-10-07T14:00:00Z","type":"gps_backup","gps":{"latitude":44.43,"longitude":26.1,"altitudeM":1200},"sender":"backup-module","rawMessage":"optional original message"}
```

Use `source: "tinygs"` for an equivalent decoded TinyGS observation. The optional `sender` and `rawMessage` retain source context. Actual modem SMS/AT output and TinyGS MQTT payloads must be transformed by a matching adapter; this app does not pretend those raw protocols are JSON. No SIM model, SMS format, TinyGS credentials/topic or received payload example was supplied, so native modem polling/MQTT subscription has not been implemented.

A bridge may emit these packets through a serial port into the corresponding **Connect adapter** button. For testing/replay, import a `.json` array or `.jsonl` (one JSON object per line) using the dashboard. Imports are limited to 1 MiB/1,000 packets. All records are validated before import starts; network errors can still leave a partial import. Reimporting identical IDs is safe. Import is not an automatic online feed.

TinyGS's [official configuration guide](https://github.com/tinygs/tinyGS/wiki/Ground-Station-configuration) describes its own Wi-Fi/web panel and project MQTT configuration. Leave the dedicated TinyGS receiver running that firmware. The documents do not establish a supported data export API for your particular setup; provide a real sample/export endpoint before integrating that feed automatically.

### GPS + one classification label

```json
{"version":1,"source":"main_lora","missionId":"flight-001","packetId":"tile-0","timestamp":"2026-10-07T14:00:00Z","type":"classification_point","imageId":"image-a","segmentIndex":0,"totalSegments":2961,"classId":4,"gps":{"latitude":44.43,"longitude":26.1,"altitudeM":28000}}
```

Different segments can have different GPS coordinates. Repeated identical segments do not inflate completion. Conflicting labels/GPS or image size are rejected. All points are stored; the map shows the latest 200, with progress for the latest 20 point images. Do not mix point and packed-grid representations under the same source/mission/image ID.

For an array fragment, add `totalSegments: 2961` or `3000` to the existing `classification` type. Fragment boundaries and grid columns are checked against that image's total rather than a global constant. Omit `columns` until the real arrangement is known. Class IDs remain 0–9; numeric mapping to names is still missing.

### Critical log and reported state

```json
{"version":1,"source":"main_lora","missionId":"flight-001","packetId":"event-1","timestamp":"2026-10-07T14:00:00Z","type":"system_log","severity":"critical","subsystem":"IMU","code":"TIMEOUT","message":"No sensor response"}
```

```json
{"version":1,"source":"main_lora","missionId":"flight-001","packetId":"state-1","timestamp":"2026-10-07T14:00:00Z","type":"state","mode":"processing","flightPhase":"descent","reason":"Payload inference started"}
```

Phases: ground/ascent/float/descent/landed. Supported command/state modes: init/nominal/photo/processing/transmission/low_power/safe/recovery. The additional modes come from multiple source documents; actual wire opcodes remain undefined. Mode changes and phase detection are the OBC's job. The UI never infers actual execution from pressing Send.

### Request data (proposal, because D42 is blank)

```json
{"version":1,"type":"request_data","missionId":"flight-001","commandId":"request-1","timestamp":"2026-10-07T14:00:00Z","target":"telemetry"}
```

Other proposed targets: classification/status/critical_logs. These use the same acknowledgement contract as mode commands. Preview mode disables sending all commands; normal mode requires explicit operator enablement and a connected main serial link.

## Remaining hardware inputs

To implement native receivers, supply the exact SIM module and example received SMS/serial output, the TinyGS board/firmware version plus an authorized data export sample/interface, and the main ESP32 packet encoder/decoder. RF frequency/modulation/CRC, class mapping and final per-image counts also need confirmation. The current implementation can be exercised entirely with the included normalized demo packets.
