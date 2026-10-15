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

/** Portal V2 tokens. The public marketing brand above remains stable. */
export const portalTokens = {
  '--ff-text': '#203449', '--ff-text-strong': '#132b40', '--ff-muted': '#526477',
  '--ff-primary': '#176b9c', '--ff-primary-hover': '#10567e', '--ff-primary-soft': '#edf5fb',
  '--ff-teal': '#16776d', '--ff-teal-soft': '#edf8f5',
  '--ff-canvas': '#f5f7fa', '--ff-surface': '#ffffff', '--ff-subtle': '#f8fafc',
  '--ff-line': '#dce3eb', '--ff-line-strong': '#b6c5d3',
  '--ff-success': '#14644f', '--ff-success-soft': '#eaf6ef', '--ff-warning': '#795213', '--ff-warning-soft': '#fff7e8',
  '--ff-danger': '#a32f3d', '--ff-danger-soft': '#fff0f1', '--ff-focus': '#176b9c',
  '--ff-font': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  '--ff-text-xs': '0.75rem', '--ff-text-sm': '0.875rem', '--ff-text-md': '1rem', '--ff-text-lg': '1.125rem',
  '--ff-title-sm': '1.25rem', '--ff-title-md': '1.5rem', '--ff-title-lg': '1.875rem',
  '--ff-space-1': '0.25rem', '--ff-space-2': '0.5rem', '--ff-space-3': '0.75rem', '--ff-space-4': '1rem',
  '--ff-space-5': '1.25rem', '--ff-space-6': '1.5rem', '--ff-space-8': '2rem', '--ff-space-10': '2.5rem',
  '--ff-control': '2.75rem', '--ff-radius-sm': '0.5rem', '--ff-radius-md': '0.75rem', '--ff-radius-lg': '1rem',
  '--ff-shadow-sm': '0 1px 3px rgb(19 43 64 / 4%)', '--ff-shadow-lg': '0 20px 64px rgb(19 43 64 / 14%)',
  '--ff-motion': '140ms',
} as const;
export const portalCssVariables = {
  ...brandCssVariables,...portalTokens,
  '--ink':'var(--ff-text)','--ink-strong':'var(--ff-text-strong)','--muted':'var(--ff-muted)',
  '--line':'var(--ff-line)','--paper':'var(--ff-surface)','--canvas':'var(--ff-canvas)',
  '--green':'var(--ff-primary)','--green-2':'var(--ff-primary-soft)','--blue':'var(--ff-primary)',
  '--aqua':'var(--ff-teal)','--mint':'var(--ff-teal-soft)','--success':'var(--ff-success)',
  '--warning':'var(--ff-warning)','--danger':'var(--ff-danger)','--info':'var(--ff-primary)',
  '--focus':'var(--ff-focus)','--shadow':'var(--ff-shadow-sm)',
} as const;
