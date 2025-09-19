import { type CanvasProps, type SkPicture } from "@shopify/react-native-skia"
import "@shopify/react-native-skia/lib/typescript/src/views/api.d.ts"
import React, { useEffect, useLayoutEffect, useMemo, useRef } from "react"
import type { View } from "react-native"
import { NitroModules } from "react-native-nitro-modules"
import { useSharedValue } from "react-native-reanimated"
import { runOnUIAsync } from "react-native-worklets"
import { reconciler } from "./Reconciler"
import { createYogaNode } from "./util"
const { default: SkiaPictureViewNativeComponent } =
	require("@shopify/react-native-skia/src/specs/SkiaPictureViewNativeComponent") as typeof import("@shopify/react-native-skia/lib/typescript/src/specs/SkiaPictureViewNativeComponent")
const { SkiaViewNativeId } =
	require("@shopify/react-native-skia/src/views/SkiaViewNativeId") as typeof import("@shopify/react-native-skia/lib/typescript/src/views/SkiaViewNativeId")

/*

	const screen = Dimensions.get("window")
	const root = createYogaNode()
	const currentlyRunning = useSharedValue(0)

	root.setType("group")
	root.setStyle({
		flex: 1,
		minWidth: screen.width,
		minHeight: screen.height,
	})
	root.setProps({})

	const r = reconciler.createContainer(
		root,
		0,
		null,
		true,
		true,
		"test",
		console.error,
		null,
	)

	// @ts-ignore
	globalThis.reconciler = reconciler

	// @ts-ignore
	reconciler.updateContainerSync(<Root />, r, null, null)
	// @ts-ignore
	reconciler.flushSyncWork()
	reconciler.flushPassiveEffects()

	// root.computeLayout(screen.width, screen.height)
	console.log(
		"picture",
		root.getChildren().map((x) => ({ ...x, children: x.getChildren() })),
	)
	const picture = root.draw() as SkPicture

	const pic = useSharedValue<SkPicture>(picture)

	useEffect(() => {
		const id = Math.random()
		currentlyRunning.value = id

		const boxed = NitroModules.box(root)

		runOnUIAsync(() => {
			let frames = 0

			const unboxed = boxed.unbox()

			function frame(time: number) {
				if (currentlyRunning.value !== id) return

				pic.value = unboxed.draw() as SkPicture

				frames++

				requestAnimationFrame(frame)
			}

			requestAnimationFrame(frame)
		})()

		return () => {
			currentlyRunning.value = 0
		}
	}, [])

	return (
		<Canvas style={{ width: screen.width, height: screen.height }}>
			<Picture picture={pic} />
		</Canvas>
	)
*/

export function YogaCanvas({
	children,
	style,
	opaque,
	debug,
	colorSpace,
}: CanvasProps) {
	const viewRef = useRef<View>(null)
	const nativeId = useMemo(() => {
		return SkiaViewNativeId.current++
	}, [])

	const { root, node } = useMemo(() => {
		const node = createYogaNode()
		node.setType("group")
		node.setStyle({
			flex: 1,
		})
		node.setProps({})

		return {
			root: reconciler.createContainer(
				node,
				0,
				null,
				true,
				true,
				"test",
				console.error,
				null,
			),
			node,
		}
	}, [])

	useLayoutEffect(() => {
		viewRef.current?.measure((x, y, width, height, pageX, pageY) => {
			node.setStyle({
				width,
				height,
			})
		})
	}, [])

	const currentlyRunning = useSharedValue(0)

	useEffect(() => {
		const id = Math.random()
		currentlyRunning.value = id

		const boxed = NitroModules.box(node)

		runOnUIAsync(() => {
			function frame(time: number) {
				if (currentlyRunning.value !== id) return

				const unboxed = boxed.unbox()

				const picture = unboxed.draw()

				SkiaViewApi.setJsiProperty(nativeId, "picture", picture)

				requestAnimationFrame(frame)
			}

			requestAnimationFrame(frame)
		})()

		return () => {
			currentlyRunning.value = 0
		}
	}, [])

	useLayoutEffect(() => {
		// @ts-ignore
		reconciler.updateContainerSync(children, root, null, null)
		// @ts-ignore
		reconciler.flushSyncWork()
		reconciler.flushPassiveEffects()

		const picture = node.draw() as SkPicture

		SkiaViewApi.setJsiProperty(nativeId, "picture", picture)
	}, [children, root, nativeId])

	useEffect(() => {
		return () => {
			// destory the container
			reconciler.updateContainer(null, root, null, null)
			// @ts-ignore
			reconciler.flushSyncWork()
			reconciler.flushPassiveEffects()
		}
	}, [root])

	return (
		<SkiaPictureViewNativeComponent
			ref={viewRef}
			collapsable={false}
			debug={debug}
			opaque={opaque}
			nativeID={`${nativeId}`}
			style={style}
			colorSpace={colorSpace}
		/>
	)
}
