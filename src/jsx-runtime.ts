import { Fragment, jsx, jsxs } from "react/jsx-runtime"
import type { YogaJSX } from "./jsx-runtime-types"

export { Fragment, jsx, jsxs }

export namespace JSX {
	export type Element = YogaJSX.Element
	export type ElementClass = YogaJSX.ElementClass
	export type ElementAttributesProperty = YogaJSX.ElementAttributesProperty
	export type ElementChildrenAttribute = YogaJSX.ElementChildrenAttribute
	export type LibraryManagedAttributes<C, P> = YogaJSX.LibraryManagedAttributes<C, P>
	export type IntrinsicAttributes = YogaJSX.IntrinsicAttributes
	export type IntrinsicClassAttributes<T> = YogaJSX.IntrinsicClassAttributes<T>

	export interface IntrinsicElements extends YogaJSX.IntrinsicElements {}
}
