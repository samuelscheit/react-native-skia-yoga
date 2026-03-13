import { type CanvasProps, type SkPicture } from "@shopify/react-native-skia"
import "@shopify/react-native-skia/lib/typescript/src/views/api.d.ts"
import React, { useEffect, useLayoutEffect, useMemo } from "react"
import type { LayoutChangeEvent } from "react-native"
import { useSharedValue } from "react-native-reanimated"
import { NodeCommandKind } from "./specs/SkiaYoga.nitro"
import { type YogaRootContainer, reconciler } from "./Reconciler"
import { createYogaNode } from "./util"

const { default: SkiaPictureViewNativeComponent } =
	require("@shopify/react-native-skia/src/specs/SkiaPictureViewNativeComponent") as typeof import("@shopify/react-native-skia/lib/typescript/src/specs/SkiaPictureViewNativeComponent")
const { SkiaViewNativeId } =
	require("@shopify/react-native-skia/src/views/SkiaViewNativeId") as typeof import("@shopify/react-native-skia/lib/typescript/src/views/SkiaViewNativeId")

function reportError(error: Error) {
	console.error(error)
}

function noop() {}

function presentPicture(nativeId: number, picture: SkPicture) {
	SkiaViewApi.setJsiProperty(nativeId, "picture", picture)
	SkiaViewApi.requestRedraw(nativeId)
}

export function YogaCanvas({
	children,
	style,
	opaque,
	debug,
	colorSpace,
}: CanvasProps) {
	const nativeId = useMemo(() => {
		return SkiaViewNativeId.current++
	}, [])

	const { node, root } = useMemo(() => {
		const node = createYogaNode()
		node.setCommand({ type: NodeCommandKind.Group, data: {} })

		const picture = node.draw() as SkPicture
		presentPicture(nativeId, picture)

		const rootContainer: YogaRootContainer = {
			// Keep reconciler-driven invalidation disabled here. Mixing ad-hoc invalidation
			// with the continuous RAF loop below caused out-of-phase picture presents and
			// visible flicker in the demo.
			invalidate: noop,
			node,
			setContinuousRedraw: noop,
		}

		return {
			node,
			root: reconciler.createContainer(
				rootContainer,
				0,
				null,
				true,
				null,
				"",
				reportError,
				reportError,
				reportError,
				noop,
				null,
			),
		}
	}, [nativeId])

	function drawNodePicture() {
		const picture = node.draw() as SkPicture
		presentPicture(nativeId, picture)
	}

	function handleLayout(event: LayoutChangeEvent) {
		const { width, height } = event.nativeEvent.layout
		node.setStyle({
			width,
			height,
		})
		drawNodePicture()
	}

	const currentlyRunning = useSharedValue(0)

	useEffect(() => {
		// The demo animates by mutating Skia host objects such as `SkMatrix` in place
		// inside `useDerivedValue`. Those mutations do not go through React commits or a
		// shared-value style listener, so an invalidation-only redraw model caused the
		// canvas to stop animating. Keep a single continuous RAF loop until we have an
		// explicit animation invalidation contract for mutable Skia objects.
		const id = Math.random()
		currentlyRunning.value = id
		let frameId = 0

		function frame() {
			if (currentlyRunning.value !== id) {
				return
			}

			drawNodePicture()
			frameId = requestAnimationFrame(frame)
		}

		frameId = requestAnimationFrame(frame)

		return () => {
			currentlyRunning.value = 0
			if (frameId) {
				cancelAnimationFrame(frameId)
			}
		}
	}, [currentlyRunning, node, nativeId])

	useLayoutEffect(() => {
		// @ts-ignore
		reconciler.updateContainerSync(children, root, null, null)
		// @ts-ignore
		reconciler.flushSyncWork()
		reconciler.flushPassiveEffects()

		drawNodePicture()
	}, [children, root, nativeId])

	useEffect(() => {
		return () => {
			reconciler.updateContainer(null, root, null, null)
			// @ts-ignore
			reconciler.flushSyncWork()
			reconciler.flushPassiveEffects()
		}
	}, [root])

	return (
		<SkiaPictureViewNativeComponent
			collapsable={false}
			debug={debug}
			opaque={opaque}
			nativeID={`${nativeId}`}
			onLayout={handleLayout}
			style={style}
			colorSpace={colorSpace}
		/>
	)
}
