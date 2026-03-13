import { BlurStyle, FillType, PointMode } from "@shopify/react-native-skia"
import { NodeCommandKind } from "./specs/SkiaYoga.nitro"
import type {
	BlurStyleName,
	NodeCommand,
	NodeType,
	PathFillType,
	PointModeName,
} from "./specs/SkiaYoga.nitro"
import type { SharedValue } from "react-native-reanimated"
import { isSharedValue } from "react-native-reanimated"
import {
	createSynchronizable,
	executeOnUIRuntimeSync,
	runOnJS,
	type Synchronizable,
} from "react-native-worklets"
import Reconciler from "react-reconciler"
import { DefaultEventPriority } from "react-reconciler/constants"
import type { YogaNodeFinal } from "./index"
import type { NodeStyle } from "./specs/style"
import { createYogaNode } from "./util"

export type SkiaYogaHostContext = any

export interface YogaRootContainer {
	invalidate: () => void
	nativeCommandBindingsEnabled: boolean
	node: YogaNodeFinal
	setContinuousRedraw: (node: YogaNodeFinal, enabled: boolean) => void
}

type YogaNodeProps = Record<string, unknown> & {
	style?: unknown
	text?: unknown
}

type AnimatedListener = {
	id: number
	value: SharedValue<unknown>
}

type NativeAnimatedBinding = {
	id: number
	synchronizable: Synchronizable<unknown>
	value: SharedValue<unknown>
}

type AnimatedValuesMap = Map<string, unknown>

type NodeState = {
	continuousRedraw: boolean
	commandAnimatedValues: AnimatedValuesMap
	commandListeners: Map<string, AnimatedListener>
	commandNativeBindings: Map<string, NativeAnimatedBinding>
	invalidate: () => void
	lastProps: YogaNodeProps
	nativeCommandBindingsEnabled: boolean
	setContinuousRedraw: (node: YogaNodeFinal, enabled: boolean) => void
	styleAnimatedValues: AnimatedValuesMap
	styleListeners: Map<string, AnimatedListener>
	type: NodeType
}

const nodeStates = new WeakMap<YogaNodeFinal, NodeState>()

let priority = DefaultEventPriority
let nextListenerId = 1

const commandPropKeys: Record<NodeType, readonly string[]> = {
	blurMaskFilter: ["blur", "blurStyle", "respectCTM"],
	circle: ["radius"],
	group: ["rasterize"],
	image: ["fit", "image", "sampling"],
	line: ["from", "to"],
	oval: [],
	paragraph: ["paragraph", "paragraphStyle", "text"],
	path: ["fillType", "path", "stroke", "trimEnd", "trimStart"],
	points: ["pointMode", "points"],
	rect: [],
	rrect: ["cornerRadius"],
	text: ["font", "text", "textStyle"],
}

const commandNestedRoots = new Set([
	"from",
	"paragraphStyle",
	"points",
	"stroke",
	"textStyle",
	"to",
])

const styleNestedRoots = new Set([
	"borderBottomLeftRadius",
	"borderBottomRightRadius",
	"borderTopLeftRadius",
	"borderTopRightRadius",
	"origin",
	"transform",
])

const scalarCornerRadiusKeys = [
	"borderBottomLeftRadius",
	"borderBottomRightRadius",
	"borderTopLeftRadius",
	"borderTopRightRadius",
] as const

