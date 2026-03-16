import { Platform } from "react-native"

import { HapticTab } from "@/components/HapticTab"
import { IconSymbol } from "@/components/ui/IconSymbol"
import TabBarBackground from "@/components/ui/TabBarBackground"
import { Colors } from "@/constants/Colors"
import { useColorScheme } from "@/hooks/useColorScheme"
import { Tabs } from "expo-router"

export default function TabLayout() {
	const colorScheme = useColorScheme()

	return (
		<Tabs
			screenOptions={{
				tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
				headerShown: false,
				tabBarButton: HapticTab,
				tabBarBackground: TabBarBackground,
				tabBarStyle: Platform.select({
					ios: {
						// Use a transparent background on iOS to show the blur effect
						position: "absolute",
					},
					default: {},
				}),
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					title: "Breath",
					tabBarIcon: ({ color }) => (
						<IconSymbol size={28} name="house.fill" color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="animate"
				options={{
					title: "Animate",
					tabBarIcon: ({ color }) => (
						<IconSymbol size={28} name="sparkles" color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="interactivity"
				options={{
					title: "Interact",
					tabBarIcon: ({ color }) => (
						<IconSymbol
							size={28}
							name="hand.tap.fill"
							color={color}
						/>
					),
				}}
			/>
			<Tabs.Screen
				name="components"
				options={{
					title: "Components",
					tabBarIcon: ({ color }) => (
						<IconSymbol
							size={28}
							name="square.grid.2x2.fill"
							color={color}
						/>
					),
				}}
			/>
			<Tabs.Screen
				name="styles"
				options={{
					title: "Styles",
					tabBarIcon: ({ color }) => (
						<IconSymbol
							size={28}
							name="chevron.left.forwardslash.chevron.right"
							color={color}
						/>
					),
				}}
			/>
			<Tabs.Screen
				name="benchmark"
				options={{
					title: "Benchmark",
					tabBarIcon: ({ color }) => (
						<IconSymbol
							size={28}
							name="speedometer"
							color={color}
						/>
					),
				}}
			/>
		</Tabs>
	)
}
