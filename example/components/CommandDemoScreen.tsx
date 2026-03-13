import type { ReactNode } from "react"
import { StyleSheet, Text, View } from "react-native"
import { YogaCanvas } from "react-native-skia-yoga"

type CommandDemoScreenProps = {
	children: ReactNode
	description: string
	title: string
}

export function CommandDemoScreen({
	children,
	description,
	title,
}: CommandDemoScreenProps) {
	return (
		<View style={styles.container}>
			<View style={styles.header}>
				<Text style={styles.title}>{title}</Text>
				<Text style={styles.description}>{description}</Text>
			</View>
			<YogaCanvas style={styles.canvas}>{children}</YogaCanvas>
		</View>
	)
}

const styles = StyleSheet.create({
	canvas: {
		flex: 1,
	},
	container: {
		backgroundColor: "#08131d",
		flex: 1,
	},
	description: {
		color: "#8ca2b5",
		fontSize: 14,
		lineHeight: 20,
	},
	header: {
		gap: 8,
		paddingBottom: 12,
		paddingHorizontal: 20,
		paddingTop: 20,
	},
	title: {
		color: "#f3f8fb",
		fontSize: 28,
		fontWeight: "700",
	},
})
