#!/usr/bin/env node

import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import vm from "node:vm"
import ts from "typescript"

const rootDir = path.resolve(import.meta.dirname, "..")
let activeRuntime = null

verifyNativeIdAllocationAndContainerMode()
verifyLayoutRenderRetryAndAnimationCallbacks()
verifyProfilingCountersSamplesAndCleanup()

console.log("YogaCanvas lifecycle runtime verifier passed:")
console.log(
	"- YogaCanvas allocates native IDs lazily per component instance and passes them as nativeID.",
)
console.log(
	"- Root Yoga nodes and Reconciler containers are created with animationBindingMode-driven native binding mode.",
)
console.log(
	"- Layout effects and onLayout update the container/root, attach before render requests, and drive bounded initial retry.",
)
console.log(
	"- Root-container animation callbacks update active sets and synchronize setViewAnimating through the native surface.",
)
console.log(
	"- Profiling counters, native sample parsing/fallbacks, threshold/forced flushes, and counter reset behavior are covered.",
)
console.log(
	"- Unmount cleanup cancels pending retry, force-flushes profiling, clears animation state, detaches, and unmounts the Reconciler root.",
)

function verifyNativeIdAllocationAndContainerMode() {
	const harness = createYogaCanvasHarness()
	const { YogaCanvas } = harness.loadProjectModule("src/YogaCanvas.tsx")

	assert.equal(
		harness.calls.createYogaNode.length,
		0,
		"importing YogaCanvas should not create a root Yoga node before render.",
	)
	assert.deepEqual(
		harness.calls.createContainer,
		[],
		"importing YogaCanvas should not create a Reconciler container before render.",
	)
	assert.deepEqual(
		harness.calls.getSkiaYoga,
		[],
		"importing YogaCanvas should not touch the native SkiaYoga object before render/effects.",
	)

	const first = harness.createComponentInstance(YogaCanvas)
	const firstElement = first.render({
		animationBindingMode: "native",
		children: "first child",
		style: { flex: 1 },
	})
	const firstNativeView = getNativeViewElement(firstElement)
	const firstContainer = only(harness.calls.createContainer).containerInfo
	const firstRootNode = only(harness.calls.createYogaNode)

	assert.equal(
		firstNativeView.props.nativeID,
		"1000000000",
		"first YogaCanvas instance should pass the lazily allocated native ID as a string nativeID prop.",
	)
	assert.equal(
		firstContainer.nativeCommandBindingsEnabled,
		true,
		'animationBindingMode="native" should enable native Reconciler command bindings.',
	)
	assert.equal(
		firstContainer.node,
		firstRootNode,
		"Reconciler root container should use the lazily created root Yoga node.",
	)
	assert.deepEqual(
		plain(only(firstRootNode.commands)),
		{ data: {}, type: "group" },
		"YogaCanvas should initialize the root Yoga node with a group command.",
	)

	const rerenderedFirstElement = first.render({
		animationBindingMode: "native",
		children: "updated child",
		style: { flex: 2 },
	})
	assert.equal(
		getNativeViewElement(rerenderedFirstElement).props.nativeID,
		"1000000000",
		"rerendering the same component instance should keep the original native ID.",
	)
	assert.equal(
		harness.calls.createYogaNode.length,
		1,
		"rerendering the same component instance should reuse the root Yoga node.",
	)
	assert.equal(
		harness.calls.createContainer.length,
		1,
		"rerendering the same component instance should reuse the Reconciler container.",
	)

	const second = harness.createComponentInstance(YogaCanvas)
	const secondElement = second.render({
		animationBindingMode: "js",
		children: "second child",
	})
	const secondContainer = harness.calls.createContainer[1].containerInfo

	assert.equal(
		getNativeViewElement(secondElement).props.nativeID,
		"1000000001",
		"a second YogaCanvas component instance should receive the next native ID.",
	)
	assert.equal(
		secondContainer.nativeCommandBindingsEnabled,
		false,
		'animationBindingMode="js" should disable native Reconciler command bindings.',
	)
	assert.equal(
		harness.calls.useCanvasGestures.length,
		3,
		"YogaCanvas should call useCanvasGestures during each render.",
	)
	assert.equal(
		harness.calls.useCanvasGestures[0].externalGesture,
		undefined,
		"YogaCanvas should pass the optional external gesture through to useCanvasGestures.",
	)
	assert.equal(
		firstElement.type,
		harness.GestureDetector,
		"YogaCanvas should render through the stubbed GestureDetector.",
	)
}

