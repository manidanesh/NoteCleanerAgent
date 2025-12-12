/**
 * Metro configuration for React Native
 * Supports both iOS and macOS platforms
 */
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

const config = {
  resolver: {
    alias: {
      '@': './src',
      '@/models': './src/models',
      '@/agents': './src/agents',
      '@/services': './src/services',
      '@/ui': './src/ui'
    },
    platforms: ['ios', 'macos', 'native', 'web']
  },
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
};

module.exports = mergeConfig(defaultConfig, config);