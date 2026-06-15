import { readFileSync, statSync } from 'node:fs';

export function mediaResponse(path: string, contentType: string, range: string | null, cacheControl: string): Response {
  const size = statSync(path).size;
  const headers = { 'content-type': contentType, 'cache-control': cacheControl, 'x-content-type-options': 'nosniff', 'accept-ranges': 'bytes' };
  if (!range?.startsWith('bytes=')) return new Response(readFileSync(path), { headers: { ...headers, 'content-length': String(size) } });
  const [startText, endText] = range.slice(6).split('-');
  const start = Number(startText);
  const end = endText ? Math.min(Number(endText), size - 1) : Math.min(start + 2_000_000 - 1, size - 1);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= size) {
    return new Response(null, { status: 416, headers: { ...headers, 'content-range': `bytes */${size}` } });
  }
  const bytes = readFileSync(path).subarray(start, end + 1);
  return new Response(bytes, { status: 206, headers: { ...headers, 'content-length': String(bytes.length), 'content-range': `bytes ${start}-${end}/${size}` } });
}
