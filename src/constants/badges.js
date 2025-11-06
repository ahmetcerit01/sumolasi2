// src/constants/badges.js
export const BADGES = [
  { id: 'waterdrop',    title: 'İlk Yudum',           icon: 'waterdrop',      type: 'event',
    check: ({ history }) => history?.firstAdd === true },

  { id: 'sunrise',      title: 'Güne Erken Başlayan', icon: 'sunrise',        type: 'time',
    check: ({ lastAddAt }) => lastAddAt && new Date(lastAddAt).getHours() < 9 },

  { id: 'moon',         title: 'Gece Bekçisi',        icon: 'moon',           type: 'time',
    check: ({ lastAddAt }) => lastAddAt && new Date(lastAddAt).getHours() >= 23 },

  { id: 'overflow_glass', title: 'Hedef Ustası',      icon: 'overflow_glass', type: 'goal',
    check: ({ totalMl, goalMl }) => totalMl >= goalMl * 1.5 },

  { id: 'calendar5',    title: 'Bilinçli Tüketici',   icon: 'calendar5',      type: 'streak',
    check: ({ streakDays }) => streakDays >= 5 },

  { id: 'sparkling',    title: 'Serinleten',          icon: 'sparkling',      type: 'count',
    check: ({ todayGlasses }) => todayGlasses >= 10 },

  { id: 'calendar7',    title: 'Disiplinli',          icon: 'calendar7',      type: 'streak',
    check: ({ streakDays }) => streakDays >= 7 },

  { id: 'medal_bronze', title: 'Bronz Şampiyon',      icon: 'medal_bronze',   type: 'streak',
    check: ({ streakDays }) => streakDays >= 10 },

  { id: 'medal_silver', title: 'Gümüş Şampiyon',      icon: 'medal_silver',   type: 'streak',
    check: ({ streakDays }) => streakDays >= 20 },

  { id: 'medal_gold',   title: 'Altın Şampiyon',      icon: 'medal_gold',     type: 'streak',
    check: ({ streakDays }) => streakDays >= 30 },
];