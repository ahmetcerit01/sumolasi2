// src/components/BadgeIcon.js
import React from 'react';
import { Image, View, Text } from 'react-native';

const images = {
  calendar5:      require('../../assets/badges/calendar5.png'),
  calendar7:      require('../../assets/badges/calendar7.png'),
  medal_bronze:   require('../../assets/badges/medal_bronze.png'),
  medal_gold:     require('../../assets/badges/medal_gold.png'),
  medal_silver:   require('../../assets/badges/medal_silver.png'),
  moon:           require('../../assets/badges/moon.png'),
  overflow_glass: require('../../assets/badges/overflow_glass.png'),
  sparkling:      require('../../assets/badges/sparkling.png'),
  sunrise:        require('../../assets/badges/sunrise.png'),
  waterdrop:      require('../../assets/badges/waterdrop.png'),
};

export default function BadgeIcon({ name, size = 72 }) {
  const src = images[name];

  if (!src) {
    console.warn('[BadgeIcon] Missing image for key:', name);
    return (
      <View style={{
        width: size, height: size, borderRadius: size/2,
        backgroundColor: '#EEF4FF', alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: '#D8E5FF'
      }}>
        <Text style={{ color: '#4E6480', fontSize: 11 }}>missing{'\n'}{name}</Text>
      </View>
    );
  }

  return (
    <Image
      source={src}
      style={{ width: size, height: size, opacity: 1 }}
      resizeMode="contain"
    />
  );
}