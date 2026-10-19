from __future__ import annotations

import logging
import signal
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from lakehouse.sources.crawlers.base import BaseCrawler

logger = logging.getLogger(__name__)


@dataclass
class CrawlJob:
    """A single scheduled crawl task.

    Attributes:
        name:        Human-readable identifier (e.g. "tiki-smartphone")
        crawler:     Crawler instance to run
        run_every_s: Interval between runs in seconds
        kwargs:      Extra arguments passed to crawler.crawl()
        last_run_at: Epoch seconds of last invocation
        run_count:   Total times this job has been triggered
        error_count: Consecutive failure counter (resets on success)
    """

    name: str
    crawler: BaseCrawler
    run_every_s: int
    kwargs: dict[str, Any] = field(default_factory=dict)
    last_run_at: float = 0.0
    run_count: int = 0
    error_count: int = 0
    enabled: bool = True

    def is_due(self, now: float) -> bool:
        if not self.enabled:
            return False
        if self.last_run_at == 0.0:
            return True
        return (now - self.last_run_at) >= self.run_every_s


class CrawlScheduler:
    """In-process scheduler that runs multiple crawlers at fixed intervals.

    Replaces the manual "crawl on demand" pattern with a long-running
    background loop. Designed to be invoked either:
      - Foreground in a container: `python -m lakehouse.sources.scheduler`
      - As an Airflow task:  `CrawlScheduler().run_once(...)` for a one-shot
      - Inside a cron-like Kubernetes CronJob

    Example:
        >>> from lakehouse.sources.crawlers.tiki_crawler import TikiCrawler
        >>> from lakehouse.sources.crawlers.github_crawler import GithubCrawler
        >>> from lakehouse.sources.scheduler import CrawlScheduler, CrawlJob
        >>>
        >>> sched = CrawlScheduler()
        >>> sched.add(CrawlJob("tiki-smartphone", TikiCrawler(),
        ...                    run_every_s=3600, kwargs={"category": "smartphone"}))
        >>> sched.add(CrawlJob("github-trending", GithubCrawler(),
        ...                    run_every_s=1800))
        >>> sched.run()  # blocks forever
    """

    def __init__(
        self,
        *,
        tick_s: float = 5.0,
        max_consecutive_errors: int = 5,
        on_job_done: Callable[[CrawlJob, int, Exception | None], None] | None = None,
    ) -> None:
        self._jobs: list[CrawlJob] = []
        self._tick_s = tick_s
        self._max_err = max_consecutive_errors
        self._on_job_done = on_job_done
        self._stop_event = threading.Event()
        self._lock = threading.Lock()

    def add(self, job: CrawlJob) -> None:
        with self._lock:
            self._jobs.append(job)
            logger.info(
                "Scheduled job '%s' every %ds (kwargs=%s)",
                job.name, job.run_every_s, job.kwargs,
            )

    def remove(self, name: str) -> bool:
        with self._lock:
            for i, j in enumerate(self._jobs):
                if j.name == name:
                    del self._jobs[i]
                    logger.info("Removed job '%s'", name)
                    return True
            return False

    def list_jobs(self) -> list[dict[str, Any]]:
        with self._lock:
            return [
                {
                    "name": j.name,
                    "run_every_s": j.run_every_s,
                    "enabled": j.enabled,
                    "last_run_at": j.last_run_at,
                    "run_count": j.run_count,
                    "error_count": j.error_count,
                    "kwargs": j.kwargs,
                }
                for j in self._jobs
            ]

    def stop(self) -> None:
        logger.info("Scheduler stop requested")
        self._stop_event.set()

    def _install_signal_handlers(self) -> None:
        def handler(signum, frame):  # noqa: ARG001
            logger.info("Received signal %s, stopping", signum)
            self.stop()
        signal.signal(signal.SIGINT, handler)
        signal.signal(signal.SIGTERM, handler)

    def run(self) -> None:
        """Blocking loop. Run forever until stop() is called or SIGINT."""
        self._install_signal_handlers()
        logger.info(
            "CrawlScheduler starting: %d jobs, tick=%.1fs",
            len(self._jobs), self._tick_s,
        )
        while not self._stop_event.is_set():
            now = time.time()
            with self._lock:
                due = [j for j in self._jobs if j.is_due(now)]
            for job in due:
                self._run_job(job, now)
            self._stop_event.wait(self._tick_s)
        logger.info("CrawlScheduler stopped")

    def run_once(self, name: str) -> int:
        """Execute a single job one time. Returns row count, raises on error.

        Suitable for Airflow tasks where you want explicit control.
        """
        with self._lock:
            job = next((j for j in self._jobs if j.name == name), None)
        if not job:
            raise KeyError(f"Job '{name}' not found")
        result = self._run_job(job, time.time())
        if result > 0:
            return result
        return 0

    def _run_job(self, job: CrawlJob, now: float) -> int:
        logger.info("Running job '%s' (kwargs=%s)", job.name, job.kwargs)
        job.last_run_at = now
        job.run_count += 1
        exc: Exception | None = None
        count = 0
        try:
            result = job.crawler.crawl(**job.kwargs)
            count = len(result) if isinstance(result, list) else 0
            job.error_count = 0
            logger.info("Job '%s' completed: %d items", job.name, count)
        except Exception as e:  # noqa: BLE001
            exc = e
            job.error_count += 1
            logger.exception(
                "Job '%s' failed (%d/%d): %s",
                job.name, job.error_count, self._max_err, e,
            )
            if job.error_count >= self._max_err:
                logger.error("Job '%s' exceeded max errors, disabling", job.name)
                job.enabled = False
        if self._on_job_done:
            try:
                self._on_job_done(job, count, exc)
            except Exception:  # noqa: BLE001
                logger.exception("on_job_done callback raised")
        return count


