import { CommandDemoScreen } from "@/components/CommandDemoScreen"

export default function TextCommandScreen() {
	return (
		<CommandDemoScreen
			description="The text command accepts plain text plus a dedicated textStyle payload."
			title="text"
		>
			<rect
				style={{
					alignItems: "center",
					backgroundColor: "#08131d",
					flex: 1,
					justifyContent: "center",
				}}
			>
				<text
					text="Typed text command"
					textStyle={{
						color: "#f8fafc",
						fontSize: 30,
					}}
				/>
			</rect>
		</CommandDemoScreen>
	)
}
