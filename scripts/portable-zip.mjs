import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

// Precomputed CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

export function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const time =
    ((date.getHours() & 0x1f) << 11) |
    ((date.getMinutes() & 0x3f) << 5) |
    ((date.getSeconds() >> 1) & 0x1f);
  const d =
    (((date.getFullYear() - 1980) & 0x7f) << 9) |
    (((date.getMonth() + 1) & 0x0f) << 5) |
    (date.getDate() & 0x1f);
  return { time, date: d };
}

/**
 * Creates a zip file containing files from sourceDir or an explicit array of file entries.
 * entries: Array of { relativePath: string, buffer: Buffer }
 */
export function createZipBuffer(entries) {
  const localHeaders = [];
  const centralHeaders = [];
  let currentOffset = 0;

  const now = dosDateTime();

  for (const entry of entries) {
    const rawBuffer = entry.buffer;
    const nameBuffer = Buffer.from(entry.relativePath.replace(/\\/g, '/'), 'utf-8');
    const crc = crc32(rawBuffer);

    // Deflate
    let compressed = zlib.deflateRawSync(rawBuffer, { level: 9 });
    let method = 8;
    if (compressed.length >= rawBuffer.length) {
      compressed = rawBuffer;
      method = 0;
    }

    // Local header (30 bytes + name length)
    const localHeader = Buffer.alloc(30 + nameBuffer.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0, 6); // flags
    localHeader.writeUInt16LE(method, 8); // compression method
    localHeader.writeUInt16LE(now.time, 10);
    localHeader.writeUInt16LE(now.date, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(rawBuffer.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra field length
    nameBuffer.copy(localHeader, 30);

    localHeaders.push(localHeader, compressed);

    // Central directory header (46 bytes + name length)
    const centralHeader = Buffer.alloc(46 + nameBuffer.length);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(0, 8); // flags
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(now.time, 12);
    centralHeader.writeUInt16LE(now.date, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(rawBuffer.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra field length
    centralHeader.writeUInt16LE(0, 32); // comment length
    centralHeader.writeUInt16LE(0, 34); // disk num
    centralHeader.writeUInt16LE(0, 36); // internal attrs
    centralHeader.writeUInt32LE(0, 38); // external attrs
    centralHeader.writeUInt32LE(currentOffset, 42); // relative offset of local header
    nameBuffer.copy(centralHeader, 46);

    centralHeaders.push(centralHeader);

    currentOffset += localHeader.length + compressed.length;
  }

  const centralDirOffset = currentOffset;
  const centralDirSize = centralHeaders.reduce((sum, h) => sum + h.length, 0);

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirSize, 12);
  eocd.writeUInt32LE(centralDirOffset, 16);
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}

/**
 * Creates a zip archive from a directory.
 */
export function zipDirectory(sourceDir, zipPath) {
  const entries = [];
  function walk(dir, relPath = '') {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const fullPath = path.join(dir, f);
      const childRelPath = relPath ? `${relPath}/${f}` : f;
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath, childRelPath);
      } else if (stat.isFile()) {
        entries.push({
          relativePath: childRelPath,
          buffer: fs.readFileSync(fullPath),
        });
      }
    }
  }
  walk(sourceDir);
  const zipBuffer = createZipBuffer(entries);
  fs.writeFileSync(zipPath, zipBuffer);
  return zipBuffer.length;
}

/**
 * Extracts a zip file to targetDir.
 */
export function extractZip(zipPath, targetDir) {
  const buf = fs.readFileSync(zipPath);
  let eocdOffset = -1;
  // Search for EOCD signature from end of file
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    throw new Error('Invalid ZIP: End of Central Directory not found');
  }

  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  const cdOffset = buf.readUInt32LE(eocdOffset + 16);

  let p = cdOffset;
  const extractedFiles = [];

  for (let i = 0; i < totalEntries; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) {
      throw new Error(`Corrupt Central Directory record at offset ${p}`);
    }
    const compression = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const uncompressedSize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localHeaderOffset = buf.readUInt32LE(p + 42);

    const fileName = buf.toString('utf-8', p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;

    // Read local header
    if (buf.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
      throw new Error(`Corrupt local header at offset ${localHeaderOffset}`);
    }
    const localNameLen = buf.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
    const dataOffset = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const compressedData = buf.subarray(dataOffset, dataOffset + compressedSize);

    let fileData;
    if (compression === 0) {
      fileData = compressedData;
    } else if (compression === 8) {
      fileData = zlib.inflateRawSync(compressedData);
    } else {
      throw new Error(`Unsupported compression method ${compression} for ${fileName}`);
    }

    const outPath = path.join(targetDir, fileName);
    const outDir = path.dirname(outPath);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    fs.writeFileSync(outPath, fileData);
    extractedFiles.push(fileName);
  }

  return extractedFiles;
}
