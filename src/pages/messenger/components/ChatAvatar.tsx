import { Avatar } from "@mui/material";

import { getInitials } from "../utils/chat-ui";

type ChatAvatarProps = { title: string; avatarUrl?: string; size?: number };

export function ChatAvatar({ title, avatarUrl, size = 48 }: ChatAvatarProps) {
  return (
    <Avatar
      src={avatarUrl}
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        bgcolor: "#7165b0",
        color: "#fff",
        fontSize: size * 0.39,
        fontWeight: 500,
      }}
    >
      {getInitials(title)}
    </Avatar>
  );
}
