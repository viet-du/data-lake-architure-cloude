export const QUERY_KEYS = {
  catalog: {
    all: ['catalog'] as const,
    databases: () => [...QUERY_KEYS.catalog.all, 'databases'] as const,
    database: (name: string) => [...QUERY_KEYS.catalog.all, 'database', name] as const,
    tables: (params?: object) =>
      [...QUERY_KEYS.catalog.all, 'tables', params ?? {}] as const,
    table: (tableId: string) => [...QUERY_KEYS.catalog.all, 'table', tableId] as const,
    tableSchema: (tableId: string) =>
      [...QUERY_KEYS.catalog.all, 'table', tableId, 'schema'] as const,
    tableLineage: (tableId: string) =>
      [...QUERY_KEYS.catalog.all, 'table', tableId, 'lineage'] as const,
    tableStats: (tableId: string) =>
      [...QUERY_KEYS.catalog.all, 'table', tableId, 'stats'] as const,
    health: () => [...QUERY_KEYS.catalog.all, 'health'] as const,
  },
  bronze: {
    all: ['bronze'] as const,
    tables: (params?: object | object) =>
      [...QUERY_KEYS.bronze.all, 'tables', params ?? {}] as const,
  table: (name: string) => [...QUERY_KEYS.bronze.all, 'table', name] as const,
  tableSample: (name: string) => [...QUERY_KEYS.bronze.all, 'table', name, 'sample'] as const,
  tableStats: (name: string) => [...QUERY_KEYS.bronze.all, 'table', name, 'stats'] as const,
  tableHistory: (name: string) => [...QUERY_KEYS.bronze.all, 'table', name, 'history'] as const,
  tablePartitions: (name: string) =>
    [...QUERY_KEYS.bronze.all, 'table', name, 'partitions'] as const,
    jobs: () => [...QUERY_KEYS.bronze.all, 'jobs'] as const,
    job: (jobId: string) => [...QUERY_KEYS.bronze.all, 'job', jobId] as const,
    jobsStats: () => [...QUERY_KEYS.bronze.all, 'jobsStats'] as const,
  },
  silver: {
    all: ['silver'] as const,
    tables: (params?: object) =>
      [...QUERY_KEYS.silver.all, 'tables', params ?? {}] as const,
    table: (name: string) => [...QUERY_KEYS.silver.all, 'table', name] as const,
    tableSample: (name: string) => [...QUERY_KEYS.silver.all, 'table', name, 'sample'] as const,
    tableStats: (name: string) => [...QUERY_KEYS.silver.all, 'table', name, 'stats'] as const,
    tableHistory: (name: string) => [...QUERY_KEYS.silver.all, 'table', name, 'history'] as const,
    tablePartitions: (name: string) =>
      [...QUERY_KEYS.silver.all, 'table', name, 'partitions'] as const,
    timeTravel: (name: string, version: string) =>
      [...QUERY_KEYS.silver.all, 'table', name, 'timeTravel', version] as const,
    diff: (name: string, v1: string, v2: string) =>
      [...QUERY_KEYS.silver.all, 'table', name, 'diff', v1, v2] as const,
    jobs: () => [...QUERY_KEYS.silver.all, 'jobs'] as const,
    job: (jobId: string) => [...QUERY_KEYS.silver.all, 'job', jobId] as const,
    jobsStats: () => [...QUERY_KEYS.silver.all, 'jobsStats'] as const,
  },
  gold: {
    all: ['gold'] as const,
    tables: (params?: object) =>
      [...QUERY_KEYS.gold.all, 'tables', params ?? {}] as const,
    table: (name: string) => [...QUERY_KEYS.gold.all, 'table', name] as const,
    tableSample: (name: string) => [...QUERY_KEYS.gold.all, 'table', name, 'sample'] as const,
    tableStats: (name: string) => [...QUERY_KEYS.gold.all, 'table', name, 'stats'] as const,
    tableHistory: (name: string) => [...QUERY_KEYS.gold.all, 'table', name, 'history'] as const,
    tableLineage: (name: string) => [...QUERY_KEYS.gold.all, 'table', name, 'lineage'] as const,
    jobs: () => [...QUERY_KEYS.gold.all, 'jobs'] as const,
    job: (jobId: string) => [...QUERY_KEYS.gold.all, 'job', jobId] as const,
    jobsStats: () => [...QUERY_KEYS.gold.all, 'jobsStats'] as const,
    categoryRevenue: () => [...QUERY_KEYS.gold.all, 'query', 'categoryRevenue'] as const,
    businessMetrics: () => [...QUERY_KEYS.gold.all, 'query', 'businessMetrics'] as const,
    customerAnalytics: () => [...QUERY_KEYS.gold.all, 'query', 'customerAnalytics'] as const,
    productPerformance: () => [...QUERY_KEYS.gold.all, 'query', 'productPerformance'] as const,
  },
  kafka: {
    all: ['kafka'] as const,
    topics: () => [...QUERY_KEYS.kafka.all, 'topics'] as const,
    topic: (name: string) => [...QUERY_KEYS.kafka.all, 'topic', name] as const,
    topicMessages: (name: string) =>
      [...QUERY_KEYS.kafka.all, 'topic', name, 'messages'] as const,
    consumerGroups: () => [...QUERY_KEYS.kafka.all, 'consumerGroups'] as const,
    consumerGroup: (groupId: string) =>
      [...QUERY_KEYS.kafka.all, 'consumerGroup', groupId] as const,
    consumerGroupLag: (groupId: string) =>
      [...QUERY_KEYS.kafka.all, 'consumerGroup', groupId, 'lag'] as const,
    cluster: () => [...QUERY_KEYS.kafka.all, 'cluster'] as const,
    stats: () => [...QUERY_KEYS.kafka.all, 'stats'] as const,
  },
  airflow: {
    all: ['airflow'] as const,
    dags: () => [...QUERY_KEYS.airflow.all, 'dags'] as const,
    dag: (dagId: string) => [...QUERY_KEYS.airflow.all, 'dag', dagId] as const,
    dagRuns: (dagId: string) => [...QUERY_KEYS.airflow.all, 'dag', dagId, 'runs'] as const,
    dagRun: (dagId: string, runId: string) =>
      [...QUERY_KEYS.airflow.all, 'dag', dagId, 'run', runId] as const,
    dagRunTasks: (dagId: string, runId: string) =>
      [...QUERY_KEYS.airflow.all, 'dag', dagId, 'run', runId, 'tasks'] as const,
    dagRunGantt: (dagId: string, runId: string) =>
      [...QUERY_KEYS.airflow.all, 'dag', dagId, 'run', runId, 'gantt'] as const,
    health: () => [...QUERY_KEYS.airflow.all, 'health'] as const,
    stats: () => [...QUERY_KEYS.airflow.all, 'stats'] as const,
  },
  crawler: {
    all: ['crawler'] as const,
    jobs: () => [...QUERY_KEYS.crawler.all, 'jobs'] as const,
    job: (name: string) => [...QUERY_KEYS.crawler.all, 'job', name] as const,
    jobConfig: (name: string) => [...QUERY_KEYS.crawler.all, 'job', name, 'config'] as const,
    jobKafkaTopic: (name: string) =>
      [...QUERY_KEYS.crawler.all, 'job', name, 'kafkaTopic'] as const,
    jobPreview: (name: string) => [...QUERY_KEYS.crawler.all, 'job', name, 'preview'] as const,
    jobRuns: (name: string) => [...QUERY_KEYS.crawler.all, 'job', name, 'runs'] as const,
    jobRun: (name: string, runId: string) =>
      [...QUERY_KEYS.crawler.all, 'job', name, 'run', runId] as const,
    stats: () => [...QUERY_KEYS.crawler.all, 'stats'] as const,
  },
  dq: {
    all: ['dq'] as const,
    rules: (params?: object) =>
      [...QUERY_KEYS.dq.all, 'rules', params ?? {}] as const,
    rule: (ruleId: string) => [...QUERY_KEYS.dq.all, 'rule', ruleId] as const,
    runs: (params?: object) =>
      [...QUERY_KEYS.dq.all, 'runs', params ?? {}] as const,
    run: (runId: string) => [...QUERY_KEYS.dq.all, 'run', runId] as const,
    presets: () => [...QUERY_KEYS.dq.all, 'presets'] as const,
    summary: () => [...QUERY_KEYS.dq.all, 'summary'] as const,
  },
  health: {
    all: ['health'] as const,
    root: () => [...QUERY_KEYS.health.all, 'root'] as const,
    deep: () => [...QUERY_KEYS.health.all, 'deep'] as const,
    info: () => [...QUERY_KEYS.health.all, 'info'] as const,
  },
} as const;
