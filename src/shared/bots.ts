import { PlayerClass, PlayerData } from "./types";

export const createUniqueBotPlayers = (
	numberOfBotPlayers: number
): PlayerData[] => {
	const players = [];
	let avatarPool = [...randomPlayerAvatarURLs];
	let namePool = [...randomPlayerNames];

	for (let i = 0; i < numberOfBotPlayers; i++) {
		const randomName = botifyName(getRandomItem(namePool));
		const randomAvatar = getRandomItem(avatarPool);
		namePool = namePool.filter((name) => name !== randomName);
		avatarPool = avatarPool.filter((avatar) => avatar !== randomAvatar);
		players.push({
			name: randomName,
			playerClass: getRandomItem(Object.values(PlayerClass)),
			avatarURL: randomAvatar,
			id: generateRandomId(),
		});
	}

	return players;
};

const botifyName = (name: string) => `${name}(BOT)`;

export const createNewBotPlayer = (): PlayerData => ({
	name: botifyName(getRandomItem(randomPlayerNames)),
	playerClass: getRandomItem(Object.values(PlayerClass)),
	avatarURL: getRandomItem(randomPlayerAvatarURLs),
	id: generateRandomId(),
});

const generateRandomId = () => Math.random().toString().slice(2, 10);

const getRandomItem = <I>(items: I[]): I =>
	items[Math.floor(Math.random() * items.length)];

const randomPlayerNames = [
	"Aardwolf",
	"AbracMucid",
	"Ballyhoo",
	"Biltong",
	"Blatherskite",
	"Bourasque",
	"Bumpkin",
	"Catechectics",
	"Chimichanga",
	"Clapboard",
	"Equinox",
	"Glomerate",
	"Gumshoe",
	"Kyjb70Grog",
	"Lollapalooza",
	"Macaronic",
	"Miffedlien96",
	"Morassyobg",
	"Nincompoop",
	"Piddling",
	"Pollywog",
	"Sassafras",
	"Sousaphone",
	"Spodogenous",
	"Succubus",
	"Svengali",
	"Threptic",
	"Umpteenth",
	"Whorlking420",
	"Wishywashy",
	"YamorMammee",
];

const randomPlayerAvatarURLs = [
	"https://i.imgur.com/icWfRgb.png",
	"https://i.imgur.com/dusE0NZ.jpg",
	"https://i.imgur.com/hhtLmPS.png",
	"https://i.imgur.com/5V79CO5.jpg",
	"https://i.imgur.com/UkoIXoT.png",
	"https://i.imgur.com/tkzd4lr.png",
	"https://i.imgur.com/vgU5h3y.jpg",
	"https://i.imgur.com/vD1ANJZ.jpg",
	"https://i.imgur.com/rBleq5U.png",
	"https://i.imgur.com/M2BmdGT.png",
	"https://i.imgur.com/O7yE9Pr.png",
	"https://i.imgur.com/W5kBNQK.png",
	"https://i.imgur.com/nMT0sS2.jpg",
	"https://i.imgur.com/Aake5He.jpg",
	"https://i.imgur.com/GAsvHsm.png",
];
