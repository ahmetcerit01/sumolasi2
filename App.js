import React, { useEffect, useMemo, useState, createContext } from 'react';
import 'react-native-gesture-handler';
import { View, Platform, AppState, DeviceEventEmitter, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { I18n } from 'i18n-js';

// Navigasyon ve Ekranlar
import BottomTabs from './src/navigation/BottomTabs';
import OnboardWizard from './src/screens/OnboardWizard';

// Yeni Splash Bileşeni
import AnimatedSplash from './src/components/AnimatedSplash';

// Yardımcılar
import { performRolloverIfNeeded } from './src/utils/rollover';
import { useHydrationStore } from './src/storage/useHydrationStore';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// --------------------
// i18n (Çoklu Dil) - Basit kurulum
// Not: Şimdilik çevirileri burada tuttuk. İstersen sonra src/i18n/ altına ayırırız.
// --------------------
const translations = {
  tr: {
    app: { name: 'Su Molası' },
    common: { ok: 'Tamam', cancel: 'İptal', next: 'DEVAM ET', done: 'TAMAMLA' },
    settings: {
      language: 'Dil',
      english: 'English',
      turkish: 'Turkce',
      notifications: 'Bildirimler',
      soundFx: 'Ses Efektleri',
    },
    profile: {
      userTitle: 'Su Savascisi',
      editInfo: 'Bilgileri Duzenle',
      dailyGoal: 'Gunluk Hedef',
      recommended: 'Onerilen',
      updateGoal: 'Hedefi Guncelle',
    },
    home: {
  today: 'Bugun',
  goodMorning: 'Gunaydin',
  goodDay: 'Iyi gunler',
  goodEvening: 'Iyi Aksamlar',
  ready: 'Su molasi vermeye hazir misin?',
  dailyGoal: 'Gunluk Hedef',
  quickAdd: 'Hizli Ekle',
  custom: 'Ozel',
  tipOfDay: 'Gunun Ipucu',
  streakDone: '%{days} Gunluk Seri!',
  streakHint: 'Seri baslatmak icin hedefini tamamla',
},
quickAdd: {
  cup: 'Bardak',
  espresso: 'Fincan',
  bottle: 'Sise',
},
    menu: {
      history: 'Gecmis',
      reminders: 'Hatirlatici',
      badges: 'Rozetler',
      profile: 'Profil',
    },
    tabs: {
      home: 'Ana Sayfa',
      history: 'Gecmis',
      reminders: 'Hatirlaticilar',
      badges: 'Rozetler',
      profile: 'Profil',
    },
dev: {
  title: 'Gelistrici',
  reset: 'Sifirla',
  delete: 'Sil',
},
modal: {
  enterAmount: 'Miktar Girin',
  placeholderAmount: 'Orn: 150',
  add: 'Ekle',
},
    alert: {
      error: 'Hata',
      validAmount: 'Lutfen gecerli bir miktar girin.',
    },
    history: {
      title: 'Gecmis Raporu',
      subtitle: 'Son 7 gunun su tuketim analizi',
      weekTotal: 'Bu Hafta Toplam',
      dailyPerformance: 'Gunluk Performans',
      goalLabel: 'Hedef (%{goal}ml)',
      dailyAvg: 'Gunluk Ort.',
      bestDay: 'En Iyi (%{ml}ml)',
      noData: 'Veri Yok',
      goalMet: 'Hedef Tutuldu',
      belowGoal: 'Hedef Altinda',
      dayLabel: '%{day} Gunu',
    },
    reminders: {
  title: 'Hatirlaticilar',
  intervalTitle: 'Bildirim Araligi',
  profileTimesInfo: 'Bu saatler profil ayarlarindan (uyanma/uyuma) otomatik alinir.',
  frequencyTitle: 'Bildirim Sikligi',
  everyXHours: '%{hours} sa',
  previewTitle: 'Ornek Gunluk Plan',
  wake: 'Uyanis',
  sleep: 'Uyku',
  disabledInline: 'Hatirlatici kapali.',
  save: 'Kaydet',

  testPanel: 'Test Paneli',
  test1m: '1 Dk Test',
  onboard: 'Onboard',
  cancelAll: 'Hepsini Iptal Et',

  savedTitle: 'Kaydedildi',
  disabledMsg: 'Hatirlaticilar kapatildi.',
  greatTitle: 'Harika!',
  goalAlreadyDone: 'Bugunku hedefini zaten tamamladin.',
  noTimeLeftToday: 'Bugun icin planlanacak saat kalmadi. Yarin sabah baslayacak.',
  scheduledCount: '%{count} hatirlatici planlandi.',
  errorTitle: 'Hata',
  scheduleFailed: 'Planlama yapilamadi.',
  plannedTitle: 'Planlandi',
  testInOneMinuteMsg: '1 dk sonra bildirim gelecek.',
  clearedTitle: 'Temizlendi',
},
    badges: {
      title: 'Koleksiyon',
      subtitle: 'Basarilarini tamamla, rozetleri kap!',
      levelLabel: 'Rozet Seviyesi',
      motivationComplete: 'Efsanesin! 🏆',
      motivationProgress: 'Yolun basindasin, devam et!',
      earned: 'Kazanildi',
      locked: 'KILITLI',
      congrats: 'TEBRIKLER!',
      newBadge: 'Yeni bir rozet kazandin',
      awesome: 'Harika!',
      items: {
        first_sip: {
          title: 'Ilk Yudum',
          description: 'Su molasi yolculugunun ilk adimi.',
          howToEarn: 'Uygulamada ilk kez su ekle.',
        },
        sunrise: {
          title: 'Gune Erken Baslayan',
          description: 'Gune erken bir yudumla baslamak harika bir aliskanlik.',
          howToEarn: 'Sabah 09:00dan once su ekle.',
        },
        moon: {
          title: 'Gece Bekcisi',
          description: 'Gece de hidrasyonu unutmayanlara.',
          howToEarn: 'Gece 23:00 veya sonrasinda su ekle.',
        },
        overflow_glass: {
          title: 'Hedef Ustasi',
          description: 'Hedefin cok ustune ciktin!',
          howToEarn: 'Gunluk hedefinin en az %150sine ulas.',
        },
        calendar5: {
          title: 'Bilincli Tuketici',
          description: 'Istikrarli bir baslangic.',
          howToEarn: 'Ard arda 5 gun boyunca gunluk hedefini tamamla.',
        },
        sparkling: {
          title: 'Serinleten',
          description: 'Bugun bardak bardak ictin!',
          howToEarn: 'Bir gunde en az 10 kez su ekle (10 bardak).',
        },
        calendar7: {
          title: 'Disiplinli',
          description: 'Bir haftalik tam disiplin.',
          howToEarn: 'Ard arda 7 gun boyunca gunluk hedefini tamamla.',
        },
        medal_bronze: {
          title: 'Bronz Sampiyon',
          description: 'Istikrar meyvelerini veriyor.',
          howToEarn: 'Ard arda 10 gun boyunca gunluk hedefini tamamla.',
        },
        medal_silver: {
          title: 'Gumus Sampiyon',
          description: 'Aliskanlik kazanildi, devam!',
          howToEarn: 'Ard arda 20 gun boyunca gunluk hedefini tamamla.',
        },
        medal_gold: {
          title: 'Altin Sampiyon',
          description: 'Ust duzey istikrar.',
          howToEarn: 'Ard arda 30 gun boyunca gunluk hedefini tamamla.',
        },
      },
    },
    onboard: {
      loading: {
        bmi: 'Vucut kitle indeksin analiz ediliyor...',
        water: 'Gunluk su ihtiyacin hesaplanuyor...',
        plan: 'Sana ozel plan hazirlaniyor...',
      },
      gender: {
        title: 'Cinsiyetini Sec',
        subtitle: 'Sana en uygun su ihtiyacini hesaplayabilmemiz icin gerekli.',
        male: 'Erkek',
        female: 'Kadin',
      },
      weight: {
        title: 'Kilon Kac?',
        subtitle: 'Kilo, su ihtiyacini belirleyen en onemli faktordur.',
      },
      height: {
        title: 'Boyun Kac?',
        subtitle: 'Boy uzunlugu metabolizma hizini etkiler.',
      },
      wake: {
        title: 'Kacta Uyanirsin?',
        subtitle: 'Gune ne zaman basladigini bilmeliyiz.',
      },
      sleep: {
        title: 'Kacta Uyursun?',
        subtitle: 'Seni uykunda rahatsiz etmemek icin onemli.',
      },
    },
  },
  en: {
    app: { name: 'Water Break' },
    common: { ok: 'OK', cancel: 'Cancel', next: 'NEXT', done: 'FINISH' },
    settings: {
      language: 'Language',
      english: 'English',
      turkish: 'Turkish',
      notifications: 'Notifications',
      soundFx: 'Sound Effects',
    },
    profile: {
      userTitle: 'Water Warrior',
      editInfo: 'Edit Info',
      dailyGoal: 'Daily Goal',
      recommended: 'Recommended',
      updateGoal: 'Update Goal',
    },
    home: {
  today: 'Today',
  goodMorning: 'Good morning',
  goodDay: 'Good day',
  goodEvening: 'Good evening',
  ready: 'Ready for a water break?',
  dailyGoal: 'Daily Goal',
  quickAdd: 'Quick Add',
  custom: 'Custom',
  tipOfDay: 'Tip of the Day',
  streakDone: '%{days}-day streak!',
  streakHint: 'Complete your goal to start a streak',
},
quickAdd: {
  cup: 'Cup',
  espresso: 'Cup',
  bottle: 'Bottle',
},
    menu: {
      history: 'History',
      reminders: 'Reminders',
      badges: 'Badges',
      profile: 'Profile',
    },
    tabs: {
      home: 'Home',
      history: 'History',
      reminders: 'Reminders',
      badges: 'Badges',
      profile: 'Profile',
    },
dev: {
  title: 'Developer',
  reset: 'Reset',
  delete: 'Delete',
},
modal: {
  enterAmount: 'Enter amount',
  placeholderAmount: 'e.g., 150',
  add: 'Add',
},
    alert: {
      error: 'Error',
      validAmount: 'Please enter a valid amount.',
    },
    history: {
      title: 'History Report',
      subtitle: 'Your water intake analysis for the last 7 days',
      weekTotal: 'This Week Total',
      dailyPerformance: 'Daily Performance',
      goalLabel: 'Goal (%{goal}ml)',
      dailyAvg: 'Daily Avg',
      bestDay: 'Best (%{ml}ml)',
      noData: 'No Data',
      goalMet: 'Goal Met',
      belowGoal: 'Below Goal',
      dayLabel: '%{day} Day',
    },
    reminders: {
  title: 'Reminders',
  intervalTitle: 'Notification Window',
  profileTimesInfo: 'These hours are automatically taken from your profile (wake/sleep).',
  frequencyTitle: 'Notification Frequency',
  everyXHours: 'Every %{hours}h',
  previewTitle: 'Daily Preview',
  wake: 'Wake',
  sleep: 'Sleep',
  disabledInline: 'Reminders are off.',
  save: 'Save',

  testPanel: 'Test Panel',
  test1m: '1 Min Test',
  onboard: 'Onboard',
  cancelAll: 'Cancel All',

  savedTitle: 'Saved',
  disabledMsg: 'Reminders have been turned off.',
  greatTitle: 'Awesome!',
  goalAlreadyDone: 'You already completed today’s goal.',
  noTimeLeftToday: 'No time left to schedule today. It will start tomorrow morning.',
  scheduledCount: '%{count} reminders scheduled.',
  errorTitle: 'Error',
  scheduleFailed: 'Scheduling failed.',
  plannedTitle: 'Planned',
  testInOneMinuteMsg: 'You will get a notification in 1 minute.',
  clearedTitle: 'Cleared',
},
    badges: {
      title: 'Collection',
      subtitle: 'Complete achievements and unlock badges!',
      levelLabel: 'Badge Level',
      motivationComplete: 'Legendary! 🏆',
      motivationProgress: 'Just getting started—keep going!',
      earned: 'Earned',
      locked: 'LOCKED',
      congrats: 'CONGRATS!',
      newBadge: 'You earned a new badge',
      awesome: 'Awesome!',
      items: {
        first_sip: {
          title: 'First Sip',
          description: 'Your first step on the water-break journey.',
          howToEarn: 'Add water for the first time in the app.',
        },
        sunrise: {
          title: 'Early Starter',
          description: 'Starting the day with an early sip is a great habit.',
          howToEarn: 'Add water before 09:00 in the morning.',
        },
        moon: {
          title: 'Night Watch',
          description: 'For those who dont forget hydration at night.',
          howToEarn: 'Add water at 23:00 or later.',
        },
        overflow_glass: {
          title: 'Goal Master',
          description: 'You went far beyond your goal!',
          howToEarn: 'Reach at least 150% of your daily goal.',
        },
        calendar5: {
          title: 'Mindful Drinker',
          description: 'A steady start.',
          howToEarn: 'Complete your daily goal 5 days in a row.',
        },
        sparkling: {
          title: 'Chilled',
          description: 'You drank glass after glass today!',
          howToEarn: 'Add water at least 10 times in a single day.',
        },
        calendar7: {
          title: 'Disciplined',
          description: 'A full week of discipline.',
          howToEarn: 'Complete your daily goal 7 days in a row.',
        },
        medal_bronze: {
          title: 'Bronze Champion',
          description: 'Consistency is paying off.',
          howToEarn: 'Complete your daily goal 10 days in a row.',
        },
        medal_silver: {
          title: 'Silver Champion',
          description: 'Habit unlocked - keep going!',
          howToEarn: 'Complete your daily goal 20 days in a row.',
        },
        medal_gold: {
          title: 'Gold Champion',
          description: 'Top-tier consistency.',
          howToEarn: 'Complete your daily goal 30 days in a row.',
        },
      },
    },
    onboard: {
      loading: {
        bmi: 'Analyzing your BMI...',
        water: 'Calculating your daily water need...',
        plan: 'Preparing a personalized plan...',
      },
      gender: {
        title: 'Select your gender',
        subtitle: 'We need this to calculate the best daily water goal for you.',
        male: 'Male',
        female: 'Female',
      },
      weight: {
        title: 'What is your weight?',
        subtitle: 'Weight is one of the most important factors for hydration needs.',
      },
      height: {
        title: 'What is your height?',
        subtitle: 'Height can affect your metabolism.',
      },
      wake: {
        title: 'What time do you wake up?',
        subtitle: 'We should know when your day starts.',
      },
      sleep: {
        title: 'What time do you sleep?',
        subtitle: 'Important so we dont disturb you while sleeping.',
      },
    },
  },
};

const LANGUAGE_KEY = 'APP_LANGUAGE';

const i18n = new I18n(translations);
i18n.enableFallback = true;

const normalizeLang = (tag) => {
  const base = (tag || 'en').split('-')[0];
  // uygulamada desteklediğimiz diller
  if (base === 'tr') return 'tr';
  return 'en';
};

// Uygulama genelinde kullanacağız (ileride ekranlarda useContext ile alacağız)
export const LanguageContext = createContext({
  locale: 'en',
  t: (key, opts) => i18n.t(key, opts),
  setLanguage: async (_lang) => {},
});

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false); // Veriler hazır mı?
  const [splashFinished, setSplashFinished] = useState(false); // Animasyon bitti mi?
  const [showOnboard, setShowOnboard] = useState(false); // Onboard gösterilecek mi?
  const [locale, setLocale] = useState('en'); // aktif dil

  useEffect(() => {
    async function prepare() {
      try {
        // 0. Dil seçimi (kayıtlı dil varsa onu kullan, yoksa cihaz dilini al)
        const savedLang = await AsyncStorage.getItem(LANGUAGE_KEY);

        // Custom default: EN (cihaz dili TR bile olsa, ilk açılışta EN gelsin)
        const initialLang = savedLang || 'en';

        i18n.locale = initialLang;
        setLocale(initialLang);

        // 1. iOS İzinleri
        if (Platform.OS === 'ios') {
          await Notifications.requestPermissionsAsync();
        }

        // 2. Android Kanalı
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('hydration-daily', {
            name: 'Water Reminders',
            importance: Notifications.AndroidImportance.HIGH,
            sound: 'default',
            vibrationPattern: [0, 250, 250, 250],
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          });
        }

        // 3. Rollover (Gün Devri) Kontrolü
        await performRolloverIfNeeded();

        // 4. Onboard Durumu Kontrolü
        const hasOnboarded = await AsyncStorage.getItem('HAS_ONBOARDED');
        setShowOnboard(!hasOnboarded); // Eğer onboard yapılmadıysa göster

        // 5. Store'a Onboard Verilerini Yükle (Senkronizasyon)
        if (hasOnboarded) {
           const entries = await AsyncStorage.multiGet(['ONBOARD_PROFILE', 'DAILY_GOAL_ML']);
           const profileStr = entries.find(x => x[0] === 'ONBOARD_PROFILE')?.[1];
           const goalStr = entries.find(x => x[0] === 'DAILY_GOAL_ML')?.[1];
           
           if (profileStr) {
             // Store'u güncelle (Arka planda)
             const profile = JSON.parse(profileStr);
             useHydrationStore.getState().updateProfile({
               weight: profile.weightKg,
               height: profile.heightCm,
               wakeAt: profile.wakeAt,
               sleepAt: profile.sleepAt,
               gender: profile.gender
             });
           }
           if (goalStr) {
             useHydrationStore.getState().setGoalMl(Number(goalStr));
           }
        }

      } catch (e) {
        console.warn(e);
      } finally {
        // Hazırlık bitti
        setAppIsReady(true);
      }
    }

    prepare();

    // App State Listener (Uygulama arkaplandan dönünce gün devri kontrolü)
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') {
        performRolloverIfNeeded();
      }
    });

    return () => sub?.remove();
  }, []);

  // Onboard Test Tetikleyicisi (Geliştirici Ayarları için)
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('OPEN_ONBOARD', async () => {
      try {
        await AsyncStorage.removeItem('HAS_ONBOARDED');
        setShowOnboard(true);
      } catch {}
    });
    return () => sub.remove();
  }, []);

  // Onboard bittiğinde çağrılacak
  const handleOnboardDone = () => {
    setShowOnboard(false);
  };

  return (
    <SafeAreaProvider>
      <LanguageContext.Provider
        value={useMemo(() => ({
          locale,
          t: (key, opts) => i18n.t(key, opts),
          setLanguage: async (lang) => {
            const next = normalizeLang(lang);
            i18n.locale = next;
            setLocale(next);
            await AsyncStorage.setItem(LANGUAGE_KEY, next);
          },
        }), [locale])}
      >
      <View style={{ flex: 1 }}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

        {/* 
           Mantık: 
           1. Veriler hazır olduğunda (appIsReady) Ana Uygulama (Navigation) altta render edilir.
           2. AnimatedSplash en üstte (zIndex ile) durur ve animasyonunu yapar.
           3. Animasyon bitince (onAnimationFinish) splashFinished true olur ve Splash DOM'dan kalkar.
        */}

        {appIsReady && (
          <NavigationContainer>
            {showOnboard ? (
              <LanguageContext.Consumer>
                {({ t, locale, setLanguage }) => (
                  <OnboardWizard
                    onDone={handleOnboardDone}
                    t={t}
                    locale={locale}
                    setLanguage={setLanguage}
                  />
                )}
              </LanguageContext.Consumer>
            ) : (
              <BottomTabs />
            )}
          </NavigationContainer>
        )}

        {!splashFinished && (
          <AnimatedSplash 
            onAnimationFinish={() => setSplashFinished(true)} 
          />
        )}
        
      </View>
      </LanguageContext.Provider>
    </SafeAreaProvider>
  );
}