export default function (api) {
	api.cache(true)
	return {
		presets: ["babel-preset-expo"],
		plugins: [
			// ["react-native-worklets/plugin"],
			// ["react-native-reanimated/plugin"],
		],
		// plugins: [
		//   [
		//     "module-resolver",
		//     {
		//       extensions: [".ios.js", ".android.js", ".js", ".ts", ".tsx", ".json"],
		//       root: [],
		//       alias: {
		//         // "react-native-skia-yoga": "../src/index.ts",
		//       }
		//     }
		//   ]
		// ]
	}
}
