import { type CanvasProps, type SkPicture } from "@shopify/react-native-skia"
import "@shopify/react-native-skia/lib/typescript/src/views/api.d.ts"
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react"
import type { LayoutChangeEvent } from "react-native"
import { NodeCommandKind } from "./specs/SkiaYoga.nitro"
import { type YogaRootContainer, reconciler } from "./Reconciler"
import { createYogaNode } from "./util"

type YogaCanvasProps = CanvasProps & {
	animationBindingMode?: "native" | "js"
}

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
	animationBindingMode = "native",
}: YogaCanvasProps) {
	const nativeId = useMemo(() => {
		return SkiaViewNativeId.current++
	}, [])
	const drawNodePictureRef = useRef<() => void>(noop)
	const activeContinuousNodesRef = useRef(new Set<object>())
	const pendingDrawRef = useRef(false)
	const scheduledDrawRef = useRef<number | null>(null)
	const continuousFrameRef = useRef<number | null>(null)

	const performDraw = useCallback(() => {
		pendingDrawRef.current = false
		drawNodePictureRef.current()
	}, [])

	const scheduleDraw = useCallback(() => {
		pendingDrawRef.current = true
		if (activeContinuousNodesRef.current.size > 0) {
			return
		}
		if (scheduledDrawRef.current != null) {
			return
		}

		scheduledDrawRef.current = requestAnimationFrame(() => {
			scheduledDrawRef.current = null
			if (activeContinuousNodesRef.current.size === 0 && pendingDrawRef.current) {
				performDraw()
			}
		})
	}, [performDraw])

	const stopContinuousLoop = useCallback(() => {
		if (continuousFrameRef.current != null) {
			cancelAnimationFrame(continuousFrameRef.current)
			continuousFrameRef.current = null
		}
	}, [])

	const startContinuousLoop = useCallback(() => {
		if (continuousFrameRef.current != null) {
			return
		}

		const frame = () => {
			if (activeContinuousNodesRef.current.size === 0) {
				continuousFrameRef.current = null
				return
			}

			performDraw()
			continuousFrameRef.current = requestAnimationFrame(frame)
		}

		continuousFrameRef.current = requestAnimationFrame(frame)
	}, [performDraw])

	const { node, root } = useMemo(() => {
		const node = createYogaNode()
		node.setCommand({ type: NodeCommandKind.Group, data: {} })

		const rootContainer: YogaRootContainer = {
			invalidate: scheduleDraw,
			nativeCommandBindingsEnabled: animationBindingMode === "native",
			node,
			setContinuousRedraw: (trackedNode, enabled) => {
				const activeNodes = activeContinuousNodesRef.current
				if (enabled) {
					activeNodes.add(trackedNode)
					startContinuousLoop()
				} else {
					activeNodes.delete(trackedNode)
				}
				if (activeNodes.size === 0) {
					stopContinuousLoop()
					scheduleDraw()
				}
			},
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
	}, [animationBindingMode, nativeId, scheduleDraw, startContinuousLoop, stopContinuousLoop])

	function drawNodePicture() {
		const picture = node.draw() as SkPicture
		presentPicture(nativeId, picture)
	}

	drawNodePictureRef.current = drawNodePicture

	function handleLayout(event: LayoutChangeEvent) {
		const { width, height } = event.nativeEvent.layout
		node.setStyle({
			width,
			height,
		})
		scheduleDraw()
	}

	useLayoutEffect(() => {
		// @ts-ignore
		reconciler.updateContainerSync(children, root, null, null)
		// @ts-ignore
		reconciler.flushSyncWork()
		reconciler.flushPassiveEffects()

		scheduleDraw()
	}, [children, root, nativeId, scheduleDraw])

	useEffect(() => {
		return () => {
			stopContinuousLoop()
			activeContinuousNodesRef.current.clear()
			if (scheduledDrawRef.current != null) {
				cancelAnimationFrame(scheduledDrawRef.current)
				scheduledDrawRef.current = null
			}
			reconciler.updateContainer(null, root, null, null)
			// @ts-ignore
			reconciler.flushSyncWork()
			reconciler.flushPassiveEffects()
		}
	}, [root, stopContinuousLoop])

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
