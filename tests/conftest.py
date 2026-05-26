"""Fixtures pytest compartidos."""
from __future__ import annotations

import sys
from pathlib import Path

# Asegurar que el repo root está en sys.path para imports.
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
