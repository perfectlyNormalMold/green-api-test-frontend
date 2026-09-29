import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useUnit } from "effector-react";

import {
  $isNewChatPending,
  $newChatError,
  $newChatOpen,
  $newChatPhone,
  erasePhoneDigitBeforeSeparator,
  newChatClosed,
  newChatPhoneChanged,
  newChatSubmitted,
  formatPhoneInput,
  normalizePhone,
  phoneCaretPosition,
} from "@/features/create-chat/model";

export function NewChatDialog() {
  const [open, phoneNumber, error, pending] = useUnit([
    $newChatOpen,
    $newChatPhone,
    $newChatError,
    $isNewChatPending,
  ]);
  return (
    <Dialog open={open} onClose={() => newChatClosed()} fullWidth maxWidth="xs">
      <DialogTitle>Новый чат</DialogTitle>
      <DialogContent>
        <form
          id="new-chat-form"
          onSubmit={(event) => {
            event.preventDefault();
            newChatSubmitted(phoneNumber);
          }}
        >
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography color="text.secondary" variant="body2">
              Введите номер в международном формате, <br />
              например +7 999 123 45 67.
            </Typography>
            <TextField
              autoFocus
              type="tel"
              label="Номер телефона"
              value={phoneNumber}
              onChange={(event) => {
                const input = event.target;
                const value = input.value;
                const digitsBeforeCaret = value
                  .slice(0, input.selectionStart ?? value.length)
                  .replace(/\D/g, "").length;
                const formatted = formatPhoneInput(value, phoneNumber);
                newChatPhoneChanged(value);
                requestAnimationFrame(() => {
                  if (document.activeElement !== input) return;
                  const position = phoneCaretPosition(formatted, digitsBeforeCaret);
                  input.setSelectionRange(position, position);
                });
              }}
              onKeyDown={(event) => {
                if (event.key !== "Backspace") return;
                const input = event.target as HTMLInputElement;
                const caret = input.selectionStart;
                if (caret === null || caret !== input.selectionEnd) return;
                const edit = erasePhoneDigitBeforeSeparator(phoneNumber, caret);
                if (!edit) return;
                event.preventDefault();
                newChatPhoneChanged(edit.value);
                requestAnimationFrame(() => input.setSelectionRange(edit.caret, edit.caret));
              }}
              slotProps={{ htmlInput: { inputMode: "tel", autoComplete: "tel" } }}
              error={Boolean(error || (phoneNumber && !normalizePhone(phoneNumber)))}
              helperText={
                error ||
                (phoneNumber && !normalizePhone(phoneNumber) ? "Введите 7–15 цифр без букв." : "")
              }
            />
          </Stack>
        </form>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => newChatClosed()}>Отмена</Button>
        <Button
          variant="contained"
          disabled={!normalizePhone(phoneNumber) || pending}
          type="submit"
          form="new-chat-form"
        >
          {pending ? <CircularProgress size={20} color="inherit" /> : "Создать"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
