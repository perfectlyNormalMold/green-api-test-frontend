import { createTheme } from "@mui/material/styles";

export function createAppTheme(mode: "light" | "dark") {
  const isDark = mode === "dark";

  return createTheme({
    palette: {
      mode,
      primary: { main: isDark ? "#64b5ef" : "#3390ec", contrastText: "#ffffff" },
      background: { default: isDark ? "#0e1621" : "#e7edf2", paper: isDark ? "#17212b" : "#ffffff" },
      text: { primary: isDark ? "#f5f5f5" : "#17212b", secondary: isDark ? "#9db2c5" : "#6d7885" },
      divider: isDark ? "#28394a" : "#e5edf3",
    },
    shape: { borderRadius: 14 },
    typography: {
      fontFamily: 'Inter, "Segoe UI", Arial, sans-serif',
      button: { textTransform: "none", fontWeight: 650 },
    },
    components: {
      MuiCssBaseline: { styleOverrides: { body: { transition: "background-color 180ms ease, color 180ms ease" } } },
      MuiPaper: { styleOverrides: { root: { boxShadow: "none" } } },
      MuiTextField: { defaultProps: { size: "small" } },
      MuiIconButton: { styleOverrides: { root: { borderRadius: 10 } } },
    },
  });
}
