"use strict";

const mongoose = require("mongoose");

function toPlain(document) {
  if (!document) return null;
  const value = document.toObject ? document.toObject() : document;
  return {
    ...value,
    id: String(value._id),
    userId: value.userId ? String(value.userId) : value.userId,
    _id: undefined,
    __v: undefined
  };
}

function createModels(connection = mongoose) {
  const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: true },
    bio: { type: String, default: "", maxlength: 240 }
  }, { timestamps: true });

  const sessionSchema = new mongoose.Schema({
    _id: { type: String },
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, expires: 0 }
  }, { versionKey: false });

  const projectSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, default: "", maxlength: 500 },
    language: { type: String, required: true, enum: ["javascript", "python", "java", "sql"] },
    source: { type: String, required: true, maxlength: 32768 }
  }, { timestamps: true });

  const historySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    language: { type: String, required: true },
    source: { type: String, required: true, maxlength: 32768 },
    status: { type: String, required: true },
    eventCount: { type: Number, default: 0 },
    durationMs: { type: Number, default: null },
    outputPreview: { type: String, default: "", maxlength: 300 }
  }, { timestamps: true });

  return {
    User: connection.models.CodeFlowUser || connection.model("CodeFlowUser", userSchema),
    Session: connection.models.CodeFlowSession || connection.model("CodeFlowSession", sessionSchema),
    Project: connection.models.CodeFlowProject || connection.model("CodeFlowProject", projectSchema),
    History: connection.models.CodeFlowHistory || connection.model("CodeFlowHistory", historySchema)
  };
}

function createMongooseUserRepository(connection = mongoose) {
  const { User, Session, Project, History } = createModels(connection);

  return {
    kind: "mongoose",
    async createUser(input) { return toPlain(await User.create(input)); },
    async findUserByEmail(email) { return toPlain(await User.findOne({ email }).lean()); },
    async findUserById(id) { return toPlain(await User.findById(id).lean()); },
    async updateUser(id, updates) {
      return toPlain(await User.findByIdAndUpdate(id, updates, { new: true, runValidators: true }).lean());
    },
    async saveSession(session) {
      return toPlain(await Session.findByIdAndUpdate(session.id, {
        userId: session.userId,
        tokenHash: session.tokenHash,
        expiresAt: session.expiresAt
      }, { upsert: true, new: true }).lean());
    },
    async findSession(id) { return toPlain(await Session.findById(id).lean()); },
    async deleteSession(id) { await Session.deleteOne({ _id: id }); },
    async createProject(userId, input) { return toPlain(await Project.create({ userId, ...input })); },
    async listProjects(userId) {
      return (await Project.find({ userId }).sort({ updatedAt: -1 }).lean()).map(toPlain);
    },
    async findProject(userId, projectId) {
      return toPlain(await Project.findOne({ _id: projectId, userId }).lean());
    },
    async updateProject(userId, projectId, updates) {
      return toPlain(await Project.findOneAndUpdate(
        { _id: projectId, userId }, updates, { new: true, runValidators: true }
      ).lean());
    },
    async deleteProject(userId, projectId) {
      return (await Project.deleteOne({ _id: projectId, userId })).deletedCount === 1;
    },
    async createHistory(userId, input) { return toPlain(await History.create({ userId, ...input })); },
    async listHistory(userId, limit = 25) {
      return (await History.find({ userId }).sort({ createdAt: -1 }).limit(limit).lean()).map(toPlain);
    },
    async clearHistory(userId) { await History.deleteMany({ userId }); },
    async getDashboard(userId) {
      const [projectCount, executionCount, recentProjects, recentHistory, languageRows] = await Promise.all([
        Project.countDocuments({ userId }),
        History.countDocuments({ userId }),
        Project.find({ userId }).sort({ updatedAt: -1 }).limit(4).lean(),
        History.find({ userId }).sort({ createdAt: -1 }).limit(6).lean(),
        History.aggregate([
          { $match: { userId: new mongoose.Types.ObjectId(userId) } },
          { $group: { _id: "$language", count: { $sum: 1 } } }
        ])
      ]);

      return {
        projectCount,
        executionCount,
        languages: Object.fromEntries(languageRows.map((row) => [row._id, row.count])),
        recentProjects: recentProjects.map(toPlain),
        recentHistory: recentHistory.map(toPlain)
      };
    }
  };
}

async function connectUserDatabase(uri) {
  if (typeof uri !== "string" || !uri.trim()) {
    throw new Error("MONGODB_URI is required for the Phase 9 user platform");
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8_000 });
  return createMongooseUserRepository(mongoose);
}

module.exports = { connectUserDatabase, createMongooseUserRepository };
