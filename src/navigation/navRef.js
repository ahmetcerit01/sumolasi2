import { createNavigationContainerRef } from '@react-navigation/native';

// Ekran dışından (bildirim yanıtı vb.) gezinmek için
export const navRef = createNavigationContainerRef();

export const navigateWhenReady = (name, params) => {
  if (navRef.isReady()) {
    navRef.navigate(name, params);
    return;
  }
  // Uygulama bildirimle soğuk açıldıysa gezinme hazır olana kadar bekle
  const t = setInterval(() => {
    if (navRef.isReady()) {
      clearInterval(t);
      navRef.navigate(name, params);
    }
  }, 100);
  setTimeout(() => clearInterval(t), 5000);
};
