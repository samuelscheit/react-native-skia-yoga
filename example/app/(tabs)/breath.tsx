import { Skia } from "@shopify/react-native-skia"
import { useMemo } from "react"
import { YogaCanvas } from "react-native-skia-yoga"

function PathDemo() {
	const wavePath = useMemo(() => {
		const path = Skia.Path.MakeFromSVGString(
			"M0 60 C 30 0, 90 120, 120 60 S 210 0, 240 60",
		)

		if (!path) {
			throw new Error("Failed to create path demo")
		}

		return path
	}, [])

	return (
		<rect
			style={{
				alignItems: "center",
				backgroundColor: "#101418",
				flex: 1,
				gap: 24,
				justifyContent: "center",
			}}
		>
			<path
				path={wavePath}
				stroke={{ width: 10 }}
				style={{
					backgroundColor: "#8bd3dd",
					height: 120,
					width: 240,
				}}
			/>
			<paragraph
				style={{
					maxWidth: 280,
				}}
				paragraphStyle={{
					color: "#f2f7f5",
					fontSize: 24,
				}}
				text="Path rendering is now part of the public surface."
			/>
		</rect>
	)
}

export default function BreathScreen() {
	return (
		<YogaCanvas style={{ flex: 1 }}>
			<PathDemo />
		</YogaCanvas>
	)
}