function verifyLayoutRenderRetryAndAnimationCallbacks() {
	const harness = createYogaCanvasHarness()
	const { YogaCanvas } = harness.loadProjectModule("src/YogaCanvas.tsx")
	const gesture = { kind: "external gesture" }
	const instance = harness.createComponentInstance(YogaCanvas)
	const element = instance.render({
		animationBindingMode: "native",
		children: "layout child",
		colorSpace: "srgb",
		debug: false,
		gesture,
		opaque: true,
		style: { width: 12 },
	})
	const nativeView = getNativeViewElement(element)
	const rootNode = only(harness.calls.createYogaNode)
	const root = only(harness.calls.createContainer).root
	const rootContainer = only(harness.calls.createContainer).containerInfo

	assert.equal(
		nativeView.props.collapsable,
		false,
		"YogaCanvas should render a non-collapsible native view.",
	)
	assert.equal(nativeView.props.debug, false, "YogaCanvas should pass debug.")
	assert.equal(nativeView.props.opaque, true, "YogaCanvas should pass opaque.")
	assert.equal(
		nativeView.props.colorSpace,
		"srgb",
		"YogaCanvas should pass colorSpace.",
	)
	assert.equal(
		nativeView.props.style.width,
		12,
		"YogaCanvas should pass through the native view style.",
	)
	assert.equal(
		harness.calls.useCanvasGestures[0].externalGesture,
		gesture,
		"YogaCanvas should forward the external gesture into useCanvasGestures.",
	)
	assert.equal(
		harness.calls.useCanvasGestures[0].node,
		rootNode,
		"useCanvasGestures should receive the root Yoga node.",
	)
	assert.equal(
		element.props.gesture,
		harness.calls.useCanvasGestures[0].canvasGesture,
		"GestureDetector should receive the gesture returned by useCanvasGestures.",
	)

	instance.runLayoutEffects()

	assert.deepEqual(
		harness.calls.reconcilerOperations.slice(0, 3).map((entry) => entry.type),
		["updateContainerSync", "flushSyncWork", "flushPassiveEffects"],
		"useLayoutEffect should synchronously update the Reconciler container and flush sync/passive work.",
	)
	assert.equal(
		only(harness.calls.updateContainerSync).children,
		"layout child",
		"useLayoutEffect should update the Reconciler container with current children.",
	)
	assert.equal(
		only(harness.calls.updateContainerSync).root,
		root,
		"useLayoutEffect should update the created Reconciler root.",
	)
	assertAttachBeforeRequest(
		harness.calls.nativeOperations,
		rootNode,
		"useLayoutEffect scheduleDraw should attach the root before requesting native render.",
	)
	assert.deepEqual(
		harness.raf.pendingIds(),
		[1],
		"useLayoutEffect should start the initial render retry loop.",
	)

	nativeView.props.onLayout(makeLayoutEvent(320, 180))

	assert.deepEqual(
		plain(last(rootNode.styles)),
		{ height: 180, width: 320 },
		"handleLayout should write the root width/height style.",
	)
	assert.deepEqual(
		harness.calls.cancelAnimationFrame,
		[1],
		"handleLayout should cancel the retry frame started by the layout effect before starting a new retry loop.",
	)
	assert.deepEqual(
		harness.raf.pendingIds(),
		[2],
		"handleLayout should start a replacement initial render retry loop.",
	)
	assertAttachBeforeRequest(
		harness.calls.nativeOperations.slice(-4),
		rootNode,
		"handleLayout scheduleDraw should attach the root before requesting native render.",
	)
	assert.deepEqual(
		harness.calls.nativeOperations
			.filter((entry) => entry.type === "setViewAnimating")
			.map((entry) => entry.animating),
		[false],
		"handleLayout attach should synchronize the initial native animation state to false.",
	)

	const requestsBeforeRetry = harness.calls.requestViewRender.length
	harness.raf.runUntilIdle()

	assert.equal(
		harness.calls.requestViewRender.length - requestsBeforeRetry,
		8,
		"initial render retry should request native render for the bounded retry frame count.",
	)
	assert.deepEqual(
		harness.raf.pendingIds(),
		[],
		"initial render retry should stop after the configured frame limit.",
	)

	const continuousNode = { label: "continuous" }
	const nativeAnimatedNode = { label: "native animated" }
	rootContainer.setContinuousRedraw(continuousNode, true)
	rootContainer.setNativeAnimationActive(nativeAnimatedNode, true)
	rootContainer.setContinuousRedraw(continuousNode, false)
	rootContainer.setNativeAnimationActive(nativeAnimatedNode, false)

	assert.deepEqual(
		harness.calls.setViewAnimating.slice(-4).map((entry) => entry.animating),
		[true, true, true, false],
		"root-container callbacks should update active sets and synchronize aggregate native animation state.",
	)
	for (const operation of harness.calls.setViewAnimating.slice(-4)) {
		const index = harness.calls.nativeOperations.indexOf(operation)
		assert.equal(
			harness.calls.nativeOperations[index - 1]?.type,
			"attachViewRoot",
			"syncNativeAnimationState should attach the current root before setViewAnimating.",
		)
		assert.equal(
			harness.calls.nativeOperations[index - 1]?.root,
			rootNode,
			"syncNativeAnimationState should attach the current root node before setViewAnimating.",
		)
	}
}

