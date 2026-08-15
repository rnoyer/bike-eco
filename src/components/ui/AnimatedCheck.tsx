import { useEffect } from "react";
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { tokens } from "@/theme/tokens";

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** The two paths of `assets/images/icons/tick.svg` (lucide `circle-check-big`),
 *  restated here because a stroke can only be drawn by `react-native-svg`, and an
 *  imported `.svg` is an asset — `expo-image` renders it but cannot animate it.
 *  Keep them in step with that file; it is the source of truth for the shape. */
const CIRCLE_D = "M21.801 10A10 10 0 1 1 17 3.335";
const TICK_D = "m9 11 3 3L22 4";

/** Exact lengths, so a dash covers its path with nothing to spare: an overshoot
 *  spends the head of the animation drawing nothing and finishes early.
 *  Circle: a 311.5° arc at r=10 → 10 × 311.5 × π/180. Tick: |(9,11)→(12,14)| +
 *  |(12,14)→(22,4)| = √18 + √200. */
const CIRCLE_LENGTH = 54.36;
const TICK_LENGTH = 18.39;

/** How long the whole mark takes to draw. A caller that hides this component
 *  sooner (`ConfirmationView`'s `delay`) cuts the drawing off mid-stroke. */
export const CHECK_DRAW_MS = 750;

interface Props {
  size?: number;
  color?: string;
}

/** The confirmation mark: the circle sweeps in, then the tick strokes through it. */
export default function AnimatedCheck({
  size = 64,
  color = tokens.colors.success,
}: Props) {
  // Honour "Réduire les animations": start fully drawn and never animate, rather
  // than hiding the mark from someone whose system asked for no motion.
  const reduceMotion = useReducedMotion();
  const circleOffset = useSharedValue(reduceMotion ? 0 : CIRCLE_LENGTH);
  const tickOffset = useSharedValue(reduceMotion ? 0 : TICK_LENGTH);

  useEffect(() => {
    if (reduceMotion) return;
    circleOffset.value = withTiming(0, {
      duration: 600,
      easing: Easing.out(Easing.quad),
    });
    // Overlaps the arc's last 200ms — waiting for the circle to close first reads
    // as two separate animations rather than one mark being drawn.
    tickOffset.value = withDelay(
      400,
      withTiming(0, { duration: 350, easing: Easing.out(Easing.quad) }),
    );
  }, [reduceMotion, circleOffset, tickOffset]);

  const circleProps = useAnimatedProps(() => ({
    strokeDashoffset: circleOffset.value,
  }));
  const tickProps = useAnimatedProps(() => ({
    strokeDashoffset: tickOffset.value,
  }));

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <AnimatedPath
        d={CIRCLE_D}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={CIRCLE_LENGTH}
        animatedProps={circleProps}
      />
      <AnimatedPath
        d={TICK_D}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={TICK_LENGTH}
        animatedProps={tickProps}
      />
    </Svg>
  );
}
