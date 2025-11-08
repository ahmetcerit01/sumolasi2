// src/constants/badges.js
export const BADGES = [
  {
    id: 'waterdrop',
    title: 'İlk Yudum',
    icon: 'waterdrop',
    type: 'event',
    description: 'Su molası yolculuğunun ilk adımı.',
    howToEarn: 'Uygulamada ilk kez su ekle.',
    check: ({ history }) => history?.firstAdd === true,
  },

  {
    id: 'sunrise',
    title: 'Güne Erken Başlayan',
    icon: 'sunrise',
    type: 'time',
    description: 'Güne erken bir yudumla başlamak harika bir alışkanlık.',
    howToEarn: 'Sabah 09:00’dan önce su ekle.',
    check: ({ lastAddAt }) => lastAddAt && new Date(lastAddAt).getHours() < 9,
  },

  {
    id: 'moon',
    title: 'Gece Bekçisi',
    icon: 'moon',
    type: 'time',
    description: 'Gece de hidrasyonu unutmayanlara.',
    howToEarn: 'Gece 23:00 veya sonrasında su ekle.',
    check: ({ lastAddAt }) => lastAddAt && new Date(lastAddAt).getHours() >= 23,
  },

  {
    id: 'overflow_glass',
    title: 'Hedef Ustası',
    icon: 'overflow_glass',
    type: 'goal',
    description: 'Hedefin çok üstüne çıktın!',
    howToEarn: 'Günlük hedefinin en az %150’sine ulaş.',
    check: ({ totalMl, goalMl }) => totalMl >= goalMl * 1.5,
  },

  {
    id: 'calendar5',
    title: 'Bilinçli Tüketici',
    icon: 'calendar5',
    type: 'streak',
    description: 'İstikrarlı bir başlangıç.',
    howToEarn: 'Art arda 5 gün boyunca günlük hedefini tamamla.',
    check: ({ streakDays }) => streakDays >= 5,
  },

  {
    id: 'sparkling',
    title: 'Serinleten',
    icon: 'sparkling',
    type: 'count',
    description: 'Bugün bardak bardak içtin!',
    howToEarn: 'Bir günde en az 10 kez su ekle (10 bardak).',
    check: ({ todayGlasses }) => todayGlasses >= 10,
  },

  {
    id: 'calendar7',
    title: 'Disiplinli',
    icon: 'calendar7',
    type: 'streak',
    description: 'Bir haftalık tam disiplin.',
    howToEarn: 'Art arda 7 gün boyunca günlük hedefini tamamla.',
    check: ({ streakDays }) => streakDays >= 7,
  },

  {
    id: 'medal_bronze',
    title: 'Bronz Şampiyon',
    icon: 'medal_bronze',
    type: 'streak',
    description: 'İstikrar meyvelerini veriyor.',
    howToEarn: 'Art arda 10 gün boyunca günlük hedefini tamamla.',
    check: ({ streakDays }) => streakDays >= 10,
  },

  {
    id: 'medal_silver',
    title: 'Gümüş Şampiyon',
    icon: 'medal_silver',
    type: 'streak',
    description: 'Alışkanlık kazanıldı, devam!',
    howToEarn: 'Art arda 20 gün boyunca günlük hedefini tamamla.',
    check: ({ streakDays }) => streakDays >= 20,
  },

  {
    id: 'medal_gold',
    title: 'Altın Şampiyon',
    icon: 'medal_gold',
    type: 'streak',
    description: 'Üst düzey istikrar.',
    howToEarn: 'Art arda 30 gün boyunca günlük hedefini tamamla.',
    check: ({ streakDays }) => streakDays >= 30,
  },
];
