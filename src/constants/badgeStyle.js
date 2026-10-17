// Rozet başına renk (maketteki gibi her rozetin kendi tonu). Kilitli rozetler gri.
const TINTS = {
  first_sip: '#2B8FE8',
  sunrise: '#D98A12',
  moon: '#5A4FCF',
  overflow_glass: '#1F7A57',
  calendar5: '#138C8C',
  sparkling: '#2A9DC4',
  calendar7: '#0B5CAD',
  medal_bronze: '#B4692E',
  medal_silver: '#6F8196',
  medal_gold: '#C9940A',
};

const LIGHTEN = {
  '#2B8FE8': '#7CC2F6', '#D98A12': '#F3B95B', '#5A4FCF': '#A39CF2', '#1F7A57': '#6FD0A7', '#138C8C': '#5CCFCF',
  '#2A9DC4': '#79D3F2', '#0B5CAD': '#6FB0F0', '#B4692E': '#E0A16B', '#6F8196': '#AFC0D2', '#C9940A': '#F2C94C',
};

export function badgeTint(id, dark = false) {
  const base = TINTS[id] || '#2B8FE8';
  return dark
    ? { fg: LIGHTEN[base] || base, bg: `${base}33` }
    : { fg: base, bg: `${base}1F` };
}

export const lockedTint = (dark = false) => (dark ? { fg: '#5E7488', bg: '#18303F' } : { fg: '#9DB0C0', bg: '#EEF3F7' });
