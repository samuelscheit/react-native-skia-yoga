import { NitroModules } from "react-native-nitro-modules";
import type { YogaNodeFinal } from "./index";
import type { YogaNode } from "./specs/SkiaYoga.nitro";

const NitroModulesBox = NitroModules.box(NitroModules)

export function createYogaNode(): YogaNodeFinal {
	"worklet"

	const box = NitroModulesBox.unbox()

	const node = box.createHybridObject<YogaNode>("YogaNode")

	return node as YogaNodeFinal
}
