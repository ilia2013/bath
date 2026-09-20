"""Self-play PPO training loop for the mock Brawl-Stars-like arena.

Usage:
    python3 -m brawl_ai.train --timesteps 200000 --n-envs 8

This trains entirely against the built-in simulated arena (env/mock_arena.py)
plus a growing pool of frozen snapshots of itself (self-play). No real game,
device, or emulator is involved or required for this script.
"""
from __future__ import annotations

import argparse
from pathlib import Path

from stable_baselines3 import PPO
from stable_baselines3.common.callbacks import CheckpointCallback
from stable_baselines3.common.env_util import make_vec_env
from stable_baselines3.common.monitor import Monitor

from brawl_ai.env import MockBrawlArenaEnv, OpponentPool, CurriculumOpponentEnv


def make_env_fn(checkpoint_dir: Path, resample_every: int):
    def _init():
        base = MockBrawlArenaEnv()
        pool = OpponentPool(checkpoint_dir)
        wrapped = CurriculumOpponentEnv(base, pool, resample_every=resample_every)
        return Monitor(wrapped)

    return _init


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--timesteps", type=int, default=200_000)
    parser.add_argument("--n-envs", type=int, default=4)
    parser.add_argument("--checkpoint-dir", type=str, default="brawl_ai/checkpoints")
    parser.add_argument("--save-freq", type=int, default=20_000, help="env steps between checkpoints (divided across n-envs)")
    parser.add_argument("--resample-every", type=int, default=20, help="episodes between opponent resampling")
    parser.add_argument("--out", type=str, default="brawl_ai/checkpoints/ppo_brawl_final.zip")
    parser.add_argument("--tensorboard-log", type=str, default=None)
    args = parser.parse_args()

    checkpoint_dir = Path(args.checkpoint_dir)
    checkpoint_dir.mkdir(parents=True, exist_ok=True)

    venv = make_vec_env(
        make_env_fn(checkpoint_dir, args.resample_every),
        n_envs=args.n_envs,
    )

    model = PPO(
        "CnnPolicy",
        venv,
        verbose=1,
        n_steps=256,
        batch_size=256,
        learning_rate=2.5e-4,
        gamma=0.99,
        ent_coef=0.01,
        tensorboard_log=args.tensorboard_log,
    )

    checkpoint_cb = CheckpointCallback(
        save_freq=max(args.save_freq // args.n_envs, 1),
        save_path=str(checkpoint_dir),
        name_prefix="ppo_brawl",
    )

    model.learn(total_timesteps=args.timesteps, callback=checkpoint_cb, progress_bar=False)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    model.save(str(out_path))
    print(f"Saved final model to {out_path}")


if __name__ == "__main__":
    main()
