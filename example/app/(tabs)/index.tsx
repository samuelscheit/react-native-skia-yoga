import { SafeAreaView } from "react-native-safe-area-context"
import { createYogaNode, reconciler } from "react-native-skia-yoga"
import { ThemedText } from "../../components/ThemedText"

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

reconciler.updateContainer(<Root />, r, null, null)

// Yoga.Node.create().calculateLayout(undefined, undefined, Direction.LTR)
// Yoga.Node.create().getComputedLayout()

console.log(root.getComputedLayout())

// @ts-ignore
globalThis.node = root

export default function HomeScreen() {
	return (
		<SafeAreaView
			style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
		>
			<ThemedText style={{ fontSize: 50, lineHeight: 50 }}>
				Hello
			</ThemedText>
		</SafeAreaView>
	)
}
