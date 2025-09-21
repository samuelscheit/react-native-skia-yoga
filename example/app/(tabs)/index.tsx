import {
	Skia
} from "@shopify/react-native-skia"
import { useEffect, useMemo } from "react"
import {
	cancelAnimation,
	Easing,
	SharedValue,
	useSharedValue,
	withRepeat,
	withTiming
} from "react-native-reanimated"
import { YogaCanvas } from "react-native-skia-yoga"

declare namespace React {
	namespace JSX {
		interface IntrinsicElements {
			group: any
			rect: any
			circle: any
			oval: any
			text: any
			paragraph: any
			blurMaskFilter: any
		}
	}
}

const c1 = "#61bea2"
const c2 = "#529ca0"

interface RingProps {
	key?: any
	index: number
	progress: SharedValue<number>
	total: number
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


function Chat() {
	const matrix = useMemo(() => Skia.Matrix(), [])

	return (
		<rect style={{ flex: 1 }} />
	)
}

export default function ChatScreen() {
	return <YogaCanvas style={{ flex: 1 }}><Chat /></YogaCanvas>
}
