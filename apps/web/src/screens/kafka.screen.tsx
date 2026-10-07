import { KafkaView } from './kafka';

export function KafkaScreen() {
  return (
    <div className="h-full w-full overflow-y-auto p-4 md:p-6">
      <KafkaView />
    </div>
  );
}
