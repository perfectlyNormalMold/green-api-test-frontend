import { createTheme } from "@mui/material/styles";

export function createAppTheme(mode: "light" | "dark") {
  const isDark = mode === "dark";

  return createTheme({
    palette: {
      mode,
      primary: { main: isDark ? "#756bc5" : "#3390ec", contrastText: "#ffffff" },
      background: {
        default: isDark ? "#0e0c12" : "#e7edf2",
        paper: isDark ? "#212121" : "#ffffff",
      },
      text: { primary: isDark ? "#f5f5f5" : "#17212b", secondary: isDark ? "#a1a1a1" : "#6d7885" },
      divider: isDark ? "#333333" : "#e5edf3",
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: '"Segoe UI", Arial, sans-serif',
      button: { textTransform: "none", fontWeight: 650 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: { body: { transition: "background-color 180ms ease, color 180ms ease" } },
      },
      MuiPaper: { styleOverrides: { root: { boxShadow: "none" } } },
      MuiTextField: { defaultProps: { size: "small" } },
      MuiIconButton: { styleOverrides: { root: { borderRadius: 10 } } },
    },
  });
}
