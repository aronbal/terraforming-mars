/*
 * The handful of Lucide icons the mobile shell's chrome draws (lucide-static 0.460.0,
 * ISC licence), inlined so the shell carries no icon font or extra request.
 *
 * Only the chrome uses these. The board and the cards keep their own artwork.
 */

export type IconShape = {
  tag: 'path' | 'circle' | 'line' | 'polygon';
  attrs: Record<string, string>;
};

const path = (d: string): IconShape => ({tag: 'path', attrs: {d}});
const circle = (cx: string, cy: string, r: string): IconShape => ({tag: 'circle', attrs: {cx, cy, r}});
const line = (x1: string, y1: string, x2: string, y2: string): IconShape => ({tag: 'line', attrs: {x1, y1, x2, y2}});
const polygon = (points: string): IconShape => ({tag: 'polygon', attrs: {points}});

export const MOBILE_ICONS = {
  'award': [
    path('m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526'),
    circle('12', '8', '6'),
  ],
  'book-open': [
    path('M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z'),
    path('M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z'),
  ],
  'building-2': [
    path('M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z'),
    path('M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2'),
    path('M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2'),
    path('M10 6h4'),
    path('M10 10h4'),
    path('M10 14h4'),
    path('M10 18h4'),
  ],
  'check': [
    path('M20 6 9 17l-5-5'),
  ],
  'check-check': [
    path('M18 6 7 17l-5-5'),
    path('m22 10-7.5 7.5L13 16'),
  ],
  'coins': [
    circle('8', '8', '6'),
    path('M18.09 10.37A6 6 0 1 1 10.34 18'),
    path('M7 6h1v4'),
    path('m16.71 13.88.7.71-2.82 2.82'),
  ],
  'dices': [
    path('M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z'),
    path('M16 8h.01'),
    path('M8 8h.01'),
    path('M8 16h.01'),
    path('M16 16h.01'),
    path('M12 12h.01'),
  ],
  'ellipsis': [
    circle('12', '12', '1'),
    circle('19', '12', '1'),
    circle('5', '12', '1'),
  ],
  'external-link': [
    path('M15 3h6v6'),
    path('M10 14 21 3'),
    path('M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'),
  ],
  'globe': [
    circle('12', '12', '10'),
    path('M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20'),
    path('M2 12h20'),
  ],
  'hammer': [
    path('m15 12-8.373 8.373a1 1 0 1 1-3-3L12 9'),
    path('m18 15 4-4'),
    path('m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172V7l-2.26-2.26a6 6 0 0 0-4.202-1.756L9 2.96l.92.82A6.18 6.18 0 0 1 12 8.4V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5'),
  ],
  'handshake': [
    path('m11 17 2 2a1 1 0 1 0 3-3'),
    path('m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4'),
    path('m21 3 1 11h-2'),
    path('M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3'),
    path('M3 4h8'),
  ],
  'history': [
    path('M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8'),
    path('M3 3v5h5'),
    path('M12 7v5l4 2'),
  ],
  'info': [
    circle('12', '12', '10'),
    path('M12 16v-4'),
    path('M12 8h.01'),
  ],
  'landmark': [
    line('3', '22', '21', '22'),
    line('6', '18', '6', '11'),
    line('10', '18', '10', '11'),
    line('14', '18', '14', '11'),
    line('18', '18', '18', '11'),
    polygon('12 2 20 7 4 7'),
  ],
  'layers': [
    path('m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z'),
    path('m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65'),
    path('m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65'),
  ],
  'leaf': [
    path('M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z'),
    path('M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12'),
  ],
  'list': [
    path('M3 12h.01'),
    path('M3 18h.01'),
    path('M3 6h.01'),
    path('M8 12h13'),
    path('M8 18h13'),
    path('M8 6h13'),
  ],
  'message-circle': [
    path('M7.9 20A9 9 0 1 0 4 16.1L2 22Z'),
  ],
  'play': [
    polygon('6 3 20 12 6 21 6 3'),
  ],
  'plus': [
    path('M5 12h14'),
    path('M12 5v14'),
  ],
  'settings': [
    path('M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z'),
    circle('12', '12', '3'),
  ],
  'skip-forward': [
    polygon('5 4 15 12 5 20 5 4'),
    line('19', '5', '19', '19'),
  ],
  'sparkles': [
    path('M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z'),
    path('M20 3v4'),
    path('M22 5h-4'),
    path('M4 17v2'),
    path('M5 18H3'),
  ],
  'thermometer': [
    path('M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z'),
  ],
  'trophy': [
    path('M6 9H4.5a2.5 2.5 0 0 1 0-5H6'),
    path('M18 9h1.5a2.5 2.5 0 0 0 0-5H18'),
    path('M4 22h16'),
    path('M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22'),
    path('M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22'),
    path('M18 2H6v7a6 6 0 0 0 12 0V2Z'),
  ],
  'undo-2': [
    path('M9 14 4 9l5-5'),
    path('M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11'),
  ],
  'users': [
    path('M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2'),
    circle('9', '7', '4'),
    path('M22 21v-2a4 4 0 0 0-3-3.87'),
    path('M16 3.13a4 4 0 0 1 0 7.75'),
  ],
  'zap': [
    path('M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z'),
  ],
} as const satisfies Record<string, ReadonlyArray<IconShape>>;

export type MobileIconName = keyof typeof MOBILE_ICONS;
