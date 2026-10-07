import { type FlightPacket } from './protocol';
export function demoPackets(): FlightPacket[] {
  const missionId = `demo-${crypto.randomUUID()}`;
  const timestamp = new Date().toISOString();
  const base = { version: 1 as const, missionId, timestamp };
  const gps = { latitude: 44.4323, longitude: 26.1074, altitudeM: 28000 };
  const packets: FlightPacket[] = [{ ...base, packetId: 'telemetry-1', type: 'telemetry', averagingWindowSeconds: 600,
    exteriorTemperatureC: -45, interiorTemperaturesC: [18, 20], lightLux: 85000, pressureHpa: 16, currentA: 0.8,
    gps, imu: { accelerationMps2: { x: 0.1, y: 0, z: 9.8 }, angularVelocityDps: null },
    obc: { mode: 'nominal', flightPhase: 'float', batteryVoltageV: 15.2, parameters: { uptimeSeconds: 7200 } },
    raspberryPi: { parameters: { cpuTemperatureC: 48 } },
  }];
  for (let offset = 0; offset < 2028; offset += 128) {
    const count = Math.min(128, 2028 - offset);
    const labels = Array.from({ length: count }, (_, i) => Math.floor((offset + i) / 52) % 10).map(n => n.toString(16)).join('');
    packets.push({ ...base, type: 'classification', packetId: `image-1-${offset}`, imageId: 'image-1', gps, columns: 52,
      segmentOffset: offset, segmentCount: count, labelsHex: labels + (count % 2 ? '0' : '') });
  }
  return packets;
}
