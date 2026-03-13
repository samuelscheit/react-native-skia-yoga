import { CommandDemoScreen } from "@/components/CommandDemoScreen"

export default function BlurMaskFilterCommandScreen() {
	return (
		<CommandDemoScreen
			description="Blur mask filter wraps child content and applies a blur command payload."
			title="blurMaskFilter"
		>
			<rect
				style={{
					alignItems: "center",
					backgroundColor: "#08131d",
					flex: 1,
					justifyContent: "center",
				}}
			>
				<blurMaskFilter
					blur={28}
					blurStyle="solid"
				>
					<group
						style={{
							alignItems: "center",
							gap: 16,
							justifyContent: "center",
						}}
					>
						<circle
							radius={38}
							style={{
								backgroundColor: "#7dd3fc",
								height: 76,
								width: 76,
							}}
						/>
						<rrect
							cornerRadius={18}
							style={{
								backgroundColor: "#fda4af",
								height: 56,
								width: 180,
							}}
						/>
					</group>
				</blurMaskFilter>
			</rect>
		</CommandDemoScreen>
	)
}
