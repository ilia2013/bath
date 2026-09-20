"""Gymnasium env for controlling a REAL Brawl Stars instance (emulator or
mirrored phone) via screen capture + ADB touch input.

Unlike env/mock_arena.py this is NOT plug-and-play: it requires calibrating
`RealEnvConfig` (screen region, joystick positions, health-bar ROIs) for your
specific device/resolution/game version, and requires `adb` + a connected
device/emulator. See README.md "Real-device setup" for the calibration
walkthrough.

Responsible use: only point this at practice-mode matches against the game's
own AI bots, or offline/training modes. Do not use it to automate ranked or
any matchmaking mode against real players — that violates Supercell's Terms
of Service and is unfair to the humans on the other side.
"""
from __future__ import annotations

import time
from dataclasses import dataclass

import numpy as np
import gymnasium as gym
from gymnasium import spaces

from .capture import ScreenCapture, CaptureRegion
from .controller import AdbController, ControllerConfig
from .detector import StateDetector, DetectorConfig

IMG_SIZE = 64


@dataclass
class RealEnvConfig:
    capture_region: CaptureRegion
    controller: ControllerConfig
    detector: DetectorConfig
    step_dt: float = 0.15         # seconds between actions
    max_episode_seconds: float = 120.0


class RealBrawlStarsEnv(gym.Env):
    """Same action_space / observation_space shape as MockBrawlArenaEnv, so a
    policy pretrained in simulation can be loaded here directly — expect a
    real sim-to-real gap; plan to fine-tune on real frames rather than
    deploying the sim-trained model unmodified."""

    metadata = {"render_modes": []}

    def __init__(self, config: RealEnvConfig):
        super().__init__()
        self.config = config
        self.capture = ScreenCapture(config.capture_region, out_size=(IMG_SIZE, IMG_SIZE))
        self.controller = AdbController(config.controller)
        self.detector = StateDetector(config.detector)

        self.action_space = spaces.MultiDiscrete([9, 9, 2])
        self.observation_space = spaces.Box(low=0, high=255, shape=(IMG_SIZE, IMG_SIZE, 3), dtype=np.uint8)

        self._episode_start = 0.0

    def reset(self, *, seed=None, options=None):
        super().reset(seed=seed)
        self.detector.reset()
        # NOTE: this does not automatically start a new match. Menu navigation
        # (tapping "Play Again" / selecting practice mode) is highly specific
        # to your UI layout and game version, so it is intentionally left as
        # an explicit step for you to script with self.controller.super_tap(...)
        # (reused here as a generic tap primitive) once you've calibrated
        # those button coordinates for your setup.
        self._episode_start = time.time()
        obs = self.capture.grab()
        return obs, {}

    def step(self, action):
        move_i, shoot_i, use_super = int(action[0]), int(action[1]), int(action[2])

        self.controller.move(move_i)
        if use_super:
            # Many brawlers fire their super via the same aim-drag once
            # charged; a dedicated super button tap can be wired in via
            # self.controller.super_tap((x, y)) if your brawler needs one.
            pass
        self.controller.shoot(shoot_i)

        time.sleep(self.config.step_dt)

        frame = self.capture.grab()
        state = self.detector.read(frame)

        reward = state["dmg_dealt"] * 10.0 - state["dmg_taken"] * 10.0
        terminated = state["own_hp"] <= 0.0 or state["enemy_hp"] <= 0.0
        if state["own_hp"] <= 0.0:
            reward -= 10.0
        if state["enemy_hp"] <= 0.0:
            reward += 10.0

        truncated = (time.time() - self._episode_start) > self.config.max_episode_seconds

        return frame, reward, terminated, truncated, state

    def close(self):
        self.capture.close()
