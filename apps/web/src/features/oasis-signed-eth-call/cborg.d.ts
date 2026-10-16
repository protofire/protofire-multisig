// cborg ships types at types/cborg.d.ts, but its package.json "types" field points to a missing file
declare module 'cborg' {
  export function encode(value: unknown): Uint8Array
  export function decode(data: Uint8Array | ArrayBuffer): unknown
}