function isStyleObject(value: unknown): value is NodeStyle {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

function normalizeStyle(style: Record<string, unknown>): NodeStyle {
	let nextStyle: Record<string, unknown> | undefined

	for (const key of scalarCornerRadiusKeys) {
		const value = style[key]
		if (typeof value !== "number" && !isSharedValue(value)) {
			continue
		}

		if (!nextStyle) {
			nextStyle = { ...style }
		}

		nextStyle[key] = {
			x: value,
			y: value,
		}
	}

	return (nextStyle ?? style) as NodeStyle
}

function sanitizeProps(props: YogaNodeProps | null | undefined): YogaNodeProps {
	if (!props) {
		return {}
	}

	const nextProps: YogaNodeProps = { ...props }
	delete (nextProps as Record<string, unknown>).children
	return nextProps
}

function getNodeState(
	node: YogaNodeFinal,
	type: NodeType,
	invalidate?: () => void,
	setContinuousRedraw?: (node: YogaNodeFinal, enabled: boolean) => void,
	nativeCommandBindingsEnabled?: boolean,
): NodeState {
	const existing = nodeStates.get(node)
	if (existing) {
		existing.type = type
		if (invalidate) {
			existing.invalidate = invalidate
		}
		if (setContinuousRedraw) {
			existing.setContinuousRedraw = setContinuousRedraw
		}
		if (nativeCommandBindingsEnabled != null) {
			existing.nativeCommandBindingsEnabled = nativeCommandBindingsEnabled
		}
		return existing
	}

	const state: NodeState = {
		continuousRedraw: false,
		commandAnimatedValues: new Map(),
		commandListeners: new Map(),
		commandNativeBindings: new Map(),
		invalidate: invalidate ?? (() => {}),
		lastProps: {},
		nativeCommandBindingsEnabled: nativeCommandBindingsEnabled ?? true,
		setContinuousRedraw: setContinuousRedraw ?? (() => {}),
		styleAnimatedValues: new Map(),
		styleListeners: new Map(),
		type,
	}

	nodeStates.set(node, state)
	return state
}

function removeAnimatedListeners(listeners: Map<string, AnimatedListener>) {
	for (const { id, value } of listeners.values()) {
		executeOnUIRuntimeSync(
			(sharedValue: SharedValue<unknown>, listenerId: number) => {
				"worklet"
				sharedValue.removeListener(listenerId)
			},
		)(value, id)
	}

	listeners.clear()
}

function removeNativeAnimatedBindings(bindings: Map<string, NativeAnimatedBinding>) {
	for (const { id, value } of bindings.values()) {
		executeOnUIRuntimeSync(
			(sharedValue: SharedValue<unknown>, listenerId: number) => {
				"worklet"
				sharedValue.removeListener(listenerId)
			},
		)(value, id)
	}

	bindings.clear()
}

function resetAnimatedState(
	listeners: Map<string, AnimatedListener>,
	values?: AnimatedValuesMap,
) {
	removeAnimatedListeners(listeners)
	values?.clear()
}

function resetNativeAnimatedBindings(bindings: Map<string, NativeAnimatedBinding>) {
	removeNativeAnimatedBindings(bindings)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return false
	}

	const prototype = Object.getPrototypeOf(value)
	return prototype === Object.prototype || prototype === null
}

function pathToKey(path: readonly string[]) {
	return path.join(".")
}

function shouldTraverseNestedValue(
	path: readonly string[],
	nestedRoots: ReadonlySet<string>,
) {
	if (path.length === 0) {
		return true
	}

	return nestedRoots.has(path[0]!)
}

function addAnimatedListener(
	value: SharedValue<unknown>,
	key: string,
	listeners: Map<string, AnimatedListener>,
	onUpdate: (listenerKey: string, nextValue: unknown) => void,
) {
	const listenerId = nextListenerId++
	listeners.set(key, { id: listenerId, value })

	executeOnUIRuntimeSync(
		(
			sharedValue: SharedValue<unknown>,
			listenerKey: string,
			currentListenerId: number,
			onUpdateOnJS: (listenerKey: string, nextValue: unknown) => void,
		) => {
			"worklet"
			sharedValue.addListener(currentListenerId, (nextValue: unknown) => {
				runOnJS(onUpdateOnJS as (listenerKey: string, nextValue: unknown) => void)(
					listenerKey,
					nextValue,
				)
			})
		},
	)(value, key, listenerId, onUpdate)
}

function supportsNativeCommandBinding(type: NodeType, path: readonly string[]) {
	if (path.length !== 1) {
		return false
	}

	switch (type) {
		case "blurMaskFilter":
			return path[0] === "blur"
		case "circle":
			return path[0] === "radius"
		case "path":
			return path[0] === "trimEnd" || path[0] === "trimStart"
		case "rrect":
			return path[0] === "cornerRadius"
		default:
			return false
	}
}

function createNativeAnimatedBinding(
	value: SharedValue<unknown>,
	key: string,
	bindings: Map<string, NativeAnimatedBinding>,
	invalidate: () => void,
) {
	const listenerId = nextListenerId++
	const synchronizable = createSynchronizable(value.value)

	executeOnUIRuntimeSync(
		(
			sharedValue: SharedValue<unknown>,
			mirror: Synchronizable<unknown>,
			currentListenerId: number,
			invalidateOnJS: () => void,
		) => {
			"worklet"
			sharedValue.addListener(currentListenerId, (nextValue: unknown) => {
				mirror.setBlocking(nextValue)
				runOnJS(invalidateOnJS)()
			})
		},
	)(value, synchronizable, listenerId, invalidate)

	bindings.set(key, { id: listenerId, synchronizable, value })
	return synchronizable
}

