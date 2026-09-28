import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#3390ec", contrastText: "#ffffff" },
    background: { default: "#edf2f5", paper: "#ffffff" },
    text: { primary: "#17212b", secondary: "#6d7885" },
  },
  shape: { borderRadius: 12 },
  typography: { fontFamily: 'Inter, "Segoe UI", Arial, sans-serif', button: { textTransform: "none", fontWeight: 600 } },
  components: {
    MuiPaper: { styleOverrides: { root: { boxShadow: "none" } } },
    MuiTextField: { defaultProps: { size: "small" } },
  },
});
