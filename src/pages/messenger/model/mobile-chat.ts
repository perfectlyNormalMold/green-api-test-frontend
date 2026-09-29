import { createEvent, createStore } from "effector";

import { chatAdded, chatSelected, chatsCleared } from "@/entities/chat/model";

export const mobileChatsShown = createEvent();

export const $mobileChatOpen = createStore(false)
  .on([chatSelected, chatAdded], () => true)
  .on(mobileChatsShown, () => false)
  .reset(chatsCleared);
