import SendRoundedIcon from "@mui/icons-material/SendRounded";
import { Box, IconButton, TextField } from "@mui/material";
import { useUnit } from "effector-react";
import { useEffect, useState } from "react";
import type { KeyboardEvent } from "react";

import { $activeChatId } from "@/entities/chat/model";
import { messageSubmitted } from "@/features/send-message/model";

import { draftRestoreRequested } from "../model/draft";

export function MessageComposer() {
  const chatId = useUnit($activeChatId);
  const [value, onChange] = useState("");
  useEffect(
    () =>
      draftRestoreRequested.watch((draft) => {
        if (draft.chatId === chatId) onChange(draft.text);
      }),
    [chatId],
  );
  const onSend = () => {
    if (!chatId || !value.trim() || value.trim().length > 4096) return;
    messageSubmitted({ chatId, text: value });
    onChange("");
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      onSend();
    }
  };

  return (
    <Box
      component="form"
      onSubmit={(event) => {
        event.preventDefault();
        onSend();
      }}
      sx={{
        width: "100%",
        pt: 0.5,
      }}
    >
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          alignItems: "flex-end",
          borderRadius: "26px",
          bgcolor: "background.paper",
          px: 0.5,
          pl: 4,
          minHeight: 48,
        }}
      >
        <TextField
          fullWidth
          multiline
          maxRows={6}
          variant="standard"
          placeholder="Сообщение"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          slotProps={{
            htmlInput: { maxLength: 4096, "aria-label": "Сообщение" },
            input: { disableUnderline: true },
          }}
          sx={{ py: 1.35, "& textarea": { fontSize: 14, lineHeight: 1.5, padding: 0 } }}
        />
        <IconButton
          type="submit"
          aria-label="Отправить сообщение"
          sx={{
            width: 40,
            height: 40,
            m: 0.5,
            flexShrink: 0,
            borderRadius: "50%",
            bgcolor: "primary.main",
            color: "#fff",
            "&:hover": { bgcolor: "#867bd8" },
          }}
        >
          <SendRoundedIcon sx={{ fontSize: 22 }} />
        </IconButton>
      </Box>
    </Box>
  );
}
