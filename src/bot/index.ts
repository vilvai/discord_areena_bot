import Discord from "discord.js";

import { PlayerClass } from "../shared/types";
import GameRunner from "./GameRunner";
import { createNewBotPlayer } from "../shared/bots";
import { GAME_COUNTDOWN_SECONDS } from "../shared/constants";

require("dotenv").config();

const client = new Discord.Client();

const gameRunner: GameRunner = new GameRunner();

enum BotState {
	Ready = "ready",
	Countdown = "countdown",
	Rendering = "rendering",
}

let botState: BotState = BotState.Ready;
let countDownLeft = 0;

let botMention = "";
const acceptedCommands = [
	{ command: "aloita", info: "aloita peli" },
	{ command: "liity", info: "liity peliin" },
	{ command: "botti", info: "lisää botti peliin" },
	{ command: "class", info: "vaihda oma class" },
	{ command: "info", info: "näytä komennot" },
];

const acceptedClasses = Object.values(PlayerClass).map((playerClass) =>
	playerClass.toString()
);
const acceptedClassesAsString = `[${acceptedClasses.join(" | ")}]`;

const acceptedCommandsAsString = acceptedCommands.map((command) => {
	let fullCommandInfo = `${botMention} ${command.command}`;
	if (command.command === "class") {
		fullCommandInfo += ` ${acceptedClassesAsString}`;
	}
	fullCommandInfo += ` *(${command.info})*`;
	return fullCommandInfo;
});

client.on("ready", () => {
	if (!client.user) return;
	botMention = `@${client.user.username}`;
	console.log(`Logged in as ${client.user.tag}!`);
});

client.on("message", async (msg) => {
	const mentionedUsers = msg.mentions.users;
	if (
		!client.user ||
		mentionedUsers.size !== 1 ||
		mentionedUsers.first()!.id !== client.user.id
	) {
		return;
	}

	const messageWithoutMention = msg.content.replace(/<@!\d+>\ +/, "");

	const command = parseAndValidateCommand(messageWithoutMention);

	if (command === null) {
		sendUnknownCommandText(msg);
	} else {
		executeCommand(msg, command);
	}
});

client.login(process.env.TOKEN);

const parseAndValidateCommand = (rawText: string): string[] | null => {
	const commandWithArgs = rawText.split(" ");
	if (
		acceptedCommands.some((command) => command.command === commandWithArgs[0])
	) {
		return commandWithArgs;
	} else {
		return null;
	}
};

const sendUnknownCommandText = async (msg: Discord.Message) => {
	const botResponse = `Tuntematon komento. Tunnetut komennot:\n${acceptedCommandsAsString.join(
		"\n"
	)}`;
	await msg.channel.send(botResponse);
};

const executeCommand = async (
	msg: Discord.Message,
	commandWithArgs: string[]
) => {
	const command = commandWithArgs[0];

	switch (command) {
		case "aloita": {
			if (botState === BotState.Ready) {
				gameRunner.initializeGame();
				addPlayerToGame(msg);
				botState = BotState.Countdown;
				countDownLeft = GAME_COUNTDOWN_SECONDS;
				await msg.channel.send(
					`Peli alkaa ${countDownLeft} sekunnin kuluttua. Liittykää peliin komennolla ${botMention} liity`
				);
				setTimeout(() => countDown(msg), 1000);
			} else {
				await msg.channel.send(
					`Peli on jo käynnissä. Liity peliin komennolla ${botMention} liity.`
				);
			}
			break;
		}
		case "liity": {
			switch (botState) {
				case BotState.Countdown: {
					if (!gameRunner.playerInGame(msg.author.id)) {
						addPlayerToGame(msg);
					}
					await printPlayersInGame(msg);
					break;
				}
				case BotState.Ready: {
					await msg.channel.send(
						`Ei käynnissä olevaa peliä. Aloita peli komennolla ${botMention} aloita`
					);
					break;
				}
				default: {
					break;
				}
			}
			break;
		}
		case "botti": {
			switch (botState) {
				case BotState.Countdown: {
					const { playerClass, ...botPlayer } = createNewBotPlayer();
					gameRunner.addPlayer(botPlayer);
					gameRunner.setPlayerClass(botPlayer.id, playerClass);
					await printPlayersInGame(msg);
					break;
				}
				case BotState.Ready: {
					await msg.channel.send(
						`Ei käynnissä olevaa peliä. Aloita peli komennolla ${botMention} aloita`
					);
					break;
				}
				default: {
					break;
				}
			}
			break;
		}
		case "class": {
			const possibleClass = commandWithArgs[1];
			if (acceptedClasses.includes(possibleClass)) {
				const newPlayerClass = possibleClass as PlayerClass;
				gameRunner.setPlayerClass(msg.author.id, newPlayerClass);
				await msg.channel.send(
					`${msg.author.username} on nyt ${newPlayerClass}.`
				);
			} else {
				await msg.channel.send(
					`Valittavat classit: ${acceptedClassesAsString}`
				);
			}
			break;
		}
		case "info": {
			await msg.channel.send(acceptedCommandsAsString);
			break;
		}
		default: {
			break;
		}
	}
};

const addPlayerToGame = (msg: Discord.Message) => {
	const avatarURL = msg.author.displayAvatarURL({
		format: "png",
		size: 128,
	});

	gameRunner.addPlayer({
		avatarURL,
		name: msg.author.username,
		id: msg.author.id,
	});
};

const countDown = async (msg: Discord.Message) => {
	countDownLeft -= 1;
	if (countDownLeft === 0) {
		runGame(msg);
		return;
	}
	if (countDownLeft % 10 === 0 || countDownLeft === 5) {
		await msg.channel.send(`Peli alkaa ${countDownLeft} sekunnin kuluttua.`);
	}
	setTimeout(() => countDown(msg), 1000);
};

const runGame = async (msg: Discord.Message) => {
	if (gameRunner.getPlayerCount() > 1) {
		botState = BotState.Rendering;
		await msg.channel.send("Peli alkaa...");
		await gameRunner.runGame();
		await msg.channel.send("", { files: ["Areena_fight.mp4"] });
	} else {
		await msg.channel.send(
			`Pelissä oli liian vähän osallistujia. Aloita uusi peli komennolla ${botMention} aloita`
		);
	}
	botState = BotState.Ready;
};

const printPlayersInGame = async (msg: Discord.Message) =>
	await msg.channel.send(
		`Osallistujat:\n${gameRunner.getCurrentPlayersWithClasses()}\nVaihda class komennolla ${botMention} class ${acceptedClassesAsString}`
	);
