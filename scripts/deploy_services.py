#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path
from typing import Dict, List

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SYSTEMD_DIR = PROJECT_ROOT / "systemd"
SERVICE_FILES = ["safety-api.service", "safety-worker.service"]


def _copy_service(unit_name: str, install_root: Path) -> Path:
    target_dir = install_root / "systemd" / "system"
    target_dir.mkdir(parents=True, exist_ok=True)
    src = SYSTEMD_DIR / unit_name
    dest = target_dir / unit_name
    shutil.copy2(src, dest)
    return dest


def _enable_service(installed_path: Path) -> Path:
    wants_dir = installed_path.parent / "multi-user.target.wants"
    wants_dir.mkdir(parents=True, exist_ok=True)
    link_path = wants_dir / installed_path.name
    if link_path.exists() or link_path.is_symlink():
        link_path.unlink()
    link_path.symlink_to(Path("../") / installed_path.name)
    return link_path


def deploy_services(install_root: Path) -> Dict[str, List[str]]:
    installed_paths: List[str] = []
    enabled_paths: List[str] = []
    for unit in SERVICE_FILES:
        installed = _copy_service(unit, install_root)
        enabled = _enable_service(installed)
        installed_paths.append(str(installed))
        enabled_paths.append(str(enabled))

    env_src = PROJECT_ROOT / ".env.example"
    env_dest = install_root / "etc" / "safety-platform.env"
    env_dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(env_src, env_dest)

    summary = {
        "installed_services": installed_paths,
        "enabled_services": enabled_paths,
        "environment_file": str(env_dest),
    }
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Install safety platform systemd units")
    parser.add_argument(
        "--install-root",
        default="/etc",
        help="Target root directory used to stage systemd units",
    )
    parser.add_argument("--dry-run", action="store_true", help="Only print the actions without applying them")
    args = parser.parse_args()

    install_root = Path(args.install_root)
    if args.dry_run:
        planned = {
            "installed_services": [str(install_root / "systemd" / "system" / unit) for unit in SERVICE_FILES],
            "enabled_services": [
                str(install_root / "systemd" / "system" / "multi-user.target.wants" / unit)
                for unit in SERVICE_FILES
            ],
            "environment_file": str(install_root / "etc" / "safety-platform.env"),
        }
        print(json.dumps(planned))
        return

    summary = deploy_services(install_root)
    print(json.dumps(summary))


if __name__ == "__main__":  # pragma: no cover - used by deployment tooling
    main()
