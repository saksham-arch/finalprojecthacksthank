'use strict';

const { buildIssueBody, buildIssueTitle } = require('../utils/issue-body-formatter');

class TaskPublisher {
  constructor({ taskStore, githubClient, logger = console, clock = () => new Date() } = {}) {
    if (!taskStore) {
      throw new Error('taskStore is required');
    }
    if (!githubClient) {
      throw new Error('githubClient is required');
    }
    this.taskStore = taskStore;
    this.githubClient = githubClient;
    this.logger = logger;
    this.clock = clock;
  }

  async pushDrafts({ limit } = {}) {
    const tasks = await this.taskStore.load();
    const drafts = tasks.filter((task) => this._isDraft(task));

    let normalizedLimit;
    if (typeof limit === 'number' && Number.isFinite(limit)) {
      if (limit <= 0) {
        normalizedLimit = 0;
      } else {
        normalizedLimit = Math.floor(limit);
      }
    }

    const slice = typeof normalizedLimit === 'number' ? drafts.slice(0, normalizedLimit) : drafts;

    const summary = {
      totalDrafts: drafts.length,
      processed: slice.length,
      pushed: [],
      skipped: [],
      errors: []
    };

    for (const task of slice) {
      if (task.github && task.github.number) {
        summary.skipped.push({ id: task.id, reason: 'already pushed' });
        continue;
      }

      try {
        const payload = this._buildIssuePayload(task);
        const issue = await this.githubClient.upsertIssue(payload, task.github?.number);
        this._markTaskAsSynced(task, issue);
        summary.pushed.push({ id: task.id, issueNumber: issue.number, url: issue.html_url });
        this.logger.info?.(`Pushed ${task.id || task.title} -> ${issue.html_url}`);
      } catch (error) {
        summary.errors.push({ id: task.id, message: error.message });
        this.logger.error?.(`Failed to push task ${task.id || task.title}: ${error.message}`);
      }
    }

    if (summary.pushed.length > 0) {
      await this.taskStore.save(tasks);
    }

    return summary;
  }

  _isDraft(task) {
    return (task?.status || 'draft').toLowerCase() === 'draft';
  }

  _buildIssuePayload(task) {
    return {
      title: buildIssueTitle(task),
      body: buildIssueBody(task),
      labels: this._buildLabels(task),
      assignees: this._buildAssignees(task)
    };
  }

  _buildLabels(task) {
    const labels = new Set(['source:draft-sync']);
    (task.labels || []).forEach((label) => {
      if (label && typeof label === 'string') {
        const trimmed = label.trim();
        if (trimmed) {
          labels.add(trimmed);
        }
      }
    });
    if (task.priority) {
      labels.add(`priority:${String(task.priority).toLowerCase()}`);
    }
    if (task.area) {
      labels.add(`area:${String(task.area).toLowerCase()}`);
    }
    if (task.initiative) {
      labels.add(`initiative:${String(task.initiative).toLowerCase()}`);
    }
    return Array.from(labels);
  }

  _buildAssignees(task) {
    if (!Array.isArray(task.assignees)) {
      return [];
    }
    return task.assignees.filter((assignee) => typeof assignee === 'string' && assignee.trim().length > 0);
  }

  _markTaskAsSynced(task, issue) {
    const timestamp = this.clock().toISOString();
    task.status = 'synced';
    task.github = {
      number: issue.number,
      url: issue.html_url,
      pushedAt: timestamp
    };
  }
}

module.exports = {
  TaskPublisher
};
