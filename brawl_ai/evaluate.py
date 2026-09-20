"""Evaluate a trained (or random) policy against the scripted bot over N
episodes and report win rate / average reward — used both as a sanity check
during development and to track training progress over time.

Usage:
    python3 -m brawl_ai.evaluate --model brawl_ai/checkpoints/ppo_brawl_final.zip --episodes 50
    python3 -m brawl_ai.evaluate --episodes 20   # no --model => random policy baseline
"""
from __future__ import annotations

import argparse

import numpy as np

from brawl_ai.env import MockBrawlArenaEnv, ScriptedBot


def evaluate(model_path: str | None, episodes: int, deterministic: bool = True):
    env = MockBrawlArenaEnv(opponent=ScriptedBot())

    model = None
    if model_path:
        from stable_baselines3 import PPO
        model = PPO.load(model_path, device="cpu")

    wins, losses, draws = 0, 0, 0
    rewards = []

    for ep in range(episodes):
        obs, _info = env.reset()
        done = False
        ep_reward = 0.0
        while not done:
            if model is not None:
                action, _ = model.predict(obs, deterministic=deterministic)
            else:
                action = env.action_space.sample()
            obs, reward, terminated, truncated, info = env.step(action)
            ep_reward += reward
            done = terminated or truncated

        rewards.append(ep_reward)
        if info["hero_hp"] <= 0 and info["opponent_hp"] > 0:
            losses += 1
        elif info["opponent_hp"] <= 0 and info["hero_hp"] > 0:
            wins += 1
        else:
            draws += 1

    print(f"Episodes: {episodes}")
    print(f"Win rate vs ScriptedBot: {wins / episodes:.1%}  (wins={wins} losses={losses} draws={draws})")
    print(f"Average episode reward: {np.mean(rewards):.3f}  (std={np.std(rewards):.3f})")
    return wins / episodes, float(np.mean(rewards))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", type=str, default=None)
    parser.add_argument("--episodes", type=int, default=30)
    parser.add_argument("--stochastic", action="store_true")
    args = parser.parse_args()
    evaluate(args.model, args.episodes, deterministic=not args.stochastic)


if __name__ == "__main__":
    main()
