import logging
logger = logging.getLogger(__name__)

def check_null_percentage(df, column: str, max_pct: float=5.0) -> bool:
    total = df.count()
    if total == 0:
        return True
    null_count = df.filter(df[column].isNull()).count()
    null_pct = null_count / total * 100
    passed = null_pct < max_pct
    status = '' if passed else ''
    logger.info(f'{status} {column}: {null_pct:.2f}% nulls (max: {max_pct}%)')
    return passed

def check_unique(df, column: str) -> bool:
    total = df.count()
    distinct = df.select(column).distinct().count()
    passed = total == distinct
    status = '' if passed else ''
    logger.info(f'{status} {column}: {distinct}/{total} unique')
    return passed

def check_value_in_set(df, column: str, allowed: set) -> bool:
    total = df.count()
    invalid = df.filter(~df[column].isin(allowed)).count()
    passed = invalid == 0
    status = '' if passed else ''
    logger.info(f'{status} {column}: {invalid}/{total} invalid values')
    return passed

def check_range(df, column: str, min_val=None, max_val=None) -> bool:
    if min_val is not None:
        below = df.filter(df[column] < min_val).count()
        if below > 0:
            logger.info(f' {column}: {below} values < {min_val}')
            return False
    if max_val is not None:
        above = df.filter(df[column] > max_val).count()
        if above > 0:
            logger.info(f' {column}: {above} values > {max_val}')
            return False
    logger.info(f' {column}: in range [{min_val}, {max_val}]')
    return True