import { type CanvasProps } from "@shopify/react-native-skia"
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
import { type YogaRootContainer, reconciler } from "./Reconciler"
import { SkiaYoga } from "./SkiaYogaObject"
import { NodeCommandKind } from "./specs/SkiaYoga.nitro"
import SkiaYogaViewNativeComponent from "./specs/SkiaYogaViewNativeComponent"
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

const INITIAL_RENDER_RETRY_FRAMES = 8

type NativeProfilePayload = {
	avgDrawMs?: unknown
	avgPresentMs?: unknown
	frames?: unknown
	maxDrawMs?: unknown
	maxPresentMs?: unknown
	sampleDurationMs?: unknown
}

const { SkiaViewNativeId } =
	require("@shopify/react-native-skia/src/views/SkiaViewNativeId") as typeof import("@shopify/react-native-skia/lib/typescript/src/views/SkiaViewNativeId")

function reportError(error: Error) {
	console.error(error)
}

function noop() {}

function toFiniteNumber(value: unknown) {
	return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function parseNativeProfileSample(raw: string): NativeProfilePayload {
	if (!raw) {
		return {}
	}

	try {
		const parsed = JSON.parse(raw) as unknown
		if (typeof parsed !== "object" || parsed == null) {
			return {}
		}
		return parsed as NativeProfilePayload
	} catch {
		return {}
	}
}

export function YogaCanvas({
	children,
	style,
	opaque,
	debug = true,
	colorSpace,
	animationBindingMode = "native",
	gesture,
	onProfileSample,
	profilingEnabled = false,
}: YogaCanvasProps) {
	const nativeId = useMemo(() => {
		return SkiaViewNativeId.current++
	}, [])
	const activeContinuousNodesRef = useRef(new Set<object>())
	const activeNativeAnimationNodesRef = useRef(new Set<object>())
	const rootNodeRef = useRef<ReturnType<typeof createYogaNode> | null>(null)
	const initialRenderRetryFrameRef = useRef<number | null>(null)
	const initialRenderRetryCountRef = useRef(0)
	const profileRef = useRef({
		frames: 0,
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
			const nativeSample = parseNativeProfileSample(
				SkiaYoga.consumeViewProfileSample(nativeId),
			)
			const nativeFrames = toFiniteNumber(nativeSample.frames)
			const fallbackDurationMs = now - sampleStartTime
			const sampleDurationMs =
				toFiniteNumber(nativeSample.sampleDurationMs) ||
				fallbackDurationMs
			if (!force && sampleDurationMs < 1000) {
				return
			}

			const frames = nativeFrames > 0 ? nativeFrames : profile.frames
			onProfileSample({
				avgDrawMs: toFiniteNumber(nativeSample.avgDrawMs),
				avgPresentMs: toFiniteNumber(nativeSample.avgPresentMs),
				frames,
				maxDrawMs: toFiniteNumber(nativeSample.maxDrawMs),
				maxPresentMs: toFiniteNumber(nativeSample.maxPresentMs),
				rawInvalidateCalls: profile.rawInvalidateCalls,
				sampleDurationMs,
				scheduledInvalidateCalls: profile.scheduledInvalidateCalls,
				skippedInvalidateCalls: profile.skippedInvalidateCalls,
			})

			profile.frames = 0
			profile.rawInvalidateCalls = 0
			profile.sampleStartTime = now
			profile.scheduledInvalidateCalls = 0
			profile.skippedInvalidateCalls = 0
		},
		[nativeId, onProfileSample, profilingEnabled],
	)

	const hasActiveAnimationNodes = useCallback(() => {
		return (
			activeContinuousNodesRef.current.size > 0 ||
			activeNativeAnimationNodesRef.current.size > 0
		)
	}, [])

	const syncNativeAnimationState = useCallback(() => {
		const rootNode = rootNodeRef.current
		if (!rootNode) {
			return
		}

		SkiaYoga.attachViewRoot(nativeId, rootNode)
		SkiaYoga.setViewAnimating(nativeId, hasActiveAnimationNodes())
	}, [hasActiveAnimationNodes, nativeId])

	const requestNativeRender = useCallback(() => {
		const rootNode = rootNodeRef.current
		if (!rootNode) {
			if (profilingEnabled) {
				profileRef.current.skippedInvalidateCalls += 1
			}
			return
		}

		SkiaYoga.attachViewRoot(nativeId, rootNode)
		if (profilingEnabled) {
			profileRef.current.scheduledInvalidateCalls += 1
		}
		SkiaYoga.requestViewRender(nativeId)
	}, [nativeId, profilingEnabled])

	const clearInitialRenderRetry = useCallback(() => {
		if (initialRenderRetryFrameRef.current != null) {
			cancelAnimationFrame(initialRenderRetryFrameRef.current)
			initialRenderRetryFrameRef.current = null
		}
	}, [])

	const startInitialRenderRetry = useCallback(() => {
		clearInitialRenderRetry()
		initialRenderRetryCountRef.current = 0

		const tick = () => {
			if (
				initialRenderRetryCountRef.current >=
				INITIAL_RENDER_RETRY_FRAMES
			) {
				initialRenderRetryFrameRef.current = null
				return
			}

			initialRenderRetryCountRef.current += 1
			requestNativeRender()
			initialRenderRetryFrameRef.current = requestAnimationFrame(tick)
		}

		initialRenderRetryFrameRef.current = requestAnimationFrame(tick)
	}, [clearInitialRenderRetry, requestNativeRender])

	const scheduleDraw = useCallback(() => {
		if (profilingEnabled) {
			const profile = profileRef.current
			profile.rawInvalidateCalls += 1
			if (profile.sampleStartTime === 0) {
				profile.sampleStartTime = performance.now()
			}
		}

		requestNativeRender()
	}, [profilingEnabled, requestNativeRender])

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
				} else {
					activeNodes.delete(trackedNode)
				}
				syncNativeAnimationState()
			},
			setNativeAnimationActive: (trackedNode, enabled) => {
				const activeNodes = activeNativeAnimationNodesRef.current
				if (enabled) {
					activeNodes.add(trackedNode)
				} else {
					activeNodes.delete(trackedNode)
				}
				syncNativeAnimationState()
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
		syncNativeAnimationState,
	])
	rootNodeRef.current = node

	const attachViewRoot = useCallback(() => {
		const rootNode = rootNodeRef.current
		if (!rootNode) {
			return
		}

		SkiaYoga.attachViewRoot(nativeId, rootNode)
		syncNativeAnimationState()
	}, [nativeId, syncNativeAnimationState])

	const canvasGesture = useCanvasGestures({
		externalGesture: gesture,
		interactions,
		node,
	})

	function handleLayout(event: LayoutChangeEvent) {
		const { width, height } = event.nativeEvent.layout
		node.setStyle({
			width,
			height,
		})
		attachViewRoot()
		scheduleDraw()
		startInitialRenderRetry()
	}

	useLayoutEffect(() => {
		// @ts-ignore
		reconciler.updateContainerSync(children, root, null, null)
		// @ts-ignore
		reconciler.flushSyncWork()
		reconciler.flushPassiveEffects()

		scheduleDraw()
		startInitialRenderRetry()
	}, [children, root, scheduleDraw, startInitialRenderRetry])

	useEffect(() => {
		if (!profilingEnabled || !onProfileSample) {
			return
		}

		const intervalId = setInterval(() => {
			flushProfileSample()
		}, 1000)

		return () => {
			clearInterval(intervalId)
		}
	}, [flushProfileSample, onProfileSample, profilingEnabled])

	useEffect(() => {
		return () => {
			clearInitialRenderRetry()
			flushProfileSample(true)
			activeContinuousNodesRef.current.clear()
			activeNativeAnimationNodesRef.current.clear()
			SkiaYoga.setViewAnimating(nativeId, false)
			SkiaYoga.detachViewRoot(nativeId)
			reconciler.updateContainer(null, root, null, null)
			// @ts-ignore
			reconciler.flushSyncWork()
			reconciler.flushPassiveEffects()
		}
	}, [clearInitialRenderRetry, flushProfileSample, nativeId, root])

	return (
		<GestureDetector gesture={canvasGesture}>
			<SkiaYogaViewNativeComponent
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
