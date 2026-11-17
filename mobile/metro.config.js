// Metro config: Expo's defaults plus module-resolution fixes for Privy.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// `jose` (used by Privy) picks its Node.js build by default, which needs Node
// built-ins like `util`. Resolve its browser build instead.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'jose') {
    return context.resolveRequest({ ...context, unstable_conditionNames: ['browser'] }, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
