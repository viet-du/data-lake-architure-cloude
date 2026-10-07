import { KafkaClient } from './kafka-client';
import type {
  KafkaTopic,
  KafkaTopicConfig,
  KafkaMessage,
  KafkaConsumerGroup,
  KafkaConsumerGroupMember,
  KafkaLagPartition,
  KafkaClusterInfo,
  KafkaBrokerInfo,
} from '../types';

function decodeValue(buf: Buffer | null): string {
  if (!buf) return '';
  try {
    return buf.toString('utf-8');
  } catch {
    return buf.toString('base64');
  }
}

function decodeKey(buf: Buffer | null): string | null {
  if (!buf) return null;
  try {
    return buf.toString('utf-8');
  } catch {
    return buf.toString('base64');
  }
}

function decodeHeaders(headers: Record<string, Buffer | string | (Buffer | string)[] | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string') {
      out[k] = v;
    } else if (Array.isArray(v)) {
      const first = v[0];
      if (first === undefined) continue;
      out[k] = typeof first === 'string' ? first : first.toString('utf-8');
    } else {
      out[k] = v.toString('utf-8');
    }
  }
  return out;
}

export const KafkaTopicRepository = {
  async listTopics(opts: { internal?: boolean; pattern?: string } = {}): Promise<string[]> {
    const admin = await KafkaClient.admin();
    const all = await admin.listTopics();
    if (opts.internal) return all;
    const userOnly = all.filter((t) => !t.startsWith('__'));
    if (!opts.pattern) return userOnly;
    const re = new RegExp(opts.pattern);
    return userOnly.filter((t) => re.test(t));
  },

  async describeTopic(topic: string): Promise<KafkaTopic> {
    const admin = await KafkaClient.admin();
    const meta = await admin.fetchTopicMetadata({ topics: [topic] });
    const t = meta.topics[0];
    if (!t) throw new Error(`Topic not found: ${topic}`);
    const configResponse = await admin
      .describeConfigs({
        includeSynonyms: false,
        resources: [{ type: 2, name: topic }],
      })
      .catch(() => ({ resources: [] as Array<{ configEntries: Array<{ configName: string; configValue: string }> }> }));
    const cfgs = configResponse.resources[0]?.configEntries ?? [];
    const retention = cfgs.find((c) => c.configName === 'retention.ms')?.configValue;
    const cleanup = cfgs.find((c) => c.configName === 'cleanup.policy')?.configValue;
    const compression = cfgs.find((c) => c.configName === 'compression.type')?.configValue;
    const partitions = t.partitions.length;
    const replicationFactor = t.partitions[0]?.replicas.length ?? 0;
    return {
      name: t.name,
      partitions,
      replicationFactor,
      retentionMs: retention ? Number(retention) : null,
      cleanupPolicy: cleanup ?? null,
      compressionType: compression ?? null,
      isInternal: t.name.startsWith('__'),
    };
  },

  async createTopic(config: KafkaTopicConfig & { name: string }): Promise<void> {
    const admin = await KafkaClient.admin();
    const configEntries: Array<{ name: string; value: string }> = [];
    if (config.retentionMs !== undefined) {
      configEntries.push({ name: 'retention.ms', value: String(config.retentionMs) });
    }
    if (config.cleanupPolicy) {
      configEntries.push({ name: 'cleanup.policy', value: config.cleanupPolicy });
    }
    if (config.compressionType) {
      configEntries.push({ name: 'compression.type', value: config.compressionType });
    }
    if (config.configEntries) {
      configEntries.push(...config.configEntries);
    }
    const topicConfig: Parameters<typeof admin.createTopics>[0]['topics'][number] = {
      topic: config.name,
      numPartitions: config.numPartitions,
      replicationFactor: config.replicationFactor,
    };
    if (configEntries.length > 0) {
      topicConfig.configEntries = configEntries;
    }
    await admin.createTopics({
      waitForLeaders: true,
      topics: [topicConfig],
    });
  },

  async deleteTopic(topic: string): Promise<void> {
    const admin = await KafkaClient.admin();
    await admin.deleteTopics({ topics: [topic], timeout: 30_000 });
  },
};

