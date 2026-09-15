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
  "--ink-strong": brand.navyDeep,
  "--muted": "#526777",
  "--line": brand.line,
  "--paper": brand.white,
  "--canvas": brand.surface,
  "--green": brand.blue,
  "--green-2": brand.sky,
  "--blue": brand.blueDark,
  "--aqua": brand.aqua,
  "--mint": brand.mint,
  "--focus": "#e8a83e",
  "--success": "#176b52",
  "--warning": "#815319",
  "--danger": "#8f2630",
  "--info": brand.blueDark,
  "--control-min-size": "44px",
  "--text-xs": "0.75rem",
  "--text-sm": "0.875rem",
  "--text-md": "1rem",
  "--radius-control": "0.625rem",
} as const;
