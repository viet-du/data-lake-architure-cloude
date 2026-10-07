
Thư mục này chỉ chứa shell scripts tiện ích. Toàn bộ Python code đã được refactor
sang package `src/lakehouse/` theo chuẩn monorepo.


```bash
python scripts/01_ingest_to_bronze.py

python -m lakehouse.ingest.batch.csv_ingestor

make pipeline-batch
make stream-clickstream
```


File cũ đã được move vào `scripts/.legacy/`. Xem `scripts/.legacy/README.md` để biết
mapping sang code mới.


Sẽ thêm các shell scripts ở đây (vd: `start.sh`, `reset.sh`, `health-check.sh`).
