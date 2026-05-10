import { NitroModules } from "react-native-nitro-modules";
import type { YogaNodeFinal } from "./internalTypes";
import type { YogaNode } from "./specs/SkiaYoga.nitro";

const createNitroModulesBox = () => NitroModules.box(NitroModules)
type NitroModulesBox = ReturnType<typeof createNitroModulesBox>

let nitroModulesBox: NitroModulesBox | undefined

const lazyNitroModulesBox = {
	get current() {
		if (nitroModulesBox == null) {
			nitroModulesBox = createNitroModulesBox()
		}

		return nitroModulesBox
	},
}

export function createYogaNode(): YogaNodeFinal {
	"worklet"

	const box = lazyNitroModulesBox.current.unbox()

	const node = box.createHybridObject<YogaNode>("YogaNode")

	return node as YogaNodeFinal
}
