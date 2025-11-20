export const BADGES = [
  {
    id: 'first_sip', // veya 'waterdrop' (BadgeIcon bunu 'water'a çevirecek)
    title: 'İlk Yudum',
    icon: 'water', 
    description: 'Su molası yolculuğunun ilk adımı.',
    howToEarn: 'Uygulamada ilk kez su ekle.',
    check: ({ totalMl }) => totalMl > 0,
  },

  {
    id: 'sunrise',
    title: 'Güne Erken Başlayan',
    icon: 'sunny', // Düzeltildi
    type: 'time',
    description: 'Güne erken bir yudumla başlamak harika bir alışkanlık.',
    howToEarn: 'Sabah 09:00’dan önce su ekle.',
    check: ({ lastAddAt }) => lastAddAt && new Date(lastAddAt).getHours() < 9,
  },

  {
    id: 'moon',
    title: 'Gece Bekçisi',
    icon: 'moon', // Doğru
    type: 'time',
    description: 'Gece de hidrasyonu unutmayanlara.',
    howToEarn: 'Gece 23:00 veya sonrasında su ekle.',
    check: ({ lastAddAt }) => lastAddAt && new Date(lastAddAt).getHours() >= 23,
  },

  {
    id: 'overflow_glass',
    title: 'Hedef Ustası',
    icon: 'trophy', // Düzeltildi
    type: 'goal',
    description: 'Hedefin çok üstüne çıktın!',
    howToEarn: 'Günlük hedefinin en az %150’sine ulaş.',
    check: ({ totalMl, goalMl }) => totalMl >= goalMl * 1.5,
  },

  {
    id: 'calendar5',
    title: 'Bilinçli Tüketici',
    icon: 'calendar', // Düzeltildi
    type: 'streak',
    description: 'İstikrarlı bir başlangıç.',
    howToEarn: 'Art arda 5 gün boyunca günlük hedefini tamamla.',
    check: ({ streakDays }) => streakDays >= 5,
  },

  {
    id: 'sparkling',
    title: 'Serinleten',
    icon: 'snow', // Düzeltildi (Buz gibi su)
    type: 'count',
    description: 'Bugün bardak bardak içtin!',
    howToEarn: 'Bir günde en az 10 kez su ekle (10 bardak).',
    check: ({ todayGlasses }) => todayGlasses >= 10,
  },

  {
    id: 'calendar7',
    title: 'Disiplinli',
    icon: 'checkmark-done-circle', // Düzeltildi
    type: 'streak',
    description: 'Bir haftalık tam disiplin.',
    howToEarn: 'Art arda 7 gün boyunca günlük hedefini tamamla.',
    check: ({ streakDays }) => streakDays >= 7,
  },

  {
    id: 'medal_bronze',
    title: 'Bronz Şampiyon',
    icon: 'medal', // Düzeltildi
    type: 'streak',
    description: 'İstikrar meyvelerini veriyor.',
    howToEarn: 'Art arda 10 gün boyunca günlük hedefini tamamla.',
    check: ({ streakDays }) => streakDays >= 10,
  },

  {
    id: 'medal_silver',
    title: 'Gümüş Şampiyon',
    icon: 'ribbon', // Düzeltildi
    type: 'streak',
    description: 'Alışkanlık kazanıldı, devam!',
    howToEarn: 'Art arda 20 gün boyunca günlük hedefini tamamla.',
    check: ({ streakDays }) => streakDays >= 20,
  },

  {
    id: 'medal_gold',
    title: 'Altın Şampiyon',
    icon: 'star', // Düzeltildi
    type: 'streak',
    description: 'Üst düzey istikrar.',
    howToEarn: 'Art arda 30 gün boyunca günlük hedefini tamamla.',
    check: ({ streakDays }) => streakDays >= 30,
  },
];