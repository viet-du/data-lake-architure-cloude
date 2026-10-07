from __future__ import annotations
from pyspark.sql import DataFrame
from pyspark.sql.streaming import StreamingQuery
from lakehouse.core.constants import DEFAULT_PARTITION_BY, Layer
from lakehouse.core.paths import LakePaths

def write_delta_table(df: DataFrame, layer: Layer, table_name: str, *, paths: LakePaths | None=None, mode: str='overwrite', partition_by: str | list[str] | None=DEFAULT_PARTITION_BY, merge_schema: bool=True) -> None:
    paths = paths or LakePaths()
    base_path = _layer_path(paths, layer)
    full_path = f'{base_path}{table_name}/'
    writer = df.write.format('delta').mode(mode)
    if partition_by:
        if isinstance(partition_by, str):
            partition_by = [partition_by]
        writer = writer.partitionBy(*partition_by)
    if merge_schema:
        writer = writer.option('mergeSchema', 'true')
    writer.save(full_path)
    print(f' Written to {full_path}')

def write_delta_streaming(df: DataFrame, layer: Layer, table_name: str, *, paths: LakePaths | None=None, output_mode: str='append', partition_by: str | list[str] | None=DEFAULT_PARTITION_BY, trigger_available_now: bool=True, checkpoint_dir: str | None=None) -> StreamingQuery:
    paths = paths or LakePaths()
    base_path = _layer_path(paths, layer)
    full_path = f'{base_path}{table_name}/'
    ckpt = checkpoint_dir or paths.checkpoint(layer, table_name)
    from pyspark.sql import functions as F
    enriched = df.withColumn('_processing_timestamp', F.current_timestamp()).withColumn('_ingestion_date', F.date_format(F.current_timestamp(), 'yyyy-MM-dd'))
    writer = enriched.writeStream.format('delta').outputMode(output_mode).option('checkpointLocation', ckpt).option('path', full_path)
    if partition_by:
        if isinstance(partition_by, str):
            partition_by = [partition_by]
        writer = writer.partitionBy(*partition_by)
    if trigger_available_now:
        writer = writer.trigger(availableNow=True)
    else:
        writer = writer.trigger(processingTime='10 seconds')
    return writer.start()

def _layer_path(paths: LakePaths, layer: Layer) -> str:
    if layer == Layer.BRONZE:
        return paths.bronze('')
    if layer == Layer.SILVER:
        return paths.silver('')
    return paths.gold('')