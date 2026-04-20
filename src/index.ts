export type { FlagsString } from "./types";
export type { ErrorInput, StringFlagsOptions } from "./internal";
export { resolveErrorInput } from "./internal";
export { StringFlags, defineStringFlags } from "./class";
export {
  toStringFlags,
  parseStringFlags,
  hasStringFlag,
  addStringFlag,
  removeStringFlag,
  toggleStringFlag,
} from "./standalone";
