import { i18n } from '../i18n';

// Binlik ayırıcı: Türkçede nokta (1.450), İngilizcede virgül (1,450)
export const fmtNumber = (n) => {
  const v = Math.round(Number(n) || 0);
  const sep = i18n.locale === 'tr' ? '.' : ',';
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
};

export const fmtMl = (n) => `${fmtNumber(n)} ${i18n.t('units.ml')}`;

// Litre, tek ondalık: Türkçede virgül (2,2 L)
export const fmtLiters = (ml) => {
  const v = (Number(ml) || 0) / 1000;
  const s = v.toFixed(v >= 10 ? 0 : 1);
  return `${i18n.locale === 'tr' ? s.replace('.', ',') : s} ${i18n.t('units.liter')}`;
};

export const fmtPercent = (pct) => i18n.t('home.percent', { pct: Math.round(pct) });

const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
export const fmtTime = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

// "Cumartesi, 17 Ekim" / "Saturday, October 17"
export const fmtLongDate = (date = new Date()) => {
  const day = i18n.t(`days.long.${date.getDay()}`);
  const month = i18n.t(`months.${date.getMonth()}`);
  return i18n.locale === 'tr' ? `${day}, ${date.getDate()} ${month}` : `${day}, ${month} ${date.getDate()}`;
};

// Dile uygun büyük harf (Türkçe: i → İ, ı → I)
export const upper = (str) => String(str ?? '').toLocaleUpperCase(i18n.locale === 'tr' ? 'tr-TR' : 'en-US');
