import { z } from 'zod';

// Proposed USB bridge contract v1, NOT a byte layout specified by the DDD.
export const SEGMENTS = 2028; // Legacy DDD default only.
export const MAX_SEGMENTS = 16384; // Receiver bound, not a mission requirement.
export const SOURCES = ['main_lora', 'gsm', 'tinygs', 'wired'] as const;
export type PacketSource = typeof SOURCES[number];
export const SOURCE_NAMES: Record<PacketSource, string> = { main_lora: 'Main LoRa', gsm: 'GSM backup', tinygs: 'TinyGS backup', wired: 'Ground wired' };
export const MODES = ['init', 'nominal', 'photo', 'processing', 'transmission', 'low_power', 'safe', 'recovery'] as const;
export const PHASES = ['ground', 'ascent', 'float', 'descent', 'landed'] as const;
export class InvalidPacket extends Error {}
export const MAX_LINE = 32768;
const id = z.string().regex(/^[A-Za-z0-9_.:-]{1,80}$/);
const number = z.number().finite();
const gps = z.object({ latitude: number.min(-90).max(90), longitude: number.min(-180).max(180), altitudeM: number.nullable() }).strict();
const vector = z.object({ x: number, y: number, z: number }).strict();
const parameters = z.record(z.string().max(64), z.union([number, z.string().max(128), z.boolean(), z.null()])).refine(v => Object.keys(v).length <= 32, 'At most 32 internal parameters');
const extrema = z.object({ min: number, max: number }).strict().refine(v => v.min <= v.max, 'Minimum exceeds maximum');
const base = {
  source: z.enum(SOURCES).optional(),
  version: z.literal(1), missionId: id, packetId: id,
  timestamp: z.iso.datetime(),
  radio: z.object({ rssiDbm: number, snrDb: number }).strict().optional(),
};
export const packetSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('telemetry'),
    // Null means unavailable; zero is a real measurement.
    averagingWindowSeconds: z.number().int().positive().max(86400),
    exteriorTemperatureC: number.nullable(), interiorTemperaturesC: z.array(number.nullable()).max(16),
    interiorTemperatureExtremaC: z.array(extrema.nullable()).max(16).optional(),
    currentExtremaA: extrema.nullable().optional(),
    accelerometersMps2: z.array(vector.nullable()).max(2).optional(),
    lightLux: number.nonnegative().nullable(), pressureHpa: number.nonnegative().nullable(), currentA: number.nullable(),
    gps: gps.nullable(),
    imu: z.object({ accelerationMps2: vector.nullable(), angularVelocityDps: vector.nullable(), magneticFieldUt: vector.nullable().optional() }).strict().nullable(),
    obc: z.object({ mode: z.string().min(1).max(32), flightPhase: z.string().min(1).max(32), batteryVoltageV: number.nonnegative().nullable(), parameters }).strict(),
    raspberryPi: z.object({ parameters }).strict(),
  }).strict(),
  z.object({ ...base, type: z.literal('classification'), imageId: id, gps,
    totalSegments: z.number().int().min(1).max(MAX_SEGMENTS).optional(),
    // A fragment carries packed class IDs, high nibble first. Maximum 128 labels.
    segmentOffset: z.number().int().min(0).max(MAX_SEGMENTS - 1),
    segmentCount: z.number().int().min(1).max(128),
    labelsHex: z.string().regex(/^[0-9a-fA-F]+$/).max(128),
    // Optional until the payload team confirms the tile arrangement.
    columns: z.number().int().min(1).max(MAX_SEGMENTS).optional(),
  }).strict(),
  z.object({ ...base, type: z.literal('classification_point'), imageId: id,
    segmentIndex: z.number().int().min(0).max(MAX_SEGMENTS - 1),
    totalSegments: z.number().int().min(1).max(MAX_SEGMENTS), gps,
    classId: z.number().int().min(0).max(9),
  }).strict(),
  z.object({ ...base, type: z.literal('gps_backup'), gps,
    sender: z.string().max(80).optional(), rawMessage: z.string().max(2048).optional(),
  }).strict(),
  z.object({ ...base, type: z.literal('system_log'), severity: z.enum(['info', 'warning', 'critical']),
    subsystem: z.string().min(1).max(64), code: z.string().min(1).max(64), message: z.string().min(1).max(2048),
  }).strict(),
  z.object({ ...base, type: z.literal('state'), mode: z.enum(MODES), flightPhase: z.enum(PHASES), reason: z.string().max(256),
  }).strict(),
  z.object({ ...base, type: z.literal('command_ack'), commandId: id,
    status: z.enum(['accepted', 'executed', 'rejected']), message: z.string().max(256),
  }).strict(),
]);
export type FlightPacket = z.infer<typeof packetSchema>;
export type ClassificationPacket = Extract<FlightPacket, { type: 'classification' }>;
export type TelemetryPacket = Extract<FlightPacket, { type: 'telemetry' }>;
const commandBase = { version: z.literal(1), missionId: id, commandId: id, timestamp: z.iso.datetime() };
export const commandSchema = z.discriminatedUnion('type', [
  z.object({ ...commandBase, type: z.literal('set_mode'), mode: z.enum(MODES) }).strict(),
  z.object({ ...commandBase, type: z.literal('request_data'), target: z.enum(['telemetry', 'classification', 'status', 'critical_logs']) }).strict(),
]);

