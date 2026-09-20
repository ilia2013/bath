"""ADB-based touch controller for a real Android device/emulator.

Brawl Stars uses two virtual joysticks: a left one for movement (drag & hold)
and a right one for aim+shoot (drag & release fires in that direction). This
module drives them with `adb shell input touchscreen swipe`, which is coarse
(each call is a single discrete drag, there's no true "hold" primitive without
raw `sendevent` multitouch, which is device-node-specific and out of scope
here) but good enough to translate the RL agent's MultiDiscrete action into
game input.

Every coordinate below (joystick centers, radius) is a placeholder and MUST
be recalibrated for your device/resolution/window layout — see
README.md "Real-device setup".
"""
from __future__ import annotations

import subprocess
from dataclasses import dataclass

import numpy as np

# 0 = none/stay, 1..8 = 8 compass directions, matching env/mock_arena.py _DIRS
_DIRS = np.array(
    [
        [0.0, 0.0],
        [0.0, 1.0], [0.7071, 0.7071], [1.0, 0.0], [0.7071, -0.7071],
        [0.0, -1.0], [-0.7071, -0.7071], [-1.0, 0.0], [-0.7071, 0.7071],
    ]
)


@dataclass
class JoystickCalibration:
    """Screen-pixel calibration for one virtual joystick. PLACEHOLDER VALUES —
    measure these on your own device/emulator window before real use."""
    center_x: int
    center_y: int
    radius_px: int = 120


@dataclass
class ControllerConfig:
    adb_serial: str | None = None  # None = default/only connected device
    move_joystick: JoystickCalibration = None
    aim_joystick: JoystickCalibration = None
    swipe_duration_ms: int = 80


class AdbController:
    """Sends touch input to a device via `adb shell input`. Requires Android
    platform-tools' `adb` binary on PATH and a device/emulator already
    connected (`adb devices`)."""

    def __init__(self, config: ControllerConfig):
        self.config = config
        self._check_adb()

    def _adb_prefix(self):
        prefix = ["adb"]
        if self.config.adb_serial:
            prefix += ["-s", self.config.adb_serial]
        return prefix

    def _check_adb(self):
        try:
            subprocess.run(
                self._adb_prefix() + ["get-state"],
                check=True, capture_output=True, timeout=5,
            )
        except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
            raise RuntimeError(
                "adb is not available or no device is connected. Install Android "
                "platform-tools and run `adb devices` to confirm a device/emulator "
                "is attached before using AdbController."
            ) from e

    def _swipe(self, x1, y1, x2, y2, duration_ms=None):
        duration_ms = duration_ms or self.config.swipe_duration_ms
        subprocess.run(
            self._adb_prefix() + [
                "shell", "input", "touchscreen", "swipe",
                str(int(x1)), str(int(y1)), str(int(x2)), str(int(y2)), str(duration_ms),
            ],
            check=False, capture_output=True,
        )

    def move(self, dir_index: int):
        """Drag the movement joystick toward the given compass direction (0 = release/stay)."""
        js = self.config.move_joystick
        vec = _DIRS[dir_index]
        if dir_index == 0:
            self._swipe(js.center_x, js.center_y, js.center_x, js.center_y)
            return
        target_x = js.center_x + vec[0] * js.radius_px
        target_y = js.center_y - vec[1] * js.radius_px  # screen y grows downward
        self._swipe(js.center_x, js.center_y, target_x, target_y)

    def shoot(self, dir_index: int):
        """Drag-and-release the aim joystick to fire in the given direction (0 = no shot)."""
        if dir_index == 0:
            return
        js = self.config.aim_joystick
        vec = _DIRS[dir_index]
        target_x = js.center_x + vec[0] * js.radius_px
        target_y = js.center_y - vec[1] * js.radius_px
        self._swipe(js.center_x, js.center_y, target_x, target_y, duration_ms=140)

    def super_tap(self, super_button_xy: tuple[int, int]):
        """Some brawlers require a dedicated super button tap rather than an
        empowered aim shot; kept as a separate primitive."""
        x, y = super_button_xy
        subprocess.run(
            self._adb_prefix() + ["shell", "input", "tap", str(x), str(y)],
            check=False, capture_output=True,
        )
