"use client";

import { createContext, useContext } from "react";

export interface OptionIcons {
  /** Emoji on the chips above the input; on unless `CHAT_OPTION_ICONS=false` */
  chips: boolean;
  /** Emoji next to each choice in the popover / sheet; off unless `CHAT_OPTION_LIST_ICONS=true` */
  list: boolean;
}

export const OptionIconsContext = createContext<OptionIcons>({ chips: true, list: false });

export function useOptionIcons(): OptionIcons {
  return useContext(OptionIconsContext);
}
