import { PointMode } from "@shopify/react-native-skia"
import { CommandDemoScreen } from "@/components/CommandDemoScreen"

export default function PointsCommandScreen() {
	return (
		<CommandDemoScreen
			description="Points accepts a typed point array and point mode payload."
			title="points"
		>
			<rect
				style={{
					alignItems: "center",
					backgroundColor: "#08131d",
					flex: 1,
					justifyContent: "center",
				}}
			>
				<points
					pointMode={PointMode.Polygon}
					points={[
						{ x: 0, y: 70 },
						{ x: 60, y: 0 },
						{ x: 140, y: 30 },
						{ x: 220, y: 80 },
					]}
					style={{
						backgroundColor: "#67e8f9",
						height: 100,
						width: 240,
					}}
				/>
			</rect>
		</CommandDemoScreen>
	)
}