function bindAnimatedValues(
	value: unknown,
	listeners: Map<string, AnimatedListener>,
	nativeBindings: Map<string, NativeAnimatedBinding>,
	values: AnimatedValuesMap,
	onUpdate: (listenerKey: string, nextValue: unknown) => void,
	nestedRoots: ReadonlySet<string>,
	type?: NodeType,
	invalidate?: () => void,
	nativeCommandBindingsEnabled = true,
	path: readonly string[] = [],
): unknown {
	if (isSharedValue(value)) {
		const key = pathToKey(path)
		if (
			nativeCommandBindingsEnabled &&
			type &&
			invalidate &&
			supportsNativeCommandBinding(type, path)
		) {
			return createNativeAnimatedBinding(value, key, nativeBindings, invalidate)
		}
		values.set(key, value.value)
		addAnimatedListener(value, key, listeners, onUpdate)
		return value.value
	}

	if (!shouldTraverseNestedValue(path, nestedRoots)) {
		return value
	}

	if (Array.isArray(value)) {
		return value.map((entry, index) =>
			bindAnimatedValues(
				entry,
				listeners,
				nativeBindings,
				values,
				onUpdate,
				nestedRoots,
				type,
				invalidate,
				nativeCommandBindingsEnabled,
				[
				...path,
				String(index),
				],
			),
		)
	}

	if (isPlainObject(value)) {
		const resolved: Record<string, unknown> = {}
		for (const [key, entry] of Object.entries(value)) {
			resolved[key] = bindAnimatedValues(
				entry,
				listeners,
				nativeBindings,
				values,
				onUpdate,
				nestedRoots,
				type,
				invalidate,
				nativeCommandBindingsEnabled,
				[...path, key],
			)
		}
		return resolved
	}

	return value
}

function resolveAnimatedSnapshot(
	value: unknown,
	values: AnimatedValuesMap,
	nestedRoots: ReadonlySet<string>,
	path: readonly string[] = [],
): unknown {
	if (isSharedValue(value)) {
		const key = pathToKey(path)
		return values.has(key) ? values.get(key) : value.value
	}

	if (!shouldTraverseNestedValue(path, nestedRoots)) {
		return value
	}

	if (Array.isArray(value)) {
		return value.map((entry, index) =>
			resolveAnimatedSnapshot(entry, values, nestedRoots, [...path, String(index)]),
		)
	}

	if (isPlainObject(value)) {
		const resolved: Record<string, unknown> = {}
		for (const [key, entry] of Object.entries(value)) {
			resolved[key] = resolveAnimatedSnapshot(
				entry,
				values,
				nestedRoots,
				[...path, key],
			)
		}
		return resolved
	}

	return value
}

function pickProps(props: YogaNodeProps, keys: readonly string[]) {
	const subset: YogaNodeProps = {}
	for (const key of keys) {
		if (key in props) {
			subset[key] = props[key]
		}
	}
	return subset
}

function getResolvedStyle(state: NodeState) {
	if (!isStyleObject(state.lastProps.style)) {
		return {}
	}

	return normalizeStyle(
		resolveAnimatedSnapshot(
		state.lastProps.style,
		state.styleAnimatedValues,
		styleNestedRoots,
		) as NodeStyle,
	)
}

function resolveAnimatedStyle(
	instance: YogaNodeFinal,
	state: NodeState,
	props: YogaNodeProps,
) {
	if (!isStyleObject(props.style)) {
		resetAnimatedState(state.styleListeners, state.styleAnimatedValues)
		return {}
	}

	resetAnimatedState(state.styleListeners, state.styleAnimatedValues)
	const style = props.style as Record<string, unknown>
	return normalizeStyle(
		bindAnimatedValues(
		style,
		state.styleListeners,
		new Map<string, NativeAnimatedBinding>(),
		state.styleAnimatedValues,
		(listenerKey, nextValue) => {
			state.styleAnimatedValues.set(listenerKey, nextValue)
			instance.setStyle(getResolvedStyle(state))
			state.invalidate()
		},
		styleNestedRoots,
		undefined,
		undefined,
		true,
		) as NodeStyle,
	)
}

function shouldUseContinuousRedraw(style: unknown) {
	if (!isStyleObject(style)) {
		return false
	}

	const matrix = style.matrix
	if (matrix == null || isSharedValue(matrix) || Array.isArray(matrix)) {
		return false
	}

	return true
}

