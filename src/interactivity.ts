export type YogaPointerEvents = "auto" | "none" | "box-only" | "box-none"

export type YogaHitSlop =
	| number
	| Partial<
			Record<
				"bottom" | "horizontal" | "left" | "right" | "top" | "vertical",
				number
			>
	  >

export type YogaNormalizedHitSlop = {
	bottom: number
	left: number
	right: number
	top: number
}

export type YogaPointerEvent = {
	absoluteX: number
	absoluteY: number
	target: number
	x: number
	y: number
}

export type YogaPanEvent = YogaPointerEvent & {
	cancelled: boolean
	changeX: number
	changeY: number
	translationX: number
	translationY: number
}

export type YogaPressHandler = (event: YogaPointerEvent) => void
export type YogaPanHandler = (event: YogaPanEvent) => void

export type YogaInteractiveProps = {
	hitSlop?: YogaHitSlop
	onPanEnd?: YogaPanHandler
	onPanStart?: YogaPanHandler
	onPanUpdate?: YogaPanHandler
	onPress?: YogaPressHandler
	onPressIn?: YogaPressHandler
	onPressOut?: YogaPressHandler
	pointerEvents?: YogaPointerEvents
	preciseHit?: boolean
}

export type YogaNodeInteractionConfig = {
	eventTag: number
	hitSlop: YogaNormalizedHitSlop
	pointerEvents: YogaPointerEvents
	preciseHit: boolean
}

type InteractiveYogaNode = object & {
	setInteractionConfig: (config: YogaNodeInteractionConfig) => void
}

type RegisteredInteraction = {
	onPanEnd?: YogaPanHandler
	onPanStart?: YogaPanHandler
	onPanUpdate?: YogaPanHandler
	onPress?: YogaPressHandler
	onPressIn?: YogaPressHandler
	onPressOut?: YogaPressHandler
}

const emptyHitSlop: YogaNormalizedHitSlop = {
	bottom: 0,
	left: 0,
	right: 0,
	top: 0,
}

function normalizeHitSlop(
	hitSlop: YogaHitSlop | undefined,
): YogaNormalizedHitSlop {
	if (typeof hitSlop === "number") {
		return {
			bottom: hitSlop,
			left: hitSlop,
			right: hitSlop,
			top: hitSlop,
		}
	}

	if (!hitSlop) {
		return emptyHitSlop
	}

	const horizontal = hitSlop.horizontal ?? 0
	const vertical = hitSlop.vertical ?? 0

	return {
		bottom: (hitSlop.bottom ?? 0) + vertical,
		left: (hitSlop.left ?? 0) + horizontal,
		right: (hitSlop.right ?? 0) + horizontal,
		top: (hitSlop.top ?? 0) + vertical,
	}
}

function isFunction<T extends (...args: any[]) => void>(
	value: unknown,
): value is T {
	return typeof value === "function"
}

export class YogaInteractionRegistry {
	private nextEventTag = 1
	private handlersByTag = new Map<number, RegisteredInteraction>()
	private tagsByNode = new WeakMap<object, number>()

	configureNode(node: InteractiveYogaNode, props: Record<string, unknown>) {
		const interaction: RegisteredInteraction = {
			onPanEnd: isFunction<YogaPanHandler>(props.onPanEnd)
				? props.onPanEnd
				: undefined,
			onPanStart: isFunction<YogaPanHandler>(props.onPanStart)
				? props.onPanStart
				: undefined,
			onPanUpdate: isFunction<YogaPanHandler>(props.onPanUpdate)
				? props.onPanUpdate
				: undefined,
			onPress: isFunction<YogaPressHandler>(props.onPress)
				? props.onPress
				: undefined,
			onPressIn: isFunction<YogaPressHandler>(props.onPressIn)
				? props.onPressIn
				: undefined,
			onPressOut: isFunction<YogaPressHandler>(props.onPressOut)
				? props.onPressOut
				: undefined,
		}

		const hasHandlers = Object.values(interaction).some(Boolean)
		const existingTag = this.tagsByNode.get(node)
		const tag = existingTag ?? this.nextEventTag++
		if (!existingTag) {
			this.tagsByNode.set(node, tag)
		}

		if (hasHandlers) {
			this.handlersByTag.set(tag, interaction)
		} else {
			this.handlersByTag.delete(tag)
		}

		node.setInteractionConfig({
			eventTag: hasHandlers ? tag : 0,
			hitSlop: normalizeHitSlop(props.hitSlop as YogaHitSlop | undefined),
			pointerEvents:
				typeof props.pointerEvents === "string"
					? (props.pointerEvents as YogaPointerEvents)
					: "auto",
			preciseHit: props.preciseHit === true,
		})
	}

	unregisterNode(node: InteractiveYogaNode) {
		const tag = this.tagsByNode.get(node)
		if (tag != null) {
			this.handlersByTag.delete(tag)
		}

		node.setInteractionConfig({
			eventTag: 0,
			hitSlop: emptyHitSlop,
			pointerEvents: "auto",
			preciseHit: false,
		})
	}

	dispatchPanEnd = (tag: number, event: YogaPanEvent) => {
		this.handlersByTag.get(tag)?.onPanEnd?.(event)
	}

	dispatchPanStart = (tag: number, event: YogaPanEvent) => {
		this.handlersByTag.get(tag)?.onPanStart?.(event)
	}

	dispatchPanUpdate = (tag: number, event: YogaPanEvent) => {
		this.handlersByTag.get(tag)?.onPanUpdate?.(event)
	}

	dispatchPress = (tag: number, event: YogaPointerEvent) => {
		this.handlersByTag.get(tag)?.onPress?.(event)
	}

	dispatchPressIn = (tag: number, event: YogaPointerEvent) => {
		this.handlersByTag.get(tag)?.onPressIn?.(event)
	}

	dispatchPressOut = (tag: number, event: YogaPointerEvent) => {
		this.handlersByTag.get(tag)?.onPressOut?.(event)
	}
}
