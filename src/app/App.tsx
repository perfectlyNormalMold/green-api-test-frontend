import { CssBaseline, ThemeProvider, useMediaQuery } from "@mui/material";
import { useEffect, useMemo } from "react";

import { credentialsRestored } from "@/features/connect-instance/model/model";
import { MessengerPage } from "@/pages/messenger/ui/MessengerPage";

import { createAppTheme } from "./theme";

export function App() {
  const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");
  const theme = useMemo(() => createAppTheme(prefersDarkMode ? "dark" : "light"), [prefersDarkMode]);

  useEffect(() => {
    credentialsRestored();
  }, []);

  return <ThemeProvider theme={theme}><CssBaseline /><MessengerPage /></ThemeProvider>;
}