function requireProp<T>(type: NodeType, props: YogaNodeProps, key: string): T {
	const value = props[key]
	if (value == null) {
		throw new Error(`<${type}> requires the "${key}" prop.`)
	}

	return value as T
}

function normalizeBlurStyle(value: unknown): BlurStyleName | undefined {
	if (value == null) {
		return undefined
	}
	if (typeof value === "string") {
		return value as BlurStyleName
	}

	switch (value) {
		case BlurStyle.Normal:
			return "normal"
		case BlurStyle.Solid:
			return "solid"
		case BlurStyle.Outer:
			return "outer"
		case BlurStyle.Inner:
			return "inner"
		default:
			throw new Error(`Unsupported blurStyle value: ${String(value)}`)
	}
}

function normalizePointMode(value: unknown): PointModeName | undefined {
	if (value == null) {
		return undefined
	}
	if (typeof value === "string") {
		return value as PointModeName
	}

	switch (value) {
		case PointMode.Points:
			return "points"
		case PointMode.Lines:
			return "lines"
		case PointMode.Polygon:
			return "polygon"
		default:
			throw new Error(`Unsupported pointMode value: ${String(value)}`)
	}
}

function normalizePathFillType(value: unknown): PathFillType | undefined {
	if (value == null) {
		return undefined
	}
	if (typeof value === "string") {
		return value as PathFillType
	}

	switch (value) {
		case FillType.Winding:
			return "winding"
		case FillType.EvenOdd:
			return "evenOdd"
		case FillType.InverseWinding:
			return "inverseWinding"
		case FillType.InverseEvenOdd:
			return "inverseEvenOdd"
		default:
			throw new Error(`Unsupported fillType value: ${String(value)}`)
	}
}

function optionalBoolean(value: unknown) {
	return typeof value === "boolean" ? value : undefined
}

function optionalCommandNumber(value: unknown) {
	return value == null ? undefined : (value as any)
}

function createCommand<TData extends Record<string, unknown>>(
	type: NodeCommandKind,
	data: TData,
): NodeCommand {
	return { type, data } as NodeCommand
}

function buildNodeCommand(type: NodeType, props: YogaNodeProps): NodeCommand {
	switch (type) {
		case "group":
			return createCommand(NodeCommandKind.Group, {
				rasterize: optionalBoolean(props.rasterize),
			})
		case "rect":
			return createCommand(NodeCommandKind.Rect, {})
		case "rrect":
			return createCommand(NodeCommandKind.RoundedRect, {
				cornerRadius: optionalCommandNumber(props.cornerRadius),
			})
		case "circle":
			return createCommand(NodeCommandKind.Circle, {
				radius: optionalCommandNumber(props.radius),
			})
		case "oval":
			return createCommand(NodeCommandKind.Oval, {})
		case "text":
			return createCommand(NodeCommandKind.Text, {
				font: props.font as any,
				text: typeof props.text === "string" ? props.text : undefined,
				textStyle: props.textStyle as any,
			})
		case "paragraph":
			return createCommand(NodeCommandKind.Paragraph, {
				paragraph: props.paragraph == null ? undefined : (props.paragraph as any),
				paragraphStyle: props.paragraphStyle as any,
				text: typeof props.text === "string" ? props.text : undefined,
			})
		case "path":
			return createCommand(NodeCommandKind.Path, {
				fillType: normalizePathFillType(props.fillType),
				path: requireProp<any>(type, props, "path"),
				stroke: props.stroke as any,
				trimEnd: optionalCommandNumber(props.trimEnd),
				trimStart: optionalCommandNumber(props.trimStart),
			})
		case "line":
			return createCommand(NodeCommandKind.Line, {
				from: requireProp<any>(type, props, "from"),
				to: requireProp<any>(type, props, "to"),
			})
		case "points":
			return createCommand(NodeCommandKind.Points, {
				pointMode: normalizePointMode(props.pointMode),
				points: requireProp<any>(type, props, "points"),
			})
		case "image":
			return createCommand(NodeCommandKind.Image, {
				fit: props.fit as any,
				image: props.image == null ? null : (props.image as any),
				sampling: props.sampling as any,
			})
		case "blurMaskFilter":
			return createCommand(NodeCommandKind.BlurMaskFilter, {
				blur: optionalCommandNumber(props.blur),
				blurStyle: normalizeBlurStyle(props.blurStyle),
				respectCTM: optionalBoolean(props.respectCTM),
			})
		default: {
			const exhaustiveType: never = type
			throw new Error(`Unsupported node type: ${exhaustiveType}`)
		}
	}
}

