import { useColorScheme } from 'react-native';

// Renk ve yazı token'ları. Koyu tema: lacivert gece + camgöbeği ışık (parçacıklı onboarding ile aynı dil).
// Açık tema: beyaz-mavi su paleti.
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
    bg: '#0A131D',
    card: '#132130',
    cardAlt: '#1A2B3B',
    ink: '#F2F6FA',
    ink2: '#8C9DAF',
    ink3: '#56687A',
    accent: '#5AD3F0',
    accentInk: '#7FDDF5',
    onAccent: '#06202B',
    chip: '#15303F',
    chipInk: '#7FDDF5',
    success: '#5FD0A8',
    successInk: '#8BE3C4',
    successBg: '#123A30',
    divider: '#1B2B3A',
    track: '#1C2D3C',
    glass: 'rgba(90,211,240,0.08)',
    glassEdge: 'rgba(127,221,245,0.30)',
    water: '#2BA6CF',
    waterDeep: '#1A7FAE',
    waterTop: '#5AD3F0',
    tabBg: 'rgba(19,33,48,0.97)',
    overlay: 'rgba(0,0,0,0.55)',
    barMuted: '#22394C',
    barGoal: '#2FA58A',
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    statusBar: 'light-content',
  },
};

// Inter: sıkı, modern ve okunaklı (App.js'te yüklenir). Anahtar adları görsel ağırlığı anlatır;
// eski Nunito ağırlıklarına denk düşecek şekilde bir kademe hafif Inter kesimleri seçildi.
export const fonts = {
  medium: 'Inter_400Regular',
  semibold: 'Inter_500Medium',
  bold: 'Inter_500Medium',
  extrabold: 'Inter_600SemiBold',
  black: 'Inter_700Bold',
};

export const type = {
  display: { fontFamily: fonts.black, fontSize: 52, letterSpacing: -2 },
  title: { fontFamily: fonts.black, fontSize: 30, letterSpacing: -1 },
  heading: { fontFamily: fonts.black, fontSize: 22, letterSpacing: -0.5 },
  section: { fontFamily: fonts.black, fontSize: 16 },
  body: { fontFamily: fonts.bold, fontSize: 16 },
  bodyStrong: { fontFamily: fonts.extrabold, fontSize: 16 },
  label: { fontFamily: fonts.bold, fontSize: 13 },
  labelStrong: { fontFamily: fonts.extrabold, fontSize: 13 },
  caption: { fontFamily: fonts.extrabold, fontSize: 12 },
  // Büyük harf için textTransform değil upper() kullanılır: Türkçede i → İ olmalı
  overline: { fontFamily: fonts.extrabold, fontSize: 12, letterSpacing: 2.4 },
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
