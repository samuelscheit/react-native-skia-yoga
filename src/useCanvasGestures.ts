import { useCallback, useMemo } from "react"
import {
	Gesture,
	type GestureTouchEvent,
	type GestureType,
} from "react-native-gesture-handler"
import { runOnJS, useSharedValue } from "react-native-reanimated"
import type {
	YogaInteractionRegistry,
	YogaPanEvent,
	YogaPointerEvent,
} from "./interactivity"

type HitTestableYogaNode = {
	hitTest: (x: number, y: number) => number
}

type UseCanvasGesturesOptions = {
	externalGesture?: GestureType
	interactions: YogaInteractionRegistry
	node: HitTestableYogaNode
}

const PAN_START_DISTANCE_SQUARED = 9

function getPrimaryTouch(event: GestureTouchEvent) {
	"worklet"

	return event.changedTouches[0] ?? event.allTouches[0]
}

function makePointerEvent(
	tag: number,
	event: GestureTouchEvent,
): YogaPointerEvent | null {
	"worklet"

	const touch = getPrimaryTouch(event)
	if (!touch) {
		return null
	}

	return {
		absoluteX: touch.absoluteX,
		absoluteY: touch.absoluteY,
		target: tag,
		x: touch.x,
		y: touch.y,
	}
}

function makePanEvent(
	tag: number,
	event: GestureTouchEvent,
	startX: number,
	startY: number,
	lastX: number,
	lastY: number,
	cancelled: boolean,
): YogaPanEvent | null {
	"worklet"

	const touch = getPrimaryTouch(event)
	if (!touch) {
		return null
	}

	return {
		absoluteX: touch.absoluteX,
		absoluteY: touch.absoluteY,
		cancelled,
		changeX: touch.x - lastX,
		changeY: touch.y - lastY,
		target: tag,
		translationX: touch.x - startX,
		translationY: touch.y - startY,
		x: touch.x,
		y: touch.y,
	}
}

