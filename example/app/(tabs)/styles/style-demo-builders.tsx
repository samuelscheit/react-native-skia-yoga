import type { ReactNode } from "react"
import type { YogaNodeStyle } from "react-native-skia-yoga"

const sceneRootStyle: YogaNodeStyle = {
	alignItems: "center",
	backgroundColor: "#08131d",
	flex: 1,
	justifyContent: "center",
	padding: 12,
}

const frameStyle: YogaNodeStyle = {
	alignItems: "center",
	backgroundColor: "#102232",
	height: 116,
	justifyContent: "center",
	width: 196,
}

export function styleScene(
	children: ReactNode,
	rootStyle?: YogaNodeStyle,
) {
	return <rect style={{ ...sceneRootStyle, ...rootStyle }}>{children}</rect>
}

export function previewFrame(
	children: ReactNode,
	style?: YogaNodeStyle,
) {
	return <rect style={{ ...frameStyle, ...style }}>{children}</rect>
}

export function chip(
	color: string,
	width = 36,
	height = 20,
	style?: YogaNodeStyle,
) {
	return (
		<rect
			style={{
				backgroundColor: color,
				height,
				width,
				...style,
			}}
		/>
	)
}

export function sceneWithSingleBox(
	style: YogaNodeStyle,
	children?: ReactNode,
	frame?: YogaNodeStyle,
) {
	return styleScene(
		previewFrame(
			<rect
				style={{
					backgroundColor: "#7dd3fc",
					height: 72,
					width: 120,
					...style,
				}}
			>
				{children}
			</rect>,
			frame,
		),
	)
}
