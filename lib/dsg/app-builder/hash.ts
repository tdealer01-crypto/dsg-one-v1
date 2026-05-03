import { createHash } from 'crypto';
import { appBuilderCanonical } from './canonical';

export function hashAppBuilderObject(value: unknown): string {
  return createHash('sha256').update(appBuilderCanonical(value)).digest('hex');
}
