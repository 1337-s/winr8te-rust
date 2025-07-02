import { testCommand } from "./test.js";
import { helpCommand } from "./help.js";

// Export toutes les commandes
export const commands = {
  test: testCommand,
  help: helpCommand,
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
