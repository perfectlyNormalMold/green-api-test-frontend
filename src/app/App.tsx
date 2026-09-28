import { CssBaseline, ThemeProvider } from "@mui/material";

import { MessengerPage } from "@/pages/messenger/ui/MessengerPage";

import { theme } from "./theme";

export function App() {
  return <ThemeProvider theme={theme}><CssBaseline /><MessengerPage /></ThemeProvider>;
}
