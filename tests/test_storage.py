from __future__ import annotations

from lakehouse.storage.delta_writer import write_delta_streaming, write_delta_table


def test_write_delta_table_signature() -> None:
    # Verify the function exists and is callable with correct params (no Spark needed for signature test)
    import inspect

    sig = inspect.signature(write_delta_table)
    params = list(sig.parameters.keys())
    assert "df" in params
    assert "layer" in params
    assert "table_name" in params
    assert "paths" in params
    assert "mode" in params
    assert "partition_by" in params
    assert "merge_schema" in params


def test_write_delta_streaming_signature() -> None:
    import inspect

    sig = inspect.signature(write_delta_streaming)
    params = list(sig.parameters.keys())
    assert "df" in params
    assert "layer" in params
    assert "table_name" in params
    assert "paths" in params
    assert "output_mode" in params
    assert "partition_by" in params
    assert "checkpoint_dir" in params
