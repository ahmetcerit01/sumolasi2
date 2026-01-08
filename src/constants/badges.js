export const BADGES = [
  {
    id: 'first_sip', // veya 'waterdrop' (BadgeIcon bunu 'water'a çevirecek)
    icon: 'water', 
    titleKey: 'badges.items.first_sip.title',
    descriptionKey: 'badges.items.first_sip.description',
    howToEarnKey: 'badges.items.first_sip.howToEarn',
    check: ({ totalMl }) => totalMl > 0,
  },

  {
    id: 'sunrise',
    icon: 'sunny', // Düzeltildi
    type: 'time',
    titleKey: 'badges.items.sunrise.title',
    descriptionKey: 'badges.items.sunrise.description',
    howToEarnKey: 'badges.items.sunrise.howToEarn',
    check: ({ lastAddAt }) => lastAddAt && new Date(lastAddAt).getHours() < 9,
  },

  {
    id: 'moon',
    icon: 'moon', // Doğru
    type: 'time',
    titleKey: 'badges.items.moon.title',
    descriptionKey: 'badges.items.moon.description',
    howToEarnKey: 'badges.items.moon.howToEarn',
    check: ({ lastAddAt }) => lastAddAt && new Date(lastAddAt).getHours() >= 23,
  },

  {
    id: 'overflow_glass',
    icon: 'trophy', // Düzeltildi
    type: 'goal',
    titleKey: 'badges.items.overflow_glass.title',
    descriptionKey: 'badges.items.overflow_glass.description',
    howToEarnKey: 'badges.items.overflow_glass.howToEarn',
    check: ({ totalMl, goalMl }) => totalMl >= goalMl * 1.5,
  },

  {
    id: 'calendar5',
    icon: 'calendar', // Düzeltildi
    type: 'streak',
    titleKey: 'badges.items.calendar5.title',
    descriptionKey: 'badges.items.calendar5.description',
    howToEarnKey: 'badges.items.calendar5.howToEarn',
    check: ({ streakDays }) => streakDays >= 5,
  },

  {
    id: 'sparkling',
    icon: 'snow', // Düzeltildi (Buz gibi su)
    type: 'count',
    titleKey: 'badges.items.sparkling.title',
    descriptionKey: 'badges.items.sparkling.description',
    howToEarnKey: 'badges.items.sparkling.howToEarn',
    check: ({ todayGlasses }) => todayGlasses >= 10,
  },

  {
    id: 'calendar7',
    icon: 'checkmark-done-circle', // Düzeltildi
    type: 'streak',
    titleKey: 'badges.items.calendar7.title',
    descriptionKey: 'badges.items.calendar7.description',
    howToEarnKey: 'badges.items.calendar7.howToEarn',
    check: ({ streakDays }) => streakDays >= 7,
  },

  {
    id: 'medal_bronze',
    icon: 'medal', // Düzeltildi
    type: 'streak',
    titleKey: 'badges.items.medal_bronze.title',
    descriptionKey: 'badges.items.medal_bronze.description',
    howToEarnKey: 'badges.items.medal_bronze.howToEarn',
    check: ({ streakDays }) => streakDays >= 10,
  },

  {
    id: 'medal_silver',
    icon: 'ribbon', // Düzeltildi
    type: 'streak',
    titleKey: 'badges.items.medal_silver.title',
    descriptionKey: 'badges.items.medal_silver.description',
    howToEarnKey: 'badges.items.medal_silver.howToEarn',
    check: ({ streakDays }) => streakDays >= 20,
  },

  {
    id: 'medal_gold',
    icon: 'star', // Düzeltildi
    type: 'streak',
    titleKey: 'badges.items.medal_gold.title',
    descriptionKey: 'badges.items.medal_gold.description',
    howToEarnKey: 'badges.items.medal_gold.howToEarn',
    check: ({ streakDays }) => streakDays >= 30,
  },
];