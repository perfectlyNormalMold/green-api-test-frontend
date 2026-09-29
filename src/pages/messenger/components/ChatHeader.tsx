import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import { Box, IconButton, Menu, MenuItem, Typography } from "@mui/material";
import { useUnit } from "effector-react";
import { useState } from "react";
import type { MouseEvent } from "react";

import { $activeChat } from "@/entities/chat/model";
import { newChatOpened } from "@/features/create-chat/model";

import { mobileChatsShown } from "../model/mobile-chat";
import { ChatAvatar } from "./ChatAvatar";

export function ChatHeader() {
  const chat = useUnit($activeChat);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const openMenu = (event: MouseEvent<HTMLElement>) => setMenuAnchor(event.currentTarget);
  if (!chat) return null;

  return (
    <Box
      component="header"
      sx={{
        flexShrink: 0,
      }}
    >
      <Box
        sx={{
          minHeight: 52,
          display: "flex",
          alignItems: "center",
          px: 1,
          gap: 1,
          bgcolor: "background.paper",
          borderRadius: "28px",
        }}
      >
        <IconButton
          aria-label="Назад к чатам"
          onClick={() => mobileChatsShown()}
          sx={{ display: { md: "none" } }}
        >
          <ArrowBackRoundedIcon />
        </IconButton>
        <ChatAvatar title={chat.title} avatarUrl={chat.avatarUrl} size={38} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography noWrap sx={{ fontSize: 15, lineHeight: 1.3, fontWeight: 600 }}>
            {chat.title}
          </Typography>
          <Typography noWrap sx={{ fontSize: 12, color: "text.secondary", lineHeight: 1.4 }}>
            {chat.subtitle || "Telegram"}
          </Typography>
        </Box>
        <IconButton aria-label="Действия с чатом" onClick={openMenu}>
          <MoreVertRoundedIcon />
        </IconButton>
        <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              newChatOpened();
            }}
          >
            Новый чат
          </MenuItem>
        </Menu>
      </Box>
    </Box>
  );
}
