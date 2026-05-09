import { Platform } from "react-native"

import { HapticTab } from "@/components/HapticTab"
import { IconSymbol } from "@/components/ui/IconSymbol"
import TabBarBackground from "@/components/ui/TabBarBackground"
import { Colors } from "@/constants/Colors"
import { useColorScheme } from "@/hooks/useColorScheme"
import { Tabs } from "expo-router"

type TabBarIconProps = {
	color: string
}

function BreathTabIcon({ color }: TabBarIconProps) {
	return <IconSymbol size={28} name="house.fill" color={color} />
}

function AnimateTabIcon({ color }: TabBarIconProps) {
	return <IconSymbol size={28} name="sparkles" color={color} />
}

function InteractivityTabIcon({ color }: TabBarIconProps) {
	return <IconSymbol size={28} name="hand.tap.fill" color={color} />
}

function ComponentsTabIcon({ color }: TabBarIconProps) {
	return <IconSymbol size={28} name="square.grid.2x2.fill" color={color} />
}

function StylesTabIcon({ color }: TabBarIconProps) {
	return (
		<IconSymbol
			size={28}
			name="chevron.left.forwardslash.chevron.right"
			color={color}
		/>
	)
}

function BenchmarkTabIcon({ color }: TabBarIconProps) {
	return <IconSymbol size={28} name="speedometer" color={color} />
}

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
					tabBarIcon: BreathTabIcon,
				}}
			/>
			<Tabs.Screen
				name="animate"
				options={{
					title: "Animate",
					tabBarIcon: AnimateTabIcon,
				}}
			/>
			<Tabs.Screen
				name="interactivity"
				options={{
					title: "Interact",
					tabBarIcon: InteractivityTabIcon,
				}}
			/>
			<Tabs.Screen
				name="components"
				options={{
					title: "Components",
					tabBarIcon: ComponentsTabIcon,
				}}
			/>
			<Tabs.Screen
				name="styles"
				options={{
					title: "Styles",
					tabBarIcon: StylesTabIcon,
				}}
			/>
			<Tabs.Screen
				name="benchmark"
				options={{
					title: "Benchmark",
					tabBarIcon: BenchmarkTabIcon,
				}}
			/>
		</Tabs>
	)
}
