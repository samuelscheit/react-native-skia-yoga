import { useImage } from "@shopify/react-native-skia"
import { CommandDemoScreen } from "@/components/CommandDemoScreen"

const reactLogo = require("../../../assets/images/react-logo.png")

export default function ImageCommandScreen() {
	const image = useImage(reactLogo)

	return (
		<CommandDemoScreen
			description="Image renders a real bundled asset through the typed image command."
			title="image"
		>
			<rect
				style={{
					alignItems: "center",
					backgroundColor: "#08131d",
					flex: 1,
					justifyContent: "center",
				}}
			>
				{image ? (
					<image
						fit="contain"
						image={image}
						style={{
							height: 220,
							width: 220,
						}}
					/>
				) : (
					<circle
						radius={20}
						style={{
							backgroundColor: "#38bdf8",
							height: 40,
							width: 40,
						}}
					/>
				)}
			</rect>
		</CommandDemoScreen>
	)
}
