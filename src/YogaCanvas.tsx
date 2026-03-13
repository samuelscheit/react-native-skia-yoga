import { type CanvasProps, type SkPicture } from "@shopify/react-native-skia"
import "@shopify/react-native-skia/lib/typescript/src/views/api.d.ts"
import React, { useEffect, useLayoutEffect, useMemo, useRef } from "react"
import type { LayoutChangeEvent, View } from "react-native"
import { useSharedValue } from "react-native-reanimated"
import { reconciler } from "./Reconciler"
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
	const viewRef = useRef<View>(null)
	const nativeId = useMemo(() => {
		return SkiaViewNativeId.current++
	}, [])

	const { root, node } = useMemo(() => {
		const node = createYogaNode()
		node.setType("group")
		node.setStyle({
			flex: 1,
			backgroundColor: "#ff0000"
		})
		node.setProps({})

		const picture = node.draw() as SkPicture

		presentPicture(nativeId, picture)


		return {
			root: reconciler.createContainer(
				node,
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
			node,
		}
	}, [])

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
		const id = Math.random()
		currentlyRunning.value = id
		let frameId = 0

		function frame() {
			if (currentlyRunning.value !== id) return
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
			// destory the container
			reconciler.updateContainer(null, root, null, null)
			// @ts-ignore
			reconciler.flushSyncWork()
			reconciler.flushPassiveEffects()
		}
	}, [root])

	return (
		<SkiaPictureViewNativeComponent
			ref={viewRef}
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
