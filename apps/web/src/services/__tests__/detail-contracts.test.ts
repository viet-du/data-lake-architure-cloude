import { describe, it, expect } from 'vitest';
import { decodeMessages, decodeProduce, decodeLag } from '../kafka/kafka.adapter';
import { decodeTask, decodeLogs, decodeGantt } from '../airflow/airflow.adapter';
import { decodeCrawlerConfig, decodeRunItems, decodePreview } from '../crawler/crawler.adapter';

describe('populated detail contracts', () => {
  it('keeps Kafka offsets larger than JavaScript safe integers lossless', () => {
    const offset = '9007199254740993';
    expect(decodeProduce({ topic: 'test', partition: 0, offset, producedCount: 1 }).offset).toBe(offset);
    expect(decodeMessages({ messages: [{ partition: 0, offset, timestamp: '123', key: null, value: 'body' }] })[0]?.offset).toBe(offset);
    expect(decodeLag({ groupId: 'g', partitions: [{ topic: 'test', partition: 0, currentOffset: offset, endOffset: offset, lag: 0 }] })[0]?.logEndOffset).toBe(offset);
  });
  it('unwraps task lists and converts seconds to milliseconds without inventing dependencies', () => {
    const task = decodeTask({ taskId: 't', runId: 'r', state: 'deferred', startDate: null, endDate: null, duration: 2.5, tryNumber: 1, operator: 'PythonOperator' });
    expect(task.durationMs).toBe(2500);
    expect(task.state).toBe('deferred');
    expect(task).not.toHaveProperty('dependencies');
  });
  it('decodes task log content and time offsets', () => {
    expect(decodeLogs({ taskId: 't', runId: 'r', tryNumber: 1, content: 'hello' }).logs).toBe('hello');
    const values = decodeGantt({ tasks: [{ taskId: 'first', startDate: '2026-10-21T00:00:00Z', duration: 2, state: 'success' }, { taskId: 'later', startDate: '2026-10-21T00:00:03Z', duration: 1, state: 'running' }] });
    expect(values[0]?.duration).toBe(2000);
    expect(values[1]?.startOffset).toBe(3000);
  });
  it('maps crawler configuration and item pages rather than assuming a generic web scraper', () => {
    const config = decodeCrawlerConfig({ rateLimit: 2, timeout: 30, maxRetries: 3, maxWorkers: 8, kafkaTopic: null, userAgent: 'test' });
    expect(config.timeoutSec).toBe(30); expect(config.ratePerMinute).toBe(120);
    const items = { items: [{ id: 'repo-1', status: 'success', payload: { name: 'repo', html_url: 'https://example.test/repo' } }] };
    expect(decodeRunItems(items)[0]?.data).toEqual(items.items[0]?.payload);
    expect(decodePreview(items)[0]?.title).toBe('repo');
  });
});
