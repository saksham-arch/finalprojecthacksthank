#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { FileTaskStore } = require('../core/task-store');
const { TaskPublisher } = require('../core/task-publisher');
const { GitHubIssueClient } = require('../github/github-issue-client');

async function main() {
  const tasksFile = process.env.TASKS_FILE
    ? path.resolve(process.env.TASKS_FILE)
    : path.join(__dirname, '../../data/tasks.json');
  const requestedLimit = process.env.TASK_LIMIT ? Number(process.env.TASK_LIMIT) : undefined;
  const limit = Number.isFinite(requestedLimit) ? requestedLimit : undefined;
  const dryRun = process.env.DRY_RUN ? process.env.DRY_RUN !== 'false' : true;

  const taskStore = new FileTaskStore(tasksFile);
  const githubClient = new GitHubIssueClient({
    owner: process.env.GITHUB_OWNER,
    repo: process.env.GITHUB_REPO,
    token: process.env.GITHUB_TOKEN,
    dryRun
  });

  const publisher = new TaskPublisher({ taskStore, githubClient, logger: console });
  const summary = await publisher.pushDrafts({ limit });
  const output = {
    dryRun: githubClient.dryRun,
    ...summary
  };
  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error('Failed to push draft tasks to GitHub');
  console.error(error);
  process.exitCode = 1;
});
