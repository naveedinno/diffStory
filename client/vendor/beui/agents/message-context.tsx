// Vendored from starc007/ui-components — components/agents/message-context.tsx (MIT)
import { createContext } from "react";

export type MessageSide = "start" | "end";

export const MessageSideContext = createContext<MessageSide | undefined>(
  undefined,
);