function getResolvedCommandProps(state: NodeState): YogaNodeProps {
	return resolveAnimatedSnapshot(
		pickProps(state.lastProps, commandPropKeys[state.type]),
		state.commandAnimatedValues,
		commandNestedRoots,
	) as YogaNodeProps
}

function applyResolvedCommand(instance: YogaNodeFinal, state: NodeState) {
	setNodeCommand(instance, state.type, buildNodeCommand(state.type, getResolvedCommandProps(state)))
}

function formatCommandForError(command: NodeCommand) {
	const data = command.data
	return {
		commandType: command.type,
		dataIsArray: Array.isArray(data),
		dataKeys:
			typeof data === "object" && data !== null ? Object.keys(data) : undefined,
		dataType: data === null ? "null" : typeof data,
	}
}

function setNodeCommand(
	instance: YogaNodeFinal,
	type: NodeType,
	command: NodeCommand,
) {
	try {
		instance.setCommand(command)
	} catch (error) {
		const details = formatCommandForError(command)
		throw new Error(
			[
				`Failed to set command for <${type}>.`,
				`command=${JSON.stringify(command)}`,
				`details=${JSON.stringify(details)}`,
				`cause=${error instanceof Error ? error.message : String(error)}`,
			].join(" "),
		)
	}
}

function resolveAnimatedCommand(
	instance: YogaNodeFinal,
	state: NodeState,
	props: YogaNodeProps,
) {
	resetAnimatedState(state.commandListeners, state.commandAnimatedValues)
	resetNativeAnimatedBindings(state.commandNativeBindings)
	return bindAnimatedValues(
		pickProps(props, commandPropKeys[state.type]),
		state.commandListeners,
		state.commandNativeBindings,
		state.commandAnimatedValues,
		(listenerKey, nextValue) => {
			state.commandAnimatedValues.set(listenerKey, nextValue)
			applyResolvedCommand(instance, state)
			state.invalidate()
		},
		commandNestedRoots,
		state.type,
		state.invalidate,
		state.nativeCommandBindingsEnabled,
	) as YogaNodeProps
}

function applyProps(
	instance: YogaNodeFinal,
	type: NodeType,
	props: YogaNodeProps | null | undefined,
	invalidate?: () => void,
	setContinuousRedraw?: (node: YogaNodeFinal, enabled: boolean) => void,
	nativeCommandBindingsEnabled?: boolean,
) {
	const nextProps = sanitizeProps(props)
	const normalizedStyle = isStyleObject(nextProps.style)
		? normalizeStyle(nextProps.style as Record<string, unknown>)
		: nextProps.style
	const state = getNodeState(
		instance,
		type,
		invalidate,
		setContinuousRedraw,
		nativeCommandBindingsEnabled,
	)
	state.lastProps =
		normalizedStyle === nextProps.style
			? nextProps
			: {
					...nextProps,
					style: normalizedStyle,
				}

	const resolvedCommandProps = resolveAnimatedCommand(instance, state, state.lastProps)
	const resolvedStyle = resolveAnimatedStyle(instance, state, state.lastProps)
	const needsContinuousRedraw = shouldUseContinuousRedraw(state.lastProps.style)

	if (state.continuousRedraw !== needsContinuousRedraw) {
		state.continuousRedraw = needsContinuousRedraw
		state.setContinuousRedraw(instance, needsContinuousRedraw)
	}

	setNodeCommand(instance, type, buildNodeCommand(type, resolvedCommandProps))
	instance.setStyle(resolvedStyle)
}

function updateTextContent(instance: YogaNodeFinal, text: string) {
	const state = nodeStates.get(instance)

	applyProps(
		instance,
		state?.type ?? "text",
		{
			...(state?.lastProps ?? {}),
			text,
		},
		state?.invalidate,
	)
}

function cleanupNode(node: YogaNodeFinal) {
	const state = nodeStates.get(node)
	if (state) {
		if (state.continuousRedraw) {
			state.setContinuousRedraw(node, false)
		}
		resetAnimatedState(state.commandListeners, state.commandAnimatedValues)
		resetNativeAnimatedBindings(state.commandNativeBindings)
		resetAnimatedState(state.styleListeners, state.styleAnimatedValues)
		nodeStates.delete(node)
	}

	for (const child of node.getChildren()) {
		cleanupNode(child)
	}
}