export function unpackLabels(hex: string, count: number): number[] {
  if (hex.length !== Math.ceil(count / 2) * 2 || !/^[0-9a-fA-F]+$/.test(hex)) throw new InvalidPacket('Invalid packed label length');
  const labels = [...hex].map(c => parseInt(c, 16));
  if (labels.slice(0, count).some(n => n > 9)) throw new InvalidPacket('Class IDs must be 0..9');
  if (count % 2 && labels[count] !== 0) throw new InvalidPacket('Odd fragments require a zero padding nibble');
  return labels.slice(0, count);
}
export function parsePacket(value: unknown): FlightPacket {
  const packet = packetSchema.parse(value);
  if (packet.type === 'gps_backup' && !['gsm', 'tinygs'].includes(packet.source ?? '')) throw new InvalidPacket('Backup GPS requires gsm or tinygs source');
  if (packet.type === 'classification_point' && packet.segmentIndex >= packet.totalSegments) throw new InvalidPacket('Segment index exceeds image bounds');
  if (packet.type === 'telemetry' && packet.interiorTemperatureExtremaC && packet.interiorTemperatureExtremaC.length !== packet.interiorTemperaturesC.length) throw new InvalidPacket('Interior extrema and temperature arrays must identify the same sensors');
  if (packet.type === 'classification') {
    const total = packet.totalSegments ?? SEGMENTS;
    if (packet.segmentOffset + packet.segmentCount > total) throw new InvalidPacket('Fragment exceeds image bounds');
    if (packet.columns && total % packet.columns !== 0) throw new InvalidPacket('Columns must divide totalSegments');
    unpackLabels(packet.labelsHex, packet.segmentCount);
    packet.labelsHex = packet.labelsHex.toLowerCase();
  }
  return packet;
}
export function assembleImage(chunks: ClassificationPacket[]) {
  const first = chunks[0];
  const total = first?.totalSegments ?? SEGMENTS;
  const labels: (number | null)[] = Array(total).fill(null);
  for (const chunk of chunks) {
    if (chunk.missionId !== first.missionId || chunk.imageId !== first.imageId ||
        JSON.stringify(chunk.gps) !== JSON.stringify(first.gps) || chunk.columns !== first.columns || (chunk.totalSegments ?? SEGMENTS) !== total)
      throw new InvalidPacket('Conflicting image metadata');
    unpackLabels(chunk.labelsHex, chunk.segmentCount).forEach((label, i) => {
      const offset = chunk.segmentOffset + i;
      if (labels[offset] !== null && labels[offset] !== label) throw new InvalidPacket('Conflicting overlapping image fragments');
      labels[offset] = label;
    });
  }
  const received = labels.filter(n => n !== null).length;
  return { labels, received, totalSegments: total, complete: received === total };
}

// Serial reads can split a line anywhere, or deliver several lines together.
export class LineDecoder {
  private pending = '';
  private discarding = false;
  push(text: string): { lines: string[]; errors: string[] } {
    const lines: string[] = [], errors: string[] = [];
    for (const character of text) {
      if (character === '\n') {
        if (!this.discarding && this.pending.trim()) lines.push(this.pending.trim());
        this.pending = ''; this.discarding = false;
      } else if (!this.discarding) {
        this.pending += character;
        if (this.pending.length > MAX_LINE) {
          this.pending = ''; this.discarding = true; errors.push('Serial line too long; discarded');
        }
      }
    }
    return { lines, errors };
  }
}
