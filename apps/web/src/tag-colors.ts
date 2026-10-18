export const tagColors = ["default", "gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"] as const;
export function optionColor(value: string): typeof tagColors[number] {
  let hash = 0;
  for (const character of value.normalize("NFC")) hash = (Math.imul(hash, 31) + character.codePointAt(0)!) >>> 0;
  return tagColors[hash % tagColors.length]!;
}