function verifyProfilingCountersSamplesAndCleanup() {
	const harness = createYogaCanvasHarness({
		invalidateDuringCreateContainer: true,
	})
	const { YogaCanvas } = harness.loadProjectModule("src/YogaCanvas.tsx")
	const samples = []
	const instance = harness.createComponentInstance(YogaCanvas)

	harness.clock.set(100)
	const element = instance.render({
		children: "profile child",
		onProfileSample(sample) {
			samples.push(sample)
		},
		profilingEnabled: true,
	})
	const nativeView = getNativeViewElement(element)
	const rootNode = only(harness.calls.createYogaNode)
	const rootContainer = only(harness.calls.createContainer).containerInfo

	assert.equal(
		harness.calls.requestViewRender.length,
		0,
		"an invalidate fired during createContainer should not request native render before rootNodeRef is assigned.",
	)

	instance.runLayoutEffects()
	instance.runEffects()

	assert.deepEqual(
		harness.calls.setInterval.map((entry) => entry.delay),
		[1000],
		"profiling should install a 1000ms interval when enabled with an onProfileSample callback.",
	)
	assert.equal(
		harness.calls.requestViewRender.length,
		1,
		"useLayoutEffect scheduleDraw should request native render once after rootNodeRef is assigned.",
	)

	harness.skiaYoga.enqueueProfileSample({
		frames: 4,
		sampleDurationMs: 500,
	})
	harness.clock.set(600)
	harness.intervals.runOnly(1)

	assert.deepEqual(
		plain(samples),
		[],
		"profiling interval should not emit samples before the duration threshold.",
	)

	harness.skiaYoga.enqueueRawProfileSample("{malformed-json")
	harness.clock.set(1300)
	harness.intervals.runOnly(1)

	assert.deepEqual(
		plain(samples),
		[
			{
				avgDrawMs: 0,
				avgPresentMs: 0,
				frames: 0,
				maxDrawMs: 0,
				maxPresentMs: 0,
				rawInvalidateCalls: 2,
				sampleDurationMs: 1200,
				scheduledInvalidateCalls: 1,
				skippedInvalidateCalls: 1,
			},
		],
		"malformed native samples should fall back to zero native values and include raw/scheduled/skipped counters.",
	)

	rootContainer.invalidate()
	harness.skiaYoga.enqueueProfileSample({
		avgDrawMs: 1.25,
		avgPresentMs: "bad",
		frames: 7,
		maxDrawMs: Number.POSITIVE_INFINITY,
		maxPresentMs: 5.5,
		sampleDurationMs: 1500,
	})
	harness.clock.set(1500)
	harness.intervals.runOnly(1)

	assert.deepEqual(
		plain(samples[1]),
		{
			avgDrawMs: 1.25,
			avgPresentMs: 0,
			frames: 7,
			maxDrawMs: 0,
			maxPresentMs: 5.5,
			rawInvalidateCalls: 1,
			sampleDurationMs: 1500,
			scheduledInvalidateCalls: 1,
			skippedInvalidateCalls: 0,
		},
		"valid/partial native samples should use finite native values, zero malformed values, and reset counters after a prior flush.",
	)

	nativeView.props.onLayout(makeLayoutEvent(24, 48))
	harness.skiaYoga.enqueueProfileSample({
		avgDrawMs: 3,
		frames: 2,
		sampleDurationMs: 50,
	})
	harness.clock.set(1550)
	instance.unmount()

	assert.equal(
		samples.length,
		3,
		"unmount cleanup should force-flush a profiling sample even below the duration threshold.",
	)
	assert.deepEqual(
		plain(samples[2]),
		{
			avgDrawMs: 3,
			avgPresentMs: 0,
			frames: 2,
			maxDrawMs: 0,
			maxPresentMs: 0,
			rawInvalidateCalls: 1,
			sampleDurationMs: 50,
			scheduledInvalidateCalls: 1,
			skippedInvalidateCalls: 0,
		},
		"forced unmount profiling should include the current counters and native fallback values.",
	)
	assert.deepEqual(
		harness.calls.clearInterval,
		[1],
		"unmount should clear the profiling interval.",
	)
	assert.deepEqual(
		harness.calls.cancelAnimationFrame.slice(-1),
		[2],
		"unmount should cancel the pending initial render retry frame.",
	)
	assert.deepEqual(
		harness.raf.pendingIds(),
		[],
		"unmount should leave no pending retry RAF callbacks.",
	)
	assert.deepEqual(
		harness.intervals.pendingIds(),
		[],
		"unmount should leave no pending profiling interval callbacks.",
	)
	assert.deepEqual(
		harness.calls.setViewAnimating.slice(-1).map((entry) => entry.animating),
		[false],
		"unmount should force native animation state to false after clearing active sets.",
	)
	assert.deepEqual(
		harness.calls.detachViewRoot.slice(-1).map((entry) => entry.nativeId),
		[1000000000],
		"unmount should detach the native view root.",
	)
	assert.equal(
		only(harness.calls.updateContainer).children,
		null,
		"unmount cleanup should unmount the Reconciler container.",
	)
	assert.deepEqual(
		harness.calls.reconcilerOperations.slice(-3).map((entry) => entry.type),
		["updateContainer", "flushSyncWork", "flushPassiveEffects"],
		"unmount cleanup should flush sync and passive Reconciler work after unmounting the container.",
	)
	assert.equal(
		harness.calls.attachViewRoot.at(-1)?.root,
		rootNode,
		"all source-level native render requests should attach the current root node.",
	)
}

