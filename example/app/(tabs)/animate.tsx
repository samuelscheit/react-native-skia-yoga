import { Easing, cancelAnimation, useDerivedValue, useSharedValue, withRepeat, withTiming } from "react-native-reanimated"
import { Skia } from "@shopify/react-native-skia"
import { useEffect, useMemo } from "react"
import { YogaCanvas } from "react-native-skia-yoga"

function useLoop(duration: number) {
	const progress = useSharedValue(0)

	useEffect(() => {
		progress.value = withRepeat(
			withTiming(1, { duration, easing: Easing.inOut(Easing.ease) }),
			-1,
			true,
		)

		return () => {
			cancelAnimation(progress)
		}
	}, [duration, progress])

	return progress
}

function AnimatedCommandPropsDemo() {
	const progress = useLoop(2200)
	const radius = useSharedValue(34)
	const trimEnd = useSharedValue(0.2)
	const blur = useSharedValue(6)

	const wavePath = useMemo(() => {
		const path = Skia.Path.MakeFromSVGString(
			"M0 56 C 30 -8, 92 120, 122 56 S 212 -8, 242 56",
		)

		if (!path) {
			throw new Error("Failed to create animated path demo")
		}

		return path
	}, [])

	useDerivedValue(() => {
		const t = progress.value
		radius.value = 22 + t * 34
		trimEnd.value = 0.15 + t * 0.85
		blur.value = 4 + t * 24
	})

	return (
		<rect
			style={{
				alignItems: "center",
				backgroundColor: "#0f1720",
				flex: 1,
				gap: 24,
				justifyContent: "center",
				padding: 24,
			}}
		>
			<paragraph
				style={{
					maxWidth: 280,
				}}
				paragraphStyle={{
					color: "#dbe7f0",
					fontSize: 18,
				}}
				text="This tab animates typed command props directly: circle.radius, path.trimEnd, and blurMaskFilter.blur."
			/>
			<blurMaskFilter blur={blur} blurStyle="solid">
				<group
					style={{
						alignItems: "center",
						gap: 20,
						justifyContent: "center",
					}}
				>
					<circle
						radius={radius}
						style={{
							backgroundColor: "#7dd3fc",
							height: 120,
							width: 120,
						}}
					/>
					<path
						path={wavePath}
						stroke={{ width: 10 }}
						trimEnd={trimEnd}
						style={{
							backgroundColor: "#fda4af",
							height: 112,
							width: 242,
						}}
					/>
				</group>
			</blurMaskFilter>
		</rect>
	)
}

export default function AnimateScreen() {
	return (
		<YogaCanvas style={{ flex: 1 }}>
			<AnimatedCommandPropsDemo />
		</YogaCanvas>
	)
}
