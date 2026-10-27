import { BleClient } from '@capacitor-community/bluetooth-le'

const SVC = '0000180d-0000-1000-8000-00805f9b34fb', CH = '00002a37-0000-1000-8000-00805f9b34fb'
export const hrZone = (bpm: number, max = 190) => { const p = bpm / max; return p < 0.6 ? 1 : p < 0.7 ? 2 : p < 0.8 ? 3 : p < 0.9 ? 4 : 5 }

/** Connects to any standard Bluetooth heart-rate strap or watch in "broadcast HR" mode. */
export async function connectHr(onBpm: (b: number) => void, onLost: () => void) {
  await BleClient.initialize({ androidNeverForLocation: true })
  const dev = await BleClient.requestDevice({ services: [SVC] })
  await BleClient.connect(dev.deviceId, () => onLost())
  await BleClient.startNotifications(dev.deviceId, SVC, CH, v => onBpm(v.getUint8(0) & 1 ? v.getUint16(1, true) : v.getUint8(1)))
  return { stop: () => { BleClient.stopNotifications(dev.deviceId, SVC, CH).catch(() => {}); BleClient.disconnect(dev.deviceId).catch(() => {}) } }
}
