import { type CanvasProps, type SkPicture } from "@shopify/react-native-skia"
import "@shopify/react-native-skia/lib/typescript/src/views/api.d.ts"
import React, {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
} from "react"
import type { LayoutChangeEvent } from "react-native"
import { GestureDetector, type GestureType } from "react-native-gesture-handler"
import { YogaInteractionRegistry } from "./interactivity"
import { NodeCommandKind } from "./specs/SkiaYoga.nitro"
import { type YogaRootContainer, reconciler } from "./Reconciler"
import { useCanvasGestures } from "./useCanvasGestures"
import { createYogaNode } from "./util"

type YogaCanvasProps = CanvasProps & {
	animationBindingMode?: "native" | "js"
	gesture?: GestureType
	onProfileSample?: (sample: YogaCanvasProfileSample) => void
	profilingEnabled?: boolean
}

export type YogaCanvasProfileSample = {
	avgDrawMs: number
	avgPresentMs: number
	frames: number
	maxDrawMs: number
	maxPresentMs: number
	rawInvalidateCalls: number
	sampleDurationMs: number
	scheduledInvalidateCalls: number
	skippedInvalidateCalls: number
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
	gesture,
	onProfileSample,
	profilingEnabled = false,
}: YogaCanvasProps) {
	const nativeId = useMemo(() => {
		return SkiaViewNativeId.current++
	}, [])
	const drawNodePictureRef = useRef<() => void>(noop)
	const activeContinuousNodesRef = useRef(new Set<object>())
	const pendingDrawRef = useRef(false)
	const scheduledDrawRef = useRef<number | null>(null)
	const continuousFrameRef = useRef<number | null>(null)
	const profileRef = useRef({
		drawMsTotal: 0,
		frames: 0,
		maxDrawMs: 0,
		maxPresentMs: 0,
		presentMsTotal: 0,
		rawInvalidateCalls: 0,
		sampleStartTime: 0,
		scheduledInvalidateCalls: 0,
		skippedInvalidateCalls: 0,
	})
	const interactions = useMemo(() => {
		return new YogaInteractionRegistry()
	}, [])

	const flushProfileSample = useCallback(
		(force = false) => {
			if (!profilingEnabled || !onProfileSample) {
				return
			}

			const profile = profileRef.current
			const now = performance.now()
			const sampleStartTime = profile.sampleStartTime || now
			const sampleDurationMs = now - sampleStartTime
			if (!force && sampleDurationMs < 1000) {
				return
			}

			const frames = profile.frames
			onProfileSample({
				avgDrawMs: frames > 0 ? profile.drawMsTotal / frames : 0,
				avgPresentMs: frames > 0 ? profile.presentMsTotal / frames : 0,
				frames,
				maxDrawMs: profile.maxDrawMs,
				maxPresentMs: profile.maxPresentMs,
				rawInvalidateCalls: profile.rawInvalidateCalls,
				sampleDurationMs,
				scheduledInvalidateCalls: profile.scheduledInvalidateCalls,
				skippedInvalidateCalls: profile.skippedInvalidateCalls,
			})

			profile.drawMsTotal = 0
			profile.frames = 0
			profile.maxDrawMs = 0
			profile.maxPresentMs = 0
			profile.presentMsTotal = 0
			profile.rawInvalidateCalls = 0
			profile.sampleStartTime = now
			profile.scheduledInvalidateCalls = 0
			profile.skippedInvalidateCalls = 0
		},
		[onProfileSample, profilingEnabled],
	)

	const performDraw = useCallback(() => {
		pendingDrawRef.current = false
		drawNodePictureRef.current()
		if (profilingEnabled) {
			flushProfileSample()
		}
	}, [flushProfileSample, profilingEnabled])

	const scheduleDraw = useCallback(() => {
		if (profilingEnabled) {
			const profile = profileRef.current
			profile.rawInvalidateCalls += 1
			if (profile.sampleStartTime === 0) {
				profile.sampleStartTime = performance.now()
			}
		}

		pendingDrawRef.current = true
		if (activeContinuousNodesRef.current.size > 0) {
			if (profilingEnabled) {
				profileRef.current.skippedInvalidateCalls += 1
			}
			return
		}
		if (scheduledDrawRef.current != null) {
			if (profilingEnabled) {
				profileRef.current.skippedInvalidateCalls += 1
			}
			return
		}
		if (profilingEnabled) {
			profileRef.current.scheduledInvalidateCalls += 1
		}

		scheduledDrawRef.current = requestAnimationFrame(() => {
			scheduledDrawRef.current = null
			if (
				activeContinuousNodesRef.current.size === 0 &&
				pendingDrawRef.current
			) {
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
			interactions,
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
	}, [
		animationBindingMode,
		interactions,
		scheduleDraw,
		startContinuousLoop,
		stopContinuousLoop,
	])

	const canvasGesture = useCanvasGestures({
		externalGesture: gesture,
		interactions,
		node,
	})

	function drawNodePicture() {
		const drawStartTime = profilingEnabled ? performance.now() : 0
		const picture = node.draw() as SkPicture
		if (profilingEnabled) {
			const drawDurationMs = performance.now() - drawStartTime
			const profile = profileRef.current
			profile.drawMsTotal += drawDurationMs
			profile.frames += 1
			profile.maxDrawMs = Math.max(profile.maxDrawMs, drawDurationMs)
		}

		const presentStartTime = profilingEnabled ? performance.now() : 0
		presentPicture(nativeId, picture)
		if (profilingEnabled) {
			const presentDurationMs = performance.now() - presentStartTime
			const profile = profileRef.current
			profile.presentMsTotal += presentDurationMs
			profile.maxPresentMs = Math.max(profile.maxPresentMs, presentDurationMs)
		}
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
			flushProfileSample(true)
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
	}, [flushProfileSample, root, stopContinuousLoop])

	return (
		<GestureDetector gesture={canvasGesture}>
			<SkiaPictureViewNativeComponent
				collapsable={false}
				debug={debug}
				opaque={opaque}
				nativeID={`${nativeId}`}
				onLayout={handleLayout}
				style={style}
				colorSpace={colorSpace}
			/>
		</GestureDetector>
	)
}
