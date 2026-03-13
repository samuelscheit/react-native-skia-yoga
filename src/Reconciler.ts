import { BlurStyle, FillType, PointMode } from "@shopify/react-native-skia"
import { NitroModules } from "react-native-nitro-modules"
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

type AnimatedStyleListener = {
	id: number
	value: SharedValue<unknown>
}

type NodeState = {
	boxedNode: any
	continuousRedraw: boolean
	invalidate: () => void
	lastProps: YogaNodeProps
	setContinuousRedraw: (node: YogaNodeFinal, enabled: boolean) => void
	styleListeners: Map<string, AnimatedStyleListener>
	type: NodeType
}

const nodeStates = new WeakMap<YogaNodeFinal, NodeState>()

let priority = DefaultEventPriority
let nextListenerId = 1

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
		invalidate: invalidate ?? (() => {}),
		lastProps: {},
		setContinuousRedraw: setContinuousRedraw ?? (() => {}),
		styleListeners: new Map(),
		type,
	}

	nodeStates.set(node, state)
	return state
}

function removeAnimatedStyleListeners(state: NodeState) {
	for (const { id, value } of state.styleListeners.values()) {
		executeOnUIRuntimeSync(
			(sharedValue: SharedValue<unknown>, listenerId: number) => {
				"worklet"
				sharedValue.removeListener(listenerId)
			},
		)(value, id)
	}

	state.styleListeners.clear()
}

function resolveAnimatedStyle(state: NodeState, props: YogaNodeProps) {
	removeAnimatedStyleListeners(state)

	if (!isStyleObject(props.style)) {
		return {}
	}

	const resolvedStyle: Record<string, unknown> = { ...props.style }

	for (const [key, value] of Object.entries(props.style)) {
		if (!isSharedValue(value)) {
			continue
		}

		const listenerId = nextListenerId++
		const invalidate = state.invalidate

		resolvedStyle[key] = value.value
		state.styleListeners.set(key, { id: listenerId, value })

		executeOnUIRuntimeSync(
			(
				boxedNode: any,
				sharedValue: SharedValue<unknown>,
				listenerKey: string,
				currentListenerId: number,
				invalidateOnJS: () => void,
			) => {
				"worklet"
				const node = boxedNode.unbox()

				sharedValue.addListener(currentListenerId, (nextValue: unknown) => {
					node.setStyle({
						[listenerKey]: nextValue,
					})
					runOnJS(invalidateOnJS as () => void)()
				})
			},
		)(state.boxedNode, value, key, listenerId, invalidate)
	}

	return resolvedStyle as NodeStyle
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

function buildNodeCommand(type: NodeType, props: YogaNodeProps): NodeCommand {
	switch (type) {
		case "group":
			return { group: {} }
		case "rect":
			return { rect: {} }
		case "rrect":
			return {
				rrect: {
					cornerRadius:
						typeof props.cornerRadius === "number" ? props.cornerRadius : undefined,
				},
			}
		case "circle":
			return {
				circle: {
					radius: typeof props.radius === "number" ? props.radius : undefined,
				},
			}
		case "oval":
			return { oval: {} }
		case "text":
			return {
				text: {
					font: props.font as any,
					text: typeof props.text === "string" ? props.text : undefined,
					textStyle: props.textStyle as any,
				},
			}
		case "paragraph":
			return {
				paragraph: {
					paragraph: props.paragraph == null ? null : (props.paragraph as any),
					paragraphStyle: props.paragraphStyle as any,
					text: typeof props.text === "string" ? props.text : undefined,
				},
			}
		case "path":
			return {
				path: {
					fillType: normalizePathFillType(props.fillType),
					path: requireProp<any>(type, props, "path"),
					stroke: props.stroke as any,
					trimEnd:
						typeof props.trimEnd === "number" ? props.trimEnd : undefined,
					trimStart:
						typeof props.trimStart === "number" ? props.trimStart : undefined,
				},
			}
		case "line":
			return {
				line: {
					from: requireProp<any>(type, props, "from"),
					to: requireProp<any>(type, props, "to"),
				},
			}
		case "points":
			return {
				points: {
					pointMode: normalizePointMode(props.pointMode),
					points: requireProp<any>(type, props, "points"),
				},
			}
		case "image":
			return {
				image: {
					fit: props.fit as any,
					image: props.image == null ? null : (props.image as any),
					sampling: props.sampling as any,
				},
			}
		case "blurMaskFilter":
			return {
				blurMaskFilter: {
					blur: typeof props.blur === "number" ? props.blur : undefined,
					blurStyle: normalizeBlurStyle(props.blurStyle),
					respectCTM:
						typeof props.respectCTM === "boolean"
							? props.respectCTM
							: undefined,
				},
			}
		default: {
			const exhaustiveType: never = type
			throw new Error(`Unsupported node type: ${exhaustiveType}`)
		}
	}
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
	const resolvedStyle = resolveAnimatedStyle(state, nextProps)
	const needsContinuousRedraw = shouldUseContinuousRedraw(nextProps.style)

	if (state.continuousRedraw !== needsContinuousRedraw) {
		state.continuousRedraw = needsContinuousRedraw
		state.setContinuousRedraw(instance, needsContinuousRedraw)
	}

	state.lastProps = nextProps
	instance.setCommand(buildNodeCommand(type, nextProps))
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
		removeAnimatedStyleListeners(state)
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
