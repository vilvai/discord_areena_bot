import type { Message } from "discord.js";

import { GAME_COUNTDOWN_SECONDS, MAX_PLAYER_COUNT } from "../shared/constants";
import Bot, { BotState } from "./Bot";
import { DEFAULT_LANGUAGE } from "./languages";
import { messagesByLanguage } from "./messages/messages";

type MockMessage = Partial<Omit<Message, "channel" | "author" | "valueOf">> & {
	channel: Partial<Omit<Message["channel"], "send" | "valueOf">> & {
		type: Message["channel"]["type"];
		send: jest.Mock;
	};
	author?: Partial<Omit<Message["author"], "displayAvatarURL" | "valueOf">> & {
		displayAvatarURL: () => string;
		username: string;
		id: string;
	};
};

const constructMockMessage = (
	mockMessage: Omit<MockMessage, "channel">
): MockMessage => ({
	channel: {
		type: "text",
		send: jest.fn(),
	},
	...mockMessage,
});

describe("Bot", () => {
	describe("when creating a new bot", () => {
		let bot: Bot;

		beforeEach(() => {
			bot = new Bot("fooUserId", "fooChannelId");
		});

		it("sets the state of the bot to Waiting", () => {
			expect(bot.state).toEqual(BotState.Waiting);
		});

		it("creates a gameRunner for the bot", () => {
			expect(bot.gameRunner).not.toEqual(undefined);
		});

		it("sets the default language", () => {
			expect(bot.language).toEqual(DEFAULT_LANGUAGE);
		});
	});

	describe("handling messages", () => {
		let bot: Bot;
		let mockMessage: MockMessage;

		describe("when handling a message with an unknown command", () => {
			beforeEach(() => {
				bot = new Bot("fooUserId", "fooChannelId");
				bot.language = "suomi";
				mockMessage = constructMockMessage({ content: "foo bar asdf" });
				bot.handleMessage(mockMessage as any);
			});

			it("calls the 'msg.channel.send' function with the unknownCommand text", () => {
				expect(mockMessage.channel.send).toHaveBeenCalledTimes(1);
				expect(mockMessage.channel.send).toHaveBeenCalledWith(
					messagesByLanguage[bot.language].unknownCommand()
				);
			});

			it("doesn't change the bot state", () => {
				expect(bot.state).toEqual(BotState.Waiting);
			});
		});

		describe("when handling a start game command", () => {
			describe("and a game is already starting", () => {
				beforeEach(() => {
					bot = new Bot("fooUserId", "fooChannelId");
					bot.language = "suomi";
					mockMessage = constructMockMessage({ content: "aloita" });
					bot.state = BotState.Countdown;
					bot.handleMessage(mockMessage as any);
				});

				it("sends a message that the game is already starting", () => {
					expect(mockMessage.channel.send).toHaveBeenCalledTimes(1);
					expect(mockMessage.channel.send).toHaveBeenCalledWith(
						messagesByLanguage[bot.language].fightAlreadyStarting()
					);
				});

				it("doesn't change the bot state", () => {
					expect(bot.state).toEqual(BotState.Countdown);
				});
			});

			describe("and the bot is ready to start a game", () => {
				beforeEach(() => {
					bot = new Bot("fooUserId", "fooChannelId");
					bot.language = "suomi";

					mockMessage = constructMockMessage({
						content: "aloita ignored extra words foobar",
						author: {
							username: "someUser",
							id: "someId",
							displayAvatarURL: () => "foo.com/foobar.png",
						},
					});

					bot.countdown = jest.fn();
					bot.gameRunner = {
						initializeGame: jest.fn(),
						addPlayer: jest.fn(),
						playerInGame: () => false,
					} as any;

					bot.handleMessage(mockMessage as any);
				});

				it("initializes a game", () => {
					expect(bot.gameRunner.initializeGame).toHaveBeenCalledTimes(1);
				});

				it("adds a player to the game", () => {
					expect(bot.gameRunner.addPlayer).toHaveBeenCalledTimes(1);
				});

				it("changes the bot state to Countdown", () => {
					expect(bot.state).toEqual(BotState.Countdown);
				});

				it("sets the countdownLeft property", () => {
					expect(bot.countdownLeft).toEqual(GAME_COUNTDOWN_SECONDS);
				});

				it("starts the countdown", () => {
					expect(bot.countdown).toHaveBeenCalledTimes(1);
				});
			});
		});

		describe("when handling a join game command", () => {
			beforeAll(() => {
				mockMessage = constructMockMessage({
					content: "liity ignored extra words foobar",
					author: {
						username: "someUser",
						id: "someId",
						displayAvatarURL: () => "foo.com/foobar.png",
					},
				});
			});

			describe("and there is no game in progress", () => {
				beforeEach(() => {
					bot = new Bot("fooUserId", "fooChannelId");
					bot.language = "suomi";
					bot.sendNoGameInProgressText = jest.fn();
					bot.handleMessage(mockMessage as any);
				});

				it("calls sendNoGameInProgressText", () => {
					expect(bot.sendNoGameInProgressText).toHaveBeenCalledTimes(1);
				});
			});

			describe("and player is already in the game", () => {
				beforeEach(() => {
					bot = new Bot("fooUserId", "fooChannelId");
					bot.language = "suomi";

					bot.gameRunner = {
						addPlayer: jest.fn(),
						playerInGame: () => true,
						getPlayerCount: () => 0,
					} as any;

					bot.state = BotState.Countdown;
					bot.updatePlayersInGameText = jest.fn();
					bot.handleMessage(mockMessage as any);
				});

				it("doesn't add player to the game", () => {
					expect(bot.gameRunner.addPlayer).toHaveBeenCalledTimes(0);
				});

				it("calls updatePlayersInGameText", () => {
					expect(bot.updatePlayersInGameText).toHaveBeenCalledTimes(1);
				});
			});

			describe("and player is not already in the game", () => {
				beforeEach(() => {
					bot = new Bot("fooUserId", "fooChannelId");
					bot.language = "suomi";

					bot.gameRunner = {
						addPlayer: jest.fn(),
						playerInGame: () => false,
						getPlayerCount: () => 0,
					} as any;

					bot.state = BotState.Countdown;
					bot.updatePlayersInGameText = jest.fn();
					bot.handleMessage(mockMessage as any);
				});

				it("adds player to the game", () => {
					expect(bot.gameRunner.addPlayer).toHaveBeenCalledTimes(1);
				});

				it("calls updatePlayersInGameText", () => {
					expect(bot.updatePlayersInGameText).toHaveBeenCalledTimes(1);
				});
			});

			describe("and the game already has max players", () => {
				beforeEach(() => {
					bot = new Bot("fooUserId", "fooChannelId");
					bot.language = "suomi";

					bot.gameRunner = {
						addPlayer: jest.fn(),
						playerInGame: () => false,
						getPlayerCount: () => MAX_PLAYER_COUNT,
					} as any;

					bot.state = BotState.Countdown;
					bot.updatePlayersInGameText = jest.fn();
					bot.handleMessage(mockMessage as any);
				});

				it("doesn't add player to the game", () => {
					expect(bot.gameRunner.addPlayer).toHaveBeenCalledTimes(0);
				});

				it("doesn't call updatePlayersInGameText", () => {
					expect(bot.updatePlayersInGameText).toHaveBeenCalledTimes(0);
				});
			});
		});
	});

	describe("error handling for sending messages", () => {
		let bot: Bot;
		const error = "Sending failed because of some random HTTP issue";
		let originalConsoleError: any;
		const brokenMockChannel = {
			send: () => {
				throw new Error(error);
			},
		};

		beforeAll(() => {
			originalConsoleError = console.error;
			console.error = jest.fn();
		});

		afterAll(() => {
			console.error = originalConsoleError;
		});

		beforeEach(() => {
			bot = new Bot("fooUserId", "fooChannelId");
			bot.sendMessage(brokenMockChannel as any, "Lorem ipsum");
		});

		it("logs the error", () => {
			expect(console.error as jest.Mock).toHaveBeenCalledTimes(1);
			expect(
				(console.error as jest.Mock).mock.calls[0][0].includes(error)
			).toBe(true);
		});
	});

	describe("error handling for rendering video", () => {
		let bot: Bot;
		let channel: MockMessage["channel"];

		beforeEach(() => {
			channel = constructMockMessage({}).channel;
			bot = new Bot("fooUserId", "fooChannelId");
			bot.deleteBotMessages = jest.fn();
			bot.gameRunner = {
				getPlayerCount: () => 2,
				getCurrentPlayersWithClasses: () => [],
				runGame: () => {
					throw new Error("Bam");
				},
			} as any;

			bot.runGame(channel as any);
		});

		it("sets the bot state to Waiting", () => {
			expect(bot.state).toEqual(BotState.Waiting);
		});

		it("sends a message saying the rendering failed", () => {
			expect(channel.send).toHaveBeenCalledWith(
				messagesByLanguage[bot.language].renderingFailed()
			);
		});
	});
});
