import Discord from "discord.js";

import { PlayerClass } from "../shared/types";
import GameRunner from "./GameRunner";
import { createNewBotPlayer } from "../shared/bots";
import {
	GAME_COUNTDOWN_SECONDS,
	INPUT_FILE_DIRECTORY,
	MAX_PLAYER_COUNT,
	RENDER_DIRECTORY,
	RENDER_FILE_NAME,
} from "../shared/constants";
import { startTimer, logTimer } from "../shared/timer";
import {
	findCommandByLabel,
	getAcceptedCommandsForLanguage,
	parseCommand,
} from "./messages/commands";
import {
	messageMentionsBot,
	messagesByLanguage,
	constructGameEndText,
	messageWasSentByGuildOwner,
	MessageFunctions,
} from "./messages/messages";
import { DEFAULT_LANGUAGE, Language, languages } from "./languages";
import { CommandType } from "./messages/types";

export enum BotState {
	Waiting = "waiting",
	Countdown = "countdown",
	Rendering = "rendering",
}

export default class Bot {
	constructor(private botUserId: string, private channelId: string) {
		this.gameRunner = new GameRunner();
		this.state = BotState.Waiting;
		this.countdownLeft = 0;
		this.language = DEFAULT_LANGUAGE;
	}

	gameRunner: GameRunner;
	state: BotState;
	countdownLeft: number;
	currentParticipantsMessage?: Discord.Message;
	language: Language;

	handleMessage = async (msg: Discord.Message) => {
		if (this.state === BotState.Rendering || msg.channel.type !== "text") {
			return;
		}

		const messageWithoutMentions = msg.content.replace(/<@.*> +/, "");
		const commandWithArgs = parseCommand(this.language, messageWithoutMentions);

		if (commandWithArgs === null) {
			await this.sendTranslatedMessage(msg.channel, "unknownCommand");
		} else {
			await this.executeCommand(msg, commandWithArgs);
		}
	};

	executeCommand = async (
		msg: Discord.Message,
		commandWithArgs: string[]
	): Promise<void> => {
		if (msg.channel.type !== "text") return;
		const commandLabel = commandWithArgs[0];
		const command = findCommandByLabel(this.language, commandLabel);
		if (command === undefined) return;

		switch (command.type) {
			case CommandType.Start: {
				if (this.state === BotState.Waiting) {
					this.gameRunner.initializeGame();
					this.addPlayerToGame(msg.author);
					this.state = BotState.Countdown;
					this.countdownLeft = GAME_COUNTDOWN_SECONDS;
					await this.countdown(msg.channel);
				} else {
					await this.sendTranslatedMessage(msg.channel, "fightAlreadyStarting");
				}
				return;
			}
			case CommandType.Join:
			case CommandType.Bot: {
				switch (this.state) {
					case BotState.Countdown: {
						if (this.gameRunner.getPlayerCount() >= MAX_PLAYER_COUNT) {
							await this.sendTranslatedMessage(msg.channel, "gameIsFull");
							return;
						}

						if (command.type === CommandType.Join) {
							this.addPlayerToGame(msg.author);
						} else {
							this.addBotToGame();
						}

						await this.updatePlayersInGameText(msg.channel);
						return;
					}
					case BotState.Waiting: {
						await this.sendNoGameInProgressText(msg.channel);
						return;
					}
					default: {
						return;
					}
				}
			}
			case CommandType.Class: {
				const possibleClass = commandWithArgs[1];
				const newPlayerClass = Object.entries(
					command.playerClassTranslations
				).find(([_playerClass, label]) => label === possibleClass)?.[0];

				if (newPlayerClass !== undefined) {
					this.gameRunner.setPlayerClass(
						msg.author.id,
						newPlayerClass as PlayerClass
					);
					await this.sendTranslatedMessage(
						msg.channel,
						"classSelected",
						msg.author.username,
						newPlayerClass
					);
				} else {
					await this.sendTranslatedMessage(msg.channel, "selectableClasses");
				}
				return;
			}
			case CommandType.Info: {
				await this.sendMessage(
					msg.channel,
					getAcceptedCommandsForLanguage(this.language)
				);
				return;
			}
			case CommandType.Language: {
				if (!messageWasSentByGuildOwner(msg)) {
					await this.sendTranslatedMessage(
						msg.channel,
						"onlyOwnerCanChangeLanguage"
					);
					return;
				}

				const possibleLanguage = commandWithArgs[1];
				if (Object.keys(languages).includes(possibleLanguage)) {
					this.language = possibleLanguage as Language;
					await this.sendTranslatedMessage(msg.channel, "languageChanged");
				} else {
					await this.sendTranslatedMessage(msg.channel, "selectableLanguages");
				}

				return;
			}
		}
	};

