// commands/index.js
import { forcemapvoteCommand } from "./forcemapvote.js";

// Export toutes les commandes
export const commands = {
  forcemapvote: forcemapvoteCommand,
};

// Export les définitions pour l'enregistrement
export const commandDefinitions = Object.values(commands).map(
  (cmd) => cmd.data?.toJSON() || cmd.definition
);

// Fonction pour obtenir une commande par nom
export function getCommand(commandName) {
  return commands[commandName];
}

// Liste toutes les commandes disponibles
export function listCommands() {
  return Object.keys(commands);
}
