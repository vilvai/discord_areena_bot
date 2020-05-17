import Discord from "discord.js";
import fs from "fs";
import { createCanvas } from "canvas";
import ffmpeg from "fluent-ffmpeg";
import { Readable } from "stream";

import { SCREEN_WIDTH, SCREEN_HEIGHT, GAME_FPS } from "../shared/constants";
import { PlayerClass } from "../shared/types";
import Game from "../shared/game/Game";

require("dotenv").config();

const client = new Discord.Client();

client.on("ready", () => {
	console.log(`Logged in as ${client.user.tag}!`);
});

client.on("message", async (msg) => {
	if (msg.author.id === client.user.id) return;
	const avatarURL = msg.author.displayAvatarURL({ format: "png", size: 256 });
	const canvas = createCanvas(SCREEN_WIDTH, SCREEN_HEIGHT);
	const ctx = canvas.getContext("2d");

	const gameData = {
		players: [
			{
				avatarURL,
				class: PlayerClass.Spuge,
			},
			{
				avatarURL:
					"https://cdn.discordapp.com/avatars/160995903182864384/fa07b1a1db14e12a994d67ce32a887c3.png?size=128",
				class: PlayerClass.Teekkari,
			},
			{
				avatarURL:
					"https://cdn.discordapp.com/avatars/162898422892855297/a0a097c92ee1066133a18afaa9515e29.png?size=128",
				class: PlayerClass.Fighter,
			},
			{
				avatarURL:
					"https://cdn.discordapp.com/avatars/160785897149693952/69591f533a458a1a820d709ad491bd3e.png?size=128",
				class: PlayerClass.Chungus,
			},
			{
				avatarURL:
					"https://cdn.discordapp.com/avatars/160115262538907658/0de78ec90612f30c34f3140257f9fef9.png?size=128",
				class: PlayerClass.Assassin,
			},
		],
	};

	const command = ffmpeg();
	const game = new Game(ctx);
	await game.initializeGame(gameData);
	game.draw();

	//const stream = fs.createWriteStream("test.png").write(canvas.toBuffer());
	//const stream = fs.createWriteStream("test.mp4");
	const readable = new Readable();
	readable._read = () => {};
	readable.push(canvas.toBuffer());
	readable.push(null);
	command
		.input(canvas.createPNGStream())
		.format("mp4")
		.fps(1)
		.videoCodec("libx264")
		.size("400x300")
		.save("test.mp4");
	msg.channel.send("", { files: ["test.mp4"] });
});

client.login(process.env.TOKEN);
