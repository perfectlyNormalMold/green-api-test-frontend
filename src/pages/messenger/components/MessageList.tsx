import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import DoneAllRoundedIcon from "@mui/icons-material/DoneAllRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import { useUnit } from "effector-react";
import { Fragment, useEffect, useRef } from "react";

import { $activeChat } from "@/entities/chat/model";
import type { ChatMessage, MessageStatus } from "@/entities/chat/model";
import { $historyError, $historyLoading } from "@/features/load-chat-history/model";

import { draftRestoreRequested } from "../model/draft";
import { formatDay, formatTime, isSameDay } from "../utils/chat-ui";

function isGrouped(first: ChatMessage, second: ChatMessage) {
  return (
    first.direction === second.direction &&
    isSameDay(first.timestamp, second.timestamp) &&
    Math.abs(first.timestamp - second.timestamp) < 300_000
  );
}

function MessageStatusIcon({ status }: { status?: MessageStatus }) {
  if (status === "sending") return <CircularProgress size={12} sx={{ color: "inherit" }} />;
  if (status === "failed")
    return <ErrorOutlineRoundedIcon sx={{ fontSize: 16, color: "error.main" }} />;
  if (status === "read") return <DoneAllRoundedIcon sx={{ fontSize: 16, color: "#fff" }} />;
  if (status === "delivered") return <DoneAllRoundedIcon sx={{ fontSize: 16 }} />;
  return <CheckRoundedIcon sx={{ fontSize: 16 }} />;
}

function MessageBubble({
  message,
  chatId,
  groupedWithNext,
  groupedWithPrevious,
}: {
  message: ChatMessage;
  chatId: string;
  groupedWithNext: boolean;
  groupedWithPrevious: boolean;
}) {
  const outgoing = message.direction === "outgoing";

  return (
    <Box
      sx={{
        alignSelf: outgoing ? "flex-end" : "flex-start",
        maxWidth: { xs: "89%", sm: "min(75%, 520px)" },
        minWidth: 0,
        mt: groupedWithPrevious ? "3px" : "14px",
        px: 1.25,
        pt: 0.7,
        pb: 0.55,
        color: "var(--chat-text)",
        bgcolor: outgoing ? "var(--chat-outgoing)" : "var(--chat-incoming)",
        borderRadius: outgoing
          ? `12px 12px ${groupedWithNext ? "12px" : "4px"} 12px`
          : `12px 12px 12px ${groupedWithNext ? "12px" : "4px"}`,
        boxShadow: "0 1px 2px rgba(0,0,0,.16)",
        overflowWrap: "anywhere",
      }}
    >
      <Typography
        component="span"
        sx={{ fontSize: 14, lineHeight: 1.4, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
      >
        {message.text}
      </Typography>
      <Box
        component="span"
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: "3px",
          ml: 1,
          whiteSpace: "nowrap",
          float: "right",
          mt: "5px",
          color: outgoing ? "rgba(255,255,255,.74)" : "var(--chat-meta)",
        }}
      >
        <Typography component="span" sx={{ fontSize: 10.5, lineHeight: 1.2 }}>
          {formatTime(message.timestamp)}
        </Typography>
        {outgoing && <MessageStatusIcon status={message.status} />}
      </Box>
      {message.status === "failed" && (
        <Box sx={{ mt: 0.5, display: "flex", gap: 1, alignItems: "center" }}>
          <Typography variant="caption" color="error.main">
            {message.error || "Не удалось отправить"}
          </Typography>
          <Button
            size="small"
            onClick={() => draftRestoreRequested({ chatId, text: message.text })}
          >
            Вернуть текст
          </Button>
        </Box>
      )}
    </Box>
  );
}

export function MessageList() {
  const chat = useUnit($activeChat);
  const [historyLoading, historyError] = useUnit([$historyLoading, $historyError]);
  const chatId = chat?.id;
  const messages = chat?.messages ?? [];
  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const previousChatId = useRef<string | undefined>(undefined);

  useEffect(() => {
    const container = scrollRef.current;
    if (container && (previousChatId.current !== chatId || nearBottom.current))
      container.scrollTop = container.scrollHeight;
    previousChatId.current = chatId;
  }, [chatId, messages.length]);

  return (
    <Box
      ref={scrollRef}
      onScroll={(event) => {
        const container = event.currentTarget;
        nearBottom.current =
          container.scrollHeight - container.scrollTop - container.clientHeight < 80;
      }}
      role="log"
      aria-label="Сообщения"
      sx={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        overscrollBehavior: "contain",
        scrollbarWidth: "thin",
        scrollBehavior: "smooth",
        // Chrome / Edge / Safari
        "&::-webkit-scrollbar-thumb": {
          backgroundColor: "rgba(255, 255, 255, 0.2)",
          borderRadius: "999px",
        },
        colorScheme: "dark",
      }}
    >
      <Box
        sx={{
          minHeight: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          px: { xs: 1, sm: 1.5 },
          pt: 1,
          pb: 1,
        }}
      >
        {historyLoading && !messages.length && (
          <Typography sx={{ textAlign: "center" }}>Загрузка истории…</Typography>
        )}
        {historyError && (
          <Typography color="error.main" sx={{ textAlign: "center" }}>
            История недоступна: {historyError}
          </Typography>
        )}
        {!historyLoading && !historyError && !messages.length && (
          <Typography color="text.secondary" sx={{ textAlign: "center" }}>
            Сообщений пока нет
          </Typography>
        )}
        {messages.map((message, index) => (
          <Fragment key={message.localId}>
            {(index === 0 || !isSameDay(messages[index - 1].timestamp, message.timestamp)) && (
              <Box
                sx={{
                  alignSelf: "center",
                  px: 1.5,
                  py: 0.4,
                  mt: 1,
                  mb: 0.25,
                  borderRadius: "16px",
                  bgcolor: "rgba(28,28,30,.86)",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {formatDay(message.timestamp)}
              </Box>
            )}
            <MessageBubble
              message={message}
              chatId={chatId ?? ""}
              groupedWithPrevious={index > 0 && isGrouped(messages[index - 1], message)}
              groupedWithNext={
                index < messages.length - 1 && isGrouped(message, messages[index + 1])
              }
            />
          </Fragment>
        ))}
      </Box>
    </Box>
  );
}
