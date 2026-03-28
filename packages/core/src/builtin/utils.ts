import { assert } from "../internal";
import { Buffer } from "buffer";

export const getUTF8String = (buffer: Buffer): { parsedStr: string, newBuffer: Buffer } => {
  let bytesRead = buffer.length;
  let parsedStr = buffer.toString('utf8');

  while (Buffer.byteLength(parsedStr, 'utf8') !== bytesRead) {
    parsedStr = buffer.toString('utf8', 0, --bytesRead);
  }

  return { parsedStr, newBuffer: buffer.slice(bytesRead) };
}

export const removeEndSubstring = (str: string, end: string) => (
  str.endsWith(end) ? str.slice(0, -end.length) : str
);

export const clamp = (n: number, min: number, max: number): number => {
  assert(min <= max);
  return Math.min(max, Math.max(min, n));
}

export const nthIndexOf = (mainStr: string, subStr: string, n: number) => {
  let i = -1;

  if (n === 0) {
    return 0;
  }

  while(n-- && i++ < mainStr.length) {
      i = mainStr.indexOf(subStr, i);
      if (i < 0) break;
  }

  return i;
}
