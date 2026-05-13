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

const maxNativeFloat = 3.4028234663852886e38

function validateHitSlopNumber(value: number, propertyPath: string): number {
	if (!Number.isFinite(value) || Math.abs(value) > maxNativeFloat) {
		throw new Error(
			`Invalid hitSlop value for ${propertyPath}: expected a finite native float.`,
		)
	}
	return value
}

function throwInvalidHitSlopValue(propertyPath: string): never {
	throw new Error(
		`Invalid hitSlop value for ${propertyPath}: expected a finite native float.`,
	)
}

function throwInvalidHitSlopShape(propertyPath: string): never {
	throw new Error(
		`Invalid hitSlop value for ${propertyPath}: expected a finite native float, non-array object, null, or undefined.`,
	)
}

function validateHitSlopLeaf(value: unknown, propertyPath: string): number {
	if (value == null) {
		return 0
	}
	if (typeof value !== "number") {
		return throwInvalidHitSlopValue(propertyPath)
	}
	return validateHitSlopNumber(value, propertyPath)
}

function addHitSlopValues(
	value: number,
	axis: number,
	propertyPath: string,
): number {
	return validateHitSlopNumber(value + axis, propertyPath)
}

function normalizeHitSlop(
	hitSlop: YogaHitSlop | undefined,
): YogaNormalizedHitSlop {
	if (typeof hitSlop === "number") {
		const inset = validateHitSlopNumber(hitSlop, "hitSlop")
		return {
			bottom: inset,
			left: inset,
			right: inset,
			top: inset,
		}
	}

	if (hitSlop == null) {
		return emptyHitSlop
	}
	if (typeof hitSlop !== "object" || Array.isArray(hitSlop)) {
		return throwInvalidHitSlopShape("hitSlop")
	}

	const hitSlopRecord = hitSlop as Record<string, unknown>
	const horizontal = validateHitSlopLeaf(
		hitSlopRecord.horizontal,
		"hitSlop.horizontal",
	)
	const vertical = validateHitSlopLeaf(
		hitSlopRecord.vertical,
		"hitSlop.vertical",
	)

	return {
		bottom: addHitSlopValues(
			validateHitSlopLeaf(hitSlopRecord.bottom, "hitSlop.bottom"),
			vertical,
			"hitSlop.bottom",
		),
		left: addHitSlopValues(
			validateHitSlopLeaf(hitSlopRecord.left, "hitSlop.left"),
			horizontal,
			"hitSlop.left",
		),
		right: addHitSlopValues(
			validateHitSlopLeaf(hitSlopRecord.right, "hitSlop.right"),
			horizontal,
			"hitSlop.right",
		),
		top: addHitSlopValues(
			validateHitSlopLeaf(hitSlopRecord.top, "hitSlop.top"),
			vertical,
			"hitSlop.top",
		),
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
		const hitSlop = normalizeHitSlop(props.hitSlop as YogaHitSlop | undefined)
		const pointerEvents =
			typeof props.pointerEvents === "string"
				? (props.pointerEvents as YogaPointerEvents)
				: "auto"
		const preciseHit = props.preciseHit === true
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
			hitSlop,
			pointerEvents,
			preciseHit,
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
