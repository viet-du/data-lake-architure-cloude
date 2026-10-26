import { EdaView } from './eda';

export function EdaScreen() {
  return (
    <div className="h-full w-full overflow-y-auto p-4 md:p-6">
      <EdaView />
    </div>
  );
}
