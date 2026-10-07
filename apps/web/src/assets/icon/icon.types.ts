export type EIconName =
  | 'Airflow'
  | 'Analyst'
  | 'Background'
  | 'Bronze'
  | 'Cloud'
  | 'Gold'
  | 'HiveMetastore'
  | 'Home'
  | 'Pipeline'
  | 'PostgreSQL'
  | 'Silver'
  | 'Storage'
  | 'Terraform'
  | 'ApacheSpark'
  | 'Kafka';

export type EIconTone = 'colored' | 'mono';

export interface IconComponentProps {
  name: EIconName;
  size?: number;
  className?: string;
  alt?: string;
  tone?: EIconTone;
}
