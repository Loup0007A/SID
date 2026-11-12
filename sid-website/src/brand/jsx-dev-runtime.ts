// Couche JSX du site, mode développement (Lot 77) : voir src/brand/props.ts.
import * as R from "react/jsx-dev-runtime";
import { brandProps } from "./props";

export type { JSX } from "react/jsx-dev-runtime";
export const Fragment = R.Fragment;
export function jsxDEV(type: React.ElementType, props: Record<string, unknown>, key: React.Key | undefined, isStatic: boolean, source?: unknown, self?: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (R as any).jsxDEV(type, brandProps(type, props), key, isStatic, source, self);
}
