'use strict';

const { TaskPublisher } = require('../src/core/task-publisher');

class InMemoryTaskStore {
  constructor(tasks) {
    this.tasks = tasks;
    this.saved = null;
  }

  async load() {
    return this.tasks;
  }

  async save(tasks) {
    this.saved = JSON.parse(JSON.stringify(tasks));
    this.tasks = tasks;
  }
}

class FakeGitHubClient {
  constructor({ shouldFailOn } = {}) {
    this.shouldFailOn = new Set(shouldFailOn || []);
    this.calls = [];
    this.counter = 0;
  }

  async upsertIssue(payload) {
    const title = payload.title;
    this.calls.push(payload);
    if (this.shouldFailOn.has(title)) {
      throw new Error(`boom for ${title}`);
    }
    this.counter += 1;
    return {
      number: this.counter,
      html_url: `https://github.com/example/repo/issues/${this.counter}`
    };
  }
}

const logger = { info: () => {}, error: () => {} };
const fixedClock = () => new Date('2024-03-01T00:00:00.000Z');

describe('TaskPublisher', () => {
  test('pushes every draft task and updates metadata', async () => {
    const tasks = [
      {
        id: 'TASK-1',
        title: 'First draft',
        status: 'draft',
        description: 'Do something',
        labels: ['alpha'],
        acceptanceCriteria: ['AC1'],
        checklist: ['Check']
      },
      {
        id: 'TASK-2',
        title: 'Second draft',
        status: 'draft',
        description: 'Do something else',
        labels: ['beta'],
        assignees: ['octocat']
      },
      {
        id: 'TASK-3',
        title: 'Already synced',
        status: 'synced',
        description: 'Delivered'
      }
    ];

    const store = new InMemoryTaskStore(tasks);
    const client = new FakeGitHubClient();
    const publisher = new TaskPublisher({ taskStore: store, githubClient: client, logger, clock: fixedClock });

    const summary = await publisher.pushDrafts();

    expect(summary.totalDrafts).toBe(2);
    expect(summary.pushed).toHaveLength(2);
    expect(summary.errors).toHaveLength(0);
    expect(store.saved).not.toBeNull();
    expect(store.saved[0].status).toBe('synced');
    expect(store.saved[0].github).toMatchObject({ number: 1, pushedAt: '2024-03-01T00:00:00.000Z' });
    expect(store.saved[1].github.number).toBe(2);
    expect(client.calls[0].labels).toContain('source:draft-sync');
    expect(client.calls[1].assignees).toContain('octocat');
  });

  test('skips tasks that already have GitHub metadata', async () => {
    const tasks = [
      { id: 'TASK-1', title: 'Draft A', status: 'draft', description: 'A' },
      { id: 'TASK-2', title: 'Draft B', status: 'draft', description: 'B', github: { number: 77 } },
      { id: 'TASK-3', title: 'Draft C', status: 'draft', description: 'C' }
    ];

    const store = new InMemoryTaskStore(tasks);
    const client = new FakeGitHubClient();
    const publisher = new TaskPublisher({ taskStore: store, githubClient: client, logger, clock: fixedClock });

    const summary = await publisher.pushDrafts();
    expect(summary.pushed).toHaveLength(2);
    expect(summary.skipped).toEqual([{ id: 'TASK-2', reason: 'already pushed' }]);
  });

  test('respects the provided task limit', async () => {
    const tasks = [
      { id: 'TASK-1', title: 'Draft A', status: 'draft', description: 'A' },
      { id: 'TASK-2', title: 'Draft B', status: 'draft', description: 'B' }
    ];

    const store = new InMemoryTaskStore(tasks);
    const client = new FakeGitHubClient();
    const publisher = new TaskPublisher({ taskStore: store, githubClient: client, logger, clock: fixedClock });

    const summary = await publisher.pushDrafts({ limit: 1 });
    expect(summary.processed).toBe(1);
    expect(summary.pushed).toHaveLength(1);
  });

  test('records failures without aborting the sync', async () => {
    const tasks = [
      { id: 'TASK-1', title: 'Healthy', status: 'draft', description: 'ok' },
      { id: 'TASK-2', title: 'Explode', status: 'draft', description: 'boom' }
    ];
    const store = new InMemoryTaskStore(tasks);
    const client = new FakeGitHubClient({ shouldFailOn: ['[TASK-2] Explode'] });
    const publisher = new TaskPublisher({ taskStore: store, githubClient: client, logger, clock: fixedClock });

    const summary = await publisher.pushDrafts();

    expect(summary.pushed).toHaveLength(1);
    expect(summary.errors).toHaveLength(1);
    expect(summary.errors[0]).toMatchObject({ id: 'TASK-2' });
  });
});
