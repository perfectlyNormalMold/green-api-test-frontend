import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import { Box, Stack, Typography, useTheme } from "@mui/material";
import { useUnit } from "effector-react";
import { useEffect } from "react";

import {
  $activeChat,
  $activeChatId,
  $chats,
  chatsPersistenceRequested,
  chatsRestored,
} from "@/entities/chat/model";
import { $credentials, sessionRestoreRequested } from "@/features/connect-instance/model";
import { historyRequested } from "@/features/load-chat-history/model";
import { chatsRequested } from "@/features/load-chats/model";
import { pollingStarted, pollingStopped } from "@/features/receive-events/model";

import { ChatHeader } from "./components/ChatHeader";
import { ChatSidebar } from "./components/ChatSidebar";
import { ConnectionScreen } from "./components/ConnectionScreen";
import { MessageComposer } from "./components/MessageComposer";
import { MessageList } from "./components/MessageList";
import { NewChatDialog } from "./components/NewChatDialog";
import { SettingsNotice } from "./components/SettingsNotice";
import { $mobileChatOpen } from "./model/mobile-chat";
import "./model/session";

const chatWallpaperUrl = `${import.meta.env.BASE_URL}chat-wallpaper.svg`;

export function MessengerPage() {
  const theme = useTheme();
  const [credentials, chats, activeChatId, activeChat, mobileChatOpen] = useUnit([
    $credentials,
    $chats,
    $activeChatId,
    $activeChat,
    $mobileChatOpen,
  ]);

  useEffect(() => {
    sessionRestoreRequested();
  }, []);

  useEffect(() => {
    if (!credentials) return;
    chatsRestored({ instanceId: credentials.idInstance });
    chatsRequested({ credentials });
    pollingStarted();
    return () => pollingStopped();
  }, [credentials]);

  useEffect(() => {
    if (credentials) chatsPersistenceRequested(credentials.idInstance);
  }, [chats, credentials]);

  useEffect(() => {
    if (credentials && activeChatId) {
      historyRequested({ chatId: activeChatId, credentials });
    }
  }, [activeChatId, credentials]);

  const dark = theme.palette.mode === "dark";

  if (!credentials) {
    return <ConnectionScreen />;
  }

  return (
    <Box
      sx={{
        display: "flex",
        width: "100%",
        height: "100svh",
        minHeight: 0,
        overflow: "hidden",
        bgcolor: dark ? "#000" : "background.default",
        "--chat-text": dark ? "#f5f5f5" : "#17212b",
        "--chat-meta": dark ? "#aaa9af" : "#7c8790",
        "--chat-incoming": dark ? "#212121" : "#ffffff",
        "--chat-outgoing": dark ? "#756bc5" : "#e7ffdb",
      }}
    >
      <ChatSidebar />
      <Box
        component="main"
        sx={{
          display: { xs: mobileChatOpen ? "flex" : "none", md: "flex" },
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          position: "relative",
          isolation: "isolate",
          flexDirection: "column",
          bgcolor: dark ? "#000" : "#d7e3dc",
          "& > *": { position: "relative", zIndex: 1 },
          "&::before": dark
            ? {
                content: '""',
                position: "absolute",
                inset: 0,
                zIndex: 0,
                pointerEvents: "none",
                background: "linear-gradient(160deg, #453651 0%, #654568 48%, #302a4b 100%)",
                opacity: 0.55,
                maskImage: `url("${chatWallpaperUrl}")`,
                maskSize: { xs: "cover", md: "auto 1000px" },
                maskRepeat: "repeat",
                WebkitMaskImage: `url("${chatWallpaperUrl}")`,
                WebkitMaskSize: { xs: "cover", md: "auto 1000px" },
                WebkitMaskRepeat: "repeat",
              }
            : undefined,
        }}
      >
        {activeChat ? (
          <Stack
            sx={{
              flex: 1,
              minHeight: 0,
              overflow: "hidden",
              width: "min(100%, 980px)",
              pt: { xs: 2, sm: 1.5 },
              pb: { xs: 2, sm: 1.5 },
              mx: "auto",
            }}
          >
            <ChatHeader />
            <MessageList />
            <MessageComposer key={activeChat.id} />
          </Stack>
        ) : (
          <Stack spacing={1} sx={{ flex: 1, p: 3, alignItems: "center", justifyContent: "center" }}>
            <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 36, color: "text.secondary" }} />
            <Typography
              sx={{
                px: 2,
                py: 0.75,
                borderRadius: 4,
                bgcolor: "rgba(0,0,0,.35)",
                color: "#fff",
                fontSize: 14,
              }}
            >
              Выберите или создайте чат
            </Typography>
          </Stack>
        )}
      </Box>
      <NewChatDialog />
      <SettingsNotice />
    </Box>
  );
}
