import { StyleShowcaseScreen } from "@/components/StyleShowcaseScreen"

import { styleShowcaseBySlug } from "./registry"

const showcase = styleShowcaseBySlug.spacing

export default function SpacingStyleScreen() {
	return (
		<StyleShowcaseScreen
			description={showcase.description}
			sections={showcase.sections}
			title={showcase.title}
		/>
	)
}
