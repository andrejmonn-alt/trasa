// Минимальный ZIP-ридер без зависимостей.
// Распаковка через встроенный DecompressionStream('deflate-raw')
// (есть в Android WebView/Chrome 103+ и в Node 18+).

export function listZip(buf) {
  const u8 = new Uint8Array(buf);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  // ищем End Of Central Directory с конца
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Это не ZIP-файл (нет EOCD)');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const entries = {};
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('Битый central directory');
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const usize = dv.getUint32(p + 24, true);
    const nlen = dv.getUint16(p + 28, true);
    const xlen = dv.getUint16(p + 30, true);
    const clen = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    let name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
    const base = name.split('/').pop().toLowerCase();
    entries[base] = { name, method, csize, usize, lho };
    p += 46 + nlen + xlen + clen;
  }
  return { u8, dv, entries };
}

function entryData(zip, e) {
  const { dv, u8 } = zip;
  if (dv.getUint32(e.lho, true) !== 0x04034b50) throw new Error('Битый local header');
  const nlen = dv.getUint16(e.lho + 26, true);
  const xlen = dv.getUint16(e.lho + 28, true);
  const start = e.lho + 30 + nlen + xlen;
  return u8.subarray(start, start + e.csize);
}

// Возвращает ReadableStream строк-кусков (текст) для файла внутри ZIP
export function textStream(zip, fileName) {
  const e = zip.entries[fileName.toLowerCase()];
  if (!e) return null;
  const data = entryData(zip, e);
  let byteStream = new Blob([data]).stream();
  if (e.method === 8) byteStream = byteStream.pipeThrough(new DecompressionStream('deflate-raw'));
  else if (e.method !== 0) throw new Error('Неподдерживаемое сжатие: ' + e.method);
  return byteStream.pipeThrough(new TextDecoderStream('utf-8'));
}

export function hasFile(zip, fileName) {
  return !!zip.entries[fileName.toLowerCase()];
}
