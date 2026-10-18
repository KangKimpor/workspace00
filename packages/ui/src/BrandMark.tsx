// Generated from brand/svg/workspace-mark.svg by pnpm brand:build.
const strokes = [
  "M28 20V80",
  "M72 20L40 50L72 80",
  "M28 50H40"
];
export function BrandMark({ size = 24 }: { size?: number }) {
  return <svg viewBox="0 0 100 100" width={size} height={size} fill="none" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">{strokes.map((d, index) => <path key={index} d={d}/>)}</g></svg>;
}
