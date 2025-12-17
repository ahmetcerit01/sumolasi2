const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Mevcut asset uzantılarını al ve mp3, wav ekle
config.resolver.assetExts.push(
  'mp3',
  'wav'
);

module.exports = config;