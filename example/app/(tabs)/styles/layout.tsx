import { StyleShowcaseScreen } from "@/components/StyleShowcaseScreen"

import { styleShowcaseBySlug } from "./registry"

const showcase = styleShowcaseBySlug.layout

export default function LayoutStyleScreen() {
	return (
		<StyleShowcaseScreen
			description={showcase.description}
			sections={showcase.sections}
			title={showcase.title}
		/>
	)
}
