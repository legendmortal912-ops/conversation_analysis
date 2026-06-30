export const typeDefs = `
  scalar DateTime
  scalar JSON

  enum Role {
    OWNER
    ADMIN
    ANALYST
    VIEWER
  }

  enum Grade {
    A
    B
    C
    D
    F
  }

  enum Pattern {
    TOPIC_HIJACKING
    OPINION_INJECTION
    FALSE_URGENCY
    CONCERN_DISMISSAL
    AGENDA_PERSISTENCE
  }

  enum Severity {
    LOW
    MEDIUM
    HIGH
    CRITICAL
  }

  enum AlertType {
    THRESHOLD
    SPIKE
    PATTERN_SURGE
    CRITICAL_FLAG
  }

  type User {
    id: ID!
    email: String!
    name: String
    role: Role!
    organization: Organization!
  }

  type Member {
    id: ID!
    name: String!
    email: String!
    role: String!
    createdAt: DateTime!
  }

  type Organization {
    id: ID!
    name: String!
    plan: String!
    slug: String!
    stripeCustomerId: String
    users: [User!]!
    projects: [Project!]!
  }

  type CustomRule {
    id: ID!
    projectId: ID!
    name: String!
    description: String
    patterns: [String!]!
    severity: Severity!
    isEnabled: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Project {
    id: ID!
    name: String!
    aiSystemName: String!
    createdAt: DateTime!
    settings: JSON
    customRules: [CustomRule!]!
    conversations: [Conversation!]!
    alertConfigs: [AlertConfig!]!
  }

  type AlertConfig {
    id: ID!
    isActive: Boolean!
    channels: [AlertChannelInfo!]!
  }

  type AlertChannelInfo {
    id: ID!
    type: String!
    isActive: Boolean!
  }

  type AlertConfigFull {
    id: ID!
    projectId: ID!
    channel: String!
    webhookUrl: String
    slackWebhookUrl: String
    emailAddresses: [String!]!
    enabled: Boolean!
  }

  type UsageStats {
    totalConversations: Int!
    totalTurns: Int!
    totalFlags: Int!
    plan: String!
    orgName: String!
  }

  type DailyStatPoint {
    date: String!
    conversations: Int!
    flags: Int!
    avgScore: Float
  }

  type DashboardMetrics {
    totalConversations: Int!
    totalTurns: Int!
    flaggedTurns: Int!
    avgTiltScore: Float
    criticalAlerts: Int!
    patternCounts: JSON!
    dailyStats: [DailyStatPoint!]!
  }

  type Conversation {
    id: ID!
    projectId: ID!
    externalId: String
    status: String!
    startedAt: DateTime!
    endedAt: DateTime
    tiltScore: Float
    score: Score
    grade: String
    turnCount: Int!
    flagCount: Int!
    metadata: JSON
    turns: [Turn!]!
    flags: [Flag!]!
  }

  type Score {
    tiltScore: Int!
    grade: Grade!
    urgency: Float!
    evasion: Float!
    persistence: Float!
  }

  type Turn {
    id: ID!
    conversationId: ID!
    role: String!
    content: String!
    index: Int!
    createdAt: DateTime!
    latencyMs: Int
    flags: [Flag!]!
  }

  type Flag {
    id: ID!
    turnId: ID!
    conversationId: ID!
    patternName: String!
    severity: String!
    confidence: Float!
    description: String!
    evidence: String!
    scoreImpact: Float!
    review: FlagReview
    createdAt: DateTime!
  }

  type FlagReview {
    id: ID!
    flagId: ID!
    reviewerId: ID!
    isFalsePositive: Boolean!
    comment: String
    createdAt: DateTime!
  }

  type AlertSummaryConversation {
    id: ID!
    externalId: String
  }

  type Alert {
    id: ID!
    message: String!
    status: String!
    createdAt: DateTime!
    tiltScore: Float!
    pattern: String
    severity: String
    modelName: String
    conversationId: ID
  }

  type MetricSnapshot {
    id: ID!
    projectId: ID!
    timestamp: DateTime!
    period: String!
    totalConversations: Int!
    totalTurns: Int!
    flaggedTurns: Int!
    avgTiltScore: Float!
    patternCounts: JSON!
  }

  type Report {
    id: ID!
    projectId: ID!
    type: String!
    status: String!
    url: String
    createdAt: DateTime!
  }

  type ConversationEdge {
    node: Conversation!
    cursor: String!
  }

  type PageInfo {
    hasNextPage: Boolean!
    endCursor: String
  }

  type ConversationConnection {
    edges: [ConversationEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  input CreateProjectInput {
    name: String!
    aiSystemName: String
  }

  input CreateCustomRuleInput {
    projectId: ID!
    name: String!
    description: String
    patterns: [String!]!
    severity: Severity!
    isEnabled: Boolean
  }

  input UpdateCustomRuleInput {
    name: String
    description: String
    patterns: [String!]
    severity: Severity
    isEnabled: Boolean
  }

  input ConversationFilters {
    status: String
    minTiltScore: Int
    maxTiltScore: Int
    hasFlags: Boolean
    dateFrom: DateTime
    dateTo: DateTime
  }

  type Query {
    me: User
    organization: Organization
    members: [Member!]!
    project(id: ID!): Project
    projects: [Project!]!
    conversation(id: ID!): Conversation
    conversations(projectId: ID!, first: Int, after: String, filters: ConversationFilters): ConversationConnection!
    flags(projectId: ID!, limit: Int): [Flag!]!
    alerts(projectId: ID, limit: Int, unacknowledgedOnly: Boolean): [Alert!]!
    metrics(projectId: ID!, period: String!, dateFrom: DateTime, dateTo: DateTime): [MetricSnapshot!]!
    searchConversations(projectId: ID!, query: String!): [Conversation!]!
    reports(projectId: ID!): [Report!]!
    alertConfigs(projectId: ID!): [AlertConfigFull!]!
    usageStats: UsageStats!
    dashboardMetrics(projectId: ID!): DashboardMetrics!
  }

  type Mutation {
    createProject(input: CreateProjectInput!): Project!
    updateProject(id: ID!, name: String!): Project!
    deleteProject(id: ID!): Boolean!
    updateProjectSettings(id: ID!, settings: JSON!): Project!
    updateOrganization(name: String!): Organization!

    createCustomRule(input: CreateCustomRuleInput!): CustomRule!
    updateCustomRule(id: ID!, input: UpdateCustomRuleInput!): CustomRule!
    deleteCustomRule(id: ID!): Boolean!

    markFlagFalsePositive(flagId: ID!, isFalsePositive: Boolean!, comment: String): Flag!
    acknowledgeAlert(alertId: ID!): Alert!
    updateAlertSettings(projectId: ID!, isActive: Boolean!): Boolean!
    
    generateReport(projectId: ID!, type: String!, dateFrom: DateTime!, dateTo: DateTime!): Report!

    inviteUser(email: String!, role: Role!): Boolean!
    removeUser(userId: ID!): Boolean!
    updateUserRole(userId: ID!, role: Role!): User!
    
    upsertAlertConfig(projectId: ID!, channel: String!, webhookUrl: String, slackWebhookUrl: String, emailAddresses: [String!], enabled: Boolean!): AlertConfigFull!
    deleteAlertConfig(id: ID!): Boolean!

    saveAnalyzedConversation(projectId: ID!, payload: JSON!): Conversation!
  }

  type Subscription {
    conversationUpdated(projectId: ID!): Conversation!
    newFlag(projectId: ID!): Flag!
    newAlert(projectId: ID!): Alert!
    metricsUpdated(projectId: ID!): MetricSnapshot!
  }
`;
