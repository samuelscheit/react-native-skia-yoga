import { Link } from "expo-router"
import { ScrollView, StyleSheet, Text, View } from "react-native"

import { countStyleProperties, styleShowcases } from "./registry"

export default function StylesIndexScreen() {
	return (
		<ScrollView
			contentContainerStyle={styles.content}
			style={styles.container}
		>
			<View style={styles.hero}>
				<Text style={styles.title}>Style Gallery</Text>
				<Text style={styles.description}>
					Every supported `NodeStyle` key is grouped into focused routes with a
					live preview and concrete example values.
				</Text>
			</View>
			<View style={styles.list}>
				{styleShowcases.map((showcase) => {
					return (
						<Link
							asChild
							href={showcase.href}
							key={showcase.slug}
						>
							<Text style={styles.card}>
								<Text style={styles.cardTitle}>{showcase.title}</Text>
								{"\n"}
								<Text style={styles.cardDescription}>
									{showcase.description}
								</Text>
								{"\n\n"}
								<Text style={styles.cardMeta}>
									{countStyleProperties(showcase.sections)} properties
								</Text>
							</Text>
						</Link>
					)
				})}
			</View>
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	card: {
		backgroundColor: "#102232",
		borderColor: "#17354d",
		borderRadius: 18,
		borderWidth: 1,
		color: "#f3f8fb",
		paddingHorizontal: 18,
		paddingVertical: 16,
	},
	cardDescription: {
		color: "#8ca2b5",
		fontSize: 14,
		lineHeight: 20,
	},
	cardMeta: {
		color: "#67e8f9",
		fontSize: 13,
		fontWeight: "700",
	},
	cardTitle: {
		color: "#f3f8fb",
		fontSize: 18,
		fontWeight: "700",
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
	hero: {
		gap: 8,
	},
	list: {
		gap: 12,
	},
	title: {
		color: "#f3f8fb",
		fontSize: 30,
		fontWeight: "700",
	},
})
