// Terminal escape sequences (colours, cursor moves), taken out of logs and
// screens to show them as plain text.

// biome-ignore lint/suspicious/noControlCharactersInRegex: escape sequences
export const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]/g;
