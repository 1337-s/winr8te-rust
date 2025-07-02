import "dotenv/config";
import { logger } from "./logger.js";

export async function DiscordRequest(endpoint, options) {
  const url = "https://discord.com/api/v10/" + endpoint;

  logger.debug("Making Discord API request", {
    url,
    method: options.method || "GET",
  });

  // Stringify payloads
  if (options.body) {
    options.body = JSON.stringify(options.body);
  }

  // Use fetch to make requests
  const res = await fetch(url, {
    headers: {
      Authorization: `Bot ${process.env.BOT_TOKEN}`,
      "Content-Type": "application/json; charset=UTF-8",
      "User-Agent": "DiscordBot (WINR8TE-Bot, 1.0.0)",
    },
    ...options,
  });

  if (!res.ok) {
    const data = await res.json();
    logger.error("Discord API Error", {
      status: res.status,
      statusText: res.statusText,
      data,
    });
    throw new Error(`Discord API Error: ${res.status} ${JSON.stringify(data)}`);
  }

  logger.debug("Discord API request successful", { status: res.status });
  return res;
}

export async function InstallGlobalCommands(appId, commands) {
  const endpoint = `applications/${appId}/commands`;

  logger.info("Installing global commands", {
    appId,
    commandCount: commands.length,
  });

  try {
    await DiscordRequest(endpoint, { method: "PUT", body: commands });
    logger.success("Global commands installed successfully");
  } catch (err) {
    logger.error("Failed to install global commands", { error: err.message });
    throw err;
  }
}
