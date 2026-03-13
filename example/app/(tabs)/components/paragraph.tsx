import { CommandDemoScreen } from "@/components/CommandDemoScreen"

export default function ParagraphCommandScreen() {
	return (
		<CommandDemoScreen
			description="Paragraph builds a SkParagraph from text and paragraphStyle, including wrapping behavior."
			title="paragraph"
		>
			<rect
				style={{
					alignItems: "center",
					backgroundColor: "#08131d",
					flex: 1,
					justifyContent: "center",
					padding: 24,
				}}
			>
				<paragraph
					style={{
						maxWidth: 260,
					}}
					paragraphStyle={{
						color: "#f3f8fb",
						fontSize: 24,
					}}
					text="Paragraph command text should wrap naturally inside its max width."
				/>
			</rect>
		</CommandDemoScreen>
	)
}
