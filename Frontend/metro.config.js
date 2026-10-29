const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push("wasm");
config.server.enhanceMiddleware = (middleware) => (request, response, next) => {
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  response.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
  return middleware(request, response, next);
};

module.exports = withNativeWind(config, { input: "./global.css" });