function createYogaCanvasHarness(options = {}) {
	const calls = {
		cancelAnimationFrame: [],
		clearInterval: [],
		createContainer: [],
		createElement: [],
		createYogaNode: [],
		detachViewRoot: [],
		flushPassiveEffects: [],
		flushSyncWork: [],
		getSkiaYoga: [],
		requestAnimationFrame: [],
		requestViewRender: [],
		reconcilerOperations: [],
		setInterval: [],
		setViewAnimating: [],
		updateContainer: [],
		updateContainerSync: [],
		useCanvasGestures: [],
		nativeOperations: [],
		attachViewRoot: [],
	}
	const moduleCache = new Map()
	const clock = createClock()
	const raf = createRafScheduler(calls)
	const intervals = createIntervalScheduler(calls)
	let nextNodeId = 1
	let nextRootId = 1

	const skiaYoga = {
		profileSamples: [],
		attachViewRoot(nativeId, root) {
			const operation = { nativeId, root, type: "attachViewRoot" }
			calls.attachViewRoot.push(operation)
			calls.nativeOperations.push(operation)
		},
		consumeViewProfileSample(nativeId) {
			const sample = skiaYoga.profileSamples.shift() ?? ""
			calls.nativeOperations.push({
				nativeId,
				sample,
				type: "consumeViewProfileSample",
			})
			return sample
		},
		detachViewRoot(nativeId) {
			const operation = { nativeId, type: "detachViewRoot" }
			calls.detachViewRoot.push(operation)
			calls.nativeOperations.push(operation)
		},
		enqueueProfileSample(sample) {
			skiaYoga.profileSamples.push(JSON.stringify(sample))
		},
		enqueueRawProfileSample(sample) {
			skiaYoga.profileSamples.push(sample)
		},
		requestViewRender(nativeId) {
			const operation = { nativeId, type: "requestViewRender" }
			calls.requestViewRender.push(operation)
			calls.nativeOperations.push(operation)
		},
		setViewAnimating(nativeId, animating) {
			const operation = { animating, nativeId, type: "setViewAnimating" }
			calls.setViewAnimating.push(operation)
			calls.nativeOperations.push(operation)
		},
	}

	function GestureDetector() {}
	function NativeSkiaYogaView() {}

	const react = {
		createElement(type, props, ...children) {
			const element = {
				children,
				props: {
					...(props ?? {}),
					children: children.length === 1 ? children[0] : children,
				},
				type,
			}
			calls.createElement.push(element)
			return element
		},
		useCallback(callback, deps) {
			return getActiveRuntime().useCallback(callback, deps)
		},
		useEffect(effect, deps) {
			return getActiveRuntime().useEffect(effect, deps)
		},
		useLayoutEffect(effect, deps) {
			return getActiveRuntime().useLayoutEffect(effect, deps)
		},
		useMemo(factory, deps) {
			return getActiveRuntime().useMemo(factory, deps)
		},
		useRef(value) {
			return getActiveRuntime().useRef(value)
		},
	}

	const externalModules = new Map([
		["@shopify/react-native-skia", {}],
		[
			"react",
			{
				...react,
				default: react,
			},
		],
		[
			"react-native-gesture-handler",
			{
				GestureDetector,
			},
		],
	])

	const global = {
		cancelAnimationFrame(id) {
			raf.cancel(id)
		},
		clearInterval(id) {
			intervals.clear(id)
		},
		console,
		performance: {
			now() {
				return clock.now()
			},
		},
		requestAnimationFrame(callback) {
			return raf.request(callback)
		},
		setInterval(callback, delay) {
			return intervals.set(callback, delay)
		},
	}
	global.globalThis = global
	const context = vm.createContext(global)

	function loadProjectModule(relativePath) {
		return loadModule(projectPath(relativePath))
	}

	function loadModule(filePath) {
		const normalizedPath = path.resolve(filePath)
		if (moduleCache.has(normalizedPath)) {
			return moduleCache.get(normalizedPath).exports
		}

		const code = readFileSync(normalizedPath, "utf8")
		const compiled = ts.transpileModule(code, {
			compilerOptions: {
				esModuleInterop: true,
				jsx: ts.JsxEmit.React,
				module: ts.ModuleKind.CommonJS,
				target: ts.ScriptTarget.ES2022,
			},
			fileName: normalizedPath,
			reportDiagnostics: true,
		})
		const diagnostics = compiled.diagnostics ?? []
		if (diagnostics.length > 0) {
			throw new Error(
				`Failed to transpile ${path.relative(rootDir, normalizedPath)}:\n` +
					ts.formatDiagnosticsWithColorAndContext(
						diagnostics,
						typescriptDiagnosticHost,
					),
			)
		}

		const module = { exports: {} }
		moduleCache.set(normalizedPath, module)

		const script = new vm.Script(
			`(function(exports, require, module, __filename, __dirname) {\n${compiled.outputText}\n})`,
			{
				filename: normalizedPath,
			},
		)
		const moduleFunction = script.runInContext(context)
		moduleFunction(
			module.exports,
			(specifier) => requireFrom(normalizedPath, specifier),
			module,
			normalizedPath,
			path.dirname(normalizedPath),
		)

		return module.exports
	}

	function requireFrom(parentPath, specifier) {
		if (externalModules.has(specifier)) {
			return externalModules.get(specifier)
		}

		if (specifier === "./Reconciler") {
			return {
				reconciler: makeReconcilerStub(),
			}
		}
		if (specifier === "./SkiaYogaObject") {
			return {
				getSkiaYoga() {
					calls.getSkiaYoga.push({})
					return skiaYoga
				},
			}
		}
		if (specifier === "./specs/SkiaYoga.nitro") {
			return {
				NodeCommandKind: {
					Group: "group",
				},
			}
		}
		if (specifier === "./specs/SkiaYogaViewNativeComponent") {
			return NativeSkiaYogaView
		}
		if (specifier === "./useCanvasGestures") {
			return {
				useCanvasGestures(input) {
					const canvasGesture = {
						input,
						kind: "canvas gesture",
					}
					calls.useCanvasGestures.push({
						...input,
						canvasGesture,
					})
					return canvasGesture
				},
			}
		}
		if (specifier === "./util") {
			return {
				createYogaNode() {
					const node = makeYogaNode(nextNodeId)
					nextNodeId += 1
					calls.createYogaNode.push(node)
					return node
				},
			}
		}

		if (specifier.startsWith(".")) {
			return loadModule(resolveProjectSpecifier(parentPath, specifier))
		}

		throw new Error(
			`Unexpected external import while verifying YogaCanvas lifecycle runtime: ${specifier}`,
		)
	}

	function makeReconcilerStub() {
		return {
			createContainer(containerInfo, tag) {
				const root = {
					containerInfo,
					id: nextRootId,
					tag,
				}
				nextRootId += 1
				calls.createContainer.push({ containerInfo, root, tag })
				if (options.invalidateDuringCreateContainer) {
					containerInfo.invalidate()
				}
				return root
			},
			flushPassiveEffects() {
				const operation = { type: "flushPassiveEffects" }
				calls.flushPassiveEffects.push(operation)
				calls.reconcilerOperations.push(operation)
			},
			flushSyncWork() {
				const operation = { type: "flushSyncWork" }
				calls.flushSyncWork.push(operation)
				calls.reconcilerOperations.push(operation)
			},
			updateContainer(children, root, parentComponent, callback) {
				const operation = {
					callback,
					children,
					parentComponent,
					root,
					type: "updateContainer",
				}
				calls.updateContainer.push(operation)
				calls.reconcilerOperations.push(operation)
			},
			updateContainerSync(children, root, parentComponent, callback) {
				const operation = {
					callback,
					children,
					parentComponent,
					root,
					type: "updateContainerSync",
				}
				calls.updateContainerSync.push(operation)
				calls.reconcilerOperations.push(operation)
			},
		}
	}

	function makeYogaNode(id) {
		return {
			commands: [],
			id,
			styles: [],
			setCommand(command) {
				this.commands.push(command)
			},
			setStyle(style) {
				this.styles.push(style)
			},
		}
	}

	function createComponentInstance(Component) {
		const runtime = createHookRuntime()
		return {
			render(props) {
				return runtime.render(() => Component(props))
			},
			runEffects() {
				runtime.runEffects()
			},
			runLayoutEffects() {
				runtime.runLayoutEffects()
			},
			unmount() {
				runtime.unmount()
			},
		}
	}

	return {
		GestureDetector,
		calls,
		clock,
		createComponentInstance,
		intervals,
		loadProjectModule,
		raf,
		skiaYoga,
	}
}

