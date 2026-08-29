"use strict";

const { randomUUID } = require("node:crypto");

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function createMemoryUserRepository() {
  const users = new Map();
  const sessions = new Map();
  const projects = new Map();
  const history = new Map();
  const passwordResets = new Map();
  const practiceSubmissions = new Map();

  return {
    kind: "memory",
    async close() {},

    async createUser(input) {
      const now = new Date().toISOString();
      const user = {
        id: randomUUID(),
        ...input,
        bio: "",
        createdAt: now,
        updatedAt: now
      };
      users.set(user.id, user);
      return clone(user);
    },

    async findUserByEmail(email) {
      return clone([...users.values()].find((user) => user.email === email) || null);
    },

    async findUserById(id) {
      return clone(users.get(id) || null);
    },

    async updateUser(id, updates) {
      const user = users.get(id);
      if (!user) return null;
      Object.assign(user, updates, { updatedAt: new Date().toISOString() });
      return clone(user);
    },

    async saveSession(session) {
      sessions.set(session.id, clone(session));
      return clone(session);
    },

    async findSession(id) {
      return clone(sessions.get(id) || null);
    },

    async deleteSession(id) {
      sessions.delete(id);
    },

    async deleteSessionsForUser(userId) {
      for (const [id, session] of sessions) {
        if (session.userId === userId) sessions.delete(id);
      }
    },

    async savePasswordReset(reset) {
      passwordResets.set(reset.id, clone(reset));
      return clone(reset);
    },

    async findPasswordReset(id) {
      return clone(passwordResets.get(id) || null);
    },

    async deletePasswordReset(id) {
      passwordResets.delete(id);
    },

    async deletePasswordResetsForUser(userId) {
      for (const [id, reset] of passwordResets) {
        if (reset.userId === userId) passwordResets.delete(id);
      }
    },

    async createProject(userId, input) {
      const now = new Date().toISOString();
      const project = {
        id: randomUUID(),
        userId,
        ...input,
        createdAt: now,
        updatedAt: now
      };
      projects.set(project.id, project);
      return clone(project);
    },

    async listProjects(userId) {
      return clone([...projects.values()]
        .filter((project) => project.userId === userId)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)));
    },

    async findProject(userId, projectId) {
      const project = projects.get(projectId);
      return clone(project?.userId === userId ? project : null);
    },

    async updateProject(userId, projectId, updates) {
      const project = projects.get(projectId);
      if (!project || project.userId !== userId) return null;
      Object.assign(project, updates, { updatedAt: new Date().toISOString() });
      return clone(project);
    },

    async deleteProject(userId, projectId) {
      const project = projects.get(projectId);
      if (!project || project.userId !== userId) return false;
      projects.delete(projectId);
      return true;
    },

    async createHistory(userId, input) {
      const item = {
        id: randomUUID(),
        userId,
        ...input,
        createdAt: new Date().toISOString()
      };
      history.set(item.id, item);
      return clone(item);
    },

    async listHistory(userId, limit = 25) {
      return clone([...history.values()]
        .filter((item) => item.userId === userId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, limit));
    },

    async clearHistory(userId) {
      for (const [id, item] of history) {
        if (item.userId === userId) history.delete(id);
      }
    },

    async createPracticeSubmission(userId, input) {
      const submission = {
        id: randomUUID(),
        userId,
        ...input,
        createdAt: new Date().toISOString()
      };
      practiceSubmissions.set(submission.id, submission);
      return clone(submission);
    },

    async listPracticeSubmissions(userId, limit = 25) {
      return clone([...practiceSubmissions.values()]
        .filter((item) => item.userId === userId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, limit));
    },

    async getDashboard(userId) {
      const userProjects = await this.listProjects(userId);
      const userHistory = await this.listHistory(userId, 1000);
      const languages = {};

      for (const item of userHistory) {
        languages[item.language] = (languages[item.language] || 0) + 1;
      }

      return {
        projectCount: userProjects.length,
        executionCount: userHistory.length,
        languages,
        recentProjects: userProjects.slice(0, 4),
        recentHistory: userHistory.slice(0, 6)
      };
    }
  };
}

module.exports = { createMemoryUserRepository };
