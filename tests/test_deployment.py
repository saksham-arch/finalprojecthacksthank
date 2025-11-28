from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


def test_deploy_services(tmp_path: Path) -> None:
    script = Path("scripts/deploy_services.py")
    result = subprocess.run(
        [sys.executable, str(script), "--install-root", str(tmp_path)],
        capture_output=True,
        text=True,
        check=True,
    )
    summary = json.loads(result.stdout.strip())
    for service in ["safety-api.service", "safety-worker.service"]:
        service_path = tmp_path / "systemd" / "system" / service
        wants_path = tmp_path / "systemd" / "system" / "multi-user.target.wants" / service
        assert service_path.exists()
        assert wants_path.is_symlink()
        assert str(service_path) in summary["installed_services"]
        assert str(wants_path) in summary["enabled_services"]

    env_file = tmp_path / "etc" / "safety-platform.env"
    assert env_file.exists()
    assert summary["environment_file"] == str(env_file)