function getActiveRuntime() {
	assert.ok(activeRuntime, "React hook stubs should be called during render.")
	return activeRuntime
}

function createHookRuntime() {
	const hookState = []
	const pendingEffects = []
	const pendingLayoutEffects = []
	let hookIndex = 0

	function nextHook() {
		const index = hookIndex
		hookIndex += 1
		if (!hookState[index]) {
			hookState[index] = {}
		}
		return {
			index,
			state: hookState[index],
		}
	}

	function scheduleEffect(queue, effect, deps) {
		const hook = nextHook()
		if (!hook.state.hasValue || !areHookDepsEqual(hook.state.deps, deps)) {
			queue.push({
				effect,
				index: hook.index,
			})
			hook.state.deps = deps
			hook.state.hasValue = true
		}
	}

	function runEffectQueue(queue) {
		while (queue.length > 0) {
			const entry = queue.shift()
			const state = hookState[entry.index]
			if (typeof state.cleanup === "function") {
				state.cleanup()
			}
			const cleanup = entry.effect()
			state.cleanup = typeof cleanup === "function" ? cleanup : undefined
		}
	}

	const runtime = {
		render(renderComponent) {
			hookIndex = 0
			activeRuntime = runtime
			try {
				return renderComponent()
			} finally {
				activeRuntime = null
			}
		},
		runEffects() {
			runEffectQueue(pendingEffects)
		},
		runLayoutEffects() {
			runEffectQueue(pendingLayoutEffects)
		},
		unmount() {
			for (const state of hookState) {
				if (typeof state?.cleanup === "function") {
					state.cleanup()
					state.cleanup = undefined
				}
			}
		},
		useCallback(callback, deps) {
			return runtime.useMemo(() => callback, deps)
		},
		useEffect(effect, deps) {
			scheduleEffect(pendingEffects, effect, deps)
		},
		useLayoutEffect(effect, deps) {
			scheduleEffect(pendingLayoutEffects, effect, deps)
		},
		useMemo(factory, deps) {
			const hook = nextHook()
			if (!hook.state.hasValue || !areHookDepsEqual(hook.state.deps, deps)) {
				hook.state.value = factory()
				hook.state.deps = deps
				hook.state.hasValue = true
			}
			return hook.state.value
		},
		useRef(value) {
			const hook = nextHook()
			if (!hook.state.hasValue) {
				hook.state.value = {
					current: value,
				}
				hook.state.hasValue = true
			}
			return hook.state.value
		},
	}
	return runtime
}

