const path = require('path')
// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config')

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname)
const exampleNodeModules = path.join(__dirname, 'node_modules')

const singletonPackages = [
  'react',
  'react-native',
  'react-native-gesture-handler',
  'react-native-reanimated',
  'react-native-safe-area-context',
  'react-native-screens',
  'react-native-worklets',
  '@shopify/react-native-skia',
]

const singletonAliases = Object.fromEntries(
  singletonPackages.map((packageName) => [
    packageName,
    path.join(exampleNodeModules, packageName),
  ])
)

function resolveSingletonPackage(moduleName) {
  const packageName = singletonPackages.find(
    (name) => moduleName === name || moduleName.startsWith(`${name}/`)
  )

  if (!packageName) {
    return null
  }

  const packagePath = singletonAliases[packageName]
  const subpath = moduleName.slice(packageName.length)
  return `${packagePath}${subpath}`
}

const finalConfig = {
  ...config,

  resolver: {
    ...config.resolver,
    nodeModulesPaths: [
      exampleNodeModules,
      path.join(__dirname, '..', 'node_modules'),
    ],
    resolveRequest: (context, moduleName, platform) => {
      const singletonPath = resolveSingletonPackage(moduleName)
      return context.resolveRequest(
        context,
        singletonPath ?? moduleName,
        platform
      )
    },
    extraNodeModules: {
      ...config.resolver?.extraNodeModules,
      ...singletonAliases,
      'react-native-skia-yoga': path.join(__dirname, '..'),
    },
  },
  watchFolders: [...config.watchFolders, path.join(__dirname, '..')],
}

module.exports = finalConfig
