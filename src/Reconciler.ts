import { BlurStyle, FillType, PointMode } from "@shopify/react-native-skia"
import { NitroModules } from "react-native-nitro-modules"
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
import { executeOnUIRuntimeSync, runOnJS } from "react-native-worklets"
import Reconciler from "react-reconciler"
import { DefaultEventPriority } from "react-reconciler/constants"
import type { YogaNodeFinal } from "./index"
import type { NodeStyle } from "./specs/style"
import { createYogaNode } from "./util"

export type SkiaYogaHostContext = any

export interface YogaRootContainer {
	invalidate: () => void
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

type AnimatedValuesMap = Map<string, unknown>

type NodeState = {
	boxedNode: any
	continuousRedraw: boolean
	commandAnimatedValues: AnimatedValuesMap
	commandListeners: Map<string, AnimatedListener>
	invalidate: () => void
	lastProps: YogaNodeProps
	setContinuousRedraw: (node: YogaNodeFinal, enabled: boolean) => void
	styleListeners: Map<string, AnimatedListener>
	type: NodeType
}

const nodeStates = new WeakMap<YogaNodeFinal, NodeState>()

let priority = DefaultEventPriority
let nextListenerId = 1

const commandPropKeys: Record<NodeType, readonly string[]> = {
	blurMaskFilter: ["blur", "blurStyle", "respectCTM"],
	circle: ["radius"],
	group: [],
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

function isStyleObject(value: unknown): value is NodeStyle {
	return typeof value === "object" && value !== null && !Array.isArray(value)
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
		return existing
	}

	const state: NodeState = {
		boxedNode: NitroModules.box(node),
		continuousRedraw: false,
		commandAnimatedValues: new Map(),
		commandListeners: new Map(),
		invalidate: invalidate ?? (() => {}),
		lastProps: {},
		setContinuousRedraw: setContinuousRedraw ?? (() => {}),
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

function resetAnimatedState(
	listeners: Map<string, AnimatedListener>,
	values?: AnimatedValuesMap,
) {
	removeAnimatedListeners(listeners)
	values?.clear()
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

function resolveAnimatedProps(
	props: Record<string, unknown>,
	keys: Iterable<string>,
	listeners: Map<string, AnimatedListener>,
	onUpdate: (listenerKey: string, nextValue: unknown) => void,
	values?: AnimatedValuesMap,
) {
	resetAnimatedState(listeners, values)

	const resolvedProps: Record<string, unknown> = { ...props }

	for (const key of keys) {
		const value = props[key]
		if (!isSharedValue(value)) {
			continue
		}

		resolvedProps[key] = value.value
		values?.set(key, value.value)
		addAnimatedListener(value, key, listeners, onUpdate)
	}

	return resolvedProps
}

function resolveAnimatedStyle(state: NodeState, props: YogaNodeProps) {
	if (!isStyleObject(props.style)) {
		resetAnimatedState(state.styleListeners)
		return {}
	}

	const style = props.style as Record<string, unknown>
	return resolveAnimatedProps(
		style,
		Object.keys(style),
		state.styleListeners,
		(listenerKey, nextValue) => {
			state.boxedNode.unbox().setStyle({
				[listenerKey]: nextValue,
			})
			state.invalidate()
		},
	) as NodeStyle
}

function shouldUseContinuousRedraw(style: unknown) {
	if (!isStyleObject(style)) {
		return false
	}

	return style.matrix != null
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

function optionalNumber(value: unknown) {
	return typeof value === "number" ? value : undefined
}

function optionalBoolean(value: unknown) {
	return typeof value === "boolean" ? value : undefined
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
			return createCommand(NodeCommandKind.Group, {})
		case "rect":
			return createCommand(NodeCommandKind.Rect, {})
		case "rrect":
			return createCommand(NodeCommandKind.RoundedRect, {
				cornerRadius: optionalNumber(props.cornerRadius),
			})
		case "circle":
			return createCommand(NodeCommandKind.Circle, {
				radius: optionalNumber(props.radius),
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
				paragraph: props.paragraph == null ? null : (props.paragraph as any),
				paragraphStyle: props.paragraphStyle as any,
				text: typeof props.text === "string" ? props.text : undefined,
			})
		case "path":
			return createCommand(NodeCommandKind.Path, {
				fillType: normalizePathFillType(props.fillType),
				path: requireProp<any>(type, props, "path"),
				stroke: props.stroke as any,
				trimEnd: optionalNumber(props.trimEnd),
				trimStart: optionalNumber(props.trimStart),
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
				blur: optionalNumber(props.blur),
				blurStyle: normalizeBlurStyle(props.blurStyle),
				respectCTM: optionalBoolean(props.respectCTM),
			})
		default: {
			const exhaustiveType: never = type
			throw new Error(`Unsupported node type: ${exhaustiveType}`)
		}
	}
}

function resolveCommandProps(
	type: NodeType,
	props: YogaNodeProps,
	animatedValues: Map<string, unknown>,
): YogaNodeProps {
	const resolvedProps: YogaNodeProps = { ...props }

	for (const key of commandPropKeys[type]) {
		if (animatedValues.has(key)) {
			resolvedProps[key] = animatedValues.get(key)
		}
	}

	return resolvedProps
}

function applyResolvedCommand(instance: YogaNodeFinal, state: NodeState) {
	setNodeCommand(
		instance,
		state.type,
		buildNodeCommand(
			state.type,
			resolveCommandProps(state.type, state.lastProps, state.commandAnimatedValues),
		),
	)
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
	return resolveAnimatedProps(
		props,
		commandPropKeys[state.type],
		state.commandListeners,
		(listenerKey, nextValue) => {
			state.commandAnimatedValues.set(listenerKey, nextValue)
			applyResolvedCommand(instance, state)
			state.invalidate()
		},
		state.commandAnimatedValues,
	) as YogaNodeProps
}

function applyProps(
	instance: YogaNodeFinal,
	type: NodeType,
	props: YogaNodeProps | null | undefined,
	invalidate?: () => void,
	setContinuousRedraw?: (node: YogaNodeFinal, enabled: boolean) => void,
) {
	const nextProps = sanitizeProps(props)
	const state = getNodeState(instance, type, invalidate, setContinuousRedraw)
	state.lastProps = nextProps

	const resolvedCommandProps = resolveAnimatedCommand(instance, state, nextProps)
	const resolvedStyle = resolveAnimatedStyle(state, nextProps)
	const needsContinuousRedraw = shouldUseContinuousRedraw(nextProps.style)

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
		resetAnimatedState(state.styleListeners)
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
