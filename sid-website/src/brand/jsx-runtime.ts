// Couche JSX du site (Lot 77) : voir src/brand/props.ts.
import * as R from "react/jsx-runtime";
import { brandProps } from "./props";

export type { JSX } from "react/jsx-runtime";
export const Fragment = R.Fragment;
export function jsx(type: React.ElementType, props: Record<string, unknown>, key?: React.Key) {
  return R.jsx(type, brandProps(type, props) as never, key);
}
export function jsxs(type: React.ElementType, props: Record<string, unknown>, key?: React.Key) {
  return R.jsxs(type, brandProps(type, props) as never, key);
}
