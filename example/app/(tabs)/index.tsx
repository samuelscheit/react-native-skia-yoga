import {
	Canvas,
	FillType,
	Picture,
	Skia,
	SkPicture,
	StrokeOpts,
	useImage,
} from "@shopify/react-native-skia"
import { useEffect } from "react"
import { Dimensions } from "react-native"
import { runOnUI, useSharedValue } from "react-native-reanimated"
import { createYogaNode } from "react-native-skia-yoga"

declare namespace React {
	namespace JSX {
		interface IntrinsicElements {
			group: any
			rect: any
		}
	}
}

function Root() {
	return (
		<group style={{ flex: 1, width: 500, height: 500 }}>
			<rect x={0} y={0} width={200} height={200} color="green"></rect>
			<rect x={50} y={50} width={100} height={100} color="red"></rect>
		</group>
	)
}

// const r = reconciler.createContainer(
// 	root,
// 	0,
// 	null,
// 	true,
// 	true,
// 	"test",
// 	console.error,
// 	null,
// )

// reconciler.updateContainer(<Root />, r, null, null)

// Yoga.Node.create().calculateLayout(undefined, undefined, Direction.LTR)
// Yoga.Node.create().getComputedLayout()
// const picture = root.draw()
// console.log("picture", picture)
const x = createYogaNode()
x.setType("rect")
x.setProps({ color: "red" })
x.setStyle({ width: 100, height: 100 })
const p = x.draw()

export default function HomeScreen() {
	const image = useImage("https://picsum.photos/200/300")
	const screen = Dimensions.get("window")
	const start = performance.now()
	const currentlyRunning = useSharedValue(0)
	const pic = useSharedValue<SkPicture>(p)

	useEffect(() => {
		const id = Math.random()
		currentlyRunning.value = id

		runOnUI(() => {
			const root = createYogaNode()
			const img = createYogaNode()
			const pathNode = createYogaNode()
			const matrix = Skia.Matrix().identity()

			root.setType("rect")
			root.setProps({})
			root.setStyle({
				flex: 1,
				// paddingTop: 120,
				// paddingBottom: 30,
				backgroundColor: "#2d3e50",
				// gap: 20,
				// paddingHorizontal: 40,
			})

			img.setType("image")
			img.setProps({
				image,
				fit: "contain",
			})
			img.setStyle({
				flex: 1,
			})

			root.insertChild(img)

			const path = Skia.Path.Make()
			path.moveTo(128, 0)
			path.lineTo(168, 80)
			path.lineTo(256, 93)
			path.lineTo(192, 155)
			path.lineTo(207, 244)
			path.lineTo(128, 202)
			path.lineTo(49, 244)
			path.lineTo(64, 155)
			path.lineTo(0, 93)
			path.lineTo(88, 80)
			path.lineTo(128, 0)
			path.close()

			pathNode.setType("path")
			pathNode.setProps({
				path,
				fillType: FillType.Winding,
				stroke: {
					width: 1,
					miter_limit: 0,
					precision: 1,
				} as StrokeOpts,
			})
			pathNode.setStyle({
				backgroundColor: "#e3c16f",
				flex: 1,
				matrix,
			})
			root.insertChild(pathNode)

			root.computeLayout(screen.width, screen.height)
			const start = performance.now()
			let lastTime = performance.now()
			let frames = 0
			const pathLayout = pathNode.layout

			function frame(time: number) {
				if (currentlyRunning.value !== id) return
				const dt = time - start

				matrix
					.identity()
					.translate(-pathLayout.width / 2, -pathLayout.height / 2)
					.postRotate((dt * 0.1 * Math.PI) / 180)
					.postScale(0.5, 0.5)
					.postTranslate(pathLayout.width / 2, pathLayout.height / 2)

				pic.value = root.draw() as SkPicture

				if (time - lastTime >= 1000) {
					console.log(
						"dt",
						dt,
						"time",
						time - lastTime,
						"fps",
						frames,
					)
					lastTime = time
					frames = -1
				}


				frames++

				requestAnimationFrame(frame)
			}

			requestAnimationFrame(frame)
		})()

		return () => {
			currentlyRunning.value = 0
		}
	}, [image])

	return (
		<Canvas style={{ width: screen.width, height: screen.height }}>
			<Picture picture={pic} />
		</Canvas>
	)
}
