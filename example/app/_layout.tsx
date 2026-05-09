import {
	DarkTheme,
	DefaultTheme,
	ThemeProvider,
} from "@react-navigation/native"
import { useFonts } from "expo-font"
import { Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"
import "react-native-reanimated"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { StyleSheet } from "react-native"
import "../components/polyfill"

import { useColorScheme } from "@/hooks/useColorScheme"

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
})

export default function RootLayout() {
	const colorScheme = useColorScheme()
	const [loaded] = useFonts({
		SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
	})

	if (!loaded) {
		// Async font loading only occurs in development.
		return null
	}

	return (
		<GestureHandlerRootView style={styles.root}>
			<ThemeProvider
				value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
			>
				<Stack>
					<Stack.Screen
						name="(tabs)"
						options={{ headerShown: false }}
					/>
					<Stack.Screen name="+not-found" />
				</Stack>
				<StatusBar style="auto" />
			</ThemeProvider>
		</GestureHandlerRootView>
	)
}
