import { CommandDemoScreen } from "@/components/CommandDemoScreen"

export default function LineCommandScreen() {
	return (
		<CommandDemoScreen
			description="Line uses explicit start and end points and then scales into the Yoga layout box."
			title="line"
		>
			<rect
				style={{
					alignItems: "center",
					backgroundColor: "#08131d",
					flex: 1,
					justifyContent: "center",
				}}
			>
				<line
					from={{ x: 0, y: 0 }}
					to={{ x: 180, y: 80 }}
					style={{
						backgroundColor: "#f3f8fb",
						height: 100,
						width: 220,
					}}
				/>
			</rect>
		</CommandDemoScreen>
	)
}
