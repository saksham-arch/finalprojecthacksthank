#!/usr/bin/env bash
set -euo pipefail

PYTHON_BIN=${PYTHON_BIN:-python3}
VENV_PATH=${VENV_PATH:-.venv}
PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

if [ ! -d "$VENV_PATH" ]; then
  echo "[setup] creating virtual environment at $VENV_PATH"
  "$PYTHON_BIN" -m venv "$VENV_PATH"
fi

source "$VENV_PATH/bin/activate"
python -m pip install --upgrade pip
pip install -r "$PROJECT_ROOT/requirements.txt"

echo "[setup] environment ready"
