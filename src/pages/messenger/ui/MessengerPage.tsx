import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import DoneAllRoundedIcon from "@mui/icons-material/DoneAllRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import {
  Alert,
  AppBar,
  Avatar,
  Badge,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { useUnit } from "effector-react";
import { useEffect, useState } from "react";

import {
  $activeChat,
  $activeChatId,
  $chats,
  chatSelected,
  chatsCleared,
  chatsPersistenceRequested,
  chatsRestored,
} from "@/entities/chat/model/model";
import {
  $connectionError,
  $connectionStatus,
  $credentials,
  $isConnectionPending,
  $settings,
  connectRequested,
  disconnectRequested,
  settingsFixRequested,
} from "@/features/connect-instance/model/model";
import {
  $isNewChatPending,
  $newChatError,
  newChatSubmitted,
} from "@/features/create-chat/model/model";
import {
  $pollingStatus,
  pollingStarted,
  pollingStopped,
} from "@/features/receive-events/model/model";
import { messageSubmitted } from "@/features/send-message/model/model";

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(timestamp);
}

function MessageStatus({
  status,
}: {
  status?: "sending" | "sent" | "delivered" | "read" | "failed";
}) {
  if (status === "sending") return <CircularProgress size={12} />;
  if (status === "failed") return <Typography color="error.main">!</Typography>;
  if (status === "read") return <DoneAllRoundedIcon sx={{ color: "primary.main", fontSize: 16 }} />;
  return <CheckRoundedIcon sx={{ color: "text.secondary", fontSize: 16 }} />;
}

