import { createEvent } from "effector";

export const draftRestoreRequested = createEvent<{ chatId: string; text: string }>();
