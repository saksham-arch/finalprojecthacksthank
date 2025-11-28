# Safety Deployment Platform

This repository contains a minimal yet fully testable deployment template for a safety-focused inference API
and its companion queue worker. The platform ships with configurable guardrails, compliance logging, deployment
assets, and monitoring hooks so operators can safely roll out the stack in constrained or offline environments.

## Features

- **Configurable guardrails**: financial blocklist checks, consent enforcement, per-user rate limiting, and
  deterministic output validation. Each guard can be toggled or tuned through `config/settings.toml` or
  environment variables documented in `.env.example`.
- **Compliance visibility**: every guard decision (including skipped checks) is appended to
  `logs/compliance.log`. Breaches automatically emit alert entries via `logs/alerts.log`.
- **Monitoring hooks**: the `/health` endpoint and worker telemetry leverage lightweight journald-style logs to
  confirm the deployment is operating below the 2&nbsp;GB memory threshold and remains offline-ready.
- **Deployment automation**: `scripts/deploy_services.py` installs the provided `systemd` unit files and
  environment template, ensuring both the API and queue worker services are registered and enabled.
- **Bootstrapping support**: `scripts/setup_env.sh` configures the Python virtual environment and installs all
  dependencies from `requirements.txt`.

## Getting started

1. Create and activate the Python environment:
   ```bash
   ./scripts/setup_env.sh
   ```
2. Copy `config/settings.example.toml` to `config/settings.toml` (already provided) and adjust any values as
   needed. Environment overrides may be specified via `.env` by following `.env.example`.
3. Launch the API locally:
   ```bash
   uvicorn main:app --reload
   ```
4. (Optional) Process queued offline tasks once:
   ```bash
   python worker.py --once --queue-file queue/tasks.example.json
   ```

## Deployment

Use the deployment helper to stage the `systemd` units and environment template into a target root directory
(default `/etc`):

```bash
python scripts/deploy_services.py --install-root /tmp/safety-stage
```

The script copies `systemd/safety-api.service` and `systemd/safety-worker.service`, emulates `systemctl enable`
by creating the appropriate `multi-user.target.wants` symlinks, and places the environment file at
`etc/safety-platform.env` beneath the chosen root.

## Testing

Run the test suite with:

```bash
pytest
```

Integration tests validate guardrail toggles, rate limiting, output validation, health monitoring, and the
deployment automation workflow so you can trust the stack before promoting it to higher environments.
