import { asRecord } from './workroom-contract';

export type NativeDeviceSummary = {
  deviceId: string;
  label: string;
  platform: string | null;
  online: boolean | null;
};

// Display only a bound Native status receipt; never infer a device from old copy.
export function nativeDeviceSummary(value: unknown): NativeDeviceSummary | null {
  const result = asRecord(value);
  const execution = asRecord(result?.execution);
  const device = asRecord(execution?.device);
  if (result?.ok !== true || result.provider !== 'dsg-desktop-native' ||
      result.action !== 'device.remote.status' || execution?.ok !== true ||
      !device || device.registry_bound !== true || typeof device.device_id !== 'string' ||
      !device.device_id || result.device_id !== device.device_id) return null;
  return {
    deviceId: device.device_id,
    label: typeof device.label === 'string' && device.label.trim()
      ? device.label : typeof device.hostname === 'string' && device.hostname.trim() ? device.hostname : device.device_id,
    platform: typeof device.platform === 'string' && device.platform ? device.platform : null,
    online: typeof device.online === 'boolean' ? device.online : null,
  };
}
