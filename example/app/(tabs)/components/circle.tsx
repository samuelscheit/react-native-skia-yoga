import { CommandDemoScreen } from "@/components/CommandDemoScreen"

export default function CircleCommandScreen() {
	return (
		<CommandDemoScreen
			description="Circle uses its command radius and draws inside the Yoga layout box."
			title="circle"
		>
			<rect
				style={{
					alignItems: "center",
					backgroundColor: "#08131d",
					flex: 1,
					justifyContent: "center",
				}}
			>
				<circle
					radius={72}
					style={{
						backgroundColor: "#7dd3fc",
						height: 144,
						width: 144,
					}}
				/>
			</rect>
		</CommandDemoScreen>
	)
}
