import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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
		//         // "react-native-skia-yoga": path.join(__dirname, "..", "src", "index.ts"),
		//       }
		//     }
		//   ]
		// ]
	}
}
