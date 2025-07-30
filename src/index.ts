import { NitroModules } from "react-native-nitro-modules";
import type { SkiaYoga as SkiaYogaType } from "./specs/SkiaYoga.nitro";

export const SkiaYoga = NitroModules.createHybridObject<SkiaYogaType>('SkiaYoga')

// @ts-ignore
globalThis.SkiaYoga = SkiaYoga;
