'use strict';

class GitHubIssueClient {
  constructor({ owner, repo, token, fetchImpl, dryRun } = {}) {
    this.owner = owner;
    this.repo = repo;
    this.token = token;
    this.fetch = fetchImpl || global.fetch;
    this.dryRun = typeof dryRun === 'boolean' ? dryRun : !(owner && repo && token);
    this._dryRunCounter = 1;
  }

  _ensureFetch() {
    if (!this.fetch) {
      throw new Error('fetch is not available in this environment. Provide fetchImpl or enable dryRun.');
    }
  }

  _headers() {
    if (!this.token) {
      return {
        Accept: 'application/vnd.github+json'
      };
    }
    return {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${this.token}`
    };
  }

  async createIssue(payload) {
    if (!payload || !payload.title) {
      throw new Error('Issue payload requires a title');
    }
    if (this.dryRun) {
      return this._mockIssue(payload);
    }
    this._ensureFetch();
    const response = await this.fetch(`https://api.github.com/repos/${this.owner}/${this.repo}/issues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this._headers() },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GitHub createIssue failed (${response.status}): ${text}`);
    }
    return response.json();
  }

  async updateIssue(number, payload) {
    if (!number) {
      throw new Error('Issue number is required for updates');
    }
    if (this.dryRun) {
      return {
        number,
        html_url: `https://github.com/${this.owner || 'dry-run'}/${this.repo || 'sandbox'}/issues/${number}`,
        payload,
        dryRun: true
      };
    }
    this._ensureFetch();
    const response = await this.fetch(`https://api.github.com/repos/${this.owner}/${this.repo}/issues/${number}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...this._headers() },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GitHub updateIssue failed (${response.status}): ${text}`);
    }
    return response.json();
  }

  async upsertIssue(payload, existingNumber) {
    if (existingNumber) {
      return this.updateIssue(existingNumber, payload);
    }
    return this.createIssue(payload);
  }

  _mockIssue(payload) {
    const number = this._dryRunCounter++;
    const owner = this.owner || 'dry-run';
    const repo = this.repo || 'sandbox';
    return {
      number,
      html_url: `https://github.com/${owner}/${repo}/issues/${number}`,
      payload,
      dryRun: true
    };
  }
}

module.exports = {
  GitHubIssueClient
};
