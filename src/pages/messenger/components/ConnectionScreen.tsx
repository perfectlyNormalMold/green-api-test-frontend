import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useUnit } from "effector-react";
import { useState } from "react";

import {
  $connectionError,
  $isConnectionPending,
  connectRequested,
} from "@/features/connect-instance/model";

export function ConnectionScreen() {
  const [error, pending] = useUnit([$connectionError, $isConnectionPending]);
  const [idInstance, setIdInstance] = useState("");
  const [token, setToken] = useState("");

  return (
    <Box
      sx={{
        minHeight: "100svh",
        display: "grid",
        placeItems: "center",
        px: 2,
        bgcolor: "background.default",
      }}
    >
      <Paper
        sx={{
          width: "min(100%, 440px)",
          p: { xs: 3, sm: 4 },
          borderRadius: 4,
          border: 1,
          borderColor: "divider",
        }}
      >
        <Box
          component="form"
          onSubmit={(event) => {
            event.preventDefault();
            connectRequested({ idInstance, apiTokenInstance: token });
          }}
        >
          <Stack spacing={3}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <Avatar sx={{ bgcolor: "primary.main", width: 48, height: 48 }}>
                <ChatBubbleOutlineRoundedIcon />
              </Avatar>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  Telegram Chat
                </Typography>
                <Typography color="text.secondary">GREEN-API test client</Typography>
              </Box>
            </Stack>
            <Typography color="text.secondary">
              Подключите авторизованный Telegram-инстанс. Браузер может предложить сохранить учётные
              данные в своём менеджере паролей.
            </Typography>
            <TextField
              label="idInstance"
              name="idInstance"
              value={idInstance}
              onChange={(event) => setIdInstance(event.target.value)}
              autoComplete="username"
            />
            <TextField
              label="apiTokenInstance"
              name="apiTokenInstance"
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              autoComplete="current-password"
            />
            {error && <Alert severity="error">{error}</Alert>}
            <Button
              variant="contained"
              size="large"
              disabled={!idInstance.trim() || !token.trim() || pending}
              type="submit"
            >
              {pending ? <CircularProgress size={22} color="inherit" /> : "Подключиться"}
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}
