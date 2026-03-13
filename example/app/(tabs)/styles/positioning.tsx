import { StyleShowcaseScreen } from "@/components/StyleShowcaseScreen"

import { styleShowcaseBySlug } from "./registry"

const showcase = styleShowcaseBySlug.positioning

export default function PositioningStyleScreen() {
	return (
		<StyleShowcaseScreen
			description={showcase.description}
			sections={showcase.sections}
			title={showcase.title}
		/>
	)
}
