import { CommandDemoScreen } from "@/components/CommandDemoScreen"

export default function ParagraphCommandScreen() {
	return (
		<CommandDemoScreen
			description="Paragraph builds a SkParagraph from text and rich paragraphStyle fields."
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
						ellipsis: "...",
						heightMultiplier: 1.15,
						maxLines: 3,
						textStyle: {
							color: "#f3f8fb",
							fontSize: 24,
							letterSpacing: 0.2,
						},
					}}
					text="Paragraph command text should wrap naturally while using root paragraph fields plus nested textStyle."
				/>
			</rect>
		</CommandDemoScreen>
	)
}
