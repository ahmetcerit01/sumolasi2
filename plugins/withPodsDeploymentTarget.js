// Xcode 26+ iOS 15.0 altındaki deployment target'ları desteklemiyor.
// Bazı pod'lar (lottie, async-storage, svg...) hâlâ 12.x/13.x ile geliyor;
// prebuild sırasında Podfile'ın post_install bloğuna tüm pod target'larını yükselten bir adım ekler.
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '# sumolasi: pods deployment target';

module.exports = function withPodsDeploymentTarget(config, { target = '15.1' } = {}) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf8');
      if (podfile.includes(MARKER)) return cfg;

      const snippet = `
    ${MARKER}
    installer.pods_project.targets.each do |t|
      t.build_configurations.each do |bc|
        current = bc.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current.nil? || Gem::Version.new(current) < Gem::Version.new('${target}')
          bc.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${target}'
        end
      end
    end
`;
      podfile = podfile.replace(/post_install do \|installer\|\n/, (m) => m + snippet);
      fs.writeFileSync(podfilePath, podfile);
      return cfg;
    },
  ]);
};
