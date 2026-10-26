// Browser/Node port of dsg_spacetime.goal_first_laplacian.verify_evidence.
//
// Recomputes a goal-first-cycle-laplacian-v1 evidence payload from its own
// target with exact BigInt rationals and checks every field plus the SHA-256.
// No server, network call, or float arithmetic is involved.
//
// Truth boundary: sha256 is an integrity checksum, not a signature. VALID
// means "self-consistent and recomputable", not "produced by a trusted party".

export const ALGORITHM = 'goal-first-cycle-laplacian-v1';
export const N = 12;
const MAX_VALUE_CHARS = 1000;
const RATIONAL = /^[+-]?([0-9]+(\.[0-9]+)?|[0-9]+\/[0-9]+)$/;

class TargetError extends Error {}

// ---- exact rationals: { n: BigInt, d: BigInt > 0 }, always reduced ----
const abs = (x) => (x < 0n ? -x : x);
function gcd(a, b) { a = abs(a); b = abs(b); while (b) [a, b] = [b, a % b]; return a; }
function frac(n, d = 1n) {
  if (d === 0n) throw new TargetError('zero denominator');
  if (d < 0n) { n = -n; d = -d; }
  const g = gcd(n, d) || 1n;
  return { n: n / g, d: d / g };
}
const ZERO = frac(0n);
const add = (a, b) => frac(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a, b) => frac(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a, b) => frac(a.n * b.n, a.d * b.d);
const div = (a, b) => frac(a.n * b.d, a.d * b.n);
const isZero = (a) => a.n === 0n;
const fstr = (a) => (a.d === 1n ? `${a.n}` : `${a.n}/${a.d}`);

function parseRational(value, index) {
  if (typeof value === 'boolean') throw new TargetError(`target[${index}]: use an int or a rational string, not bool`);
  if (typeof value === 'number') {
    // JSON cannot tell 1 from 1.0 in JS; only exact safe integers are accepted.
    if (!Number.isSafeInteger(value)) throw new TargetError(`target[${index}]: use an int or a rational string, not float`);
    return frac(BigInt(value));
  }
  if (typeof value !== 'string') throw new TargetError(`target[${index}]: unsupported type`);
  const text = value.trim();
  if (text.length > MAX_VALUE_CHARS) throw new TargetError(`target[${index}]: value longer than ${MAX_VALUE_CHARS} characters`);
  if (!RATIONAL.test(text)) throw new TargetError(`target[${index}]: ${JSON.stringify(value)} is not an exact rational`);
  if (text.includes('/')) {
    const [num, den] = text.split('/');
    if (BigInt(den) === 0n) throw new TargetError(`target[${index}]: zero denominator in ${JSON.stringify(value)}`);
    return frac(BigInt(num), BigInt(den));
  }
  const neg = text.startsWith('-');
  const [whole, dec = ''] = text.replace(/^[+-]/, '').split('.');
  const r = frac(BigInt(whole + dec), 10n ** BigInt(dec.length));
  return neg ? frac(-r.n, r.d) : r;
}

function parseTarget(values) {
  if (!Array.isArray(values)) throw new TargetError(`target must be a list of ${N} values`);
  if (values.length !== N) throw new TargetError(`target must have exactly ${N} values, got ${values.length}`);
  return values.map(parseRational);
}

function cycleLaplacian(n) {
  const L = Array.from({ length: n }, () => Array(n).fill(ZERO));
  for (let i = 0; i < n; i++) {
    L[i][i] = frac(2n);
    L[i][(i - 1 + n) % n] = frac(-1n);
    L[i][(i + 1) % n] = frac(-1n);
  }
  return L;
}

const matvec = (A, x) => A.map((row) => row.reduce((s, a, j) => add(s, mul(a, x[j])), ZERO));

// Same deterministic Gaussian elimination as the Python module (first valid pivot).
function solveExactWithZeroMean(L, b) {
  const n = L.length;
  if (!isZero(b.reduce(add, ZERO))) throw new Error('INFEASIBLE: Laplacian source must sum to zero');
  const A = L.map((row, i) => [...row, b[i]]);
  A[n - 1] = [...Array(n).fill(frac(1n)), ZERO];
  for (let col = 0; col < n; col++) {
    let pivot = -1;
    for (let r = col; r < n; r++) if (!isZero(A[r][col])) { pivot = r; break; }
    if (pivot < 0) throw new Error(`INFEASIBLE: no pivot in column ${col}`);
    if (pivot !== col) [A[col], A[pivot]] = [A[pivot], A[col]];
    const p = A[col][col];
    A[col] = A[col].map((v) => div(v, p));
    for (let r = 0; r < n; r++) {
      if (r === col || isZero(A[r][col])) continue;
      const f = A[r][col];
      A[r] = A[r].map((v, c) => sub(v, mul(f, A[col][c])));
    }
  }
  return A.map((row) => row[n]);
}

export function runGoalFirst(values) {
  const target = parseTarget(values);
  const L = cycleLaplacian(N);
  const requiredAction = matvec(L, target);
  const reconstructed = solveExactWithZeroMean(L, requiredAction);
  const residual = matvec(L, reconstructed).map((v, i) => sub(v, requiredAction[i]));
  const goalError = reconstructed.map((v, i) => sub(v, target[i]));
  return {
    algorithm: ALGORITHM,
    n: N,
    target: target.map(fstr),
    required_action: requiredAction.map(fstr),
    reconstructed: reconstructed.map(fstr),
    source_sum: fstr(requiredAction.reduce(add, ZERO)),
    residual: residual.map(fstr),
    goal_error: goalError.map(fstr),
    status: [...residual, ...goalError].every(isZero) ? 'PASS' : 'FAIL',
  };
}

// Python json.dumps(sort_keys=True, separators=(",", ":"), ensure_ascii=False)
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export async function sha256Hex(text) {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function canonicalSha256(evidence) {
  const { sha256, ...payload } = evidence;
  return sha256Hex(canonicalJson(payload));
}

export async function verifyEvidence(evidence) {
  const failures = [];
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    return { valid: false, failures: ['evidence must be an object'] };
  }
  if (evidence.sha256 !== (await canonicalSha256(evidence))) failures.push('sha256 does not match payload');
  let expected;
  try {
    expected = runGoalFirst(evidence.target);
  } catch (e) {
    failures.push(`target invalid: ${e.message}`);
    return { valid: false, failures };
  }
  for (const [key, value] of Object.entries(expected)) {
    if (canonicalJson(evidence[key]) !== canonicalJson(value)) failures.push(`field '${key}' does not match recomputation`);
  }
  const extra = Object.keys(evidence).filter((k) => k !== 'sha256' && !(k in expected)).sort();
  if (extra.length) failures.push(`unexpected fields: [${extra.map((k) => `'${k}'`).join(', ')}]`);
  return { valid: failures.length === 0, failures };
}
