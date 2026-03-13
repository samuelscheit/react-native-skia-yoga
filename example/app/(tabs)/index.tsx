import { BlendMode, mix, polar2Canvas } from "@shopify/react-native-skia"
import { useEffect, useState } from "react"
import { useWindowDimensions } from "react-native"
import {
	cancelAnimation,
	Easing,
	SharedValue,
	useDerivedValue,
	useSharedValue,
	withRepeat,
	withTiming,
} from "react-native-reanimated"
import { YogaCanvas } from "react-native-skia-yoga"

const c1 = "#61bea2"
const c2 = "#529ca0"

interface RingProps {
	key?: any
	index: number
	progress: SharedValue<number>
	total: number
}

type Matrix3 = [
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
]

function createTranslateScaleMatrix(
	x: number,
	y: number,
	scale: number,
): Matrix3 {
	"worklet"
	return [scale, 0, x, 0, scale, y, 0, 0, 1]
}

function createRotateMatrix(radians: number): Matrix3 {
	"worklet"
	const cos = Math.cos(radians)
	const sin = Math.sin(radians)
	return [cos, -sin, 0, sin, cos, 0, 0, 0, 1]
}

export const useLoop = ({ duration }: { duration: number }) => {
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

const Ring = ({ index, progress, total }: RingProps) => {
	const { width } = useWindowDimensions()
	const R = width / 4

	const theta = (index * (2 * Math.PI)) / total
	const matrix = useDerivedValue(() => {
		const { x, y } = polar2Canvas(
			{ theta, radius: progress.value * R },
			{ x: 0, y: 0 },
		)
		const scale = mix(progress.value, 0.3, 1)
		return createTranslateScaleMatrix(x, y, scale)
	})

	return (
		<circle
			radius={R}
			style={{
				backgroundColor: index % 2 === 0 ? c1 : c2,
				matrix,
				blendMode: BlendMode.Screen,
			}}
		/>
	)
}

function Root() {
	const [rings] = useState(6)

	const progress = useLoop({ duration: 3000 })

	const matrix = useDerivedValue(() => {
		return createRotateMatrix(mix(progress.value, -Math.PI, 0))
	})

	return (
		<rect
			style={{
				flex: 1,
				justifyContent: "center",
				alignItems: "center",
				backgroundColor: "#242b38",
			}}
		>
			<blurMaskFilter blurStyle="solid" blur={40}>
				<group
					style={{
						matrix,
					}}
				>
					{new Array(rings).fill(0).map((_, index) => {
						return (
							<Ring
								key={index}
								index={index}
								progress={progress}
								total={rings}
							/>
						)
					})}
				</group>
			</blurMaskFilter>
		</rect>
	)
}

export default function HomeScreen() {
	return (
		<YogaCanvas style={{ flex: 1 }}>
			<Root />
		</YogaCanvas>
	)
}
