import { StyleShowcaseScreen } from "@/components/StyleShowcaseScreen"

import { styleShowcaseBySlug } from "./registry"

const showcase = styleShowcaseBySlug.paint

export default function PaintStyleScreen() {
	return (
		<StyleShowcaseScreen
			description={showcase.description}
			sections={showcase.sections}
			title={showcase.title}
		/>
	)
}
