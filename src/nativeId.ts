const YOGA_CANVAS_NATIVE_ID_START = 1_000_000_000
const YOGA_CANVAS_NATIVE_ID_END = 2_000_000_000

let nextYogaCanvasNativeId = YOGA_CANVAS_NATIVE_ID_START

export function allocateYogaCanvasNativeId() {
	const nativeId = nextYogaCanvasNativeId
	nextYogaCanvasNativeId =
		nativeId >= YOGA_CANVAS_NATIVE_ID_END
			? YOGA_CANVAS_NATIVE_ID_START
			: nativeId + 1
	return nativeId
}
