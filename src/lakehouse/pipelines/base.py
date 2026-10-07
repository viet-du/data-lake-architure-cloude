from __future__ import annotations
import logging
from abc import ABC, abstractmethod
from pyspark.sql import SparkSession
from lakehouse.core.paths import LakePaths
from lakehouse.core.spark import get_spark_session
logger = logging.getLogger(__name__)

class BasePipeline(ABC):

    def __init__(self, spark: SparkSession | None=None, *, paths: LakePaths | None=None) -> None:
        self.spark = spark or get_spark_session(self.__class__.__name__)
        self.paths = paths or LakePaths()

    @property
    @abstractmethod
    def name(self) -> str:
        ...

    @abstractmethod
    def run(self) -> None:
        ...

    def validate_inputs(self) -> bool:
        return True

    def cleanup(self) -> None:
        pass

    def execute(self) -> None:
        logger.info(' Pipeline: %s', self.name)
        logger.info('=' * 60)
        try:
            if not self.validate_inputs():
                logger.error(' Input validation failed')
                return
            self.run()
            logger.info(" Pipeline '%s' completed successfully", self.name)
        except Exception as e:
            logger.exception(" Pipeline '%s' failed: %s", self.name, e)
            raise
        finally:
            self.cleanup()

class BatchPipeline(BasePipeline):

    def run(self) -> None:
        for stage in self.stages():
            logger.info('▶  Stage: %s', stage.__class__.__name__)
            stage.execute()

    @abstractmethod
    def stages(self) -> list:
        ...

    @property
    def name(self) -> str:
        return self.__class__.__name__

class StreamingPipeline(BasePipeline):

    def execute(self) -> None:
        super().execute()

    @abstractmethod
    def queries(self) -> list:
        ...

    def run(self) -> None:
        queries = self.queries()
        logger.info(' Started %d streaming queries', len(queries))
        for q in queries:
            try:
                q.awaitTermination()
            except KeyboardInterrupt:
                q.stop()
                logger.info('Stopped query: %s', q.name)

    @property
    def name(self) -> str:
        return self.__class__.__name__