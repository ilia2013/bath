"""Screen capture for a real device/emulator running Brawl Stars.

This grabs frames from a fixed screen region (typically an Android emulator
window such as BlueStacks/Waydroid, or a scrcpy mirror of a real phone) via
`mss`. It does NOT read any game memory or network traffic — purely pixels,
exactly like a human looking at the screen.

You must calibrate `region` for your own setup (resolution/window position
differ on every machine); see README.md "Real-device setup".
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass
class CaptureRegion:
    left: int
    top: int
    width: int
    height: int

    def as_mss_dict(self):
        return {"left": self.left, "top": self.top, "width": self.width, "height": self.height}


class ScreenCapture:
    """Thin wrapper around `mss` for grabbing a fixed screen region as an
    RGB numpy array, resized to the env's observation resolution."""

    def __init__(self, region: CaptureRegion, out_size: tuple[int, int] = (64, 64)):
        try:
            import mss  # noqa: F401
        except ImportError as e:  # pragma: no cover
            raise ImportError(
                "The 'mss' package is required for real screen capture. Install it with "
                "`pip install mss`."
            ) from e
        self.region = region
        self.out_size = out_size
        self._sct = None  # lazily created (mss is not fork-safe)

    def _ensure_sct(self):
        if self._sct is None:
            import mss
            self._sct = mss.mss()
        return self._sct

    def grab(self) -> np.ndarray:
        """Return an (H, W, 3) uint8 RGB frame resized to `out_size`."""
        import cv2

        sct = self._ensure_sct()
        raw = np.array(sct.grab(self.region.as_mss_dict()))  # BGRA
        rgb = raw[:, :, :3][:, :, ::-1]  # BGRA -> RGB
        resized = cv2.resize(rgb, self.out_size, interpolation=cv2.INTER_AREA)
        return np.ascontiguousarray(resized)

    def close(self):
        if self._sct is not None:
            self._sct.close()
            self._sct = None
