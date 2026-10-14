from __future__ import annotations

import subprocess

import pytest

from lakehouse.core.constants import StorageEnv
from lakehouse.core.paths import LakePaths
from lakehouse.pipelines.base import BatchPipeline, StreamingPipeline


def _has_spark() -> bool:
    """Return True if Java/Spark is available (used by tests that need a JVM)."""
    try:
        result = subprocess.run(
            ["java", "-version"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        return result.returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False


SKIP_IF_NO_SPARK = pytest.mark.skipif(
    not _has_spark(),
    reason="Java/Spark not available in this environment",
)


class DummyBatchPipeline(BatchPipeline):
    """Minimal concrete implementation for testing."""

    @property
    def name(self) -> str:
        return "DummyBatchPipeline"

    def stages(self):
        return []


class DummyStreamingPipeline(StreamingPipeline):
    """Minimal concrete implementation for testing."""

    @property
    def name(self) -> str:
        return "DummyStreamingPipeline"

    def queries(self):
        return []


class TestBatchPipelineName:
    @SKIP_IF_NO_SPARK
    def test_batch_pipeline_name(self) -> None:
        paths = LakePaths(env=StorageEnv.LOCAL)
        pipe = DummyBatchPipeline(paths=paths)
        assert pipe.name == "DummyBatchPipeline"

    @SKIP_IF_NO_SPARK
    def test_batch_pipeline_stages_returns_list(self) -> None:
        paths = LakePaths(env=StorageEnv.LOCAL)
        pipe = DummyBatchPipeline(paths=paths)
        assert isinstance(pipe.stages(), list)

    @SKIP_IF_NO_SPARK
    def test_batch_pipeline_paths(self) -> None:
        paths = LakePaths(env=StorageEnv.LOCAL)
        pipe = DummyBatchPipeline(paths=paths)
        assert pipe.paths is not None
        assert pipe.paths.env == StorageEnv.LOCAL

    @SKIP_IF_NO_SPARK
    def test_validate_inputs_defaults_true(self) -> None:
        paths = LakePaths(env=StorageEnv.LOCAL)
        pipe = DummyBatchPipeline(paths=paths)
        assert pipe.validate_inputs() is True


class TestStreamingPipelineName:
    @SKIP_IF_NO_SPARK
    def test_streaming_pipeline_name(self) -> None:
        paths = LakePaths(env=StorageEnv.LOCAL)
        pipe = DummyStreamingPipeline(paths=paths)
        assert pipe.name == "DummyStreamingPipeline"

    @SKIP_IF_NO_SPARK
    def test_streaming_pipeline_queries_returns_list(self) -> None:
        paths = LakePaths(env=StorageEnv.LOCAL)
        pipe = DummyStreamingPipeline(paths=paths)
        assert isinstance(pipe.queries(), list)
