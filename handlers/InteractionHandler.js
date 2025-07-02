import { InteractionResponseType, InteractionType } from "discord-interactions";
import { getCommand } from "../commands/index.js";
import { logger } from "../utils/logger.js";

export async function handleInteraction(req, res) {
  const { id, type, data, user, member } = req.body;

  // Log de l'interaction reçue
  logger.info("Interaction received", { id, type, commandName: data?.name });

  try {
    // Gestion des PING (vérification Discord)
    if (type === InteractionType.PING) {
      logger.info("Responding to PING");
      return res.send({ type: InteractionResponseType.PONG });
    }

    // Gestion des commandes slash
    if (type === InteractionType.APPLICATION_COMMAND) {
      return await handleSlashCommand(req, res, data, user || member?.user);
    }

    // Type d'interaction non supporté
    logger.warn("Unknown interaction type", { type });
    return res.status(400).json({ error: "unknown interaction type" });
  } catch (error) {
    logger.error("Error handling interaction", {
      error: error.message,
      stack: error.stack,
    });

    // Réponse d'erreur générique pour l'utilisateur
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content:
          "❌ Une erreur s'est produite lors de l'exécution de cette commande.",
        flags: 64, // Ephemeral
      },
    });
  }
}

async function handleSlashCommand(req, res, data, user) {
  const { name: commandName, options } = data;

  const command = getCommand(commandName);

  if (!command) {
    logger.warn("Unknown command", { commandName });
    return res.status(400).json({ error: "unknown command" });
  }

  logger.info("Executing command", {
    commandName,
    userId: user?.id,
    username: user?.username,
  });

  // Construire un objet interaction simplifié, compatible avec ta commande
  const interaction = {
    id: req.body.id,
    token: req.body.token,
    type: req.body.type,
    data,
    user,
    options: options || [],
    // Ajouter ce champ si ta commande en a besoin
    channel_id: req.body.channel_id,
  };

  // Exécuter la commande et récupérer la réponse JSON Discord attendue
  const response = await command.execute(interaction);

  logger.info("Command executed successfully", { commandName });

  // Envoyer directement la réponse au webhook Discord
  return res.send(response);
}