export const KafkaMessageRepository = {
  async sampleMessages(
    topic: string,
    opts: { partition?: number; fromOffset: number; limit: number; timeoutMs: number },
  ): Promise<KafkaMessage[]> {
    const admin = await KafkaClient.admin();
    const meta = await admin.fetchTopicMetadata({ topics: [topic] });
    const t = meta.topics[0];
    if (!t) throw new Error(`Topic not found: ${topic}`);
    const allPartitions = t.partitions.map((p) => p.partitionId);
    const partitionsToRead = opts.partition !== undefined ? [opts.partition] : allPartitions;

    const groupId = `lakehouse-peek-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const consumer = await KafkaClient.consumer(groupId);
    const out: KafkaMessage[] = [];
    try {
      await consumer.subscribe({ topic, fromBeginning: true });
      for (const p of partitionsToRead) {
        consumer.seek({ topic, partition: p, offset: String(opts.fromOffset) });
      }
      let consumed = 0;
      const runResult = await consumer.run({
        autoCommit: false,
        eachMessage: async ({ partition, message }) => {
          if (!partitionsToRead.includes(partition)) return;
          const kafkaMessage: KafkaMessage = {
            partition,
            offset: message.offset,
            timestamp: new Date(Number(message.timestamp)).toISOString(),
            key: decodeKey(message.key),
            value: decodeValue(message.value),
          };
          if (message.headers && Object.keys(message.headers).length > 0) {
            kafkaMessage.headers = decodeHeaders(message.headers);
          }
          out.push(kafkaMessage);
          consumed += 1;
          if (consumed >= opts.limit) {
            await consumer.stop();
          }
        },
      });
      const startedAt = Date.now();
      while (out.length < opts.limit && Date.now() - startedAt < opts.timeoutMs) {
        await new Promise((r) => setTimeout(r, 100));
      }
      await consumer.stop().catch(() => undefined);
      await runResult;
    } finally {
      await KafkaClient.disconnectEphemeralConsumer(consumer);
    }
    return out.slice(0, opts.limit);
  },

  async produce(
    topic: string,
    messages: Array<{
      key?: string;
      value: string;
      headers?: Record<string, string>;
      partition?: number;
    }>,
  ): Promise<{ producedCount: number; partition: number; offset: string }> {
    const producer = await KafkaClient.producer();
    const records = messages.map((m) => ({
      ...(m.key !== undefined ? { key: m.key } : {}),
      value: m.value,
      ...(m.headers ? { headers: m.headers } : {}),
      ...(m.partition !== undefined ? { partition: m.partition } : {}),
    }));
    const meta = await producer.send({ topic, messages: records });
    const first = meta[0];
    return {
      producedCount: messages.length,
      partition: first?.partition ?? 0,
      offset: first?.baseOffset ?? '0',
    };
  },
};

export const KafkaConsumerGroupRepository = {
  async listGroups(filter: { state?: string; pattern?: string } = {}): Promise<Array<{ groupId: string; state: string; protocol: string }>> {
    const admin = await KafkaClient.admin();
    const result = await admin.listGroups();
    const groups = result.groups.filter((g) => {
      if (filter.pattern && !new RegExp(filter.pattern).test(g.groupId)) return false;
      return true;
    });
    const out: Array<{ groupId: string; state: string; protocol: string }> = [];
    if (groups.length === 0) return out;
    try {
      const descs = await admin.describeGroups(groups.map((g) => g.groupId));
      for (const g of descs.groups) {
        if (filter.state && g.state !== filter.state) continue;
        out.push({
          groupId: g.groupId,
          state: g.state,
          protocol: g.protocol,
        });
      }
    } catch {
      for (const g of groups) {
        out.push({ groupId: g.groupId, state: 'Unknown', protocol: 'unknown' });
      }
    }
    return out;
  },

  async describeGroup(groupId: string): Promise<KafkaConsumerGroup> {
    const admin = await KafkaClient.admin();
    const desc = await admin.describeGroups([groupId]);
    const g = desc.groups[0];
    if (!g) throw new Error(`Consumer group not found: ${groupId}`);
    const lagResult = await this.lagForGroup(groupId);
    return {
      groupId: g.groupId,
      state: g.state,
      protocol: g.protocol,
      protocolType: g.protocolType,
      members: g.members.map((m): KafkaConsumerGroupMember => ({
        memberId: m.memberId,
        clientId: m.clientId,
        host: m.clientHost,
        topicPartitions: this.parseAssignmentTopics(m.memberAssignment),
      })),
      totalLag: lagResult.reduce((sum, p) => sum + p.lag, 0),
    };
  },

  parseAssignmentTopics(buf: Buffer): Array<{ topic: string; partition: number }> {
    if (!buf || buf.length === 0) return [];
    const out: Array<{ topic: string; partition: number }> = [];
    try {
      const decoded = JSON.parse(buf.toString('utf-8')) as {
        topics?: string[];
        partitions?: number[][];
      };
      if (decoded.topics && decoded.partitions) {
        for (let i = 0; i < decoded.topics.length; i += 1) {
          const topic = decoded.topics[i];
          const parts = decoded.partitions[i] ?? [];
          for (const p of parts) {
            if (topic) out.push({ topic, partition: p });
          }
        }
      }
    } catch {
      // ignore malformed assignment
    }
    return out;
  },

  async deleteGroup(groupId: string): Promise<void> {
    const admin = await KafkaClient.admin();
    await admin.deleteGroups([groupId]);
  },

  async lagForGroup(groupId: string, topic?: string): Promise<KafkaLagPartition[]> {
    const admin = await KafkaClient.admin();
    const groups = await admin.describeGroups([groupId]);
    const g = groups.groups[0];
    if (!g) return [];
    const memberTopics = new Set<string>();
    for (const m of g.members) {
      const tps = this.parseAssignmentTopics(m.memberAssignment);
      for (const tp of tps) {
        memberTopics.add(tp.topic);
      }
    }
    const topics = topic ? [topic] : Array.from(memberTopics);
    if (topics.length === 0) return [];
    const out: KafkaLagPartition[] = [];
    for (const t of topics) {
      const endOffsets = await admin.fetchTopicOffsets(t);
      const committed = await admin.fetchOffsets({ groupId, topics: [t] });
      const committedMap = new Map<number, string>();
      for (const part of committed) {
        for (const p of part.partitions) {
          committedMap.set(p.partition, p.offset);
        }
      }
      for (const entry of endOffsets) {
        const current = committedMap.get(entry.partition);
        const endBig = BigInt(entry.offset);
        const currentBig = current !== undefined ? BigInt(current) : 0n;
        const lag = Number(endBig - currentBig);
        out.push({
          topic: t,
          partition: entry.partition,
          currentOffset: current ?? '0',
          endOffset: entry.offset,
          lag: lag < 0 ? 0 : lag,
        });
      }
    }
    return out;
  },

  async resetOffset(
    groupId: string,
    opts: { reset: 'earliest' | 'latest' | 'specific'; topic: string; offset?: number; partitions?: number[] },
  ): Promise<void> {
    const admin = await KafkaClient.admin();
    if (opts.reset === 'specific') {
      if (opts.offset === undefined) {
        throw new Error('offset required when reset is specific');
      }
      if (!opts.partitions || opts.partitions.length === 0) {
        throw new Error('partitions required when reset is specific');
      }
      const seekEntries = opts.partitions.map((p) => ({ partition: p, offset: String(opts.offset) }));
      await admin.setOffsets({
        groupId,
        topic: opts.topic,
        partitions: seekEntries,
      });
      return;
    }
    await admin.resetOffsets({
      groupId,
      topic: opts.topic,
      earliest: opts.reset === 'earliest',
    });
  },
};

export const KafkaClusterRepository = {
  async clusterInfo(): Promise<KafkaClusterInfo> {
    const admin = await KafkaClient.admin();
    const cluster = await admin.describeCluster();
    const [topics, groups] = await Promise.all([
      admin.listTopics().catch(() => [] as string[]),
      admin.listGroups().then((r) => r.groups).catch(() => [] as Array<{ groupId: string }>),
    ]);
    return {
      clusterId: cluster.clusterId,
      controller: cluster.controller ?? 0,
      brokers: cluster.brokers.map((b): KafkaBrokerInfo => ({
        nodeId: b.nodeId,
        host: b.host,
        port: b.port,
        rack: null,
      })),
      topicsCount: topics.filter((t) => !t.startsWith('__')).length,
      consumerGroupsCount: groups.length,
    };
  },

  async stats(): Promise<{
    totalTopics: number;
    totalPartitions: number;
    totalConsumerGroups: number;
    totalMessagesIn: number;
    totalLag: number;
    byTopic: Array<{ topic: string; partitions: number; endOffsetTotal: number; lag: number }>;
  }> {
    const admin = await KafkaClient.admin();
    const topics = (await admin.listTopics().catch(() => [])).filter((t) => !t.startsWith('__'));
    const groups = (await admin.listGroups().catch(() => ({ groups: [] as Array<{ groupId: string }> }))).groups;
    let totalPartitions = 0;
    let totalMessagesIn = 0;
    let totalLag = 0;
    const byTopic: Array<{ topic: string; partitions: number; endOffsetTotal: number; lag: number }> = [];
    for (const t of topics) {
      const offsets = await admin.fetchTopicOffsets(t).catch(() => []);
      const partitions = offsets.length;
      const endOffsetTotal = offsets.reduce((sum, o) => sum + Number(o.offset), 0);
      let topicLag = 0;
      for (const g of groups) {
        const committed = await admin
          .fetchOffsets({ groupId: g.groupId, topics: [t] })
          .catch(() => []);
        for (const part of committed) {
          for (const p of part.partitions) {
            const endEntry = offsets.find((o) => o.partition === p.partition);
            const endBig = endEntry ? BigInt(endEntry.offset) : 0n;
            const currentBig = BigInt(p.offset);
            const lag = Number(endBig - currentBig);
            if (lag > 0) topicLag += lag;
          }
        }
      }
      totalPartitions += partitions;
      totalMessagesIn += endOffsetTotal;
      totalLag += topicLag;
      byTopic.push({ topic: t, partitions, endOffsetTotal, lag: topicLag });
    }
    return {
      totalTopics: topics.length,
      totalPartitions,
      totalConsumerGroups: groups.length,
      totalMessagesIn,
      totalLag,
      byTopic,
    };
  },
};