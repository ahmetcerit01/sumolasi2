// Siri / Kısayollar için App Intents dosyasını ana uygulama hedefine ekler.
// Kaynak: plugins/siri/WaterIntents.swift → ios/<Proje>/WaterIntents.swift
const { withXcodeProject, IOSConfig } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const FILE = 'WaterIntents.swift';

module.exports = function withSiriShortcuts(config) {
  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const projectName = IOSConfig.XcodeUtils.getProjectName(cfg.modRequest.projectRoot);
    const src = path.join(cfg.modRequest.projectRoot, 'plugins', 'siri', FILE);
    const dest = path.join(cfg.modRequest.platformProjectRoot, projectName, FILE);
    fs.copyFileSync(src, dest);

    const relPath = `${projectName}/${FILE}`;
    if (!project.hasFile(relPath)) {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath: relPath,
        groupName: projectName,
        project,
        // Projede widget eklentisi de var: dosyayı adıyla bulduğumuz ana uygulama hedefine ekle
        targetUuid: project.findTargetKey(projectName),
      });
    }
    return cfg;
  });
};
