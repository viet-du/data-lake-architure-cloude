import { KafkaClient } from '../repositories/kafka-client';
import { KafkaClusterRepository } from '../repositories/kafka.repository';
import { KafkaClusterService, KafkaHealthService } from '../services/kafka.service';

export {};

async function main(): Promise<void> {
  console.log('[smoke] Kafka brokers:', KafkaClient.getBrokers());
  console.log('[smoke] Kafka connected:', KafkaClient.isConnected());
  const health = await KafkaHealthService.health();
  console.log('[smoke] Health:', health);
  if (health.connected) {
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
  } else {
    const repoTried = await KafkaClusterRepository.clusterInfo().catch((e) => `failed: ${(e as Error).message}`);
    console.log('[smoke] Direct repo call returned:', repoTried);
  }
  await KafkaClient.closeAll();
  console.log('[smoke] OK');
}

main().catch((err) => {
  console.error('[smoke] failed:', err);
  process.exit(1);
});