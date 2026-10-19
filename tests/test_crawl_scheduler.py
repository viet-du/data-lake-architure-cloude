"""Tests for CrawlScheduler.

Verifies the in-process scheduler dispatches jobs at the right intervals
and handles errors gracefully.
"""
from __future__ import annotations

import time
from unittest.mock import MagicMock

import pytest

from lakehouse.sources.scheduler import CrawlJob, CrawlScheduler


class FakeCrawler:
    """Stand-in for BaseCrawler — configurable crawl() result + exception."""

    def __init__(self, return_value=None, raise_exc=None):
        self.return_value = return_value or []
        self.raise_exc = raise_exc
        self.call_count = 0
        self.last_kwargs = None

    def crawl(self, **kwargs):
        self.call_count += 1
        self.last_kwargs = kwargs
        if self.raise_exc:
            raise self.raise_exc
        return self.return_value


def make_scheduler(tick_s=0.05, max_err=3, jobs=None):
    s = CrawlScheduler(tick_s=tick_s, max_consecutive_errors=max_err)
    for j in (jobs or []):
        s.add(j)
    return s


def test_add_and_list_jobs():
    crawler = FakeCrawler(return_value=[{"x": 1}, {"x": 2}])
    job = CrawlJob("test-1", crawler, run_every_s=10)
    s = make_scheduler(jobs=[job])

    jobs = s.list_jobs()
    assert len(jobs) == 1
    assert jobs[0]["name"] == "test-1"
    assert jobs[0]["run_every_s"] == 10
    assert jobs[0]["run_count"] == 0
    assert jobs[0]["enabled"] is True


def test_run_once_executes_job():
    crawler = FakeCrawler(return_value=[{"a": 1}, {"b": 2}])
    s = make_scheduler(jobs=[CrawlJob("foo", crawler, run_every_s=999)])
    count = s.run_once("foo")
    assert count == 2
    assert crawler.call_count == 1
    assert s.list_jobs()[0]["run_count"] == 1


def test_run_once_missing_job_raises():
    s = make_scheduler()
    with pytest.raises(KeyError, match="not found"):
        s.run_once("missing")


def test_run_once_increments_error_count():
    crawler = FakeCrawler(raise_exc=RuntimeError("boom"))
    s = make_scheduler(jobs=[CrawlJob("bad", crawler, run_every_s=999)])
    s.run_once("bad")
    job = s.list_jobs()[0]
    assert job["error_count"] == 1
    assert job["enabled"] is True  # not yet disabled


def test_max_consecutive_errors_disables_job():
    crawler = FakeCrawler(raise_exc=RuntimeError("boom"))
    s = make_scheduler(max_err=3, jobs=[CrawlJob("bad", crawler, run_every_s=999)])
    for _ in range(3):
        s.run_once("bad")
    job = s.list_jobs()[0]
    assert job["enabled"] is False
    assert job["error_count"] == 3


def test_success_resets_error_count():
    crawler = FakeCrawler()
    s = make_scheduler(max_err=3, jobs=[CrawlJob("flaky", crawler, run_every_s=999)])

    crawler.raise_exc = RuntimeError("boom")
    s.run_once("flaky")
    s.run_once("flaky")
    assert s.list_jobs()[0]["error_count"] == 2

    crawler.raise_exc = None
    crawler.return_value = [{"ok": 1}]
    s.run_once("flaky")
    assert s.list_jobs()[0]["error_count"] == 0
    assert s.list_jobs()[0]["enabled"] is True


def test_remove_job():
    crawler = FakeCrawler()
    s = make_scheduler(jobs=[CrawlJob("a", crawler, run_every_s=999)])
    assert s.remove("a") is True
    assert s.list_jobs() == []
    assert s.remove("nonexistent") is False


def test_is_due_logic():
    crawler = FakeCrawler()
    job = CrawlJob("test", crawler, run_every_s=10)
    assert job.is_due(100.0) is True
    job.last_run_at = 95.0
    assert job.is_due(100.0) is False  # only 5s elapsed
    assert job.is_due(110.0) is True   # 15s elapsed


def test_disabled_job_not_due():
    crawler = FakeCrawler()
    job = CrawlJob("test", crawler, run_every_s=10, enabled=False)
    assert job.is_due(100.0) is False


def test_loop_runs_due_jobs(monkeypatch):
    """Smoke test: run() loop invokes at least one job and stops quickly."""
    crawler = FakeCrawler(return_value=[{"v": 1}])
    s = make_scheduler(
        tick_s=0.01,
        jobs=[CrawlJob("ticker", crawler, run_every_s=1)],
    )

    def stop_after_a_tick():
        time.sleep(0.05)
        s.stop()
    import threading
    threading.Thread(target=stop_after_a_tick, daemon=True).start()
    s.run()

    assert crawler.call_count >= 1


def test_callback_fires_on_done():
    crawler = FakeCrawler(return_value=[{"i": 1}])
    callback = MagicMock()
    s = CrawlScheduler(on_job_done=callback)
    s.add(CrawlJob("cb", crawler, run_every_s=999))
    s.run_once("cb")
    assert callback.call_count == 1
    args = callback.call_args[0]
    assert args[0].name == "cb"
    assert args[1] == 1
    assert args[2] is None


def test_callback_fires_on_error():
    crawler = FakeCrawler(raise_exc=ValueError("fail"))
    callback = MagicMock()
    s = CrawlScheduler(on_job_done=callback)
    s.add(CrawlJob("err", crawler, run_every_s=999))
    s.run_once("err")
    assert callback.call_count == 1
    args = callback.call_args[0]
    assert args[0].name == "err"
    assert args[1] == 0
    assert isinstance(args[2], ValueError)


def test_build_default_scheduler_has_all_jobs(monkeypatch):
    """Sanity: factory wires the 7 expected business sources.

    KafkaProducer is mocked so this test does NOT require a live Kafka
    broker. It only verifies the scheduler factory assembles the correct
    crawler instances and job names.
    """
    from unittest.mock import MagicMock, patch

    # Block KafkaProducer from connecting to any broker during test.
    # This lets the test run in CI / sandbox / laptop-without-Kafka.
    monkeypatch.setenv("KAFKA_BOOTSTRAP", "localhost:9092")
    with patch("lakehouse.sources.crawlers.base.KafkaProducer") as mock_producer:
        mock_producer.return_value = MagicMock()
        from lakehouse.sources.scheduler import build_default_scheduler
        s = build_default_scheduler()
        names = {j["name"] for j in s.list_jobs()}

        # E-commerce (business-critical, 5 Tiki categories)
        assert "tiki-smartphone" in names
        assert "tiki-laptop" in names
        assert "tiki-fashion" in names
        assert "tiki-beauty" in names
        assert "tiki-home-appliance" in names

        # Trending / dev signals
        assert "github-trending" in names
        assert "hackernews-top" in names

        # Finance
        assert "crypto-top-50" in names

        # Weather: NOT in default schedule (no downstream join yet)
        assert not any(n.startswith("weather-") for n in names), \
            "Weather jobs should not be auto-scheduled"