function createClock() {
	let currentTime = 0
	return {
		now() {
			return currentTime
		},
		set(time) {
			currentTime = time
		},
	}
}

function createRafScheduler(calls) {
	let nextId = 1
	const callbacks = new Map()

	return {
		cancel(id) {
			callbacks.delete(id)
			calls.cancelAnimationFrame.push(id)
		},
		pendingIds() {
			return [...callbacks.keys()].sort((a, b) => a - b)
		},
		request(callback) {
			const id = nextId
			nextId += 1
			callbacks.set(id, callback)
			calls.requestAnimationFrame.push({ callback, id })
			return id
		},
		runNext() {
			const id = this.pendingIds()[0]
			assert.ok(id, "expected a pending requestAnimationFrame callback")
			const callback = callbacks.get(id)
			callbacks.delete(id)
			callback()
		},
		runUntilIdle(limit = 50) {
			let iterations = 0
			while (callbacks.size > 0) {
				iterations += 1
				assert.ok(iterations <= limit, "RAF scheduler did not become idle.")
				this.runNext()
			}
		},
	}
}

function createIntervalScheduler(calls) {
	let nextId = 1
	const callbacks = new Map()

	return {
		clear(id) {
			callbacks.delete(id)
			calls.clearInterval.push(id)
		},
		pendingIds() {
			return [...callbacks.keys()].sort((a, b) => a - b)
		},
		runOnly(id) {
			const callback = callbacks.get(id)
			assert.equal(
				typeof callback,
				"function",
				`expected interval ${id} to be pending.`,
			)
			callback()
		},
		set(callback, delay) {
			const id = nextId
			nextId += 1
			callbacks.set(id, callback)
			calls.setInterval.push({ callback, delay, id })
			return id
		},
	}
}

