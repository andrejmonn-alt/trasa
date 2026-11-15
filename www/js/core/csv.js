// Потоковый CSV-парсер (RFC 4180: кавычки, "" внутри кавычек, CRLF).
// onRow(rowArray, headerIndexMap) вызывается для каждой строки данных.

export async function parseCsvStream(stream, onRow, onProgress) {
  const reader = stream.getReader();
  let header = null, idx = null;
  let field = '', row = [], inQ = false, pendingQuote = false;
  let rows = 0, chars = 0;

  const endRow = () => {
    row.push(field); field = '';
    if (!header) {
      header = row.map(h => h.replace(/^﻿/, '').trim());
      idx = {}; header.forEach((h, i) => { idx[h] = i; });
    } else if (!(row.length === 1 && row[0] === '')) {
      onRow(row, idx); rows++;
    }
    row = [];
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const s = value; chars += s.length;
    let i = 0; const n = s.length;
    while (i < n) {
      const ch = s.charCodeAt(i);
      if (pendingQuote) { // предыдущий кусок кончился на " внутри кавычек
        pendingQuote = false;
        if (ch === 34) { field += '"'; i++; continue; }
        inQ = false; // это была закрывающая кавычка
        continue;
      }
      if (inQ) {
        if (ch === 34) {
          if (i + 1 >= n) { pendingQuote = true; i++; continue; }
          if (s.charCodeAt(i + 1) === 34) { field += '"'; i += 2; continue; }
          inQ = false; i++; continue;
        }
        // быстрый проход до следующей кавычки
        let j = s.indexOf('"', i);
        if (j < 0) j = n;
        field += s.slice(i, j); i = j; continue;
      }
      if (ch === 44) { row.push(field); field = ''; i++; continue; }      // ,
      if (ch === 10) { endRow(); i++; continue; }                         // \n
      if (ch === 13) { i++; continue; }                                   // \r
      if (ch === 34 && field === '') { inQ = true; i++; continue; }
      // быстрый проход до разделителя
      let j = i;
      while (j < n) { const c = s.charCodeAt(j); if (c === 44 || c === 10 || c === 13) break; j++; }
      field += s.slice(i, j); i = j;
    }
    if (onProgress) onProgress(chars);
  }
  if (pendingQuote) inQ = false;
  if (field !== '' || row.length) endRow();
  return rows;
}

export function parseTime(t) { // "25:10:00" -> секунды от начала служебных суток
  if (!t) return -1;
  let h = 0, m = 0, sec = 0, part = 0, any = false;
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i);
    if (c >= 48 && c <= 57) { any = true; const d = c - 48; if (part === 0) h = h * 10 + d; else if (part === 1) m = m * 10 + d; else sec = sec * 10 + d; }
    else if (c === 58) part++;
  }
  if (!any || part < 1) return -1;
  return h * 3600 + m * 60 + sec;
}
