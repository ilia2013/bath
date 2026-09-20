"""A lightweight, fully self-contained 2D top-down combat arena that mimics the
core mechanics of a Brawl Stars 1v1 (movement, aiming/shooting, ammo, walls,
super charge, health). It exists so the RL pipeline (env -> policy -> PPO ->
self-play) can be built, tested and trained end-to-end without needing the
real game, a phone, or an emulator.

The observation is a small rasterized RGB image, so the same CNN policy
architecture used here transfers directly to real screen-capture frames
later (see env/brawl_env.py backend="real").
"""
from __future__ import annotations

import numpy as np
import gymnasium as gym
from gymnasium import spaces

# ---- World / balance constants -------------------------------------------------
WORLD_SIZE = 20.0          # arena is WORLD_SIZE x WORLD_SIZE units
IMG_SIZE = 64               # rasterized observation resolution
MAX_STEPS = 400
MOVE_SPEED = 0.55
PROJECTILE_SPEED = 2.2
PROJECTILE_LIFE = 12         # steps before a shot despawns
PROJECTILE_RADIUS = 0.5
HIT_RADIUS = 0.7            # agent collision radius for projectiles
MAX_HP = 100.0
BASE_DAMAGE = 9.0
SUPER_DAMAGE = 26.0
MAX_AMMO = 3
SHOOT_COOLDOWN_STEPS = 3
AMMO_REGEN_STEPS = 25
SUPER_CHARGE_PER_HIT = 34.0  # % charge gained per successful hit dealt
SUPER_MAX_CHARGE = 100.0

# 0 = none/stay, 1..8 = 8 compass directions, clockwise from North
_DIRS = np.array(
    [
        [0.0, 0.0],
        [0.0, 1.0], [0.7071, 0.7071], [1.0, 0.0], [0.7071, -0.7071],
        [0.0, -1.0], [-0.7071, -0.7071], [-1.0, 0.0], [-0.7071, 0.7071],
    ],
    dtype=np.float32,
)

# A small symmetric set of cover walls, roughly evoking a Brawl Stars map.
WALLS = [
    (8.5, 8.5, 11.5, 11.5),   # center block
    (2.0, 14.0, 5.0, 15.0),
    (15.0, 5.0, 18.0, 6.0),
    (2.0, 5.0, 3.0, 8.0),
    (17.0, 12.0, 18.0, 15.0),
]


def _rect_contains(rect, x, y):
    x0, y0, x1, y1 = rect
    return x0 <= x <= x1 and y0 <= y <= y1


def _blocked(x, y):
    if not (0.0 <= x <= WORLD_SIZE and 0.0 <= y <= WORLD_SIZE):
        return True
    for rect in WALLS:
        if _rect_contains(rect, x, y):
            return True
    return False


class _Agent:
    __slots__ = ("pos", "hp", "ammo", "shoot_cd", "ammo_regen_cd", "super_charge")

    def __init__(self, pos):
        self.pos = np.array(pos, dtype=np.float32)
        self.hp = MAX_HP
        self.ammo = MAX_AMMO
        self.shoot_cd = 0
        self.ammo_regen_cd = AMMO_REGEN_STEPS
        self.super_charge = 0.0

    @property
    def alive(self):
        return self.hp > 0.0


class _Projectile:
    __slots__ = ("pos", "vel", "owner", "life", "damage")

    def __init__(self, pos, vel, owner, damage):
        self.pos = np.array(pos, dtype=np.float32)
        self.vel = np.array(vel, dtype=np.float32)
        self.owner = owner  # "hero" or "opponent"
        self.life = PROJECTILE_LIFE
        self.damage = damage


