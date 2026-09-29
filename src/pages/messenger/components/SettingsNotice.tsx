import { Alert, Button, Snackbar, Stack } from "@mui/material";
import { useUnit } from "effector-react";

import {
  $connectionStatus,
  $connectionError,
  $settings,
  settingsFixRequested,
} from "@/features/connect-instance/model";
import { $pollingError, $pollingStatus, pollingStarted } from "@/features/receive-events/model";

export function SettingsNotice() {
  const [settings, status, error, pollingError, pollingStatus] = useUnit([
    $settings,
    $connectionStatus,
    $connectionError,
    $pollingError,
    $pollingStatus,
  ]);
  const needsSettings =
    settings &&
    (settings.webhookUrl ||
      settings.incomingWebhook !== "yes" ||
      settings.outgoingWebhook !== "yes" ||
      settings.outgoingAPIMessageWebhook !== "yes");

  return (
    <Snackbar
      open={Boolean(needsSettings || error || pollingError || pollingStatus === "reconnecting")}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
    >
      <Stack spacing={1}>
        {pollingError && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" onClick={() => pollingStarted()}>
                Повторить
              </Button>
            }
          >
            {pollingError}
          </Alert>
        )}
        {!pollingError && pollingStatus === "reconnecting" && (
          <Alert severity="warning">Нет связи с уведомлениями. Повторное подключение…</Alert>
        )}
        {error && <Alert severity="error">{error}</Alert>}
        {needsSettings && (
          <Alert
            severity="warning"
            action={
              <Button
                color="inherit"
                size="small"
                disabled={status === "restarting"}
                onClick={() => settingsFixRequested()}
              >
                {status === "restarting" ? "Проверка…" : "Настроить"}
              </Button>
            }
          >
            Для получения ответов нужны HTTP-уведомления. Настройка очистит текущий webhookUrl и
            перезапустит инстанс.
          </Alert>
        )}
      </Stack>
    </Snackbar>
  );
}
