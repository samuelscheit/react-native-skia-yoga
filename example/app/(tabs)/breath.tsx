import {
  BlendMode,
  mix,
  polar2Canvas,
  Skia
} from "@shopify/react-native-skia"
import { useEffect, useMemo, useState } from "react"
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

const Ring = ({ index, progress, total }: RingProps) => {
  const { width } = useWindowDimensions()
  const R = width / 4

  const theta = (index * (2 * Math.PI)) / total
  const matrix = useMemo(() => Skia.Matrix(), [])
  useDerivedValue(() => {
    const { x, y } = polar2Canvas(
      { theta, radius: progress.value * R },
      { x: 0, y: 0 },
    )
    const scale = mix(progress.value, 0.3, 1)

    matrix.identity().translate(x, y).scale(scale, scale)
  })

  return (
    <circle
      r={R}
      style={{
        backgroundColor: index % 2 === 0 ? c1 : c2,
        matrix,
        blendMode: BlendMode.Plus,
      }}
    />
  )
}

function Breath() {
  const [rings] = useState(6)

  const progress = useLoop({ duration: 3000 })

  const matrix = useMemo(() => Skia.Matrix(), [])
  useDerivedValue(() => {
    matrix.identity().rotate(mix(progress.value, -Math.PI, 0))
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
      <blurMaskFilter style="solid" blur={40}>
        <group style={{ matrix }}>
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

export default function BreathScreen() {
  return
}
