import {
	Canvas,
	matchFont,
	Picture,
	Skia,
	SkParagraphStyle,
	SkPicture,
	SkTextStyle,
	TextAlign,
	useImage
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
x.setProps({})
x.setStyle({ width: 100, height: 100, backgroundColor: "red" })
x.computeLayout()
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

		const font = matchFont({
			fontFamily: "Arial",
			fontSize: 14,
			fontStyle: "normal",
		})

		const textStyle = {
			color: Skia.Color("black"),
			fontSize: 40,
			fontFamilies: ["Arial"],
		}

		const builder = Skia.ParagraphBuilder.Make({
			textStyle,
			textAlign: TextAlign.Left,
		})

		const paint = Skia.Paint()
		paint.setColor(Skia.Color("green"))

		runOnUI(() => {
			const root = createYogaNode()
			const child = createYogaNode()
			const matrix = Skia.Matrix().identity()


			root.setType("rect")
			root.setProps({})
			root.setStyle({
				flex: 1,
				padding: 60,
				// paddingTop: 120,
				// paddingBottom: 30,
				backgroundColor: "#ffffff",
				layer: paint,
				justifyContent: "center",
				alignItems: "center",
				// flexDirection: "row",
				// gap: 20,
				// paddingHorizontal: 40,
			})
			child.setType("paragraph")
			child.setStyle({
				// backgroundColor: "#ff0000ff",
				flex: 0,
				matrix,
			})
			child.setProps({
				text: "Hello World! How are you doing today?",
				style: {
					fontSize: 50,
					fontFamilies: ["Arial"],
					color: Skia.Color("#0091ff"),
					backgroundColor: Skia.Color("#ffeeaaff"),
					textAlign: TextAlign.Center,
				} as SkTextStyle & SkParagraphStyle,
				// style,
				// paragraph,
				// font,
			})
			root.insertChild(child)

			root.computeLayout(screen.width, screen.height)
			const start = performance.now()
			let lastTime = performance.now()
			let frames = 0
			const pathLayout = child.layout

			function frame(time: number) {
				if (currentlyRunning.value !== id) return
				const dt = time - start

				const scale = Math.cos(dt * 0.002) * 0.25 + 0.75

				matrix
					.identity()
					.translate(-pathLayout.width / 2, -pathLayout.height / 2)
					.postRotate((dt * 0.1 * Math.PI) / 180)
					.postScale(scale, scale)
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
