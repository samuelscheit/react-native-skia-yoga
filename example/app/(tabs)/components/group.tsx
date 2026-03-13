import { CommandDemoScreen } from "@/components/CommandDemoScreen"

export default function GroupCommandScreen() {
	return (
		<CommandDemoScreen
			description="A group can hold multiple child commands and apply shared layout or transforms."
			title="group"
		>
			<rect
				style={{
					alignItems: "center",
					backgroundColor: "#08131d",
					flex: 1,
					justifyContent: "center",
				}}
			>
				<group
					style={{
						alignItems: "center",
						gap: 18,
						justifyContent: "center",
						opacity: 0.95,
					}}
				>
					<rrect
						cornerRadius={28}
						style={{
							backgroundColor: "#f59e0b",
							height: 96,
							width: 220,
						}}
					/>
					<group
						style={{
							alignItems: "center",
							flexDirection: "row",
							gap: 16,
						}}
					>
						<circle
							radius={32}
							style={{
								backgroundColor: "#7dd3fc",
								height: 64,
								width: 64,
							}}
						/>
						<circle
							radius={24}
							style={{
								backgroundColor: "#fca5a5",
								height: 48,
								width: 48,
							}}
						/>
					</group>
				</group>
			</rect>
		</CommandDemoScreen>
	)
}