const config: SkiaYogaHostContext = {
	supportsMutation: true,
	supportsPersistence: false,
	createInstance(
		type: NodeType,
		props: YogaNodeProps | null | undefined,
		rootContainer: YogaRootContainer,
	) {
		const node = createYogaNode()
		applyProps(
			node,
			type,
			props,
			rootContainer.invalidate,
			rootContainer.setContinuousRedraw,
			rootContainer.nativeCommandBindingsEnabled,
		)
		return node
	},
	scheduleTimeout(fn: (...args: never[]) => void, delay?: number) {
		return setTimeout(fn, delay ?? 0)
	},
	cancelTimeout(id: ReturnType<typeof setTimeout>) {
		clearTimeout(id)
	},
	noTimeout: -1,
	supportsMicrotasks: true,
	scheduleMicrotask(fn: () => void) {
		queueMicrotask(fn)
	},
	createTextInstance(_text: string) {
		throw new Error('Use the "text" prop on <text> and <paragraph>; raw text children are unsupported.')
	},
	removeChildFromContainer(container: YogaRootContainer, child: YogaNodeFinal) {
		container.node.removeChild(child)
	},
	appendChildToContainer(container: YogaRootContainer, child: YogaNodeFinal) {
		container.node.insertChild(child)
	},
	appendInitialChild(parentInstance: YogaNodeFinal, child: YogaNodeFinal) {
		parentInstance.insertChild(child)
	},
	finalizeInitialChildren(
		_instance: YogaNodeFinal,
		_type: NodeType,
		_props: YogaNodeProps,
		_rootContainer: YogaRootContainer,
		_hostContext: unknown,
	) {
		return false
	},
	shouldSetTextContent() {
		return false
	},
	getRootHostContext(rootContainer: YogaRootContainer) {
		return rootContainer
	},
	getChildHostContext(
		parentHostContext: YogaRootContainer,
		_type: NodeType,
		_rootContainer: YogaRootContainer,
	) {
		return parentHostContext
	},
	getPublicInstance(instance: YogaNodeFinal) {
		return instance
	},
	prepareForCommit(_containerInfo: YogaRootContainer) {
		return null
	},
	resetAfterCommit(containerInfo: YogaRootContainer) {
		containerInfo.invalidate()
	},
	preparePortalMount(_containerInfo: YogaRootContainer) {},
	resolveUpdatePriority() {
		return priority
	},
	setCurrentUpdatePriority(newPriority: number) {
		priority = newPriority
	},
	isPrimaryRenderer: false,
	getCurrentUpdatePriority() {
		return DefaultEventPriority
	},
	prepareUpdate() {
		return true
	},
	appendChild(parentInstance: YogaNodeFinal, child: YogaNodeFinal) {
		parentInstance.insertChild(child)
	},
	insertBefore(
		parentInstance: YogaNodeFinal,
		child: YogaNodeFinal,
		beforeChild: YogaNodeFinal,
	) {
		parentInstance.insertChild(child, beforeChild)
	},
	removeChild(parentInstance: YogaNodeFinal, child: YogaNodeFinal) {
		parentInstance.removeChild(child)
	},
	resetTextContent(instance: YogaNodeFinal) {
		updateTextContent(instance, "")
	},
	commitTextUpdate(textInstance: YogaNodeFinal, _oldText: string, newText: string) {
		updateTextContent(textInstance, newText)
	},
	commitMount(
		_instance: YogaNodeFinal,
		_type: NodeType,
		_props: YogaNodeProps,
		_internalInstanceHandle: unknown,
	) {},
	commitUpdate(
		instance: YogaNodeFinal,
		type: NodeType,
		_prevProps: YogaNodeProps,
		nextProps: YogaNodeProps,
		_internalHandle: unknown,
	) {
		const state = nodeStates.get(instance)
		applyProps(
			instance,
			type,
			nextProps,
			state?.invalidate,
			state?.setContinuousRedraw,
			state?.nativeCommandBindingsEnabled,
		)
	},
	clearContainer(container: YogaRootContainer) {
		for (const child of container.node.getChildren()) {
			cleanupNode(child)
		}
		container.node.removeAllChildren()
	},
	maySuspendCommit(_type: string, _props: YogaNodeProps) {
		return false
	},
	detachDeletedInstance(node: YogaNodeFinal) {
		cleanupNode(node)
	},
}

export const reconciler = Reconciler(config)
