
export type Align =
  | 'auto'
  | 'flex-start'
  | 'center'
  | 'flex-end'
  | 'stretch'
  | 'bseline'
  | 'space-between'
  | 'space-around'
  | 'space-evenly';

export type JustifyContent =
  | 'flex-start'
  | 'center'
  | 'flex-end'
  | 'space-between'
  | 'space-around'
  | 'space-evenly';

export type BoxSizing = 'border-box' | 'content-box';

export type Direction = 'inherit' | 'ltr' | 'rtl';

export type Display = 'flex' | 'none' | 'contents';

export type FlexDirection = 'column' | 'column-reverse' | 'row' | 'row-reverse';

export type FlexWrap = 'wrap' | 'nowrap' | 'wrap-reverse';

export type Overflow = 'visible' | 'hidden' | 'scroll';

export type Position = 'static' | 'relative' | 'absolute';

export type Percentage = string // `${number}%`; // string templates not supported by nitro

export type NodeStyle = {
  alignContent?: Align;
  alignItems?: Align;
  alignSelf?: Align;
  aspectRatio?: number;
  borderBottomWidth?: number;
  borderEndWidth?: number;
  borderLeftWidth?: number;
  borderRightWidth?: number;
  borderStartWidth?: number;
  borderTopWidth?: number;
  borderWidth?: number;
  borderHorizontalWidth?: number;
  borderVerticalWidth?: number;
  bottom?: number | Percentage;
  boxSizing?: BoxSizing;
  direction?: Direction;
  display?: Display;
  end?: number | Percentage;
  flex?: number;
  flexBasis?: number | 'auto' | Percentage;
  flexDirection?: FlexDirection;
  rowGap?: number;
  gap?: number;
  columnGap?: number;
  flexGrow?: number;
  flexShrink?: number;
  flexWrap?: FlexWrap;
  height?: number | 'auto' | Percentage;
  justifyContent?: JustifyContent;
  left?: number | Percentage;
  margin?: number | 'auto' | Percentage;
  marginBottom?: number | 'auto' | Percentage;
  marginEnd?: number | 'auto' | Percentage;
  marginLeft?: number | 'auto' | Percentage;
  marginRight?: number | 'auto' | Percentage;
  marginStart?: number | 'auto' | Percentage;
  marginTop?: number | 'auto' | Percentage;
  marginHorizontal?: number | 'auto' | Percentage; // horizontal
  marginVertical?: number | 'auto' | Percentage; // vertical
  maxHeight?: number | Percentage;
  maxWidth?: number | Percentage;
  minHeight?: number | Percentage;
  minWidth?: number | Percentage;
  overflow?: Overflow;
  padding?: number | Percentage;
  paddingBottom?: number | Percentage;
  paddingEnd?: number | Percentage;
  paddingLeft?: number | Percentage;
  paddingRight?: number | Percentage;
  paddingStart?: number | Percentage;
  paddingTop?: number | Percentage;
  paddingHorizontal?: number | Percentage; // horizontal
  paddingVertical?: number | Percentage; // vertical
  position?: Position;
  right?: number | Percentage;
  start?: number | Percentage;
  top?: number | Percentage;
  insetHorizontal?: number | Percentage; // horizontal
  insetVertical?: number | Percentage; // vertical
  inset?: number | Percentage;
  width?: number | 'auto' | Percentage;
};
