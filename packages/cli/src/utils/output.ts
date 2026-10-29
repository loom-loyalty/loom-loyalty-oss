/**
 * Terminal colors. Respects NO_COLOR (https://no-color.org/).
 */

const noColor = Boolean(process.env.NO_COLOR);

export const colors = {
  green: noColor ? "" : "\x1b[32m",
  red: noColor ? "" : "\x1b[31m",
  yellow: noColor ? "" : "\x1b[33m",
  cyan: noColor ? "" : "\x1b[36m",
  dim: noColor ? "" : "\x1b[2m",
  bold: noColor ? "" : "\x1b[1m",
  reset: noColor ? "" : "\x1b[0m",
};
