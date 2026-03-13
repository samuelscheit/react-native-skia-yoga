import { Skia } from "@shopify/react-native-skia"
import { useMemo } from "react"
import { CommandDemoScreen } from "@/components/CommandDemoScreen"

export default function PathCommandScreen() {
	const wavePath = useMemo(() => {
		const path = Skia.Path.MakeFromSVGString(
			"M0 56 C 30 -8, 92 120, 122 56 S 212 -8, 242 56",
		)

		if (!path) {
			throw new Error("Failed to create path demo")
		}

		return path
	}, [])

	return (
		<CommandDemoScreen
			description="Path uses a typed SkPath payload plus stroke and trim command props."
			title="path"
		>
			<rect
				style={{
					alignItems: "center",
					backgroundColor: "#08131d",
					flex: 1,
					justifyContent: "center",
				}}
			>
				<path
					path={wavePath}
					stroke={{ width: 10 }}
					trimEnd={0.82}
					style={{
						backgroundColor: "#fda4af",
						height: 112,
						width: 242,
					}}
				/>
			</rect>
		</CommandDemoScreen>
	)
}