export function useCanvasGestures({
	externalGesture,
	interactions,
	node,
}: UseCanvasGesturesOptions) {
	const activeTag = useSharedValue(0)
	const panStarted = useSharedValue(false)
	const pressedInside = useSharedValue(false)
	const startX = useSharedValue(0)
	const startY = useSharedValue(0)
	const lastX = useSharedValue(0)
	const lastY = useSharedValue(0)

	const dispatchPanEnd = useCallback(
		(tag: number, event: YogaPanEvent) => {
			interactions.dispatchPanEnd(tag, event)
		},
		[interactions],
	)
	const dispatchPanStart = useCallback(
		(tag: number, event: YogaPanEvent) => {
			interactions.dispatchPanStart(tag, event)
		},
		[interactions],
	)
	const dispatchPanUpdate = useCallback(
		(tag: number, event: YogaPanEvent) => {
			interactions.dispatchPanUpdate(tag, event)
		},
		[interactions],
	)
	const dispatchPress = useCallback(
		(tag: number, event: YogaPointerEvent) => {
			interactions.dispatchPress(tag, event)
		},
		[interactions],
	)
	const dispatchPressIn = useCallback(
		(tag: number, event: YogaPointerEvent) => {
			interactions.dispatchPressIn(tag, event)
		},
		[interactions],
	)
	const dispatchPressOut = useCallback(
		(tag: number, event: YogaPointerEvent) => {
			interactions.dispatchPressOut(tag, event)
		},
		[interactions],
	)

	const internalGesture = useMemo(() => {
		return Gesture.Manual()
			.manualActivation(true)
			.shouldCancelWhenOutside(false)
			.onTouchesDown((event, stateManager) => {
				"worklet"

				const touch = getPrimaryTouch(event)
				if (!touch || event.allTouches.length !== 1) {
					stateManager.fail()
					return
				}

				const tag = node.hitTest(touch.x, touch.y)
				if (tag <= 0) {
					stateManager.fail()
					return
				}

				activeTag.value = tag
				panStarted.value = false
				pressedInside.value = true
				startX.value = touch.x
				startY.value = touch.y
				lastX.value = touch.x
				lastY.value = touch.y
				stateManager.begin()
				stateManager.activate()

				const pressInEvent = makePointerEvent(tag, event)
				if (pressInEvent) {
					runOnJS(dispatchPressIn)(tag, pressInEvent)
				}
			})
			.onTouchesMove((event) => {
				"worklet"

				const tag = activeTag.value
				if (tag <= 0) {
					return
				}

				const touch = getPrimaryTouch(event)
				if (!touch) {
					return
				}

				if (!panStarted.value) {
					const translationX = touch.x - startX.value
					const translationY = touch.y - startY.value
					const distanceSquared =
						translationX * translationX +
						translationY * translationY

					if (distanceSquared >= PAN_START_DISTANCE_SQUARED) {
						panStarted.value = true
						if (pressedInside.value) {
							pressedInside.value = false
							const pressOutEvent = makePointerEvent(tag, event)
							if (pressOutEvent) {
								runOnJS(dispatchPressOut)(tag, pressOutEvent)
							}
						}

						const panStartEvent = makePanEvent(
							tag,
							event,
							startX.value,
							startY.value,
							lastX.value,
							lastY.value,
							false,
						)
						if (panStartEvent) {
							runOnJS(dispatchPanStart)(tag, panStartEvent)
						}
					} else {
						const isInside = node.hitTest(touch.x, touch.y) === tag
						if (isInside !== pressedInside.value) {
							pressedInside.value = isInside
							const nextEvent = makePointerEvent(tag, event)
							if (nextEvent) {
								if (isInside) {
									runOnJS(dispatchPressIn)(tag, nextEvent)
								} else {
									runOnJS(dispatchPressOut)(tag, nextEvent)
								}
							}
						}
					}
				}

				if (panStarted.value) {
					const panUpdateEvent = makePanEvent(
						tag,
						event,
						startX.value,
						startY.value,
						lastX.value,
						lastY.value,
						false,
					)
					if (panUpdateEvent) {
						runOnJS(dispatchPanUpdate)(tag, panUpdateEvent)
					}
				}

				lastX.value = touch.x
				lastY.value = touch.y
			})
			.onTouchesUp((event, stateManager) => {
				"worklet"

				const tag = activeTag.value
				if (tag <= 0) {
					stateManager.fail()
					return
				}

				if (panStarted.value) {
					const panEndEvent = makePanEvent(
						tag,
						event,
						startX.value,
						startY.value,
						lastX.value,
						lastY.value,
						false,
					)
					if (panEndEvent) {
						runOnJS(dispatchPanEnd)(tag, panEndEvent)
					}
				} else if (pressedInside.value) {
					const pressEvent = makePointerEvent(tag, event)
					if (pressEvent) {
						runOnJS(dispatchPress)(tag, pressEvent)
						runOnJS(dispatchPressOut)(tag, pressEvent)
					}
				}

				activeTag.value = 0
				panStarted.value = false
				pressedInside.value = false
				stateManager.end()
			})
			.onTouchesCancelled((event, stateManager) => {
				"worklet"

				const tag = activeTag.value
				if (tag <= 0) {
					stateManager.fail()
					return
				}

				if (panStarted.value) {
					const panCancelEvent = makePanEvent(
						tag,
						event,
						startX.value,
						startY.value,
						lastX.value,
						lastY.value,
						true,
					)
					if (panCancelEvent) {
						runOnJS(dispatchPanEnd)(tag, panCancelEvent)
					}
				} else if (pressedInside.value) {
					const pressOutEvent = makePointerEvent(tag, event)
					if (pressOutEvent) {
						runOnJS(dispatchPressOut)(tag, pressOutEvent)
					}
				}

				activeTag.value = 0
				panStarted.value = false
				pressedInside.value = false
				stateManager.fail()
			})
	}, [
		activeTag,
		dispatchPanEnd,
		dispatchPanStart,
		dispatchPanUpdate,
		dispatchPress,
		dispatchPressIn,
		dispatchPressOut,
		lastX,
		lastY,
		node,
		panStarted,
		pressedInside,
		startX,
		startY,
	])

	return useMemo(() => {
		if (!externalGesture) {
			return internalGesture
		}

		return Gesture.Simultaneous(internalGesture, externalGesture)
	}, [externalGesture, internalGesture])
}
