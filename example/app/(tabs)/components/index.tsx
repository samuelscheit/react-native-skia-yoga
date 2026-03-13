import { Link } from "expo-router"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { commandDemos } from "./registry"

export default function CommandsIndexScreen() {
	return (
		<ScrollView
			contentContainerStyle={styles.content}
			style={styles.container}
		>
			<View style={styles.hero}>
				<Text style={styles.title}>Command Gallery</Text>
				<Text style={styles.description}>
					Each supported host command has its own route so you can inspect it in
					isolation.
				</Text>
			</View>
			<View style={styles.list}>
				{commandDemos.map((demo) => {
					return (
						<Link
							asChild
							href={demo.href}
							key={demo.slug}
						>
							<Text style={styles.card}>
								<Text style={styles.cardTitle}>{demo.title}</Text>
								{"\n"}
								<Text style={styles.cardDescription}>{demo.description}</Text>
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
