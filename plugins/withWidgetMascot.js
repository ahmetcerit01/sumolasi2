// Damla ruh hali görsellerini widget eklentisine asset katalog olarak gömer.
// Kaynak: assets/mascot/damla_<mood>.png → ios/DamlaWidgetAssets.xcassets/damla_<mood>.imageset
// Widget'ta <Image assetName="damla_happy" /> ile kullanılır (WaterWidget.js).
const { withDangerousMod, withXcodeProject } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const CATALOG = 'DamlaWidgetAssets.xcassets';
const TARGET = 'ExpoWidgetsTarget';
const MOODS = ['thirsty', 'normal', 'happy', 'celebrate', 'sleepy'];
const INFO = { info: { author: 'xcode', version: 1 } };

const withCatalogFiles = (config) =>
  withDangerousMod(config, [
    'ios',
    (cfg) => {
      const root = cfg.modRequest.projectRoot;
      const dir = path.join(cfg.modRequest.platformProjectRoot, CATALOG);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'Contents.json'), JSON.stringify(INFO, null, 2));
      for (const mood of MOODS) {
        const name = `damla_${mood}`;
        const set = path.join(dir, `${name}.imageset`);
        fs.mkdirSync(set, { recursive: true });
        fs.copyFileSync(path.join(root, 'assets', 'mascot', `${name}.png`), path.join(set, `${name}.png`));
        fs.writeFileSync(
          path.join(set, 'Contents.json'),
          JSON.stringify({ images: [{ idiom: 'universal', filename: `${name}.png` }], ...INFO }, null, 2)
        );
      }
      return cfg;
    },
  ]);

const withCatalogInTarget = (config) =>
  withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const objects = project.hash.project.objects;
    const targetKey = project.findTargetKey(TARGET);
    if (!targetKey) {
      console.warn(`[withWidgetMascot] ${TARGET} hedefi bulunamadı; widget görselleri eklenmedi`);
      return cfg;
    }
    const exists = Object.entries(objects.PBXFileReference || {}).some(
      ([k, v]) => !k.endsWith('_comment') && v && String(v.path).replace(/"/g, '') === CATALOG
    );
    if (exists) return cfg;

    const fileRef = project.generateUuid();
    const buildFile = project.generateUuid();
    objects.PBXFileReference[fileRef] = {
      isa: 'PBXFileReference',
      lastKnownFileType: 'folder.assetcatalog',
      path: CATALOG,
      sourceTree: '"<group>"',
    };
    objects.PBXFileReference[`${fileRef}_comment`] = CATALOG;
    objects.PBXBuildFile[buildFile] = { isa: 'PBXBuildFile', fileRef, fileRef_comment: CATALOG };
    objects.PBXBuildFile[`${buildFile}_comment`] = `${CATALOG} in Resources`;

    // ana gruba ekle (dosya ios/ kökünde)
    const mainGroup = objects.PBXGroup[project.getFirstProject().firstProject.mainGroup];
    mainGroup.children.push({ value: fileRef, comment: CATALOG });

    // widget hedefinin Resources aşamasına ekle (yoksa oluştur)
    const target = objects.PBXNativeTarget[targetKey];
    let phaseKey = (target.buildPhases || []).map((p) => p.value).find((k) => objects.PBXResourcesBuildPhase?.[k]);
    if (!phaseKey) {
      phaseKey = project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', targetKey).uuid;
    }
    objects.PBXResourcesBuildPhase[phaseKey].files.push({ value: buildFile, comment: `${CATALOG} in Resources` });
    return cfg;
  });

module.exports = (config) => withCatalogInTarget(withCatalogFiles(config));
