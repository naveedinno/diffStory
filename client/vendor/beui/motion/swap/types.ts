// Vendored from starc007/ui-components — components/motion/swap/types.ts (MIT)
export type Chain = {
  id: string;
  name: string;
  tone: string;
  symbol: string;
};

export type Token = {
  id: string;
  symbol: string;
  name: string;
  chainId: string;
  address?: string;
  balance?: number;
  usd?: number;
  trending?: boolean;
  popular?: boolean;
};

export type TokenSide = "from" | "to";
