import type { YogaNodeStyle } from "react-native-skia-yoga"

import type { StylePropertySection } from "@/components/StyleShowcaseScreen"
import { layoutSections } from "./layout-demos"
import { paintSections } from "./paint-demos"
import { positioningSections } from "./positioning-demos"
import { spacingSections } from "./spacing-demos"
import { transformSections } from "./transform-demos"

type StylePropertyName = keyof YogaNodeStyle

type StyleShowcaseDefinition = {
	description: string
	href: `/styles/${string}`
	sections: readonly StylePropertySection[]
	slug: string
	title: string
}

export const styleShowcases = [
	{
		description:
			"Flexbox, sizing, wrapping, and overflow settings for Yoga layout.",
		href: "/styles/layout",
		sections: layoutSections,
		slug: "layout",
		title: "Layout",
	},
	{
		description:
			"Margins, paddings, gaps, and border widths across logical and physical edges.",
		href: "/styles/spacing",
		sections: spacingSections,
		slug: "spacing",
		title: "Spacing",
	},
	{
		description:
			"Absolute positioning helpers, directional edges, and inset shorthands.",
		href: "/styles/positioning",
		sections: positioningSections,
		slug: "positioning",
		title: "Positioning",
	},
	{
		description:
			"Skia paint properties including clipping, corner radii, opacity, and stroke styling.",
		href: "/styles/paint",
		sections: paintSections,
		slug: "paint",
		title: "Paint",
	},
	{
		description:
			"Transform arrays, explicit origins, and raw matrix application.",
		href: "/styles/transform",
		sections: transformSections,
		slug: "transform",
		title: "Transform",
	},
] as const satisfies readonly StyleShowcaseDefinition[]

export type StyleShowcaseSlug = (typeof styleShowcases)[number]["slug"]

export const styleShowcaseBySlug = Object.fromEntries(
	styleShowcases.map((showcase) => [showcase.slug, showcase]),
) as Record<StyleShowcaseSlug, (typeof styleShowcases)[number]>

export function countStyleProperties(
	sections: readonly StylePropertySection[],
) {
	return sections.reduce((count, section) => {
		return count + section.properties.length
	}, 0)
}

type CoveredStyleProperty =
	(typeof styleShowcases)[number]["sections"][number]["properties"][number]["name"]

type MissingStyleProperty = Exclude<StylePropertyName, CoveredStyleProperty>

const _allStylePropertiesCovered: MissingStyleProperty extends never
	? true
	: never = true

void _allStylePropertiesCovered
