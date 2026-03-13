import type { ReactNode } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { YogaCanvas } from "react-native-skia-yoga"
import type { YogaNodeStyle } from "react-native-skia-yoga"

export type StylePropertyDefinition = {
	example: string
	name: keyof YogaNodeStyle
	preview: ReactNode
}

export type StylePropertySection = {
	description: string
	properties: readonly StylePropertyDefinition[]
	title: string
}

type StyleShowcaseScreenProps = {
	description: string
	sections: readonly StylePropertySection[]
	title: string
}

export function StyleShowcaseScreen({
	description,
	sections,
	title,
}: StyleShowcaseScreenProps) {
	return (
		<ScrollView
			contentContainerStyle={styles.content}
			style={styles.container}
		>
			<View style={styles.header}>
				<Text style={styles.title}>{title}</Text>
				<Text style={styles.description}>{description}</Text>
			</View>
			{sections.map((section) => {
				return (
					<View
						key={section.title}
						style={styles.section}
					>
						<Text style={styles.sectionTitle}>{section.title}</Text>
						<Text style={styles.sectionDescription}>
							{section.description}
						</Text>
						<View style={styles.propertyList}>
							{section.properties.map((property) => {
								return (
									<View
										key={property.name}
										style={styles.propertyCard}
									>
										<Text style={styles.propertyName}>{property.name}</Text>
										<View style={styles.canvasShell}>
											<YogaCanvas style={styles.canvas}>
												{property.preview}
											</YogaCanvas>
										</View>
										<Text style={styles.propertyExample}>
											{property.example}
										</Text>
									</View>
								)
							})}
						</View>
					</View>
				)
			})}
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	canvas: {
		flex: 1,
	},
	canvasShell: {
		backgroundColor: "#040b12",
		borderColor: "#17354d",
		borderRadius: 22,
		borderWidth: 1,
		height: 320,
		overflow: "hidden",
	},
	container: {
		backgroundColor: "#08131d",
		flex: 1,
	},
	content: {
		gap: 18,
		padding: 20,
		paddingBottom: 120,
	},
	description: {
		color: "#8ca2b5",
		fontSize: 15,
		lineHeight: 22,
	},
	header: {
		gap: 8,
	},
	propertyCard: {
		backgroundColor: "#0c1a27",
		borderColor: "#17354d",
		borderRadius: 16,
		borderWidth: 1,
		gap: 10,
		paddingHorizontal: 14,
		paddingVertical: 12,
	},
	propertyExample: {
		color: "#8ca2b5",
		fontFamily: "SpaceMono-Regular",
		fontSize: 12,
		lineHeight: 18,
	},
	propertyList: {
		gap: 10,
	},
	propertyName: {
		color: "#f3f8fb",
		fontSize: 16,
		fontWeight: "700",
	},
	section: {
		backgroundColor: "#102232",
		borderColor: "#17354d",
		borderRadius: 24,
		borderWidth: 1,
		gap: 12,
		padding: 16,
	},
	sectionDescription: {
		color: "#8ca2b5",
		fontSize: 14,
		lineHeight: 20,
	},
	sectionTitle: {
		color: "#f3f8fb",
		fontSize: 18,
		fontWeight: "700",
	},
	title: {
		color: "#f3f8fb",
		fontSize: 30,
		fontWeight: "700",
	},
})
