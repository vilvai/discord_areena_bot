import { loadImage } from "canvas";
import { SCREEN_WIDTH, SIDEBAR_WIDTH, SCREEN_HEIGHT } from "../../constants";
import {
	findRandomAliveTarget,
	calculateVector,
	randomizeAttributes,
} from "./utils";

export type CreateBloodStain = (x: number, y: number, size: number) => void;

export default class BasePlayer {
	constructor(
		x: number,
		y: number,
		createBloodStain: CreateBloodStain,
		name: string
	) {
		this.name = name;
		this.x = x;
		this.y = y;
		this.radius = 16;
		this.chaseSpeed = 0;
		this.knockbackXSpeed = 0;
		this.knockbackYSpeed = 0;
		this.maxSpeed = 3;
		this.acceleration = 0.1;
		this.damage = 5;
		this.maxHealth = 30;
		this.health = this.maxHealth;
		this.meleeRange = this.radius * 1.5;
		this.meleeCooldown = 30;
		this.meleeCooldownLeft = 0;
		this.createBloodStain = createBloodStain;
		randomizeAttributes(this, [
			"maxSpeed",
			"damage",
			"meleeRange",
			"meleeCooldown",
		]);
	}

	avatar?: CanvasImageSource;
	name: string;
	x: number;
	y: number;
	radius: number;
	target?: BasePlayer;
	chaseSpeed: number;
	knockbackXSpeed: number;
	knockbackYSpeed: number;
	maxSpeed: number;
	acceleration: number;
	damage: number;
	maxHealth: number;
	health: number;
	meleeRange: number;
	meleeCooldown: number;
	meleeCooldownLeft: number;
	createBloodStain: CreateBloodStain;

	async loadAvatar(avatarURL: string) {
		const avatar: unknown = await loadImage(avatarURL);
		this.avatar = avatar as CanvasImageSource;
	}

	onHit(
		sourceX: number,
		sourceY: number,
		damage: number,
		_sourcePlayer?: BasePlayer
	) {
		const vector = calculateVector(this.x, this.y, sourceX, sourceY);
		this.knockbackXSpeed -= vector.x * damage;
		this.knockbackYSpeed -= vector.y * damage;
		this.chaseSpeed = 0;
		const size = damage + Math.random() * 4;
		this.createBloodStain(this.x, this.y, size);
		this.health = Math.max(this.health - damage, 0);
	}

	setTarget = (player: BasePlayer) => (this.target = player);

	isDead = () => this.health <= 0;

	update(otherPlayers: BasePlayer[]) {
		this.updateKnockback();

		const alivePlayersLeft = otherPlayers.some((player) => !player.isDead());
		if (!this.isDead() && alivePlayersLeft) this.updateAI(otherPlayers);

		this.constrainIntoArena();
		this.updateBleeding();
	}

	updateAI(otherPlayers: BasePlayer[]) {
		if (!this.target || this.target.isDead()) {
			this.target = findRandomAliveTarget(otherPlayers);
		}
		if (!this.target) return;
		this.moveTowardsTarget();
		this.checkTargetHit();
		this.meleeCooldownLeft -= 1;
	}

	updateKnockback() {
		this.knockbackXSpeed *= 0.85;
		this.knockbackYSpeed *= 0.85;
		if (Math.abs(this.knockbackXSpeed) < 0.1) this.knockbackXSpeed = 0;
		if (Math.abs(this.knockbackYSpeed) < 0.1) this.knockbackYSpeed = 0;
		this.x += this.knockbackXSpeed;
		this.y += this.knockbackYSpeed;
	}

	inMeleeRange() {
		if (!this.target) return;
		const { x: targetX, y: targetY } = this.target;
		const vector = calculateVector(this.x, this.y, targetX, targetY);
		return vector.distance <= this.meleeRange + this.target.radius;
	}

	moveTowardsTarget() {
		if (!this.target) return;
		this.chaseSpeed = Math.min(
			this.maxSpeed,
			this.chaseSpeed + this.acceleration
		);

		if (!this.inMeleeRange()) {
			const { x: targetX, y: targetY } = this.target;
			const vector = calculateVector(this.x, this.y, targetX, targetY);
			this.x += vector.x * this.chaseSpeed;
			this.y += vector.y * this.chaseSpeed;
		}
	}

	checkTargetHit() {
		if (!this.target) return;
		if (this.inMeleeRange()) {
			this.chaseSpeed = 0;
			if (this.meleeCooldownLeft <= 0) {
				this.target.onHit(this.x, this.y, this.damage, this);
				this.target.setTarget(this);
				this.meleeCooldownLeft = this.meleeCooldown;
			}
		}
	}

	constrainIntoArena() {
		this.x = Math.min(
			Math.max(this.x, SIDEBAR_WIDTH + this.radius),
			SCREEN_WIDTH - this.radius
		);
		this.y = Math.min(
			Math.max(this.y, this.radius),
			SCREEN_HEIGHT - this.radius
		);
	}

	isAtEdgeOfArena() {
		return (
			this.x <= SIDEBAR_WIDTH + this.radius ||
			this.x >= SCREEN_WIDTH - this.radius ||
			this.y <= this.radius ||
			this.y >= SCREEN_HEIGHT - this.radius
		);
	}

	updateBleeding() {
		if ((1 - this.health / this.maxHealth) * 0.07 > Math.random()) {
			const size = 6 + Math.random() * 4;
			this.createBloodStain(this.x, this.y, size);
		}
	}

	draw(ctx: CanvasRenderingContext2D) {
		this.drawAvatar(ctx);
	}

	drawAvatar(ctx: CanvasRenderingContext2D) {
		if (!this.avatar) return;
		ctx.save();
		ctx.beginPath();
		ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
		ctx.clip();
		ctx.drawImage(
			this.avatar,
			this.x - this.radius,
			this.y - this.radius,
			this.radius * 2,
			this.radius * 2
		);
		if (this.isDead()) {
			ctx.fillStyle = "rgba(255,0,0,0.5)";
			ctx.fillRect(
				this.x - this.radius,
				this.y - this.radius,
				this.radius * 2,
				this.radius * 2
			);
		}
		ctx.restore();
	}

	drawHealthbar(ctx: CanvasRenderingContext2D) {
		const healthPercent = this.health / this.maxHealth;
		const healthBarY = 4;
		const healthBarWidth = 36;
		const healthBarHeight = 5;
		ctx.fillStyle = "#A00002";
		ctx.fillRect(
			this.x - healthBarWidth / 2,
			this.y - healthBarY - this.radius - healthBarHeight,
			healthBarWidth,
			healthBarHeight
		);
		ctx.fillStyle = "#00CC0D";
		ctx.fillRect(
			this.x - healthBarWidth / 2,
			this.y - healthBarY - this.radius - healthBarHeight,
			healthBarWidth * healthPercent,
			healthBarHeight
		);
	}
}