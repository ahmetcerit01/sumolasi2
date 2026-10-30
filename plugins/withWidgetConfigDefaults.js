// Widget ayarındaki (button1..button3) dinamik seçeneklerin varsayılanını boş bırakır.
// expo-widgets, app.json'daki varsayılanı ("q1" gibi ham kimlik) "Widget'ı Düzenle" ekranında aynen gösteriyor;
// boş bırakınca iOS kendi "Seç" yer tutucusunu gösterir, widget da o butonda varsayılan sırayı kullanır
// (WaterWidget.js → pick()). Seçilen seçenekler zaten adıyla ("Bardak · 200 ml") görünür.
// Sıra: app.json'da expo-widgets'tan ÖNCE gelmeli (mod'lar ters sırada çalışır, böylece üretilen Swift'ten sonra çalışır).
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const FILE = path.join('ExpoWidgetsTarget', 'WaterWidget.swift');

module.exports = (config) =>
  withDangerousMod(config, [
    'ios',
    (cfg) => {
      const file = path.join(cfg.modRequest.platformProjectRoot, FILE);
      if (!fs.existsSync(file)) return cfg;
      const src = fs.readFileSync(file, 'utf8');
      const next = src.replace(/(func defaultResult\(\) async -> String\? \{\s*\n\s*)return "[^"]*"/g, '$1return nil');
      if (next !== src) fs.writeFileSync(file, next);
      return cfg;
    },
  ]);
