import { NitroModules } from "react-native-nitro-modules"
import { isSharedValue } from "react-native-reanimated"
import { executeOnUIRuntimeSync } from "react-native-worklets"
import Reconciler, { type HostConfig } from "react-reconciler"
import { DefaultEventPriority } from "react-reconciler/constants"
import type { YogaNodeFinal } from "./index"
import { createYogaNode } from "./util"

export type SkiaYogaHostContext = HostConfig<
	any,
	any,
	YogaNodeFinal,
	YogaNodeFinal,
	YogaNodeFinal,
	YogaNodeFinal,
	any,
	any,
	any,
	any,
	any,
	any,
	any,
	any
>

let priority = DefaultEventPriority

const reanimatedMapper = new WeakMap<YogaNodeFinal, number[]>()

const config = {
	supportsMutation: true,
	supportsPersistence: false,
	createInstance(type, props, rootContainer, hostContext, internalHandle) {
		// This method should return a newly created node. For example, the DOM renderer would call document.createElement(type) here and then set the properties from props.

		// You can use rootContainer to access the root container associated with that tree. For example, in the DOM renderer, this is useful to get the correct document reference that the root belongs to.

		// The hostContext parameter lets you keep track of some information about your current place in the tree. To learn more about it, see getChildHostContext below.

		// The internalHandle data structure is meant to be opaque. If you bend the rules and rely on its internal fields, be aware that it may change significantly between versions. You're taking on additional maintenance risk by reading from it, and giving up all guarantees if you write something to it.

		// This method happens in the render phase. It can (and usually should) mutate the node it has just created before returning it, but it must not modify any other nodes. It must not register any event handlers on the parent tree. This is because an instance being created doesn't guarantee it would be placed in the tree — it could be left unused and later collected by GC. If you need to do something when an instance is definitely in the tree, look at commitMount instead.

		const node = createYogaNode()
		const nodeBoxed = NitroModules.box(node)
		node.setType(type)
		if (props) node.setProps(props)

		const listeners = reanimatedMapper.get(node) || []
		reanimatedMapper.set(node, listeners)

		if (props?.style) {
			let newStyle = { ...props.style }
			Object.keys(props.style).forEach((key) => {
				const value = props.style[key]
				if (isSharedValue(value)) {
					newStyle[key] = value.value

					executeOnUIRuntimeSync((key) => {
						"worklet"
						const unboxed = nodeBoxed.unbox()

						value.addListener(1, (v) => {
							unboxed.setStyle({
								[key]: v,
							})
							// unboxed.computeLayout(width, height)
						})
					})(key)
				}
			})

			node.setStyle(newStyle)
		}

		return node
	},
	scheduleTimeout(fn, delay) {
		return setTimeout(fn, delay ?? 0)
	},
	cancelTimeout(id) {
		clearTimeout(id)
	},
	noTimeout: -1,
	supportsMicrotasks: true,
	scheduleMicrotask(fn) {
		queueMicrotask(fn)
	},
	createTextInstance(text, rootContainer, hostContext, internalHandle) {
		// Same as createInstance, but for text nodes. If your renderer doesn't support text nodes, you can throw here.
		// const node = createYogaNode()
		// node.setStyle({
		// TODO: text style
		// })
		// TODO: text node
		// node.insertText
		// return node
	},
	removeChildFromContainer(container, child) {
		/**
         * Same as `removeChild`, but for when a node is detached from the root container. This is useful if attaching to the root has a slightly different implementation, or if the root container nodes are of a different type than the rest of the tree.
         */
		container.removeChild(child)
	},
	appendChildToContainer(container, child) {
		/**
		 * Same as `appendChild`, but for when a node is attached to the root container. This is useful if attaching to the root has a slightly different implementation, or if the root container nodes are of a different type than the rest of the tree.
		 */
		container.insertChild(child)
	},
	appendInitialChild(parentInstance, child) {
		// This method should mutate the parentInstance and add the child to its list of children. For example, in the DOM this would translate to a parentInstance.appendChild(child) call.
		// This method happens in the render phase. It can mutate parentInstance and child, but it must not modify any other nodes. It's called while the tree is still being built up and not connected to the actual tree on the screen.

		parentInstance.insertChild(child)
	},
	finalizeInitialChildren(instance, type, props, rootContainer, hostContext) {
		// In this method, you can perform some final mutations on the instance. Unlike with createInstance, by the time finalizeInitialChildren is called, all the initial children have already been added to the instance, but the instance itself has not yet been connected to the tree on the screen.

		// This method happens in the render phase. It can mutate instance, but it must not modify any other nodes. It's called while the tree is still being built up and not connected to the actual tree on the screen.

		// There is a second purpose to this method. It lets you specify whether there is some work that needs to happen when the node is connected to the tree on the screen. If you return true, the instance will receive a commitMount call later. See its documentation below.

		// rootContainer.insertChild(instance)

		return false
	},
	shouldSetTextContent(type, props) {
		return typeof props.children === "string"
	},
	getRootHostContext(rootContainer) {
		return rootContainer
	},
	getChildHostContext(parentHostContext, type, rootContainer) {
		// Host context lets you track some information about where you are in the tree so that it's available inside createInstance as the hostContext parameter. For example, the DOM renderer uses it to track whether it's inside an HTML or an SVG tree, because createInstance implementation needs to be different for them.
		// If the node of this type does not influence the context you want to pass down, you can return parentHostContext. Alternatively, you can return any custom object representing the information you want to pass down.
		return parentHostContext
	},
	getPublicInstance(instance) {
		// Determines what object gets exposed as a ref. You'll likely want to return the instance itself. But in some cases it might make sense to only expose some part of it.
		return instance
	},
	prepareForCommit(containerInfo) {
		// This method lets you store some information before React starts making changes to the tree on the screen. For example, the DOM renderer stores the current text selection so that it can later restore it. This method is mirrored by resetAfterCommit.
		return null
	},
	resetAfterCommit(containerInfo) {
		// This method is called right after React has performed the tree mutations. You can use it to restore something you've stored in prepareForCommit — for example, text selection.
	},
	preparePortalMount(containerInfo) {
		// This method is called for a container that's used as a portal target. Usually you can leave it empty.
	},
	resolveUpdatePriority() {
		return priority
	},
	setCurrentUpdatePriority(newPriority) {
		priority = newPriority
	},
	isPrimaryRenderer: false,
	getCurrentUpdatePriority() {
		return DefaultEventPriority
	},
	appendChild(parentInstance, child) {
		parentInstance.insertChild(child)
	},
	insertBefore(parentInstance, child, beforeChild) {
		parentInstance.insertChild(child, beforeChild)
	},
	removeChild(parentInstance, child) {
		parentInstance.removeChild(child)
	},
	resetTextContent(instance) {
		// TODO
		instance.setProps({ text: "" })
	},
	commitTextUpdate(textInstance, oldText, newText) {
		// TODO
	},
	commitMount(instance, type, props, internalInstanceHandle) {
		// This method is only called if you returned true from finalizeInitialChildren for this instance.
		// It lets you do some additional work after the node is actually attached to the tree on the screen for the first time. For example, the DOM renderer uses it to trigger focus on nodes with the autoFocus attribute.
		// Note that commitMount does not mirror removeChild one to one because removeChild is only called for the top-level removed node. This is why ideally commitMount should not mutate any nodes other than the instance itself. For example, if it registers some events on some node above, it will be your responsibility to traverse the tree in removeChild and clean them up, which is not ideal.
		// The internalHandle data structure is meant to be opaque. If you bend the rules and rely on its internal fields, be aware that it may change significantly between versions. You're taking on additional maintenance risk by reading from it, and giving up all guarantees if you write something to it.
		// If you never return true from finalizeInitialChildren, you can leave it empty.
	},
	commitUpdate(instance, type, prevProps, nextProps, internalHandle) {
		// The internalHandle data structure is meant to be opaque. If you bend the rules and rely on its internal fields, be aware that it may change significantly between versions. You're taking on additional maintenance risk by reading from it, and giving up all guarantees if you write something to it.
	},
	clearContainer(container) {
		// container.removeAllChildren()
	},
	maySuspendCommit(type, props) {
		return false
	},
	detachDeletedInstance(node) {
		// TODO
	},
} as SkiaYogaHostContext

// https://github.com/facebook/react/blob/main/packages/react-reconciler/README.md
export const reconciler = Reconciler(
	new Proxy(config, {
		get(target, prop) {
			// @ts-ignore
			const value = target[prop]
			if (typeof value === "function") {
				return (...args: any[]) => {
					console.log(prop, ...args)
					return value(...args)
				}
			}
			return value
		},
	}),
)
