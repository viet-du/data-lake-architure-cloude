import '@/config/apply-env';

import { KafkaClient } from '../repositories/kafka-client';
import { KafkaClusterService, KafkaHealthService } from '../services/kafka.service';

async function main(): Promise<void> {
  console.log('[smoke] Kafka brokers:', KafkaClient.getBrokers());
  console.log('[smoke] Kafka connected:', KafkaClient.isConnected());
  const health = await KafkaHealthService.health();
  console.log('[smoke] Health:', health);
  if (!health.connected) {
    throw new Error(`Kafka unavailable at ${health.brokers.join(',')}`);
  }
  const cluster = await KafkaClusterService.info();
  console.log('[smoke] Cluster:', {
    clusterId: cluster.clusterId,
    brokers: cluster.brokers.length,
    topics: cluster.topicsCount,
    groups: cluster.consumerGroupsCount,
  });
  const stats = await KafkaClusterService.stats();
  console.log('[smoke] Stats:', {
    totalTopics: stats.totalTopics,
    totalPartitions: stats.totalPartitions,
    totalLag: stats.totalLag,
  });
  await KafkaClient.closeAll();
  console.log('[smoke] OK');
}

main().catch((err: Error) => {
  console.error('[smoke] failed:', err);
  process.exit(1);
});
