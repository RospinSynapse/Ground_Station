import { type FlightPacket } from './protocol';
export function demoPackets(): FlightPacket[] {
  const missionId = `demo-${crypto.randomUUID()}`;
  const timestamp = new Date().toISOString();
  const base = { version: 1 as const, missionId, timestamp, source: 'main_lora' as const };
  const gps = { latitude: 44.4323, longitude: 26.1074, altitudeM: 28000 };
  const packets: FlightPacket[] = [{ ...base, packetId: 'telemetry-1', type: 'telemetry', averagingWindowSeconds: 600,
    exteriorTemperatureC: -45, interiorTemperaturesC: [18, 20], interiorTemperatureExtremaC: [{min: 17, max: 19}, {min: 19, max: 21}], currentExtremaA: {min: 0.6, max: 1.1}, lightLux: 85000, pressureHpa: 16, currentA: 0.8,
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
  packets.push(
    { ...base, type: 'gps_backup', source: 'gsm', packetId: 'gsm-fix-1', gps: { ...gps, latitude: 44.435, altitudeM: 1200 }, sender: 'DEMO-SIM', rawMessage: 'Synthetic normalized GPS message' },
    { ...base, type: 'gps_backup', source: 'tinygs', packetId: 'tinygs-fix-1', gps: { ...gps, longitude: 26.12 }, sender: 'DEMO-TINYGS' },
    { ...base, type: 'system_log', packetId: 'log-1', severity: 'critical', subsystem: 'DEMO sensor', code: 'DEMO_TIMEOUT', message: 'Synthetic critical event; no real failure.' },
    { ...base, type: 'state', packetId: 'state-1', mode: 'transmission', flightPhase: 'descent', reason: 'Demo: transmitting the processing buffer' },
    { ...base, type: 'classification_point', packetId: 'point-1', imageId: 'point-image-2961', segmentIndex: 0, totalSegments: 2961, classId: 4, gps: { ...gps, latitude: 44.44 } },
  );
  return packets;
}
