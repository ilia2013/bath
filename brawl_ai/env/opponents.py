"""Opponent strategies for MockBrawlArenaEnv.

- ScriptedBot: a simple heuristic (chase, kite, shoot on sightline, pop super
  when charged) used to bootstrap training before any learned policy exists.
- FrozenPolicyOpponent: wraps a previously-saved PPO checkpoint and plays it
  as a fixed (non-learning) opponent. Sampling from a pool of these across
  training is what makes this "self-play": the agent trains against snapshots
  of its own past skill level, an increasingly strong curriculum.
"""
from __future__ import annotations

import random
from pathlib import Path

import gymnasium as gym
import numpy as np

from .mock_arena import WORLD_SIZE, _DIRS  # noqa: F401 (reuse direction table)


def _vec_to_dir_index(vec: np.ndarray) -> int:
    norm = np.linalg.norm(vec)
    if norm < 1e-6:
        return 0
    v = vec / norm
    # _DIRS[1:] are the 8 compass unit vectors; pick the closest by dot product.
    dots = _DIRS[1:] @ v
    return int(np.argmax(dots)) + 1


class ScriptedBot:
    """Deterministic heuristic opponent: closes distance to mid-range, backs
    off if too close, shoots whenever roughly facing the target, and fires
    its super the instant it's charged."""

    PREFERRED_RANGE = 6.0
    SHOOT_RANGE = 9.0

    def reset(self):
        pass

    def act(self, env, perspective: str):
        self_agent = env.opponent if perspective == "opponent" else env.hero
        target_agent = env.hero if perspective == "opponent" else env.opponent

        to_target = target_agent.pos - self_agent.pos
        dist = float(np.linalg.norm(to_target))

        if dist > self.PREFERRED_RANGE:
            move_vec = to_target  # close in
        elif dist < self.PREFERRED_RANGE * 0.5:
            move_vec = -to_target  # kite away
        else:
            # strafe
            perp = np.array([-to_target[1], to_target[0]])
            move_vec = perp

        move_i = _vec_to_dir_index(move_vec)
        shoot_i = _vec_to_dir_index(to_target) if dist <= self.SHOOT_RANGE else 0
        use_super = 1 if self_agent.super_charge >= 100.0 else 0

        return (move_i, shoot_i, use_super)


class RandomBot:
    """Pure random actions — useful as a cheap diversity opponent to avoid
    the learned policy over-fitting to one style of play."""

    def reset(self):
        pass

    def act(self, env, perspective: str):
        return (random.randint(0, 8), random.randint(0, 8), random.randint(0, 1))


class FrozenPolicyOpponent:
    """Plays a frozen (non-training) copy of a saved stable-baselines3 model."""

    def __init__(self, model_path: str | Path):
        from stable_baselines3 import PPO  # local import: keep sb3 optional for capture/controller-only use

        self.model = PPO.load(str(model_path), device="cpu")

    def reset(self):
        pass

    def act(self, env, perspective: str):
        obs = env.render_for(perspective)
        action, _ = self.model.predict(obs, deterministic=False)
        return tuple(int(a) for a in action)


class OpponentPool:
    """Samples an opponent strategy for each new episode: a mix of the
    scripted bootstrap bot and frozen snapshots of the agent's own past
    checkpoints, with the mix shifting toward self-play as checkpoints
    accumulate (curriculum)."""

    def __init__(self, checkpoint_dir: str | Path, scripted_prob_floor: float = 0.15, max_pool: int = 8):
        self.checkpoint_dir = Path(checkpoint_dir)
        self.checkpoint_dir.mkdir(parents=True, exist_ok=True)
        self.scripted_prob_floor = scripted_prob_floor
        self.max_pool = max_pool
        self._scripted = ScriptedBot()

    def _checkpoints(self):
        files = sorted(self.checkpoint_dir.glob("*.zip"), key=lambda p: p.stat().st_mtime)
        return files[-self.max_pool:]

    def sample(self):
        ckpts = self._checkpoints()
        if not ckpts or random.random() < self.scripted_prob_floor:
            return self._scripted
        choice = random.choice(ckpts)
        try:
            return FrozenPolicyOpponent(choice)
        except Exception:
            return self._scripted


class CurriculumOpponentEnv(gym.Wrapper):
    """gym.Wrapper that periodically resamples the opponent strategy from an
    OpponentPool (loading a model checkpoint from disk every single episode
    would be wasteful, so we only resample every `resample_every` episodes)."""

    def __init__(self, env, pool: OpponentPool, resample_every: int = 20):
        super().__init__(env)
        self.pool = pool
        self.resample_every = resample_every
        self._episode_count = 0
        self.env.set_opponent(self.pool.sample())

    def reset(self, **kwargs):
        if self._episode_count % self.resample_every == 0:
            self.env.set_opponent(self.pool.sample())
        self._episode_count += 1
        return self.env.reset(**kwargs)

    def step(self, action):
        return self.env.step(action)
