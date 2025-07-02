// Simple logger avec couleurs et timestamps
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

function formatTimestamp() {
  return new Date().toISOString().replace("T", " ").substr(0, 19);
}

function formatMessage(level, message, data = {}) {
  const timestamp = formatTimestamp();
  const dataStr =
    Object.keys(data).length > 0 ? ` ${JSON.stringify(data)}` : "";
  return `${timestamp} [${level}] ${message}${dataStr}`;
}

export const logger = {
  info(message, data) {
    console.log(
      `${colors.green}${formatMessage("INFO", message, data)}${colors.reset}`
    );
  },

  warn(message, data) {
    console.log(
      `${colors.yellow}${formatMessage("WARN", message, data)}${colors.reset}`
    );
  },

  error(message, data) {
    console.log(
      `${colors.red}${formatMessage("ERROR", message, data)}${colors.reset}`
    );
  },

  debug(message, data) {
    if (process.env.NODE_ENV === "development") {
      console.log(
        `${colors.gray}${formatMessage("DEBUG", message, data)}${colors.reset}`
      );
    }
  },

  success(message, data) {
    console.log(
      `${colors.cyan}${formatMessage("SUCCESS", message, data)}${colors.reset}`
    );
  },
};
