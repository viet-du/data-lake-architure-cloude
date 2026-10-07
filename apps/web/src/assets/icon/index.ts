import airflowUrl from './airflow.png';
import analystUrl from './analyst.png';
import backgroundUrl from './background.png';
import bronzeUrl from './bronze.png';
import cloudUrl from './cloud.png';
import goldUrl from './gold.png';
import hiveMetastoreUrl from './hive-metastore.png';
import homeUrl from './home.png';
import pipelineUrl from './pipeline.png';
import postgresqlUrl from './postgresql.png';
import silverUrl from './silver.png';
import storageUrl from './storage.png';
import terraformUrl from './terraform.png';
import apacheSparkUrl from './apache-spark.png';
import kafkaUrl from './kafka.png';

import type { EIconName } from './icon.types';

export type { EIconName, EIconTone, IconComponentProps } from './icon.types';

export const ICONS: Readonly<Record<EIconName, string>> = {
  Airflow: airflowUrl,
  Analyst: analystUrl,
  Background: backgroundUrl,
  Bronze: bronzeUrl,
  Cloud: cloudUrl,
  Gold: goldUrl,
  HiveMetastore: hiveMetastoreUrl,
  Home: homeUrl,
  Pipeline: pipelineUrl,
  PostgreSQL: postgresqlUrl,
  Silver: silverUrl,
  Storage: storageUrl,
  Terraform: terraformUrl,
  ApacheSpark: apacheSparkUrl,
  Kafka: kafkaUrl,
};
