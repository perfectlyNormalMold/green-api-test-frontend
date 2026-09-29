import { CssBaseline, ThemeProvider } from "@mui/material";

import { MessengerPage } from "@/pages/messenger";

import { createAppTheme } from "./theme";

const theme = createAppTheme("dark");

export function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MessengerPage />
    </ThemeProvider>
  );
}
