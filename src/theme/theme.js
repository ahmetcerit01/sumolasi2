import { useColorScheme } from 'react-native';

// Tasarım maketindeki ("Su Molası Yeni Tasarım") renk ve yazı token'ları.
// Ekranlar renkleri doğrudan yazmaz; useTheme() üzerinden alır, böylece açık/koyu tema kendiliğinden çalışır.

export const palettes = {
  light: {
    bg: '#F6FAFD',
    card: '#FFFFFF',
    cardAlt: '#F2F7FB',
    ink: '#0F2233',
    ink2: '#5B6B7A',
    ink3: '#9DB0C0',
    accent: '#2B8FE8',
    accentInk: '#0B5CAD',
    onAccent: '#FFFFFF',
    chip: '#E3F0FB',
    chipInk: '#0B5CAD',
    success: '#2FA37A',
    successInk: '#1F7A57',
    successBg: '#E2F5EC',
    divider: '#EEF3F7',
    track: '#E8F0F7',
    glass: 'rgba(43,143,232,0.08)',
    glassEdge: 'rgba(43,143,232,0.22)',
    water: '#4FA9F0',
    waterDeep: '#2B8FE8',
    waterTop: '#7CC2F6',
    tabBg: 'rgba(255,255,255,0.96)',
    overlay: 'rgba(11,22,32,0.38)',
    barMuted: '#BFD9EE',
    barGoal: '#7FC7A8',
    shadowColor: '#0F2233',
    shadowOpacity: 0.06,
    statusBar: 'dark-content',
  },
  dark: {
    bg: '#0B1620',
    card: '#122230',
    cardAlt: '#18303F',
    ink: '#EAF3FA',
    ink2: '#9DB0C0',
    ink3: '#5E7488',
    accent: '#5AB2FF',
    accentInk: '#8CCBFF',
    onAccent: '#0B1620',
    chip: '#16324A',
    chipInk: '#8CCBFF',
    success: '#4CC79A',
    successInk: '#7EDDB8',
    successBg: '#123A2C',
    divider: '#1C3142',
    track: '#1A2E3E',
    glass: 'rgba(90,178,255,0.10)',
    glassEdge: 'rgba(140,203,255,0.28)',
    water: '#2E7FCB',
    waterDeep: '#1F64A8',
    waterTop: '#4F9EE6',
    tabBg: 'rgba(18,34,48,0.97)',
    overlay: 'rgba(0,0,0,0.5)',
    barMuted: '#24445E',
    barGoal: '#2F8E6C',
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    statusBar: 'light-content',
  },
};

// Nunito: SF Pro Rounded'a yakın, yumuşak ve okunaklı (App.js'te yüklenir)
export const fonts = {
  medium: 'Nunito_500Medium',
  semibold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  extrabold: 'Nunito_800ExtraBold',
  black: 'Nunito_900Black',
};

export const type = {
  display: { fontFamily: fonts.black, fontSize: 52, letterSpacing: -1.5 },
  title: { fontFamily: fonts.black, fontSize: 30, letterSpacing: -0.6 },
  heading: { fontFamily: fonts.black, fontSize: 22, letterSpacing: -0.3 },
  section: { fontFamily: fonts.black, fontSize: 16 },
  body: { fontFamily: fonts.bold, fontSize: 16 },
  bodyStrong: { fontFamily: fonts.extrabold, fontSize: 16 },
  label: { fontFamily: fonts.bold, fontSize: 13 },
  labelStrong: { fontFamily: fonts.extrabold, fontSize: 13 },
  caption: { fontFamily: fonts.extrabold, fontSize: 12 },
  overline: { fontFamily: fonts.extrabold, fontSize: 13, letterSpacing: 0.8, textTransform: 'uppercase' },
};

export const radius = { card: 22, cardLg: 24, tile: 20, pill: 999 };

export const cardShadow = (c) => ({
  shadowColor: c.shadowColor,
  shadowOpacity: c.shadowOpacity,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
});

export function useTheme() {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  return { c: dark ? palettes.dark : palettes.light, dark, fonts, type, radius };
}
