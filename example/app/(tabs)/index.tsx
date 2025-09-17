import { Canvas, Picture, Skia, useImage } from "@shopify/react-native-skia"
import { Dimensions } from "react-native"
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

export default function HomeScreen() {
	const image = useImage("https://picsum.photos/200/300")

	const root = createYogaNode()

	root.setType("rect")
	root.setProps({})
	root.setStyle({
		flex: 1,
		paddingTop: 120,
		paddingBottom: 30,
		backgroundColor: "#2d3e50",
		gap: 20,
		paddingHorizontal: 40,
	})
	const child = createYogaNode()

	child.setType("rrect")
	child.setProps({
		r: 20,
	})
	child.setStyle({
		flex: 1,
		backgroundColor: "#16a186",
		// borderRadius: 20,
		// borderTopLeftRadius: {
		// 	x: 50,
		// 	y: 100,
		// },
		matrix: Skia.Matrix().identity().translate(20, -20).skew(0, -0.1),
	})
	root.insertChild(child)

	const child2 = createYogaNode()

	child2.setType("rect")
	child2.setProps({})
	child2.setStyle({
		flex: 1,
		backgroundColor: "#16a186",
		invertClip: false,
		borderRadius: 15,
	})
	root.insertChild(child2)

	const img = createYogaNode()
	img.setType("image")
	img.setProps({
		image,
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
	const pathNode = createYogaNode()

	pathNode.setType("path")
	pathNode.setProps({
		path,
	})
	pathNode.setStyle({
		backgroundColor: "#e3c16f",
		flex: 1,
	})
	root.insertChild(pathNode)

	const screen = Dimensions.get("window")
	root.computeLayout(screen.width, screen.height)

	// @ts-ignore
	globalThis.root = root // @ts-ignore
	globalThis.child = child

	const picture = root.draw()

	return (
		<Canvas style={{ width: screen.width, height: screen.height }}>
			<Picture picture={picture} />
		</Canvas>
	)
}
