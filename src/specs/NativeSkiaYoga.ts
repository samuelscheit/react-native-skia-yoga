import type { TurboModule } from "react-native"
import { TurboModuleRegistry } from "react-native"

export interface Spec extends TurboModule {
	install(): void
}

function getNativeSkiaYoga(): Spec {
	return TurboModuleRegistry.getEnforcing<Spec>("SkiaYoga")
}

const NativeSkiaYoga: Spec = {
	install() {
		return getNativeSkiaYoga().install()
	},
}

export default NativeSkiaYoga
