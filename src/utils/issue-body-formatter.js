'use strict';

function sanitizeMultiline(text) {
  if (!text) {
    return '';
  }
  return String(text)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

function formatChecklist(items, { emptyFallback = 'Not specified', checked = false } = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    return `- [ ] ${emptyFallback}`;
  }
  return items
    .filter(Boolean)
    .map((item) => `- [${checked ? 'x' : ' '}] ${item}`)
    .join('\n');
}

function formatMetadata(task) {
  const metadata = {
    'Task ID': task.id || 'n/a',
    Priority: task.priority || 'unspecified',
    Owner: task.owner || 'unassigned',
    Area: task.area || 'unassigned',
    Initiative: task.initiative || 'not linked',
    Labels: Array.isArray(task.labels) && task.labels.length > 0 ? task.labels.join(', ') : 'none'
  };

  return Object.entries(metadata)
    .map(([key, value]) => `- **${key}:** ${value}`)
    .join('\n');
}

function buildIssueBody(task) {
  const sections = [];
  sections.push(`## Summary\n${sanitizeMultiline(task.description) || 'No description provided.'}`);
  sections.push(`## Acceptance criteria\n${formatChecklist(task.acceptanceCriteria, {
    emptyFallback: 'No acceptance criteria captured yet.'
  })}`);

  if (Array.isArray(task.checklist) && task.checklist.length > 0) {
    sections.push(`## Implementation checklist\n${formatChecklist(task.checklist)}`);
  }

  if (task.notes) {
    sections.push(`## Notes\n${sanitizeMultiline(task.notes)}`);
  }

  sections.push(`## Metadata\n${formatMetadata(task)}`);

  return sections.join('\n\n');
}

function buildIssueTitle(task) {
  const prefix = task.id ? `[${task.id}] ` : '';
  const title = task.title || 'Untitled task';
  return `${prefix}${title}`.trim();
}

module.exports = {
  buildIssueBody,
  buildIssueTitle
};
