import { z } from 'zod';

// Proposed USB bridge contract v1, NOT a byte layout specified by the DDD.
export const SEGMENTS = 2028;
export const MAX_LINE = 32768;
const id = z.string().regex(/^[A-Za-z0-9_.:-]{1,80}$/);
const number = z.number().finite();
const gps = z.object({ latitude: number.min(-90).max(90), longitude: number.min(-180).max(180), altitudeM: number.nullable() }).strict();
const vector = z.object({ x: number, y: number, z: number }).strict();
const parameters = z.record(z.string().max(64), z.union([number, z.string().max(128), z.boolean(), z.null()])).refine(v => Object.keys(v).length <= 32, 'At most 32 internal parameters');
const base = {
  version: z.literal(1), missionId: id, packetId: id,
  timestamp: z.iso.datetime(),
  radio: z.object({ rssiDbm: number, snrDb: number }).strict().optional(),
};
export const packetSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('telemetry'),
    // Null means unavailable; zero is a real measurement.
    averagingWindowSeconds: z.number().int().positive().max(86400),
    exteriorTemperatureC: number.nullable(), interiorTemperaturesC: z.array(number.nullable()).max(16),
    lightLux: number.nonnegative().nullable(), pressureHpa: number.nonnegative().nullable(), currentA: number.nullable(),
    gps: gps.nullable(),
    imu: z.object({ accelerationMps2: vector.nullable(), angularVelocityDps: vector.nullable() }).strict().nullable(),
    obc: z.object({ mode: z.string().min(1).max(32), flightPhase: z.string().min(1).max(32), batteryVoltageV: number.nonnegative().nullable(), parameters }).strict(),
    raspberryPi: z.object({ parameters }).strict(),
  }).strict(),
  z.object({ ...base, type: z.literal('classification'), imageId: id, gps,
    // A fragment carries packed class IDs, high nibble first. Maximum 128 labels.
    segmentOffset: z.number().int().min(0).max(SEGMENTS - 1),
    segmentCount: z.number().int().min(1).max(128),
    labelsHex: z.string().regex(/^[0-9a-fA-F]+$/).max(128),
    // Optional until the payload team confirms the tile arrangement.
    columns: z.number().int().min(1).max(SEGMENTS).optional(),
  }).strict(),
  z.object({ ...base, type: z.literal('command_ack'), commandId: id,
    status: z.enum(['accepted', 'executed', 'rejected']), message: z.string().max(256),
  }).strict(),
]);
export type FlightPacket = z.infer<typeof packetSchema>;
export type ClassificationPacket = Extract<FlightPacket, { type: 'classification' }>;
export type TelemetryPacket = Extract<FlightPacket, { type: 'telemetry' }>;
export const commandSchema = z.object({ version: z.literal(1), type: z.literal('set_mode'), missionId: id, commandId: id, timestamp: z.iso.datetime(), mode: z.enum(['init', 'nominal', 'low_power', 'safe', 'recovery']) }).strict();

export function unpackLabels(hex: string, count: number): number[] {
  if (hex.length !== Math.ceil(count / 2) * 2 || !/^[0-9a-fA-F]+$/.test(hex)) throw new Error('Invalid packed label length');
  const labels = [...hex].map(c => parseInt(c, 16));
  if (labels.slice(0, count).some(n => n > 9)) throw new Error('Class IDs must be 0..9');
  if (count % 2 && labels[count] !== 0) throw new Error('Odd fragments require a zero padding nibble');
  return labels.slice(0, count);
}
export function parsePacket(value: unknown): FlightPacket {
  const packet = packetSchema.parse(value);
  if (packet.type === 'classification') {
    if (packet.segmentOffset + packet.segmentCount > SEGMENTS) throw new Error('Fragment exceeds image bounds');
    if (packet.columns && SEGMENTS % packet.columns !== 0) throw new Error('Columns must divide 2028');
    unpackLabels(packet.labelsHex, packet.segmentCount);
    packet.labelsHex = packet.labelsHex.toLowerCase();
  }
  return packet;
}
export function assembleImage(chunks: ClassificationPacket[]) {
  const labels: (number | null)[] = Array(SEGMENTS).fill(null);
  const first = chunks[0];
  for (const chunk of chunks) {
    if (chunk.missionId !== first.missionId || chunk.imageId !== first.imageId ||
        JSON.stringify(chunk.gps) !== JSON.stringify(first.gps) || chunk.columns !== first.columns)
      throw new Error('Conflicting image metadata');
    unpackLabels(chunk.labelsHex, chunk.segmentCount).forEach((label, i) => {
      const offset = chunk.segmentOffset + i;
      if (labels[offset] !== null && labels[offset] !== label) throw new Error('Conflicting overlapping image fragments');
      labels[offset] = label;
    });
  }
  const received = labels.filter(n => n !== null).length;
  return { labels, received, complete: received === SEGMENTS };
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