export function MessengerPage() {
  const theme = useTheme();
  const [
    credentials,
    settings,
    status,
    error,
    isPending,
    chats,
    activeChatId,
    activeChat,
    pollingStatus,
    newChatError,
    isNewChatPending,
  ] = useUnit([
    $credentials,
    $settings,
    $connectionStatus,
    $connectionError,
    $isConnectionPending,
    $chats,
    $activeChatId,
    $activeChat,
    $pollingStatus,
    $newChatError,
    $isNewChatPending,
  ]);
  const [idInstance, setIdInstance] = useState("");
  const [token, setToken] = useState("");
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [message, setMessage] = useState("");
  const [mobileChatOpen, setMobileChatOpen] = useState(false);

  useEffect(() => {
    if (!credentials) return;
    chatsRestored({ instanceId: credentials.idInstance });
    pollingStarted();
    return () => pollingStopped();
  }, [credentials]);

  useEffect(() => {
    if (credentials) chatsPersistenceRequested(credentials.idInstance);
  }, [chats, credentials]);

  const needsSettings = settings && (settings.webhookUrl || settings.incomingWebhook !== "yes");
  const chatBackground = theme.palette.mode === "dark" ? "#0e1621" : "#dfe7ee";
  const outgoingBubble = theme.palette.mode === "dark" ? "#2b5278" : "#d9fdd3";

  const submitMessage = () => {
    if (!activeChat || !message.trim()) return;
    messageSubmitted({ chatId: activeChat.id, text: message });
    setMessage("");
  };

  if (!credentials) {
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
        <Paper sx={{ width: "min(100%, 440px)", p: { xs: 3, sm: 4 }, borderRadius: 4, border: 1, borderColor: "divider", boxShadow: "0 24px 80px rgba(15, 38, 57, 0.12)" }}>
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
              Подключите авторизованный Telegram-инстанс. Данные сохранятся только до закрытия
              вкладки.
            </Typography>
            <TextField
              label="idInstance"
              value={idInstance}
              onChange={(event) => setIdInstance(event.target.value)}
              autoComplete="off"
            />
            <TextField
              label="apiTokenInstance"
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              autoComplete="off"
            />
            {error && <Alert severity="error">{error}</Alert>}
            <Button
              variant="contained"
              size="large"
              disabled={!idInstance.trim() || !token.trim() || isPending}
              onClick={() => connectRequested({ idInstance, apiTokenInstance: token })}
            >
              {isPending ? <CircularProgress size={22} color="inherit" /> : "Подключиться"}
            </Button>
          </Stack>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100svh", p: { xs: 0, md: 2 }, display: "grid", placeItems: "center" }}>
      <Paper
        sx={{
          width: "min(1360px, 100%)",
          height: { xs: "100svh", md: "min(850px, calc(100svh - 32px))" },
          display: "flex",
          overflow: "hidden",
          borderRadius: { xs: 0, md: 2.5 },
          border: { md: 1 },
          borderColor: "divider",
        }}
      >
        <Box
          sx={{
            display: { xs: mobileChatOpen ? "none" : "flex", md: "flex" },
            width: { xs: "100%", md: 360 },
            flexDirection: "column",
            borderRight: { md: 1 },
            borderColor: "divider",
          }}
        >
          <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
            <Toolbar sx={{ gap: 1 }}>
              <Typography sx={{ flexGrow: 1, fontWeight: 700 }}>Сообщения</Typography>
              <Tooltip title="Настройки">
                <IconButton>
                  <SettingsRoundedIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Выйти">
                <IconButton
                  onClick={() => {
                    pollingStopped();
                    chatsCleared();
                    disconnectRequested();
                  }}
                >
                  <LogoutRoundedIcon />
                </IconButton>
              </Tooltip>
            </Toolbar>
          </AppBar>
          <Box sx={{ px: 2, pb: 2 }}>
            <Button
              fullWidth
              startIcon={<AddRoundedIcon />}
              variant="contained"
              onClick={() => setNewChatOpen(true)}
            >
              Новый чат
            </Button>
          </Box>
          <Divider />
          <List disablePadding sx={{ overflowY: "auto", flex: 1 }}>
            {chats.map((chat) => (
              <ListItemButton
                key={chat.id}
                selected={chat.id === activeChatId}
                onClick={() => {
                  chatSelected(chat.id);
                  setMobileChatOpen(true);
                }}
                sx={{ py: 1.25, px: 2, "&.Mui-selected": { bgcolor: "action.selected", borderRight: 3, borderColor: "primary.main" } }}
              >
                <Badge
                  badgeContent={chat.unreadCount || undefined}
                  color="primary"
                  overlap="circular"
                >
                  <Avatar>{chat.title.slice(0, 1).toUpperCase()}</Avatar>
                </Badge>
                <ListItemText
                  sx={{ ml: 1.5 }}
                  primary={
                    <Typography noWrap sx={{ fontWeight: 600 }}>
                      {chat.title}
                    </Typography>
                  }
                  secondary={
                    <Typography noWrap variant="body2" color="text.secondary">
                      {chat.messages.at(-1)?.text || "Нет сообщений"}
                    </Typography>
                  }
                />
              </ListItemButton>
            ))}
          </List>
          <Box sx={{ p: 1.5, borderTop: 1, borderColor: "divider" }}>
            <Typography
              variant="caption"
              color={pollingStatus === "online" ? "success.main" : "text.secondary"}
            >
              ●{" "}
              {pollingStatus === "online"
                ? "Подключено"
                : pollingStatus === "reconnecting"
                  ? "Переподключение…"
                  : "Опрос остановлен"}
            </Typography>
          </Box>
        </Box>
        <Box
          sx={{
            display: { xs: mobileChatOpen ? "flex" : "none", md: "flex" },
            flex: 1,
            minWidth: 0,
            flexDirection: "column",
            bgcolor: chatBackground,
            backgroundImage: theme.palette.mode === "dark" ? "radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)" : "radial-gradient(rgba(79, 111, 134, 0.12) 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
        >
          {activeChat ? (
            <>
              <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
                <Toolbar>
                  <IconButton
                    sx={{ display: { md: "none" }, mr: 1 }}
                    onClick={() => setMobileChatOpen(false)}
                  >
                    <ArrowBackRoundedIcon />
                  </IconButton>
                  <Avatar sx={{ mr: 1.5 }}>{activeChat.title.slice(0, 1).toUpperCase()}</Avatar>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography sx={{ fontWeight: 700 }}>{activeChat.title}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Telegram
                    </Typography>
                  </Box>
                  <IconButton>
                    <MoreVertRoundedIcon />
                  </IconButton>
                </Toolbar>
              </AppBar>
              <Stack
                spacing={1}
                sx={{ flex: 1, overflowY: "auto", p: { xs: 1.5, sm: 3 }, alignItems: "stretch" }}
              >
                {activeChat.messages.map((item) => (
                  <Box
                    key={item.localId}
                    sx={{
                      alignSelf: item.direction === "outgoing" ? "flex-end" : "flex-start",
                      maxWidth: "min(78%, 560px)",
                      px: 1.5,
                      py: 1,
                      borderRadius: 2,
                      bgcolor: item.direction === "outgoing" ? outgoingBubble : "background.paper",
                      boxShadow: "0 1px 2px rgba(0, 0, 0, 0.12)",
                    }}
                  >
                    <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                      {item.text}
                    </Typography>
                    <Stack
                      direction="row"
                      spacing={0.5}
                      sx={{ justifyContent: "flex-end", alignItems: "center", mt: 0.3 }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        {formatTime(item.timestamp)}
                      </Typography>
                      {item.direction === "outgoing" && <MessageStatus status={item.status} />}
                    </Stack>
                  </Box>
                ))}
              </Stack>
              <Box
                component="form"
                onSubmit={(event) => {
                  event.preventDefault();
                  submitMessage();
                }}
                sx={{ p: { xs: 1, sm: 1.5 }, display: "flex", gap: 1, bgcolor: "background.default", borderTop: 1, borderColor: "divider" }}
              >
                <TextField
                  fullWidth
                  placeholder="Написать сообщение"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      submitMessage();
                    }
                  }}
                  multiline
                  maxRows={4}
                  slotProps={{ htmlInput: { maxLength: 4096 } }}
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: 3, bgcolor: "action.hover" } }}
                />
                <IconButton
                  type="submit"
                  color="primary"
                  disabled={!message.trim()}
                  sx={{ alignSelf: "flex-end", width: 44, height: 44, bgcolor: "primary.main", color: "primary.contrastText", "&:hover": { bgcolor: "primary.dark" }, "&.Mui-disabled": { bgcolor: "action.disabledBackground" } }}
                >
                  <SendRoundedIcon />
                </IconButton>
              </Box>
            </>
          ) : (
            <Stack
              spacing={1}
              sx={{
                flex: 1,
                p: 3,
                textAlign: "center",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 54, color: "text.secondary" }} />
              <Typography variant="h6">Выберите или создайте чат</Typography>
              <Typography color="text.secondary">Переписка появится здесь.</Typography>
            </Stack>
          )}
        </Box>
      </Paper>
      <Dialog open={newChatOpen} onClose={() => setNewChatOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Новый чат</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography color="text.secondary" variant="body2">
              Введите номер в международном формате, например 79991234567.
            </Typography>
            <TextField
              autoFocus
              label="Номер телефона"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              error={Boolean(newChatError)}
              helperText={newChatError}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewChatOpen(false)}>Отмена</Button>
          <Button
            variant="contained"
            disabled={!phoneNumber.trim() || isNewChatPending}
            onClick={() => newChatSubmitted(phoneNumber)}
          >
            {isNewChatPending ? <CircularProgress size={20} color="inherit" /> : "Создать"}
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={Boolean(needsSettings)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity="warning"
          action={
            <Button
              color="inherit"
              size="small"
              disabled={status === "restarting"}
              onClick={() => settingsFixRequested()}
            >
              Настроить
            </Button>
          }
        >
          Для получения ответов нужно включить уведомления. Настройка перезапустит инстанс.
        </Alert>
      </Snackbar>
    </Box>
  );
}
