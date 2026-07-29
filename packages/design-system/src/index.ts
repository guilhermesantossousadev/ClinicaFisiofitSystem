export const brand = {
  navy: "#17324d",
  navyDeep: "#10263a",
  blue: "#2788c9",
  blueDark: "#176da8",
  aqua: "#23aa94",
  mint: "#e6f7f3",
  sky: "#eaf5fc",
  surface: "#f5f9fc",
  line: "#dce8ef",
  white: "#ffffff",
} as const;

export const appBasePath = "/sistema";

export const brandCssVariables = {
  "--ink": brand.navy,
  "--line": brand.line,
  "--paper": brand.white,
  "--canvas": brand.surface,
  "--green": brand.blue,
  "--green-2": brand.sky,
  "--blue": brand.blueDark,
  "--aqua": brand.aqua,
  "--mint": brand.mint,
} as const;
