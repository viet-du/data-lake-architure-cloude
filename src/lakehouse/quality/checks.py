from __future__ import annotations
import logging
from typing import Any
from pyspark.sql import DataFrame
logger = logging.getLogger(__name__)

def check_null_percentage(df: DataFrame, column: str, max_pct: float=5.0) -> bool:
    total = df.count()
    if total == 0:
        return True
    null_count = df.filter(df[column].isNull()).count()
    null_pct = null_count / total * 100
    passed = null_pct < max_pct
    status = '' if passed else ''
    logger.info('%s %s: %.2f%% nulls (max: %.1f%%)', status, column, null_pct, max_pct)
    return passed

def check_unique(df: DataFrame, column: str) -> bool:
    total = df.count()
    distinct = df.select(column).distinct().count()
    passed = total == distinct
    status = '' if passed else ''
    logger.info('%s %s: %d/%d unique', status, column, distinct, total)
    return passed

def check_value_in_set(df: DataFrame, column: str, allowed_values: set[Any]) -> bool:
    invalid_count = df.filter(~df[column].isin(list(allowed_values))).count()
    passed = invalid_count == 0
    status = '' if passed else ''
    logger.info('%s %s: %d invalid values (allowed: %s)', status, column, invalid_count, allowed_values)
    return passed

def check_value_range(df: DataFrame, column: str, min_val: float | None=None, max_val: float | None=None) -> bool:
    if min_val is not None:
        invalid_min = df.filter(df[column] < min_val).count()
        if invalid_min > 0:
            logger.warning(' %s: %d values < %s', column, invalid_min, min_val)
            return False
    if max_val is not None:
        invalid_max = df.filter(df[column] > max_val).count()
        if invalid_max > 0:
            logger.warning(' %s: %d values > %s', column, invalid_max, max_val)
            return False
    logger.info(' %s: all values in range [%s, %s]', column, min_val, max_val)
    return True

def run_quality_suite(df: DataFrame, rules: dict[str, list]) -> dict[str, bool]:
    results: dict[str, bool] = {}
    for (column, checks) in rules.items():
        all_passed = True
        for check in checks:
            check_type = check['type']
            if check_type == 'null':
                passed = check_null_percentage(df, column, check.get('max_pct', 5.0))
            elif check_type == 'unique':
                passed = check_unique(df, column)
            elif check_type == 'range':
                passed = check_value_range(df, column, min_val=check.get('min'), max_val=check.get('max'))
            else:
                logger.warning('Unknown check type: %s', check_type)
                passed = True
            all_passed = all_passed and passed
        results[column] = all_passed
    return results