import { expect, it } from "vitest";
import { optionColor, tagColors } from "./tag-colors";

it("assigns stable tag colors across renders, languages and Unicode normalization", () => {
  for (const value of ["", "Building", "Finished", "គម្រោង", "📚 Reading"]) {
    expect(tagColors).toContain(optionColor(value));
    expect(optionColor(value)).toBe(optionColor(`${value}`));
  }
  expect(optionColor("Café")).toBe(optionColor("Cafe\u0301"));
  expect(new Set(["Open", "Building", "Review", "Done"].map(optionColor)).size).toBeGreaterThan(1);
});
