const P: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5V21H3z M9 21v-6h6v6',
  users: 'M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1 M9 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M22 19v-1a4 4 0 0 0-3-3.9 M16 3.1a3.5 3.5 0 0 1 0 6.8',
  check: 'M4 12.5 9.5 18 20 6',
  calendar: 'M4 6h16v15H4z M4 10h16 M9 3v4 M15 3v4',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  flask: 'M9 3h6 M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3',
  video: 'M3 6h12v12H3z M15 10l6-3v10l-6-3',
  plug: 'M9 2v6 M15 2v6 M6 8h12v4a6 6 0 0 1-12 0z M12 18v4',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  doc: 'M6 2h8l5 5v15H6z M14 2v5h5 M9 13h7 M9 17h7',
  sheet: 'M5 3h14v18H5z M5 9h14 M5 15h14 M11 3v18',
  slides: 'M3 4h18v12H3z M12 16v4 M8 20h8',
  folder: 'M3 6h6l2 2h10v12H3z',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  page: 'M5 3h14v18H5z M9 8h6 M9 12h6 M9 16h3',
  arrow: 'M7 17 17 7 M8 7h9v9',
  book: 'M4 4h7a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H4z M20 4h-4a2 2 0 0 0-2 2',
  map: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z M9 3v15 M15 6v15',
  inbox: 'M3 13h5l1.5 3h5L16 13h5 M5 5h14l2 8v6H3v-6z',
  plus: 'M12 5v14 M5 12h14',
  trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 14h10l1-14',
  out: 'M15 4h4v16h-4 M10 16l-4-4 4-4 M6 12h10',
};

export function Icon({ name, size = 16 }: { name: keyof typeof P | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name] ?? P.link} />
    </svg>
  );
}
