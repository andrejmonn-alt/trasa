// Небольшие SVG-иконки (inline, без внешних файлов)
const s = (d, extra = '') => `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
export const ICON = {
  bus: s('<rect x="4" y="3" width="16" height="15" rx="3"/><path d="M4 11h16M8 21v-3M16 21v-3"/><circle cx="8" cy="14.5" r=".6" fill="currentColor"/><circle cx="16" cy="14.5" r=".6" fill="currentColor"/>'),
  trolley: s('<path d="M9 1l3 4 3-4"/><rect x="4" y="5" width="16" height="13" rx="3"/><path d="M4 12h16M8 21v-3M16 21v-3"/>'),
  express: s('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'),
  intercity: s('<rect x="2" y="5" width="20" height="12" rx="3"/><path d="M2 11h20M6 20v-3M18 20v-3M7 8h3M14 8h3"/>'),
  train: s('<rect x="5" y="2" width="14" height="15" rx="4"/><path d="M5 10h14M8 21l2-4M16 21l-2-4"/><circle cx="9" cy="13.5" r=".6" fill="currentColor"/><circle cx="15" cy="13.5" r=".6" fill="currentColor"/>'),
  walk: s('<circle cx="13" cy="4" r="2"/><path d="M10 22l2-7 3 3v6M9 12l2-4 4 1 2 4M11 8l-2 6"/>'),
  route: s('<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H16a3.5 3.5 0 000-7H8a3.5 3.5 0 010-7h7.5"/>'),
  map: s('<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>'),
  clock: s('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M5 3L2 6M19 3l3 3"/>'),
  gear: s('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>'),
  pin: s('<path d="M12 21s-7-6.2-7-11.5A7 7 0 0112 2.5a7 7 0 017 7C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
  locate: s('<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
  swap: s('<path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3"/>'),
  bell: s('<path d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 003.4 0"/>'),
  search: s('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'),
  shield: s('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>'),
  chevron: s('<path d="M6 9l6 6 6-6"/>'),
  close: s('<path d="M18 6L6 18M6 6l12 12"/>'),
};
export const CAT_ICON = { bus: ICON.bus, trolley: ICON.trolley, express: ICON.express, intercity: ICON.intercity, train: ICON.train };
