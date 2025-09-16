import { Canvas, Picture, Skia } from "@shopify/react-native-skia"
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

child.setType("rect")
child.setProps({})
child.setStyle({
	flex: 1,
	backgroundColor: "#16a186",
	borderRadius: 20,
	borderTopLeftRadius: {
		x: 50,
		y: 100,
	},
	borderBottomRightRadius: 100,
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
	transform: [
		{
			rotateX: 0.4,
		},
		{
			rotateY: 0.3,
		},
		{
			rotateZ: 0.1,
		},
		{
			translateY: 150,
		},
		{
			translateX: 100,
		},
		{
			scale: 0.8
		},
	],
})
root.insertChild(child2)

const screen = Dimensions.get("window")
root.computeLayout(screen.width, screen.height)

// @ts-ignore
globalThis.root = root
// @ts-ignore
globalThis.child = child

// root.computeLayout()

const layout = root.layout
const layoutChild = child.layout
const picture = root.draw()

// reconciler.updateContainer(<Root />, r, null, null)

// Yoga.Node.create().calculateLayout(undefined, undefined, Direction.LTR)
// Yoga.Node.create().getComputedLayout()
// const picture = root.draw()

console.log("layout", layout)
console.log("layoutChild", layoutChild)

// console.log("picture", picture)

// @ts-ignore
globalThis.node = root

export default function HomeScreen() {
	return (
		<Canvas style={{ width: screen.width, height: screen.height }}>
			<Picture picture={picture} />
		</Canvas>
	)
}
