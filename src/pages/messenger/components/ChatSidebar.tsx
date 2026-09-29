import AddRoundedIcon from "@mui/icons-material/AddRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import {
  Box,
  IconButton,
  InputBase,
  List,
  ListItemButton,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import { useUnit } from "effector-react";
import { useState } from "react";
import type { MouseEvent } from "react";

import { $activeChatId, $chats, chatSelected } from "@/entities/chat/model";
import type { Chat } from "@/entities/chat/model";
import { disconnectRequested } from "@/features/connect-instance/model";
import { newChatOpened } from "@/features/create-chat/model";
import { $pollingStatus } from "@/features/receive-events/model";

import { $mobileChatOpen } from "../model/mobile-chat";
import { formatTime, getLastMessage } from "../utils/chat-ui";
import { ChatAvatar } from "./ChatAvatar";

function ChatListItem({
  chat,
  selected,
  onClick,
}: {
  chat: Chat;
  selected: boolean;
  onClick: () => void;
}) {
  const lastMessage = getLastMessage(chat);

  return (
    <ListItemButton
      selected={selected}
      onClick={onClick}
      sx={{
        mx: 0.75,
        mb: 0.25,
        minHeight: 72,
        px: 1.25,
        py: 0.75,
        borderRadius: "12px",
        gap: 1.25,
        "&.Mui-selected": {
          bgcolor: "#756bc5",
          color: "#fff",
          "&:hover": { bgcolor: "#8075cf" },
        },
        "&:hover:not(.Mui-selected)": { bgcolor: "#303030" },
      }}
    >
      <ChatAvatar title={chat.title} avatarUrl={chat.avatarUrl} size={52} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75 }}>
          <Typography noWrap sx={{ flex: 1, fontSize: 15, fontWeight: 600, lineHeight: 1.4 }}>
            {chat.title}
          </Typography>
          {lastMessage && (
            <Typography
              sx={{
                flexShrink: 0,
                fontSize: 11,
                color: selected ? "rgba(255,255,255,.82)" : "text.secondary",
              }}
            >
              {formatTime(lastMessage.timestamp)}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.25 }}>
          <Typography
            noWrap
            sx={{
              flex: 1,
              minWidth: 0,
              fontSize: 13.5,
              color: selected ? "rgba(255,255,255,.9)" : "text.secondary",
            }}
          >
            {lastMessage ? lastMessage.text : "Нет сообщений"}
          </Typography>
          {chat.unreadCount > 0 && (
            <Box
              component="span"
              sx={{
                flexShrink: 0,
                minWidth: 20,
                height: 20,
                px: 0.6,
                display: "grid",
                placeItems: "center",
                borderRadius: "10px",
                bgcolor: selected ? "#fff" : "primary.main",
                color: selected ? "primary.main" : "#fff",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
            </Box>
          )}
        </Box>
      </Box>
    </ListItemButton>
  );
}

export function ChatSidebar() {
  const [chats, activeChatId, mobileChatOpen, pollingStatus] = useUnit([
    $chats,
    $activeChatId,
    $mobileChatOpen,
    $pollingStatus,
  ]);
  const [query, setQuery] = useState("");
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const filteredChats = chats.filter((chat) =>
    chat.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  const openMenu = (event: MouseEvent<HTMLElement>) => setMenuAnchor(event.currentTarget);
  const closeMenu = () => setMenuAnchor(null);

  return (
    <Box
      component="aside"
      sx={{
        display: { xs: mobileChatOpen ? "none" : "flex", md: "flex" },
        width: { xs: "100%", md: "clamp(320px, 26vw, 440px)" },
        flexShrink: 0,
        flexDirection: "column",
        minHeight: 0,
        bgcolor: "background.paper",
        borderRadius: { xs: 0, md: "16px" },
        mt: { md: 1.5 },
        ml: { md: 1.5 },
        mb: { md: 1.5 },
        overflow: "hidden",
      }}
    >
      <Box sx={{ height: 64, px: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
        <IconButton
          aria-label="Открыть меню"
          onClick={openMenu}
          sx={{ width: 40, height: 40, color: "#e9e9e9" }}
        >
          <MenuRoundedIcon />
        </IconButton>
        <Box
          sx={{
            display: "flex",
            flex: 1,
            minWidth: 0,
            alignItems: "center",
            gap: 1,
            px: 1.5,
            height: 44,
            borderRadius: "24px",
            bgcolor: "#2c2c2c",
            border: "1px solid transparent",
            "&:focus-within": { borderColor: "#756bc5" },
          }}
        >
          <SearchRoundedIcon sx={{ fontSize: 21, color: "text.secondary" }} />
          <InputBase
            fullWidth
            placeholder="Поиск"
            aria-label="Поиск чатов"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            sx={{ fontSize: 14 }}
          />
        </Box>
      </Box>
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        <MenuItem
          onClick={() => {
            closeMenu();
            newChatOpened();
          }}
        >
          <AddRoundedIcon sx={{ mr: 1.5, fontSize: 20 }} />
          Новый чат
        </MenuItem>
        <MenuItem
          onClick={() => {
            closeMenu();
            disconnectRequested();
          }}
        >
          <LogoutRoundedIcon sx={{ mr: 1.5, fontSize: 20 }} />
          Выйти
        </MenuItem>
        <MenuItem disabled sx={{ fontSize: 12 }}>
          {pollingStatus === "online"
            ? "● Подключено"
            : pollingStatus === "reconnecting"
              ? "● Переподключение…"
              : "● Опрос остановлен"}
        </MenuItem>
      </Menu>
      <List disablePadding sx={{ flex: 1, overflowY: "auto", minHeight: 0, py: 0.5 }}>
        {filteredChats.map((chat) => (
          <ChatListItem
            key={chat.id}
            chat={chat}
            selected={chat.id === activeChatId}
            onClick={() => chatSelected(chat.id)}
          />
        ))}
        {filteredChats.length === 0 && (
          <Typography
            sx={{ px: 3, py: 3, textAlign: "center", color: "text.secondary", fontSize: 14 }}
          >
            {query ? "Чаты не найдены" : "Пока нет чатов. Создайте новый через меню."}
          </Typography>
        )}
      </List>
    </Box>
  );
}
