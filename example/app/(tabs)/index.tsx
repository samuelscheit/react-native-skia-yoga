import { Canvas, Picture } from "@shopify/react-native-skia"
import { SafeAreaView } from "react-native-safe-area-context"
import { createYogaNode, reconciler } from "react-native-skia-yoga"

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

const root = createYogaNode()

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
globalThis.root = root

root.setType("rect")
root.setProps({})
root.setStyle({
	flex: 1,
	width: 100,
	height: 100,
	flexDirection: "row",
	backgroundColor: "blue",
})
const child = createYogaNode()
globalThis.child = child

child.setType("rect")
child.setProps({})
child.setStyle({
	margin: 10,
	flex: 1,
	backgroundColor: "red",
})
root.insertChild(child)


root.computeLayout()

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
		<SafeAreaView
			style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
		>
			<Canvas style={{ width: 300, height: 300 }}>
				<Picture picture={picture} />
			</Canvas>
		</SafeAreaView>
	)
}
