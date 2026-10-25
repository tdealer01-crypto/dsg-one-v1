import { describe, expect, it } from 'vitest';
import { nativeDeviceSummary } from '@/lib/dsg/user-bound/native-device-summary';

const receipt = {
  ok: true, provider: 'dsg-desktop-native', action: 'device.remote.status', device_id: 'test-linux-device',
  execution: { ok: true, device: { device_id: 'test-linux-device', registry_bound: true,
    label: 'Linux test machine', hostname: 'linux-test', platform: 'Linux-test-x86_64', online: true } },
};

describe('Native device summary from the verified provider shape', () => {
  it('shows the actual reported machine instead of a fixed Android/Termux claim', () => {
    expect(nativeDeviceSummary(receipt)).toEqual({ deviceId: 'test-linux-device',
      label: 'Linux test machine', platform: 'Linux-test-x86_64', online: true });
    const android = { ...receipt, device_id: 'test-android-device', execution: { ok: true, device: {
      device_id: 'test-android-device', registry_bound: true, label: 'Android test machine', platform: 'Android-test', online: false,
    } } };
    expect(nativeDeviceSummary(android)?.label).toBe('Android test machine');
    expect(nativeDeviceSummary(android)?.online).toBe(false);
  });
  it('rejects a different provider, device substitution or missing registry binding', () => {
    for (const value of [null, {}, { ...receipt, provider: 'other' }, { ...receipt, device_id: 'other-device' },
      { ...receipt, execution: { ok: true, device: { ...receipt.execution.device, registry_bound: false } } },
      { ...receipt, action: 'device.shell.exec' }]) expect(nativeDeviceSummary(value)).toBeNull();
  });
  it('does not invent online status or a platform when the provider omits them', () => {
    const value = { ...receipt, execution: { ok: true, device: { device_id: 'test-linux-device', registry_bound: true } } };
    expect(nativeDeviceSummary(value)).toEqual({ deviceId: 'test-linux-device', label: 'test-linux-device', platform: null, online: null });
  });
});
