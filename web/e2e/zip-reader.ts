export type ZipEntry = { name: string; flags: number; data: Buffer };

/** Minimal reader for stored ZIPs: walks the central directory. */
export function readZip(z: Buffer): ZipEntry[] {
  const eocd = z.length - 22;
  if (z.readUInt32LE(eocd) !== 0x06054b50) throw new Error('no EOCD');
  const count = z.readUInt16LE(eocd + 10);
  let p = z.readUInt32LE(eocd + 16);
  const out: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (z.readUInt32LE(p) !== 0x02014b50) throw new Error('bad central entry');
    if (z.readUInt16LE(p + 10) !== 0) throw new Error('not stored');
    const size = z.readUInt32LE(p + 20);
    const nl = z.readUInt16LE(p + 28);
    const off = z.readUInt32LE(p + 42);
    const start =
      off + 30 + z.readUInt16LE(off + 26) + z.readUInt16LE(off + 28);
    out.push({
      name: z.toString('utf8', p + 46, p + 46 + nl),
      flags: z.readUInt16LE(p + 8),
      data: z.subarray(start, start + size),
    });
    p += 46 + nl + z.readUInt16LE(p + 30) + z.readUInt16LE(p + 32);
  }
  return out;
}