function areHookDepsEqual(previous, next) {
	if (!previous || !next || previous.length !== next.length) {
		return false
	}

	return previous.every((value, index) => Object.is(value, next[index]))
}

function makeLayoutEvent(width, height) {
	return {
		nativeEvent: {
			layout: {
				height,
				width,
			},
		},
	}
}

function getNativeViewElement(element) {
	const nativeView = element.props.children
	assert.ok(nativeView, "GestureDetector should wrap a native view element.")
	return nativeView
}

function assertAttachBeforeRequest(operations, rootNode, message) {
	const requestIndex = operations.findIndex(
		(entry) => entry.type === "requestViewRender",
	)
	assert.notEqual(requestIndex, -1, `${message}: missing requestViewRender.`)
	const attach = operations[requestIndex - 1]
	assert.equal(
		attach?.type,
		"attachViewRoot",
		`${message}: expected attachViewRoot immediately before requestViewRender.`,
	)
	assert.equal(attach.root, rootNode, `${message}: attached the wrong root node.`)
}

function resolveProjectSpecifier(parentPath, specifier) {
	const basePath = path.resolve(path.dirname(parentPath), specifier)
	const candidates = [
		basePath,
		`${basePath}.ts`,
		`${basePath}.tsx`,
		`${basePath}.js`,
		`${basePath}.mjs`,
		path.join(basePath, "index.ts"),
		path.join(basePath, "index.tsx"),
	]
	for (const candidate of candidates) {
		if (existsSync(candidate)) {
			return candidate
		}
	}

	throw new Error(
		`Could not resolve ${specifier} from ${path.relative(rootDir, parentPath)}`,
	)
}

function projectPath(relativePath) {
	return path.join(rootDir, relativePath)
}

function plain(value) {
	return JSON.parse(JSON.stringify(value))
}

const typescriptDiagnosticHost = {
	getCanonicalFileName: (fileName) => fileName,
	getCurrentDirectory: () => rootDir,
	getNewLine: () => "\n",
}

function only(items) {
	assert.equal(items.length, 1, "expected exactly one item")
	return items[0]
}

function last(items) {
	assert.ok(items.length > 0, "expected at least one item")
	return items[items.length - 1]
}
