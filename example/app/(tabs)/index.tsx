import { Canvas, Picture, Skia, SkPicture, TextAlign } from "@shopify/react-native-skia"
import { Dimensions, ViewStyle } from "react-native"
import { createYogaNode, reconciler } from "react-native-skia-yoga"

declare namespace React {
	namespace JSX {
		interface IntrinsicElements {
			group: any
			rect: any
			circle: any
			oval: any
			text: any
			paragraph: any
		}
	}
}

function Root() {
	return (
		<rect style={{ flex: 1, backgroundColor: "blue", paddingTop: 60 }}>
			<circle style={{ flex: 1, backgroundColor: "red",margin: 50 }} />
			<paragraph style={{ flex: 1, color: Skia.Color("white"), fontSize: 50, textAlign: TextAlign.Center } as ViewStyle} text="How are you?" />
		</rect>
	)
}

export default function HomeScreen() {

	const screen = Dimensions.get("window")
	const root = createYogaNode()

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

	return (
		<Canvas style={{ width: screen.width, height: screen.height }}>
			<Picture picture={picture} />
		</Canvas>
	)
}
