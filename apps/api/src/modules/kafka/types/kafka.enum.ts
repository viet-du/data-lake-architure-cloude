export const KAFKA_OFFSET_RESET = ['earliest', 'latest', 'specific'] as const;
export type KafkaOffsetReset = (typeof KAFKA_OFFSET_RESET)[number];

export const KAFKA_COMPRESSION = [
  'none',
  'gzip',
  'snappy',
  'lz4',
  'zstd',
] as const;
export type KafkaCompression = (typeof KAFKA_COMPRESSION)[number];