"""Best-effort computer-vision state extraction from a captured game frame.

There is no public API for Brawl Stars game state, so the only source of
truth for a real deployment is pixels: health bars, ammo pips, etc. This
module provides generic, calibratable primitives (colored-bar fill fraction)
rather than a finished detector, because exact pixel coordinates depend on
your device resolution, UI scale and game version. You will need to sample a
few real screenshots and adjust `HealthBarROI` values for your setup — see
README.md "Real-device setup".
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass
class HealthBarROI:
    """Pixel region of a health bar in the *captured* (not resized) frame,
    plus the HSV color range that bar uses when full. PLACEHOLDER VALUES."""
    x0: int
    y0: int
    x1: int
    y1: int
    hsv_low: tuple[int, int, int] = (35, 80, 80)   # green-ish, tune per game version
    hsv_high: tuple[int, int, int] = (85, 255, 255)


def bar_fill_fraction(frame_rgb: np.ndarray, roi: HealthBarROI) -> float:
    """Estimate how "full" a colored bar is by the fraction of matching-color
    pixels along its width. Returns a value in [0, 1]; 0 if the ROI is empty
    or out of bounds (e.g. the bar disappeared because the unit died)."""
    import cv2

    crop = frame_rgb[roi.y0:roi.y1, roi.x0:roi.x1]
    if crop.size == 0:
        return 0.0
    hsv = cv2.cvtColor(crop, cv2.COLOR_RGB2HSV)
    mask = cv2.inRange(hsv, np.array(roi.hsv_low), np.array(roi.hsv_high))
    # take the widest contiguous filled run from the left edge, which is how
    # depleting bars actually render (rather than raw pixel-count ratio).
    col_has_color = mask.any(axis=0)
    if not col_has_color.any():
        return 0.0
    filled_cols = 0
    for v in col_has_color:
        if v:
            filled_cols += 1
        else:
            break
    return filled_cols / max(len(col_has_color), 1)


@dataclass
class DetectorConfig:
    own_hp_bar: HealthBarROI
    enemy_hp_bar: HealthBarROI


class StateDetector:
    """Turns a raw captured frame into the same kind of scalar state the
    mock arena tracks internally (hp fractions), so reward can be computed
    for the real environment the same way it is in simulation."""

    def __init__(self, config: DetectorConfig):
        self.config = config
        self._last_own_hp = 1.0
        self._last_enemy_hp = 1.0

    def reset(self):
        self._last_own_hp = 1.0
        self._last_enemy_hp = 1.0

    def read(self, frame_rgb: np.ndarray) -> dict:
        own_hp = bar_fill_fraction(frame_rgb, self.config.own_hp_bar)
        enemy_hp = bar_fill_fraction(frame_rgb, self.config.enemy_hp_bar)
        dmg_dealt = max(0.0, self._last_enemy_hp - enemy_hp)
        dmg_taken = max(0.0, self._last_own_hp - own_hp)
        self._last_own_hp, self._last_enemy_hp = own_hp, enemy_hp
        return {
            "own_hp": own_hp,
            "enemy_hp": enemy_hp,
            "dmg_dealt": dmg_dealt,
            "dmg_taken": dmg_taken,
        }
