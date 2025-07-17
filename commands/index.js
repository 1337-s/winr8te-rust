import { helpCommand } from "./help.js";
import { mapvoteCommand } from "./mapvote.js";
import { statCommand } from "./stat.js";
import { leaderboardCommand } from "./leaderboard.js";

// Export toutes les commandes
export const commands = {
  help: helpCommand,
  mapvote: mapvoteCommand,
};

// Export les définitions pour l'enregistrement
export const commandDefinitions = Object.values(commands).map(
  (cmd) => cmd.definition
);

// Fonction pour obtenir une commande par nom
export function getCommand(commandName) {
  return commands[commandName];
}

// Liste toutes les commandes disponibles
export function listCommands() {
  return Object.keys(commands);
}
