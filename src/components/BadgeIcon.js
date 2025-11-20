import React from 'react';
import { Ionicons } from '@expo/vector-icons';

export default function BadgeIcon({ name, size = 24, color, unlocked }) {
  // Eğer isim gelmezse veya hatalıysa 'ribbon' göster
  let iconName = name || 'ribbon';

  // Ionicons'ta olmayan bazı eski isimleri düzeltme haritası
  const iconFixes = {
    'waterdrop': 'water',
    'sunrise': 'sunny',
    'overflow_glass': 'trophy',
    'calendar5': 'calendar',
    'calendar7': 'calendar',
    'sparkling': 'snow',
    'medal_bronze': 'medal',
    'medal_silver': 'ribbon',
    'medal_gold': 'star',
  };

  if (iconFixes[iconName]) {
    iconName = iconFixes[iconName];
  }

  // Renk ayarı: Eğer dışarıdan renk gelmediyse duruma göre renk ver
  const iconColor = color 
    ? color 
    : (unlocked ? '#FFB300' : '#B0BEC5'); // Kazanıldıysa Altın Sarısı, Yoksa Gri

  return <Ionicons name={iconName} size={size} color={iconColor} />;
}