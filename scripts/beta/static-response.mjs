import {gzip as compress} from 'node:zlib';
import {promisify} from 'node:util';

const gzip = promisify(compress);

function acceptedEncodings(header) {
  const weights = new Map();
  for (const entry of (header ?? '').split(',')) {
    const [token, ...parameters] = entry.trim().toLowerCase().split(';');
    const name = token.trim();
    if (!name) continue;
    let weight = parameters.length > 1 ? 0 : 1;
    if (parameters.length > 1) { weights.set(name, 0); continue; }
    for (const parameter of parameters) {
      const match = /^\s*q\s*=\s*(0(?:\.\d{0,3})?|1(?:\.0{0,3})?)\s*$/.exec(parameter);
      // Malformed or unknown parameters do not make an encoding acceptable.
      if (!match) { weight = 0; break; }
      weight = Number(match[1]);
    }
    weights.set(name, Math.min(weights.get(name) ?? 1, weight));
  }
  const wildcard = weights.get('*');
  return {
    gzip: weights.get('gzip') ?? wildcard ?? 0,
    identity: weights.get('identity') ?? (wildcard === 0 ? 0 : 1),
  };
}

/** Only public script/style bytes reach this helper. API, HTML and PDF responses
 * stay outside it. Keep no-store and avoid a second in-memory asset cache. */
export async function staticResponse(bytes, acceptEncoding) {
  const weights = acceptedEncodings(acceptEncoding);
  const headers = {Vary: 'Accept-Encoding'};
  if (weights.gzip > 0 && weights.gzip >= weights.identity && (bytes.length >= 1024 || weights.identity === 0)) {
    try {
      const encoded = await gzip(bytes);
      if (encoded.length < bytes.length || weights.identity === 0) {
        return {status: 200, headers: {...headers, 'Content-Encoding': 'gzip', 'Content-Length': encoded.length}, body: encoded};
      }
    } catch {
      // Do not mislabel raw bytes as gzip or turn an encoding failure into 404.
      if (weights.identity === 0) return {status: 500, headers: {...headers, 'Content-Length': 0}, body: undefined};
    }
  }
  if (weights.identity > 0) {
    return {status: 200, headers: {...headers, 'Content-Length': bytes.length}, body: bytes};
  }
  return {status: 406, headers: {...headers, 'Content-Length': 0}, body: undefined};
}
