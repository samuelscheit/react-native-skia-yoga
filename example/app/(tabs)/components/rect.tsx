import { CommandDemoScreen } from "@/components/CommandDemoScreen"

export default function RectCommandScreen() {
	return (
		<CommandDemoScreen
			description="The rect command fills its Yoga layout box with the current paint."
			title="rect"
		>
			<rect
				style={{
					alignItems: "center",
					backgroundColor: "#08131d",
					flex: 1,
					justifyContent: "center",
				}}
			>
				<rect
					style={{
						alignItems: "center",
						backgroundColor: "#34d399",
						height: 180,
						justifyContent: "center",
						width: 240,
					}}
				>
					<rect
						style={{
							backgroundColor: "#14313f",
							height: 72,
							width: 120,
						}}
					/>
				</rect>
			</rect>
		</CommandDemoScreen>
	)
}
