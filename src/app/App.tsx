import { CssBaseline, ThemeProvider, useMediaQuery } from "@mui/material";
import { useMemo } from "react";

import { MessengerPage } from "@/pages/messenger/ui/MessengerPage";

import { createAppTheme } from "./theme";

export function App() {
  const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");
  const theme = useMemo(() => createAppTheme(prefersDarkMode ? "dark" : "light"), [prefersDarkMode]);

  return <ThemeProvider theme={theme}><CssBaseline /><MessengerPage /></ThemeProvider>;
}
