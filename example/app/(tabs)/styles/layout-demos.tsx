import type { StylePropertySection } from "@/components/StyleShowcaseScreen"

import { chip, previewFrame, sceneWithSingleBox, styleScene } from "./style-demo-builders"

export const layoutSections = [
	{
		description: "Core flexbox behavior, sizing, and intrinsic layout constraints.",
		properties: [
			{
				example: 'alignContent: "space-between"',
				name: "alignContent",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								alignContent: "space-between",
								backgroundColor: "#0c1a27",
								flexDirection: "row",
								flexWrap: "wrap",
								height: 92,
								padding: 8,
								width: 150,
							}}
						>
							{chip("#7dd3fc", 40, 18)}
							{chip("#34d399", 40, 18)}
							{chip("#f59e0b", 40, 18)}
							{chip("#fca5a5", 40, 18)}
						</rect>,
					),
				),
			},
			{
				example: 'alignItems: "center"',
				name: "alignItems",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								alignItems: "center",
								backgroundColor: "#0c1a27",
								flexDirection: "row",
								height: 86,
								justifyContent: "space-around",
								width: 164,
							}}
						>
							{chip("#7dd3fc", 18, 24)}
							{chip("#34d399", 18, 42)}
							{chip("#f59e0b", 18, 30)}
						</rect>,
					),
				),
			},
			{
				example: 'alignSelf: "stretch"',
				name: "alignSelf",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								alignItems: "flex-start",
								backgroundColor: "#0c1a27",
								height: 92,
								padding: 10,
								width: 164,
							}}
						>
							<rect
								style={{
									alignSelf: "stretch",
									backgroundColor: "#7dd3fc",
									height: 28,
								}}
							/>
						</rect>,
					),
				),
			},
			{
				example: "aspectRatio: 16 / 9",
				name: "aspectRatio",
				preview: sceneWithSingleBox({
					aspectRatio: 16 / 9,
					width: 140,
				}),
			},
			{
				example: 'boxSizing: "border-box"',
				name: "boxSizing",
				preview: sceneWithSingleBox({
					borderWidth: 10,
					boxSizing: "border-box",
					padding: 12,
					width: 160,
				}),
			},
			{
				example: 'direction: "rtl"',
				name: "direction",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								backgroundColor: "#0c1a27",
								direction: "rtl",
								flexDirection: "row",
								gap: 8,
								paddingHorizontal: 12,
								width: 164,
							}}
						>
							{chip("#7dd3fc", 34, 24)}
							{chip("#34d399", 34, 24)}
							{chip("#f59e0b", 34, 24)}
						</rect>,
					),
				),
			},
			{
				example: 'display: "contents"',
				name: "display",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								alignItems: "center",
								backgroundColor: "#0c1a27",
								height: 90,
								justifyContent: "center",
								width: 164,
							}}
						>
							<rect
								style={{
									display: "contents",
								}}
							>
								{chip("#7dd3fc", 120, 34)}
							</rect>
						</rect>,
					),
				),
			},
			{
				example: "flex: 1",
				name: "flex",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								backgroundColor: "#0c1a27",
								flexDirection: "row",
								height: 84,
								padding: 10,
								width: 172,
							}}
						>
							<rect
								style={{
									backgroundColor: "#7dd3fc",
									flex: 1,
								}}
							/>
							{chip("#34d399", 40, 64, { marginLeft: 8 })}
						</rect>,
					),
				),
			},
			{
				example: 'flexBasis: "40%"',
				name: "flexBasis",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								backgroundColor: "#0c1a27",
								flexDirection: "row",
								padding: 10,
								width: 172,
							}}
						>
							<rect
								style={{
									backgroundColor: "#7dd3fc",
									flexBasis: "40%",
									height: 52,
								}}
							/>
							<rect
								style={{
									backgroundColor: "#34d399",
									flex: 1,
									height: 52,
									marginLeft: 8,
								}}
							/>
						</rect>,
					),
				),
			},
			{
				example: 'flexDirection: "row"',
				name: "flexDirection",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								backgroundColor: "#0c1a27",
								flexDirection: "row",
								gap: 8,
								padding: 10,
							}}
						>
							{chip("#7dd3fc", 34, 34)}
							{chip("#34d399", 34, 34)}
							{chip("#f59e0b", 34, 34)}
						</rect>,
					),
				),
			},
			{
				example: "flexGrow: 1",
				name: "flexGrow",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								backgroundColor: "#0c1a27",
								flexDirection: "row",
								padding: 10,
								width: 172,
							}}
						>
							{chip("#34d399", 36, 52)}
							<rect
								style={{
									backgroundColor: "#7dd3fc",
									flexGrow: 1,
									height: 52,
									marginLeft: 8,
								}}
							/>
						</rect>,
					),
				),
			},
			{
				example: "flexShrink: 1",
				name: "flexShrink",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								backgroundColor: "#0c1a27",
								flexDirection: "row",
								padding: 10,
								width: 140,
							}}
						>
							<rect
								style={{
									backgroundColor: "#7dd3fc",
									flexShrink: 1,
									height: 52,
									width: 110,
								}}
							/>
							{chip("#34d399", 48, 52, { marginLeft: 8 })}
						</rect>,
					),
				),
			},
			{
				example: 'flexWrap: "wrap"',
				name: "flexWrap",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								backgroundColor: "#0c1a27",
								flexDirection: "row",
								flexWrap: "wrap",
								gap: 8,
								padding: 10,
								width: 122,
							}}
						>
							{chip("#7dd3fc", 46, 24)}
							{chip("#34d399", 46, 24)}
							{chip("#f59e0b", 46, 24)}
							{chip("#fca5a5", 46, 24)}
						</rect>,
					),
				),
			},
			{
				example: "gap: 16",
				name: "gap",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								backgroundColor: "#0c1a27",
								flexDirection: "row",
								gap: 16,
								padding: 10,
							}}
						>
							{chip("#7dd3fc", 28, 28)}
							{chip("#34d399", 28, 28)}
							{chip("#f59e0b", 28, 28)}
						</rect>,
					),
				),
			},
			{
				example: "rowGap: 20",
				name: "rowGap",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								backgroundColor: "#0c1a27",
								columnGap: 8,
								flexDirection: "row",
								flexWrap: "wrap",
								padding: 10,
								rowGap: 20,
								width: 128,
							}}
						>
							{chip("#7dd3fc", 50, 22)}
							{chip("#34d399", 50, 22)}
							{chip("#f59e0b", 50, 22)}
							{chip("#fca5a5", 50, 22)}
						</rect>,
					),
				),
			},
			{
				example: "columnGap: 12",
				name: "columnGap",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								backgroundColor: "#0c1a27",
								columnGap: 12,
								flexDirection: "row",
								flexWrap: "wrap",
								padding: 10,
								rowGap: 8,
								width: 128,
							}}
						>
							{chip("#7dd3fc", 46, 22)}
							{chip("#34d399", 46, 22)}
							{chip("#f59e0b", 46, 22)}
							{chip("#fca5a5", 46, 22)}
						</rect>,
					),
				),
			},
			{
				example: "height: 220",
				name: "height",
				preview: sceneWithSingleBox({
					height: 96,
					width: 120,
				}),
			},
			{
				example: 'justifyContent: "space-around"',
				name: "justifyContent",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								backgroundColor: "#0c1a27",
								flexDirection: "row",
								height: 76,
								justifyContent: "space-around",
								width: 168,
							}}
						>
							{chip("#7dd3fc", 24, 24)}
							{chip("#34d399", 24, 24)}
							{chip("#f59e0b", 24, 24)}
						</rect>,
					),
				),
			},
			{
				example: "maxHeight: 280",
				name: "maxHeight",
				preview: sceneWithSingleBox({
					height: 112,
					maxHeight: 68,
					width: 112,
				}),
			},
			{
				example: 'maxWidth: "90%"',
				name: "maxWidth",
				preview: sceneWithSingleBox({
					height: 72,
					maxWidth: 92,
					width: 164,
				}),
			},
			{
				example: "minHeight: 160",
				name: "minHeight",
				preview: sceneWithSingleBox({
					height: 28,
					minHeight: 76,
					width: 112,
				}),
			},
			{
				example: "minWidth: 180",
				name: "minWidth",
				preview: sceneWithSingleBox({
					height: 72,
					minWidth: 124,
					width: 48,
				}),
			},
			{
				example: 'overflow: "hidden"',
				name: "overflow",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								alignItems: "center",
								backgroundColor: "#0c1a27",
								height: 80,
								justifyContent: "center",
								overflow: "hidden",
								width: 124,
							}}
						>
							<rect
								style={{
									backgroundColor: "#7dd3fc",
									height: 68,
									transform: [{ rotateZ: 0.45 }],
									width: 152,
								}}
							/>
						</rect>,
					),
				),
			},
			{
				example: 'width: "stretch"',
				name: "width",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								backgroundColor: "#0c1a27",
								padding: 12,
								width: 168,
							}}
						>
							<rect
								style={{
									backgroundColor: "#7dd3fc",
									height: 40,
									width: "stretch",
								}}
							/>
						</rect>,
					),
				),
			},
		],
		title: "Layout",
	},
] as const satisfies readonly StylePropertySection[]
