# Draft Task Pusher

This repository provides a small Node.js utility that reads product/development tasks that are still in **draft** state and publishes them as GitHub issues. It is useful for teams that maintain a planning board or spreadsheet locally but want to synchronize everything with GitHub for execution.

## Features

- Reads structured tasks from `data/tasks.json` (or a custom file path)
- Uses a pluggable GitHub client so you can run in dry-run mode during local development
- Formats clean issue bodies with metadata, acceptance criteria, and checklists
- Keeps a persistent record of which tasks have already been pushed to avoid duplicates
- Provides a CLI helper (`npm run push:drafts`) to synchronize everything with a single command

## Getting started

1. Install dependencies (Jest is used for the included unit tests):

```bash
npm install
```

2. Review and, if necessary, edit `data/tasks.json` with the tasks you would like to publish. Any task with `"status": "draft"` will be considered for synchronization.

3. Export the following environment variables so the CLI knows how to talk to GitHub:

- `GITHUB_OWNER` – the GitHub organization or user
- `GITHUB_REPO` – the target repository name
- `GITHUB_TOKEN` – a classic PAT with `repo` scope
- `DRY_RUN` – set to `false` to perform real API calls (defaults to `true`)
- `TASKS_FILE` – optional absolute/relative path to a different tasks JSON file
- `TASK_LIMIT` – optional number that gates how many drafts are processed per run

4. Push the drafts:

```bash
npm run push:drafts
```

By default the CLI runs in dry-run mode so you can inspect the console output. When you are ready, set `DRY_RUN=false` and rerun the command to create real GitHub issues.

## Tests

```bash
npm test
```

## Data format

Each task in `data/tasks.json` follows the structure below:

```json
{
  "id": "TASK-101",
  "title": "Implement new onboarding flow",
  "status": "draft",
  "description": "Short summary that turns into the issue body.",
  "priority": "high",
  "labels": ["growth", "frontend"],
  "assignees": ["octocat"],
  "acceptanceCriteria": [
    "Describe measurable outcomes",
    "List any functional requirements"
  ],
  "checklist": ["Add tracking plan"],
  "area": "activation"
}
```

When the CLI pushes a task, it updates the entry with a `github` field containing the issue number, URL, and the timestamp of the synchronization.