def build_default_scheduler() -> CrawlScheduler:
    """Factory: returns a scheduler pre-loaded with the recommended jobs.

    Tweak intervals per your business needs. Defaults are conservative
    (respect rate limits of upstream APIs).

    Schedule:
      - Tiki smartphone/laptop/fashion: every 6h
      - GitHub trending:               every 1h
      - HackerNews top:                every 30min
      - Crypto top-50:                 every 5min
    """
    from lakehouse.sources.crawlers.crypto_crawler import CryptoCrawler
    from lakehouse.sources.crawlers.github_crawler import GithubCrawler
    from lakehouse.sources.crawlers.hackernews_crawler import HackerNewsCrawler
    from lakehouse.sources.crawlers.tiki_crawler import TikiCrawler

    s = CrawlScheduler()

    # --- E-commerce: Tiki (focus on Vietnam e-commerce business data) ---
    for cat in ("smartphone", "laptop", "fashion", "beauty", "home-appliance"):
        s.add(CrawlJob(
            name=f"tiki-{cat}",
            crawler=TikiCrawler(rate_limit=2.0),
            run_every_s=6 * 3600,
            kwargs={"category": cat, "max_pages": 5, "workers": 4},
        ))

    # --- Trending: GitHub ---
    s.add(CrawlJob(
        name="github-trending",
        crawler=GithubCrawler(rate_limit=1.0),
        run_every_s=3600,
        kwargs={"language": "python", "since": "daily"},
    ))

    # --- HackerNews top stories ---
    s.add(CrawlJob(
        name="hackernews-top",
        crawler=HackerNewsCrawler(rate_limit=0.5),
        run_every_s=1800,
        kwargs={"limit": 50},
    ))

    # --- Crypto prices (high frequency) ---
    s.add(CrawlJob(
        name="crypto-top-50",
        crawler=CryptoCrawler(rate_limit=0.3),
        run_every_s=300,
        kwargs={"vs_currency": "usd", "per_page": 50},
    ))

    # NOTE: OpenWeather was removed on 2026-10-14. Weather is not joined with
    # any business data in this project, so crawling it produces noise without
    # downstream value. Re-add only when a Silver/Gold layer joins weather
    # with ecommerce. See: docs/operations/DATA_LAYOUT.md

    return s


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    scheduler = build_default_scheduler()
    for j in scheduler.list_jobs():
        logger.info("  • %s (every %ds)", j["name"], j["run_every_s"])
    scheduler.run()