class MockBrawlArenaEnv(gym.Env):
    """Single-agent Gymnasium env: controls `hero`, the `opponent` is driven by
    a pluggable strategy object (scripted bot or a frozen self-play checkpoint)
    so the env exposes the standard single-agent interface PPO expects."""

    metadata = {"render_modes": ["rgb_array"]}

    def __init__(self, opponent=None, max_steps: int = MAX_STEPS):
        super().__init__()
        self.opponent_strategy = opponent
        self.max_steps = max_steps

        self.action_space = spaces.MultiDiscrete([9, 9, 2])  # move, shoot, super
        self.observation_space = spaces.Box(
            low=0, high=255, shape=(IMG_SIZE, IMG_SIZE, 3), dtype=np.uint8
        )

        self.hero: _Agent | None = None
        self.opponent: _Agent | None = None
        self.projectiles: list[_Projectile] = []
        self.steps = 0
        self._rng = np.random.default_rng()

    def set_opponent(self, strategy):
        """Swap the opponent strategy (used by the self-play curriculum)."""
        self.opponent_strategy = strategy

    # ------------------------------------------------------------------ reset
    def reset(self, *, seed=None, options=None):
        super().reset(seed=seed)
        if seed is not None:
            self._rng = np.random.default_rng(seed)

        self.hero = _Agent(self._random_spawn(corner="bl"))
        self.opponent = _Agent(self._random_spawn(corner="tr"))
        self.projectiles = []
        self.steps = 0

        if self.opponent_strategy is not None and hasattr(self.opponent_strategy, "reset"):
            self.opponent_strategy.reset()

        return self._render(), self._info()

    def _random_spawn(self, corner: str):
        for _ in range(50):
            if corner == "bl":
                x = self._rng.uniform(1.0, 6.0)
                y = self._rng.uniform(1.0, 6.0)
            else:
                x = self._rng.uniform(WORLD_SIZE - 6.0, WORLD_SIZE - 1.0)
                y = self._rng.uniform(WORLD_SIZE - 6.0, WORLD_SIZE - 1.0)
            if not _blocked(x, y):
                return (x, y)
        return (1.0, 1.0) if corner == "bl" else (WORLD_SIZE - 1.0, WORLD_SIZE - 1.0)

    # ------------------------------------------------------------------- step
    def step(self, action):
        self.steps += 1
        move_i, shoot_i, use_super = int(action[0]), int(action[1]), int(action[2])

        opp_action = self._opponent_action()

        dmg_dealt = self._apply_agent_action(self.hero, "hero", move_i, shoot_i, use_super)
        dmg_taken = self._apply_agent_action(
            self.opponent, "opponent", opp_action[0], opp_action[1], opp_action[2]
        )

        self._advance_projectiles()

        # Resolve projectile hits after both agents moved/shot this tick.
        hit_on_opponent = self._resolve_hits(target=self.opponent, target_name="opponent")
        hit_on_hero = self._resolve_hits(target=self.hero, target_name="hero")

        reward = 0.0
        reward += hit_on_opponent * 0.10
        reward -= hit_on_hero * 0.10
        reward -= 0.002  # small time pressure so the agent seeks the fight

        terminated = False
        if not self.opponent.alive:
            reward += 10.0
            terminated = True
        if not self.hero.alive:
            reward -= 10.0
            terminated = True

        truncated = self.steps >= self.max_steps

        return self._render(), reward, terminated, truncated, self._info()

    def _opponent_action(self):
        if self.opponent_strategy is None:
            return (0, 0, 0)
        return self.opponent_strategy.act(self, perspective="opponent")

    def _apply_agent_action(self, agent: _Agent, name: str, move_i: int, shoot_i: int, use_super: int) -> float:
        if not agent.alive:
            return 0.0

        # movement, blocked by walls/bounds on a per-axis basis
        d = _DIRS[move_i] * MOVE_SPEED
        nx, ny = agent.pos[0] + d[0], agent.pos[1]
        if not _blocked(nx, ny):
            agent.pos[0] = nx
        nx, ny = agent.pos[0], agent.pos[1] + d[1]
        if not _blocked(nx, ny):
            agent.pos[1] = ny

        # cooldowns
        if agent.shoot_cd > 0:
            agent.shoot_cd -= 1
        if agent.ammo < MAX_AMMO:
            agent.ammo_regen_cd -= 1
            if agent.ammo_regen_cd <= 0:
                agent.ammo += 1
                agent.ammo_regen_cd = AMMO_REGEN_STEPS

        fired_damage = 0.0
        if shoot_i != 0 and agent.shoot_cd <= 0 and agent.ammo > 0:
            direction = _DIRS[shoot_i]
            self.projectiles.append(
                _Projectile(agent.pos, direction * PROJECTILE_SPEED, name, BASE_DAMAGE)
            )
            agent.ammo -= 1
            agent.shoot_cd = SHOOT_COOLDOWN_STEPS

        if use_super and agent.super_charge >= SUPER_MAX_CHARGE and shoot_i != 0:
            direction = _DIRS[shoot_i]
            self.projectiles.append(
                _Projectile(agent.pos, direction * PROJECTILE_SPEED * 1.3, name, SUPER_DAMAGE)
            )
            agent.super_charge = 0.0

        return fired_damage  # actual damage credited on hit, see _resolve_hits

    def _advance_projectiles(self):
        alive_proj = []
        for p in self.projectiles:
            p.pos += p.vel
            p.life -= 1
            if p.life <= 0:
                continue
            if _blocked(p.pos[0], p.pos[1]) and any(
                _rect_contains(r, p.pos[0], p.pos[1]) for r in WALLS
            ):
                continue  # absorbed by a wall
            if not (0.0 <= p.pos[0] <= WORLD_SIZE and 0.0 <= p.pos[1] <= WORLD_SIZE):
                continue
            alive_proj.append(p)
        self.projectiles = alive_proj

    def _resolve_hits(self, target: _Agent, target_name: str) -> float:
        if not target.alive:
            return 0.0
        owner_name = "opponent" if target_name == "hero" else "hero"
        shooter = self.opponent if owner_name == "opponent" else self.hero
        total_dealt = 0.0
        remaining = []
        for p in self.projectiles:
            if p.owner != owner_name:
                remaining.append(p)
                continue
            if np.linalg.norm(p.pos - target.pos) <= HIT_RADIUS:
                target.hp = max(0.0, target.hp - p.damage)
                shooter.super_charge = min(SUPER_MAX_CHARGE, shooter.super_charge + SUPER_CHARGE_PER_HIT)
                total_dealt += p.damage
                continue  # projectile consumed
            remaining.append(p)
        self.projectiles = remaining
        return total_dealt

    # ----------------------------------------------------------------- render
    def _render(self) -> np.ndarray:
        return self.render_for("hero")

    def render_for(self, perspective: str) -> np.ndarray:
        """Rasterize the arena with `perspective`'s agent drawn as the
        controllable "self" (blue) and the other as "enemy" (red). This lets a
        single trained policy control either side symmetrically, which is
        what makes self-play (playing frozen copies of itself) possible."""
        img = np.zeros((IMG_SIZE, IMG_SIZE, 3), dtype=np.uint8)
        img[:, :] = (18, 18, 24)  # background

        scale = IMG_SIZE / WORLD_SIZE

        def to_px(pos):
            return int(pos[0] * scale), int(IMG_SIZE - 1 - pos[1] * scale)

        for (x0, y0, x1, y1) in WALLS:
            px0, py1 = to_px((x0, y0))
            px1, py0 = to_px((x1, y1))
            img[max(py0, 0):min(py1, IMG_SIZE), max(px0, 0):min(px1, IMG_SIZE)] = (90, 90, 100)

        def draw_dot(pos, color, radius_px=2):
            cx, cy = to_px(pos)
            x0, x1 = max(cx - radius_px, 0), min(cx + radius_px + 1, IMG_SIZE)
            y0, y1 = max(cy - radius_px, 0), min(cy + radius_px + 1, IMG_SIZE)
            img[y0:y1, x0:x1] = color

        self_agent, enemy_agent = (self.hero, self.opponent) if perspective == "hero" else (self.opponent, self.hero)
        self_name = perspective
        for p in self.projectiles:
            color = (255, 220, 60) if p.owner == self_name else (255, 120, 60)
            draw_dot(p.pos, color, radius_px=1)

        if enemy_agent.alive:
            draw_dot(enemy_agent.pos, (235, 60, 70), radius_px=3)
        if self_agent.alive:
            draw_dot(self_agent.pos, (60, 140, 255), radius_px=3)

        return img

    def _info(self):
        return {
            "hero_hp": None if self.hero is None else float(self.hero.hp),
            "opponent_hp": None if self.opponent is None else float(self.opponent.hp),
            "steps": self.steps,
        }
