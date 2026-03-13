import { CommandDemoScreen } from "@/components/CommandDemoScreen"

export default function OvalCommandScreen() {
	return (
		<CommandDemoScreen
			description="Oval uses the Yoga bounds directly, unlike circle which also has a command radius."
			title="oval"
		>
			<rect
				style={{
					alignItems: "center",
					backgroundColor: "#08131d",
					flex: 1,
					justifyContent: "center",
				}}
			>
				<oval
					style={{
						backgroundColor: "#c084fc",
						height: 140,
						width: 250,
					}}
				/>
			</rect>
		</CommandDemoScreen>
	)
}
