import { sample } from "effector";

import { chatsCleared } from "@/entities/chat/model";
import { disconnectRequested } from "@/features/connect-instance/model";

sample({ clock: disconnectRequested, target: chatsCleared });
