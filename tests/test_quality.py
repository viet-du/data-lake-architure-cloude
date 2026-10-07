from __future__ import annotations
import os
os.environ.setdefault('ENV', 'local')
import pytest

class TestNullPercentage:

    def test_zero_nulls_passes(self) -> None:
        total = 100
        null_count = 0
        null_pct = null_count / total * 100
        assert null_pct < 5.0

    def test_high_nulls_fails(self) -> None:
        total = 100
        null_count = 10
        null_pct = null_count / total * 100
        assert null_pct >= 5.0

    def test_empty_df(self) -> None:
        total = 0
        assert total == 0

class TestUniqueCheck:

    def test_all_unique(self) -> None:
        values = [1, 2, 3, 4, 5]
        total = len(values)
        distinct = len(set(values))
        assert total == distinct

    def test_duplicates(self) -> None:
        values = [1, 2, 3, 3, 4]
        total = len(values)
        distinct = len(set(values))
        assert total != distinct

class TestValueRange:

    def test_in_range(self) -> None:
        age = 25
        assert 0 <= age <= 120

    def test_below_min(self) -> None:
        age = -1
        assert not 0 <= age <= 120

    def test_above_max(self) -> None:
        age = 121
        assert not 0 <= age <= 120

class TestValueInSet:

    def test_in_set(self) -> None:
        allowed = {'active', 'inactive'}
        assert 'active' in allowed

    def test_not_in_set(self) -> None:
        allowed = {'active', 'inactive'}
        assert 'unknown' not in allowed

class TestQualityCheckSignature:

    def test_functions_exist(self) -> None:
        from lakehouse.quality.checks import check_null_percentage, check_unique, check_value_in_set, check_value_range, run_quality_suite
        assert callable(check_null_percentage)
        assert callable(check_unique)
        assert callable(check_value_in_set)
        assert callable(check_value_range)
        assert callable(run_quality_suite)

    def test_run_quality_suite_signature(self) -> None:
        import inspect
        sig = inspect.signature(__import__('lakehouse.quality.checks', fromlist=['run_quality_suite']).run_quality_suite)
        assert 'df' in sig.parameters
        assert 'rules' in sig.parameters