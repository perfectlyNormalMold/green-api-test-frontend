import { CssBaseline, ThemeProvider } from "@mui/material";
import { useEffect } from "react";

import { credentialsRestored } from "@/features/connect-instance/model/model";
import { MessengerPage } from "@/pages/messenger/ui/MessengerPage";

import { theme } from "./theme";

export function App() {
  useEffect(() => {
    credentialsRestored();
  }, []);

  return <ThemeProvider theme={theme}><CssBaseline /><MessengerPage /></ThemeProvider>;
}
