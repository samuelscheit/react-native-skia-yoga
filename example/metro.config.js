const path = require('path')
// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config')

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname)

const finalConfig = {
  ...config,

  resolver: {
    ...config.resolver,
    nodeModulesPaths: [
      path.join(__dirname, '.', 'node_modules'),
      path.join(__dirname, '..'),
      path.join(__dirname, '..', 'node_modules'),
    ],
    extraNodeModules: {
      ...config.resolver?.extraNodeModules,
      'react-native-skia-yoga': path.join(__dirname, '..'),
    },
  },
  watchFolders: [...config.watchFolders, path.join(__dirname, '..')],
}

console.log(finalConfig)

module.exports = finalConfig
