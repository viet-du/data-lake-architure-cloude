from __future__ import annotations

import logging
from typing import Any

from pyspark.sql import DataFrame

logger = logging.getLogger(__name__)


def check_null_percentage(
    df: DataFrame, column: str, max_pct: float = 5.0, raise_on_fail: bool = False
) -> bool:
    total = df.count()
    if total == 0:
        return True
    null_count = df.filter(df[column].isNull()).count()
    null_pct = null_count / total * 100
    passed = null_pct < max_pct
    tag = "✅" if passed else "❌"
    logger.info("%s %s: %.2f%% nulls (max: %.1f%%)", tag, column, null_pct, max_pct)
    if not passed and raise_on_fail:
        raise ValueError(
            f"Null check failed: column '{column}' has {null_pct:.2f}% nulls "
            f"(exceeds {max_pct}% threshold)"
        )
    return passed


def check_unique(df: DataFrame, column: str, raise_on_fail: bool = False) -> bool:
    total = df.count()
    distinct = df.select(column).distinct().count()
    passed = total == distinct
    tag = "✅" if passed else "❌"
    logger.info("%s %s: %d/%d unique", tag, column, distinct, total)
    if not passed and raise_on_fail:
        raise ValueError(
            f"Unique check failed: column '{column}' has {total - distinct} duplicate(s) "
            f"({distinct} distinct out of {total} total)"
        )
    return passed


def check_value_in_set(
    df: DataFrame,
    column: str,
    allowed_values: set[Any],
    raise_on_fail: bool = False,
) -> bool:
    invalid_count = df.filter(~df[column].isin(list(allowed_values))).count()
    passed = invalid_count == 0
    tag = "✅" if passed else "❌"
    logger.info(
        "%s %s: %d invalid values (allowed: %s)", tag, column, invalid_count, allowed_values
    )
    if not passed and raise_on_fail:
        raise ValueError(
            f"Enum check failed: column '{column}' has {invalid_count} value(s) "
            f"outside allowed set {allowed_values}"
        )
    return passed


def check_value_range(
    df: DataFrame,
    column: str,
    min_val: float | None = None,
    max_val: float | None = None,
    raise_on_fail: bool = False,
) -> bool:
    passed = True
    if min_val is not None:
        invalid_min = df.filter(df[column] < min_val).count()
        if invalid_min > 0:
            logger.warning(" ❌ %s: %d values < %s", column, invalid_min, min_val)
            passed = False
    if max_val is not None:
        invalid_max = df.filter(df[column] > max_val).count()
        if invalid_max > 0:
            logger.warning(" ❌ %s: %d values > %s", column, invalid_max, max_val)
            passed = False
    if passed:
        logger.info(" ✅ %s: all values in range [%s, %s]", column, min_val, max_val)
    if not passed and raise_on_fail:
        raise ValueError(f"Range check failed: column '{column}' has out-of-range values")
    return passed


def run_quality_suite(
    df: DataFrame, rules: dict[str, list], *, raise_on_fail: bool = False
) -> dict[str, bool]:
    """
    Run a suite of quality checks on a DataFrame.

    Parameters
    ----------
    df : DataFrame
    rules : dict[str, list]
        Mapping of column name → list of check dicts. Each check dict must have
        a ``type`` key ("null", "unique", "in_set", "range") and may have
        type-specific keys (max_pct, allowed_values, min, max).
    raise_on_fail : bool
        If True, raise ValueError when any check fails. Default False.

    Returns
    -------
    dict[str, bool]
        Column name → True if all checks for that column passed.
    """
    results: dict[str, bool] = {}
    for column, checks in rules.items():
        all_passed = True
        for check in checks:
            check_type = check["type"]
            if check_type == "null":
                passed = check_null_percentage(
                    df, column, check.get("max_pct", 5.0), raise_on_fail=False
                )
            elif check_type == "unique":
                passed = check_unique(df, column, raise_on_fail=False)
            elif check_type == "in_set":
                passed = check_value_in_set(
                    df, column, set(check.get("allowed_values", [])), raise_on_fail=False
                )
            elif check_type == "range":
                passed = check_value_range(
                    df,
                    column,
                    min_val=check.get("min"),
                    max_val=check.get("max"),
                    raise_on_fail=False,
                )
            else:
                logger.warning("Unknown check type: %s", check_type)
                passed = True
            all_passed = all_passed and passed
        results[column] = all_passed
    if raise_on_fail and not all(results.values()):
        failed = [c for c, p in results.items() if not p]
        raise ValueError(f"Quality suite failed for columns: {failed}")
    return results