	addPlayerToGame = (user: Discord.User) => {
		if (this.gameRunner.playerInGame(user.id)) return;

		const avatarURL = user.displayAvatarURL({
			format: "png",
			size: 128,
		});

		this.gameRunner.addPlayer({
			avatarURL,
			name: user.username,
			id: user.id,
		});
	};

	addBotToGame = () => {
		const { playerClass, ...botPlayer } = createNewBotPlayer();
		this.gameRunner.addPlayer(botPlayer);
		this.gameRunner.setPlayerClass(botPlayer.id, playerClass);
	};

	countdown = async (channel: Discord.TextChannel) => {
		if (this.countdownLeft === 0) {
			this.runGame(channel);
			return;
		}
		if (this.countdownLeft % 10 === 0 || this.countdownLeft === 5) {
			await this.sendTranslatedMessage(
				channel,
				"fightStartsIn",
				this.countdownLeft
			);
		}
		this.countdownLeft -= 1;
		setTimeout(() => this.countdown(channel), 1000);
	};

	runGame = async (channel: Discord.TextChannel) => {
		await this.deleteBotMessages(channel);

		if (this.gameRunner.getPlayerCount() <= 1) {
			await this.sendTranslatedMessage(channel, "notEnoughPlayers");
		} else {
			this.state = BotState.Rendering;
			const gameStartMessage = await this.sendTranslatedMessage(
				channel,
				"fightStarting",
				this.gameRunner.getCurrentPlayersWithClasses()
			);

			const inputDirectory = `${INPUT_FILE_DIRECTORY}/${this.channelId}`;
			const outputDirectory = `${RENDER_DIRECTORY}/${this.channelId}`;

			const gameEndData = await this.gameRunner.runGame(
				inputDirectory,
				outputDirectory,
				this.language
			);

			await this.deleteSingleMessage(gameStartMessage);

			if (gameEndData === null) return;

			const gameEndText = constructGameEndText(this.language, gameEndData);
			try {
				await channel.send(gameEndText, {
					files: [`./${outputDirectory}/${RENDER_FILE_NAME}.mp4`],
				});
			} catch (error) {
				console.error(`Error when posting fight:\n${error}`);
			}
		}
		await this.sendTranslatedMessage(channel, "startNewFight");
		this.state = BotState.Waiting;
	};

	sendTranslatedMessage = async <M extends keyof MessageFunctions>(
		channel: Discord.TextChannel,
		messageFunctionKey: M,
		...messageFunctionParameters: Parameters<MessageFunctions[M]>
	) =>
		await this.sendMessage(
			channel,
			(messagesByLanguage[this.language][messageFunctionKey] as any)(
				...messageFunctionParameters
			)
		);

	sendMessage = async (channel: Discord.TextChannel, message: string) => {
		try {
			return await channel.send(message);
		} catch (error) {
			console.error(`Error when sending message: ${message}\n${error}`);
		}
	};

	updatePlayersInGameText = async (channel: Discord.TextChannel) => {
		await this.deleteSingleMessage(this.currentParticipantsMessage);

		this.currentParticipantsMessage = await this.sendMessage(
			channel,
			`${messagesByLanguage[this.language].playersInFight(
				this.gameRunner.getCurrentPlayersWithClasses()
			)}\n\n${messagesByLanguage[this.language].changeClassWith()}`
		);
	};

	sendNoGameInProgressText = async (channel: Discord.TextChannel) =>
		await this.sendMessage(
			channel,
			`${messagesByLanguage[
				this.language
			].noFightInProgress()} ${messagesByLanguage[
				this.language
			].startNewFight()}`
		);

	deleteSingleMessage = async (message: Discord.Message | undefined) => {
		if (message === undefined || !message.deletable) return;

		try {
			return await message.delete();
		} catch (error) {
			console.error(
				`Error when deleting message: ${message.content}\n${error}`
			);
		}
	};

	deleteBotMessages = async (channel: Discord.TextChannel) => {
		startTimer("Fetching messages");
		const messages = await channel.messages.fetch({ limit: 100 });
		logTimer("Fetching messages");
		const messagesToDelete = messages.filter((message) => {
			return (
				message.author.id === this.botUserId ||
				messageMentionsBot(message, this.botUserId)
			);
		});
		startTimer("Deleting messages");
		try {
			await channel.bulkDelete(messagesToDelete, true);
		} catch (error) {
			console.error(error);
		}
		logTimer("Deleting messages");
	};
}
