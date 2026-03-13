import { CommandDemoScreen } from "@/components/CommandDemoScreen"

export default function RoundedRectCommandScreen() {
	return (
		<CommandDemoScreen
			description="Rounded rectangles use the command payload for cornerRadius, while size comes from layout."
			title="rrect"
		>
			<rect
				style={{
					alignItems: "center",
					backgroundColor: "#08131d",
					flex: 1,
					justifyContent: "center",
				}}
			>
				<rrect
					cornerRadius={36}
					style={{
						backgroundColor: "#fb7185",
						height: 170,
						width: 250,
					}}
				/>
			</rect>
		</CommandDemoScreen>
	)
}
