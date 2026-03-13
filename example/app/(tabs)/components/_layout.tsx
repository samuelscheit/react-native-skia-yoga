import { Stack } from "expo-router"
import React from "react"

export default function CommandsLayout() {
	return (
		<Stack
			screenOptions={{
				contentStyle: {
					backgroundColor: "#08131d",
				},
				headerStyle: {
					backgroundColor: "#08131d",
				},
				headerTintColor: "#f3f8fb",
			}}
		>
			<Stack.Screen
				name="index"
				options={{
					title: "Commands",
				}}
			/>
		</Stack>
	)
}
