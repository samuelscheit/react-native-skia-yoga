import type { StylePropertySection } from "@/components/StyleShowcaseScreen"

import { previewFrame, styleScene } from "./style-demo-builders"

export const transformSections = [
	{
		description: "2D and 3D transform stacks plus explicit matrix overrides.",
		properties: [
			{
				example:
					'transform: [{ translateX: 24 }, { rotateZ: 0.4 }, { scale: 0.9 }]',
				name: "transform",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								backgroundColor: "#7dd3fc",
								height: 68,
								transform: [
									{ translateX: 14 },
									{ translateY: 6 },
									{ rotateZ: 0.35 },
									{ scale: 0.88 },
									{ scaleX: 1.08 },
									{ scaleY: 0.92 },
									{ skewX: 0.12 },
									{ skewY: -0.08 },
									{ rotateX: 0.2 },
									{ rotateY: -0.18 },
								],
								width: 122,
							}}
						/>,
					),
				),
			},
			{
				example: "origin: [80, 40]",
				name: "origin",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								backgroundColor: "#34d399",
								height: 68,
								origin: [80, 40],
								transform: [{ rotateZ: 0.45 }],
								width: 122,
							}}
						/>,
					),
				),
			},
			{
				example: "matrix: [1, 0, 24, 0, 1, -12, 0, 0, 1]",
				name: "matrix",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								backgroundColor: "#f59e0b",
								height: 68,
								matrix: [1, 0, 24, 0, 1, -12, 0, 0, 1],
								width: 122,
							}}
						/>,
					),
				),
			},
		],
		title: "Transforms",
	},
] as const satisfies readonly StylePropertySection[]
