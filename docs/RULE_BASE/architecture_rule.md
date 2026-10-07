# QUY TẮC KIẾN TRÚC COURSE_WORK

## 1. Danh tính tài liệu

```text
Document ID: COURSE-WORK-ARCHITECTURE-v1
Repository scope: COURSE_WORK
Architecture style: Source-owned processing with Human-approved direct Phase 5 EDA exception
Scientific scope: Multivariate time-series regression
Current implementation scope: Phase 0 through Phase 37 preparation
Status: ACTIVE_HUMAN_APPROVED
```

Tài liệu này quy định vị trí lưu trữ, quyền sở hữu logic, hướng dependency, vòng đời dữ liệu, vòng đời artifact, ranh giới notebook và trách nhiệm kiểm thử của `COURSE_WORK`.

Tài liệu không thay thế:

```text
COURSE_WORK/working_rule.md
COURSE_WORK/docs/RULE_BASE/rule_code.md
Phase detail tương ứng
Pre-process plan đã được Human duyệt
```

Khi có xung đột chưa được giải quyết rõ bằng rule cấp cao hơn, phải dừng thực thi và xin Human quyết định.

## 2. Mục tiêu kiến trúc

Kiến trúc phải bảo đảm:

```text
Một nơi sở hữu duy nhất cho mỗi loại logic.
Notebook không phải source of truth cho canonical data processing ngoài direct exploratory Phase 5 exception.
Mọi Phase có input, output và sign-off truy vết được.
Raw data bất biến.
Không có leakage giữa Train, Validation và Test.
Mọi kết quả có thể tái tạo từ config, source và artifact.
Mọi Phase chỉ chạy sau khi upstream Phase hợp lệ.
EDA không bị trộn với preprocessing hoặc model selection.
Code, artifact và report có trách nhiệm tách biệt.
```

## 3. Những điều kiến trúc không cho phép

```text
Đặt processing logic trong notebook ngoài direct exploratory Phase 5 exception đã được Human duyệt.
Duplicate cùng một logic ở nhiều module.
Ghi đè raw data.
Tạo file hoặc thư mục không có owner.
Tạo artifact không có schema hoặc provenance.
Để Phase sau đoán lại contract của Phase trước.
Để source import notebook.
Để scientific decision phụ thuộc Test trước final gate.
Đưa interpolation hoặc data repair vào EDA một cách âm thầm.
Tạo Phase mới mà không có Phase detail và approval.
```

## 4. Canonical project root

Project root duy nhất:

```text
COURSE_WORK/
```

Python source root duy nhất:

```text
COURSE_WORK/src/course_work/
```

Notebook chính duy nhất cho coursework:

```text
COURSE_WORK/notebook_course_work/CourseWork.ipynb
```

Không tạo package hoặc notebook song song chỉ khác chữ hoa, chữ thường hoặc cách viết.

Các tên sau không canonical:

```text
COURSE_WORK/SRC/
COURSE_WORK/src/coursework/
COURSE_WORK/course_work/
COURSE_WORK/notebook_course_work/course_work.ipynb
COURSE_WORK/notebook_course_work/practice_3.ipynb
```

## 5. Cây kiến trúc canonical

```text
COURSE_WORK/
├── README.md
├── requirements.txt
├── pyproject.toml
├── working_rule.md
├── configs/
│   └── base/
│       └── coursework_contract.json
├── data/
│   ├── raw_data/
│   │   ├── source/
│   │   ├── energydata_complete.csv
│   │   ├── checksums.sha256
│   │   ├── dataset_manifest.json
│   │   ├── source_metadata.json
│   │   ├── variable_metadata.csv
│   │   └── README_SOURCE.md
│   ├── interim/
│   │   └── uci_appliances_energy_prediction/
│   │       └── energydata_feature_engineered_v1.csv
│   ├── data_after_processing/
│   └── data_after_split/
├── artifacts/
│   ├── contracts/
│   ├── environment/
│   ├── acquisition/
│   ├── schema/
│   ├── temporal/
│   ├── eda/
│       ├── tables/
│       └── figures/
│   ├── features/
│   ├── feature_sets/
│   ├── splits/
│   ├── scaling/
│   ├── scalers/
│   ├── windows/
│   ├── dataloaders/
│   ├── metrics/
│   ├── experiments/
│   ├── baselines/
│   │   └── persistence/
│   └── runs/
├── src/
│   └── course_work/
│       ├── __init__.py
│       ├── contracts/
│       │   ├── __init__.py
│       │   └── coursework.py
│       ├── data/
│       │   ├── __init__.py
│       │   ├── acquisition.py
│       │   ├── schema.py
│       │   ├── temporal.py
│       │   ├── eda.py
│       │   ├── features.py
│       │   ├── feature_sets.py
│       │   ├── splitting.py
│       │   ├── scaling.py
│       │   ├── windows.py
│       │   └── datasets.py
│       ├── reporting/
│       │   ├── __init__.py
│       │   ├── eda.py
│       │   └── phase_summary.py
│       ├── models/
│       │   ├── __init__.py
│       │   ├── lstm_regressor.py
│       │   ├── transformer_regressor.py
│       │   ├── transformer_encoder_layer.py
│       │   └── positional_encoding.py
│       ├── training/
│       │   ├── __init__.py
│       │   ├── engine.py
│       │   └── engine_materialize.py
│       ├── sanity/
│       │   ├── __init__.py
│       │   └── forward_sanity.py
│       ├── diagnostics/
│       │   ├── __init__.py
│       │   ├── learning_curves.py
│       │   └── learning_diagnostics.py
│       ├── sweeps/
│       │   ├── d_model.py
│       │   ├── dropout.py
│       │   ├── heads.py
│       │   ├── sweep_results.py
│       │   └── weight_decay.py
│       ├── evaluation/
│       │   └── metrics.py
│       ├── experiments/
│       │   ├── registry.py
│       │   ├── phase_execution.py
│       │   └── sweep_recovery.py
│       ├── baselines/
│       │   ├── persistence.py
│       │   ├── lstm_baseline.py
│       │   └── transformer_b0.py
│       ├── utils/
│       │   ├── __init__.py
│       │   ├── artifacts.py
│       │   ├── environment.py
│       │   └── reproducibility.py
│       └── attention/
│           ├── extraction.py
│           ├── heatmaps.py
│           ├── last_query.py
│           ├── head_comparison.py
│           ├── mapping.py
│           └── verification.py
├── tests/
│   ├── contracts/
│   ├── unit/
│   └── integration/
├── notebook_course_work/
│   └── CourseWork.ipynb
└── docs/
    ├── RULE_BASE/
    ├── plan-doc/
    └── save_log_in_processing/
```

Các package và artifact ngoài Phase 0-37 chỉ là namespace được bảo lưu. Không được triển khai logic Phase 38 trở đi nếu chưa có Human approval riêng.

## 6. Trách nhiệm thư mục cấp cao

### 6.1. `configs`

Lưu cấu hình khai báo đã được duyệt.

Quy tắc:

```text
Không chứa kết quả runtime.
Không chứa absolute path theo máy.
Không chứa secret.
Không chứa giá trị được chọn bằng Test.
Mỗi config phải có schema hoặc validator.
```

### 6.2. `data`

Lưu dữ liệu nguồn và dữ liệu dẫn xuất theo vòng đời đã duyệt.

`data` không chứa source code.

### 6.3. `artifacts`

Lưu machine-readable output của các Phase.

Artifact là bằng chứng thực thi, không phải source code và không phải cấu hình đầu vào tùy ý.

### 6.4. `src/course_work`

Lưu toàn bộ reusable processing logic.

Mọi logic được dùng bởi notebook hoặc nhiều Phase phải có owner tại đây.

### 6.5. `tests`

Lưu contract, unit và integration tests.

Notebook output không thay thế automated tests.

### 6.6. `notebook_course_work`

Lưu presentation và orchestration notebook.

Notebook không sở hữu canonical scientific implementation.

Ngoại lệ được Human duyệt cho Phase 6 EDA:

```text
CourseWork.ipynb được chứa direct descriptive EDA calculation và plotting.
Direct EDA phải dùng validated Phase 4 view.
Direct EDA không được fetch dataset hoặc ghi artifact.
Direct EDA không được thay đổi raw data hoặc signed outputs.
DataFrame smoothing chỉ được tồn tại trên deep copy để minh họa.
Smoothed demonstration không được dùng bởi Phase 6 hoặc modeling.
Ngoại lệ không áp dụng cho split, scaling, windowing, training hoặc evaluation.
```

### 6.7. `docs`

Lưu rules, issue synthesis, pre-process plans, Phase details, execution records và report đã được xác minh.

#### 6.7.1. Log routing — mandatory

Raw terminal và training execution logs bắt buộc lưu dưới:

```text
artifacts/sweeps/logs/
```

Các file này dùng extension `.log` và tên mô tả phải chứa Phase cùng run ID khi đã biết, ví dụ:

```text
artifacts/sweeps/logs/phase_34_h2_RUN_TR_S12_0020_DE823D66_terminal.log
```

Machine-readable Phase, process và recovery logs bắt buộc lưu dưới:

```text
docs/save_log_in_processing/
```

Các processing log này dùng extension `.json`.

```text
Không được đặt file .log trong docs/save_log_in_processing/.
Không được trộn raw terminal output với machine-readable JSON processing logs.
```

### 6.8. `pyproject.toml`

Sở hữu cấu hình packaging của canonical Python source root:

```text
COURSE_WORK/src/course_work
```

Quy tắc:

```text
Notebook và test import package qua environment đã cài project.
Không chèn sys.path hoặc PYTHONPATH bootstrap vào notebook.
Editable install không thay đổi scientific dependency contract.
Không khai báo dependency trùng với requirements.txt.
Không package namespace bảo lưu chưa có __init__.py.
```

## 7. Source package ownership

### 7.1. `contracts/coursework.py`

Sở hữu Phase 0:

```text
Coursework contract schema
Contract validation
Option-registry validation
Research-question validation
Contract fingerprint
Phase 0 materialization
Phase 0 sign-off eligibility
```

Không đọc dataset và không chạy computation phụ thuộc dữ liệu.

### 7.2. `utils/environment.py`

Sở hữu phần environment của Phase 1:

```text
Interpreter inventory
Package-version inventory
Platform inventory
Working-directory validation
CUDA, MPS và CPU detection
Device selection
Tensor, autograd, module và optimizer smoke tests
Environment report
```

### 7.3. `utils/reproducibility.py`

Sở hữu:

```text
Python seed
NumPy seed
PyTorch seed
CUDA seed khi áp dụng
Deterministic policy
Randomness smoke tests
```

Không tuyên bố reproducibility tuyệt đối giữa mọi platform và package version.

### 7.4. `utils/artifacts.py`

Sở hữu:

```text
Canonical path resolution
Directory creation trong approved scope
Atomic write
JSON và CSV serialization
SHA-256 helper
Artifact fingerprint
Artifact reload verification
```

Không sở hữu schema khoa học, EDA calculation hoặc Phase decision.

### 7.5. `data/acquisition.py`

Sở hữu Phase 2:

```text
Official source identity
Acquisition method
Archive integrity
Safe extraction
Archive và CSV hashing
Minimal CSV smoke test
Dataset manifest
Source metadata
Acquisition log
DATA-v1 sign-off eligibility
```

Không preprocessing, split, scale, drop column hoặc overwrite raw CSV.

### 7.6. `data/schema.py`

Sở hữu Phase 3:

```text
Expected raw schema
Expected-versus-actual comparison
Raw dtype audit
Semantic roles
Feature groups
Units và descriptions
Null, all-null và constant audit
Numeric coercion
Non-finite audit
Timestamp parse probe
Schema fingerprint
SCHEMA-v1 sign-off eligibility
```

Không convert timestamp chính thức và không mutate raw DataFrame.

### 7.7. `data/temporal.py`

Sở hữu Phase 4:

```text
Strict timestamp parsing
Original-order audit
Delta classification
Duplicate timestamp classification
Grid alignment
Missing timestamps
Gap events
Coverage metrics
Continuity segmentation
Window-safety contract
TEMPORAL-v1 sign-off eligibility
```

Không interpolation, resampling, split hoặc window construction.

### 7.8. `data/eda.py`

Sở hữu calculation của Phase 5:

```text
Derived EDA view
Numeric summary
Target quantiles
Hourly và weekday profiles
Feature summaries
Correlation tables
High-correlation pairs
Selected-lag autocorrelation
Segment-aware cross-correlation
Segment-aware rolling statistics
Extreme-target samples
Hypothesis registry
Anomaly registry
EDA-v1 sign-off eligibility
```

Không sở hữu plotting backend và không thực hiện preprocessing.

### 7.9. `reporting/eda.py`

Sở hữu figure rendering của Phase 5:

```text
Canonical EDA figure names
Plot style
Axis labels
Figure export
Figure checksum handoff
```

Chỉ nhận validated tables hoặc validated derived views từ `data/eda.py`.

Không tự tính lại scientific tables theo logic khác.

### 7.9.1. `reporting/phase_summary.py`

Sở hữu presentation layer dùng chung cho Phase 0-33:

```text
Đọc canonical machine-readable artifacts đã được materialize
Tạo processing log đầy đủ độc lập với notebook presentation
Áp dụng presentation allowlist riêng cho từng Phase
Chỉ render bảng hoặc visualization trực tiếp phục vụ quyết định của Phase
Ghi một processing log JSON atomically cho mỗi Phase dưới docs/save_log_in_processing
Render HTML/CSS cục bộ, không dùng JavaScript hoặc external resource
Escape mọi artifact value trước khi đưa vào HTML
Không render warnings, discrepancies, checksum, fingerprint, source artifacts hoặc technical lineage
```

Không tính lại scientific result, không thay đổi canonical artifact và không thay thế sign-off.

Notebook presentation bắt buộc tuân thủ:

```text
Header chỉ gồm Phase, artifact version và status
Phase 1 hiển thị Environment overview và Core package versions
Phase 2 hiển thị Dataset overview
Phase 3 hiển thị Schema overview và Critical schema checks
Phase 4 hiển thị Temporal coverage và Critical temporal checks
Phase 5 chỉ hiển thị Chronological membership và Split allocation
Phase 6 chỉ hiển thị header cùng các output EDA 5.1-5.14 đã được duyệt với TRAIN-only scope
Phase 7 hiển thị Feature overview và Engineered feature registry với TRAIN-only scope
Phase 8 chỉ hiển thị Feature-set registry và không hiển thị fingerprint với TRAIN-only scope
Phase 9 chỉ hiển thị X scaler bundles và Target scaling options
Phase 10 chỉ hiển thị Window contract và Common target population
Phase 11 chỉ hiển thị Dataset population và Loader policy
Phase 12 chỉ hiển thị Metric registry và Evaluation policy
Phase 13 chỉ hiển thị Registry state và Core safeguards
Phase 14 chỉ hiển thị Validation performance và Baseline contract
```

Phase 15 hiển thị model contract và tensor-interface verification.
Phase 16 hiển thị Transformer contract và tensor-interface verification.
Phase 17 hiển thị attention verification contract và kiểm tra attention weights.
Phase 18 hiển thị forward-sanity matrix và kết quả kiểm tra hữu hạn.
Phase 19 hiển thị training-engine contract và smoke-test result.
Phase 20 hiển thị LSTM Validation metrics và learning curves.
Phase 21 hiển thị Transformer B0 Validation metrics và learning curves.
Phase 22 hiển thị diagnostic findings và learning-curve figures.
Phase 23-33 hiển thị phase state, resolved action, prerequisite state, expected conditions, verified conditions, missing conditions và bảng Validation comparison đã xác minh.

Phase mới phải khai báo presentation allowlist trước khi triển khai. Training phase chỉ hiển thị learning curves và metrics chính. Evaluation phase chỉ hiển thị model comparison và error plots cần thiết. Attention phase chỉ hiển thị heatmaps và diễn giải trực tiếp liên quan. Mọi technical detail vẫn phải được giữ đầy đủ trong processing log JSON.

### 7.10. `data/features.py`

Sở hữu toàn bộ canonical Phase 6 feature engineering:

```text
Verify signed DATA-v1, SCHEMA-v1, TEMPORAL-v1 và EDA-v1 inputs
Build deterministic FEATURES-v1 view
Create hour_sin, hour_cos, dow_sin, dow_cos và weekend
Preserve raw values, target, timestamps, row lineage và continuity segments
Create feature registry, lineage, availability và leakage audits
Write the derived CSV, manifest, checksum, discrepancy log và Phase 6 sign-off
```

Không sở hữu:

```text
Final feature-set selection
Chronological split
Scaling hoặc imputation
Manual lag hoặc rolling model features
Window construction
Training
```

### 7.11. `data/feature_sets.py`

Sở hữu toàn bộ canonical Phase 7 feature-set variants:

```text
Verify signed FEATURES-v1 inputs và checksums
Define immutable ordered feature components
Build FS0/FS1/FS2 kết hợp TF0/TF1
Validate metadata, historical-target, random-control và time-feature isolation
Validate numeric compatibility, missingness và finite values
Compute deterministic ordered-feature fingerprints
Write FEATURESETS-v1 registry, lineage, audits, manifest và sign-off
Expose defensive-copy feature-list lookup
```

Không sở hữu:

```text
Feature value transformation
Feature-set winner selection
Chronological split
Scaling hoặc imputation
Window construction
Training
```

### 7.12. `data/splitting.py`

Sở hữu toàn bộ canonical Phase 8 chronological split:

```text
Verify signed FEATURES-v1, FEATURESETS-v1 và TEMPORAL-v1 inputs
Compute deterministic floor-based 70/15/15 boundaries
Assign TRAIN, VALIDATION và TEST row membership
Preserve one full master timeline for WB0 context carry-over
Prepare WB1 strict-isolation metadata for downstream comparison
Audit chronology, coverage, disjointness và Test firewall
Compute per-split và global membership fingerprints
Create Train/Validation-only descriptive diagnostics
Create timestamp-only split timeline
Write SPLIT-v1 manifest, artifacts và sign-off
```

Không sở hữu:

```text
Scaling hoặc imputation
Feature-set winner selection
Window construction
DataLoader construction
Training hoặc evaluation metrics
Detailed Test distribution analysis trước Phase 47
```

### 7.13. `data/scaling.py`

Sở hữu toàn bộ canonical Phase 9 Train-only scaling:

```text
Verify signed FEATURES-v1, FEATURESETS-v1 và SPLIT-v1 inputs
Fit sáu variant-specific X StandardScaler bundles chỉ trên TRAIN rows
Scale continuous channels và giữ cyclical/binary channels pass-through
Fit một YS1 target scaler chỉ trên TRAIN target period
Expose YS0 identity cùng target inverse-transform utility
Bind scaler với feature order, feature fingerprint và split fingerprint
Audit Train standardization, Validation transform và structural-only Test transform
Serialize trusted local scaler artifacts, statistics, checksums, manifest và sign-off
```

Không sở hữu:

```text
Window construction
DataLoader construction
Feature-set hoặc target-scaling winner selection
Model training hoặc metrics
Detailed Test distribution inspection
```

### 7.14. `data/windows.py`

Sở hữu toàn bộ canonical Phase 10 window construction:

```text
Verify signed TEMPORAL-v1, FEATURES-v1, FEATURESETS-v1, SPLIT-v1 và SCALING-v1 inputs
Build deterministic L36, L72 và L144 native window indices cho H1
Validate timestamp cadence, continuity segments, target exclusion và sequence direction
Assign sample split bằng target timestamp
Register WB0 context carry-over và WB1 strict-isolation eligibility
Lock WINDOWPOP-v1 common target population cho controlled comparisons
Transform frozen SCALING-v1 feature timelines và materialize deterministic probes lazily
Preserve Test target firewall và không export target values
Write window index, population, audits, fingerprints, manifest, README và Phase 10 sign-off
```

Không sở hữu:

```text
PyTorch Dataset hoặc DataLoader
Model training hoặc evaluation metrics
Lookback winner selection
Full 3D tensor persistence
Test target outcome analysis trước Phase 47
```

### 7.15. `data/datasets.py`

Sở hữu toàn bộ canonical Phase 11 Dataset và DataLoader contract:

```text
Verify signed FEATURESETS-v1, SPLIT-v1, SCALING-v1, WINDOWS-v1 và WINDOWPOP-v1 inputs
Build map-style SequenceWindowDataset bằng lazy slicing từ read-only float32 feature timeline
Bind Dataset với variant, lookback, target option, window fingerprint và population fingerprint
Expose TRAIN, VALIDATION, TEST_LOCKED và explicit Phase 47 TEST_EVALUATION target access modes
Return batch-first CPU tensors với stable int64 sample_idx
Build split-specific DataLoaders cho B32 và B64
Shuffle TRAIN reproducibly và giữ VALIDATION/TEST chronological
Use drop_last false, separate split generators và canonical worker seed utility
Apply CUDA-only pin-memory policy và keep device transfer outside Dataset
Audit batch shapes, dtypes, coverage, ordering, reproducibility và Test firewall
Write registries, audits, device policy, manifest, README và Phase 11 sign-off
```

Không sở hữu:

```text
Window construction hoặc scaler fitting
Sample population selection
Model training hoặc metric calculation
Batch-size winner selection
Serialized Dataset, DataLoader hoặc full 3D tensors
Test target evaluation trước explicit Phase 47 gate
```

### 7.16. `evaluation/metrics.py`

Sở hữu toàn bộ canonical Phase 12 shared metric contract:

```text
Verify signed SCALING-v1, WINDOWS-v1, WINDOWPOP-v1 và DATALOADERS-v1 inputs
Normalize single-output arrays có shape N hoặc N x 1 về NumPy float64
Convert YS0 identity và inverse-transform YS1 bằng frozen Train-only target scaler
Compute MAE Wh, RMSE Wh và R² trên full aligned split population một lần
Preserve negative R² và explicit undefined states cho constant target hoặc N nhỏ hơn 2
Enforce residual bằng actual trừ prediction
Enforce sample index uniqueness, population coverage và chronological canonical order
Aggregate epoch loss theo sample count
Compare baseline và model chỉ khi contract, split, population, unit, horizon và sample count khớp
Enforce FINAL_TEST mode cùng model lock id trước mọi Test metric
Write metric contract, registry, schemas, audits, reference examples, manifest, README và Phase 12 sign-off
```

Không sở hữu:

```text
Model training hoặc model selection run
Prediction generation
Persistence baseline implementation
Test prediction hoặc Test target materialization trong Phase 12
Batch-mean RMSE hoặc batch-mean R² aggregation
Prediction clipping hoặc rounding trước metric
```

### 7.17. `experiments/registry.py`

Sở hữu toàn bộ canonical Phase 13 experiment registry contract:

```text
Verify signed contracts từ ENV-v1 đến METRICS-v1
Canonicalize nested run config và tạo deterministic SHA-256 config fingerprint
Validate data, model, training, reproducibility, runtime và upstream lineage fields
Allocate unique run ID theo model family, experiment family, sequence và config hash
Require canonical rerun reason cho duplicate config
Enforce parent-child lineage và final-model-lock references
Control REGISTERED, RUNNING, COMPLETED, FAILED, CANCELLED, INVALIDATED và ARCHIVED transitions
Preserve completed config immutability và failed-run evidence
Register project-relative artifacts với checksum và file size
Register METRICS-v1 rows với unit, sample count và population guards
Reject development Test targets và Test metrics
Allow final Test chỉ với FINAL_TEST family, execution type, lock id và authorization
Validate one-factor sweep consistency và run comparison compatibility
Write canonical JSONL, derived CSV views, families, audits, manifest, index, README và Phase 13 sign-off
Initialize Phase 13 production registry without fabricated runs or results
Allow Phase 14+ owners to register real runs through public lifecycle APIs
Require predictions and metrics before completing Persistence evaluation
Allow task-level Persistence config với null feature, scaler, DataLoader và seed fields
```

Không sở hữu:

```text
Model training hoặc evaluation execution
Persistence, LSTM hoặc Transformer implementation
Winner selection
Checkpoint, prediction hoặc actual metric generation
Test authorization trước Phase 47
Manual registry edits hoặc Excel source of truth
```

### 7.18. `baselines/persistence.py`

Sở hữu toàn bộ canonical Phase 14 Persistence baseline:

```text
Verify signed WINDOWS-v1, WINDOWPOP-v1, DATALOADERS-v1, METRICS-v1 và EXPERIMENTS-v1 inputs
Lock PERSISTENCE-v1 formula y_hat(t+1) = y(t)
Use the full L144-anchored common Validation population under WB0
Read raw Appliances values only through the final required Validation row
Keep Test target values and Test metrics inaccessible
Validate source-target H1 alignment, ten-minute cadence, continuity and population order
Generate raw-Wh predictions directly from input-end target history
Compute MAE Wh, RMSE Wh, R² and residuals through METRICS-v1
Register and start one PERSISTENCE_BASELINE evaluation run before metric computation
Register prediction, metric, audit and supporting artifacts before completion
Complete the run without training, scaler, DataLoader, seed, optimizer or checkpoint
Write manifest, summary, predictions, metrics, audits, discrepancies, README và Phase 14 sign-off
Expose materialize_phase_14 as the only notebook orchestration API
```

Không sở hữu:

```text
Learned model implementation
Feature-set hoặc target-scaling selection
Training, optimizer, checkpoint hoặc hyperparameter sweep
Test evaluation trước Phase 47
Moving-average hoặc seasonal baseline extension
```

### 7.19. `models/lstm_regressor.py`

Sở hữu Phase 15 LSTM implementation contract, model construction, interface audit và signed implementation artifact.

### 7.20. `models/transformer_regressor.py`

Sở hữu Phase 16 Transformer implementation contract, positional encoding integration, encoder construction, regression interface audit và signed implementation artifact.

### 7.21. `attention/verification.py`

Sở hữu Phase 17 attention-aware encoder verification, attention tensor contract, masking verification và signed verification artifact.

### 7.22. `sanity/forward_sanity.py`

Sở hữu Phase 18 forward-pass sanity matrix cho LSTM và Transformer, shape, dtype, finite-value, backward compatibility và signed sanity artifact.

### 7.23. `training/engine.py` và `training/engine_materialize.py`

Sở hữu Phase 19 training engine, epoch aggregation, Validation-only monitoring, checkpoint contract, early stopping, reproducibility handoff và signed engine artifact.

### 7.24. `baselines/lstm_baseline.py`

Sở hữu Phase 20 canonical LSTM baseline run, run-registry lifecycle, Validation metrics, checkpoint lineage, learning history và signed baseline artifact.

### 7.25. `baselines/transformer_b0.py`

Sở hữu Phase 21 canonical Transformer B0 run, run-registry lifecycle, Validation metrics, checkpoint lineage, learning history và signed baseline artifact.

### 7.26. `diagnostics/learning_diagnostics.py` và `diagnostics/learning_curves.py`

Sở hữu Phase 22 learning-curve diagnostics, validated training-history comparison, diagnostic findings, saved figures và signed diagnostics artifact.

### 7.27. `sweeps/sweep_results.py`

Sở hữu validation contract dùng chung cho Phase 23-34 sweep results, condition completeness, Validation-only winner selection, manifest, winner handoff, reference update và signed sweep artifacts.

Không được tái sử dụng sign-off nếu output path thiếu, checksum sai, condition thiếu hoặc run configuration không khớp condition.

### 7.28. `experiments/phase_execution.py`

Sở hữu selective phase inspection và resume orchestration:

```text
Phase dependency registry
Expected condition registry
Canonical evidence inspection
State classification
Smallest-safe-action resolution
Missing-only dispatch
Derived processing-log refresh
Notebook-ready persistent presentation payload
```

Module này không sở hữu training logic, scientific metric calculation hoặc HTML rendering. Module không được gọi materializer của Phase trước chỉ để kiểm tra Phase được chọn.

### 7.29. `sweeps/weight_decay.py`

Sở hữu Phase 31 S9 weight-decay contract, Phase 30 handoff preflight, WD0/WD1/WD2 mapping, frozen AdamW parameter-group policy boundary, WD1 exact-reference reuse gate, Phase 31 condition preparation và Test firewall.

Module không được hard-code S8 winner, không được xem processing log là canonical evidence, không được thêm explicit L2 loss, không được đổi optimizer group topology và không được chạy condition khi Phase 30 gate không hợp lệ.

### 7.30. `experiments/sweep_recovery.py`

Sở hữu read-only recovery audit từ Phase 22 tới target Phase, current-runtime identity inspection, earliest-invalid-dependency resolution, minimal execution-set calculation và dependency-aware recovery proposal.

Module không sở hữu training, winner selection, artifact finalization, HTML rendering hoặc scientific metric calculation. Audit mode không được ghi scientific artifact, thay đổi notebook output hoặc xem processing log là scientific evidence.

### 7.31. `sweeps/dropout.py`

Sở hữu Phase 32 S10 dropout contract, Phase 31 handoff preflight, DR01/DR02/DR03 mapping, frozen dropout-site scope, DR01 exact-reference reuse gate, DR02/DR03 fresh-run preparation, train/eval dropout semantics và Test firewall.

Module không được hard-code S9 winner, không được xem processing log là canonical evidence, không được thêm dropout site mới, không được thay đổi capacity hoặc optimizer contract và không được chạy condition khi Phase 31 gate không hợp lệ.

### 7.32. `sweeps/d_model.py`

Sở hữu Phase 33 S11 d_model contract, Phase 32 handoff preflight, D32/D64 mapping, H4/N2/F128 frozen-capacity boundary, D64 exact-reference reuse gate, D32 fresh-run preparation, model-geometry audit, capacity-efficiency context và Test firewall.

Module không được hard-code S10 winner, không được xem processing log là canonical evidence, không được bù thay đổi d_model bằng cách thay đổi head count, layer count hoặc FFN dimension và không được chạy condition khi Phase 32 gate không hợp lệ.

### 7.33. `sweeps/heads.py`

Sở hữu Phase 34 S12 head-count contract, Phase 33 handoff preflight, H2/H4 mapping, dynamic selected `d_model`, head-dimension và divisibility audit, parameter-schema equality, H4 exact-reference reuse gate, H2 fresh-run preparation, attention API sanity và Test firewall.

Module không được hard-code S11 winner, không được xem processing log là canonical evidence, không được thay `d_model`, layer count hoặc FFN dimension để bù head geometry, không được warm-start H2 từ H4 và không được chạy condition khi Phase 33 gate không hợp lệ.

### 7.34. `sweeps/layers.py`

Sở hữu Phase 35 S13 layer-count contract, Phase 34 handoff preflight, N1/N2 mapping, depth-only topology audit, independent-layer audit, N2 exact-reference reuse gate, N1 fresh-run preparation và Test firewall.

Module không được hard-code winner ngoài canonical Phase 34 handoff, không được xem processing log là canonical evidence, không được thay `d_model`, `num_heads`, FFN width hoặc optimizer contract để bù layer count, không được warm-start/truncate N1 từ N2 và không được chạy N1 khi Phase 34 gate không hợp lệ.

### 7.35. `sweeps/ffn.py`

Sở hữu Phase 36 S14 FFN-width contract, Phase 35 handoff preflight, F64/F128/F256 mapping, dynamic selected `d_model`, `num_heads`, `head_dim` và `num_layers`, FFN-only shape/parameter audit, F128 exact-reference reuse gate, F64/F256 fresh-run preparation, optimizer/attention sanity và Test firewall.

Module không được hard-code Phase 35 winner ngoài canonical handoff, không được xem processing log là canonical evidence, không được thay D/H/N hoặc bất kỳ frozen factor nào để bù FFN width, không được warm-start/slice/pad F64 hoặc F256 từ F128 và không được chạy condition khi Phase 35 gate không hợp lệ.

### 7.36. `sweeps/loss.py` và `training/losses.py`

Sở hữu Phase 37 S15 loss contract, Phase 36 handoff preflight, L0/L1 mapping, dynamic target model-space delta audit, MSE exact-reference reuse gate, Huber fresh-run preparation, criterion construction, broadcast safety, architecture/parameter invariance, gradient-clipping instrumentation support, Huber regime diagnostics và Test firewall.

Các module không được hard-code Phase 36 winner ngoài canonical handoff, không được xem processing log là canonical evidence, không được tune Huber delta, thay optimizer/data/model/budget, dùng raw criterion để chọn winner, retrain MSE hoặc chạy Huber khi Phase 36 gate không hợp lệ.

### 7.37. Các module Phase 38 trở đi

Phase 38 trở đi nằm ngoài current implementation scope. Không được triển khai nếu chưa có Phase detail, pre-process plan và Human approval riêng.

#### 7.37.1. Phase 48 ngoại lệ (prediction analysis, mô tả)

Phase 48 (Prediction Analysis) được phép tạo package:

```text
src/course_work/phase48/
src/course_work/reporting/phase_48_dashboard.py
artifacts/prediction_analysis/
docs/save_log_in_processing/phase_48_prediction_analysis_log.json
docs/save_log_in_processing/phase_48_architecture_amendment_log.json
```

sau khi amendment `phase-48-architecture-amendment-v1.10` ở §28 được Human phê duyệt.

Phase 48 chỉ phân tích frozen Phase 47 prediction bundles. Không được training, không new Test inference, không reload checkpoint để tạo prediction mới, không scaler fitting, không best-seed selection, không ensemble metric, không prediction shift/clip/calibration, không Test-derived threshold tuning, không residual / regime / worst-error / attention analysis.

#### 7.37.2. Phase 49 ngoại lệ (residual analysis, mô tả)

Phase 49 (Residual Analysis) được phép tạo package:

```text
src/course_work/phase49/
src/course_work/reporting/phase_49_dashboard.py
artifacts/residual_analysis/
docs/save_log_in_processing/phase_49_residual_analysis_log.json
docs/save_log_in_processing/phase_49_architecture_amendment_log.json
```

sau khi amendment `phase-49-architecture-amendment-v1.11` ở §28 được Human phê duyệt và pre-process plan `docs/plan-doc/plan_before_process/phase_49_residual_analysis_plan.md` đã được Human duyệt.

Phase 49 chỉ phân tích residual structure của frozen Phase 47 prediction bundles. Phase 49 dùng immutable Phase 47 prediction bundles và đọc Phase 48 signoff + handoff JSON. Phase 49 không được training, không new Test inference, không reload checkpoint để tạo prediction mới, không scaler fitting, không best-seed selection, không ensemble promotion, không residual correction / bias correction / recalibration, không residual forecasting model, không Test-derived target regimes, không worst-error ranking, không attention analysis.

#### 7.37.3. Phase 49 quy ước residual bị khóa

```text
residual_definition             = Y_TRUE_MINUS_Y_PRED
positive_residual_semantics     = UNDERPREDICTION
negative_residual_semantics     = OVERPREDICTION
zero_policy                     = EXACT_ZERO
all_three_seeds_retained        = true
seed_pooling_as_3N_iid          = false
seed_mean_residual_semantics    = SEED_MEAN_RESIDUAL_DESCRIPTIVE
best_seed_selection             = false
ensemble_residual               = false
prediction_correction           = false
bias_correction                 = false
residual_model                  = false
new_inference                   = false
training                        = false
target_regime_analysis_deferred_to_phase50 = true
worst_error_ranking_deferred_to_phase51    = true
attention_analysis_deferred_to_phase52_plus = true
```

Phase 49 phải recompute `residual = y_true - y_pred` độc lập từ frozen prediction bundles và verify exact agreement với stored `residual_wh` field ở Phase 47 prediction bundles.

Phase 49 giữ 3 Transformer seeds đối xứng khoa học: seed 42 / seed 123 / seed 2026. Ba seeds được phân tích độc lập và joint dưới dạng descriptive cross-seed summary. Không được chọn best-seed bằng Test error, không được xem 3×N = i.i.d. pooled sample.

Phase 49 prediction decile diagnostic chỉ dùng `y_pred_wh` làm basis, không dùng residual quantile và không được reuse làm Phase 50 target regimes.

Phase 50 thresholds phải là TRAIN-derived only; Phase 49 không được đề xuất hay định nghĩa Phase 50 regime.

Worst-error ranking vẫn deferred sang Phase 51; Phase 49 không được ranking per-target bằng absolute error hay squared error.

#### 7.37.4. Phase 49 temporal contract bị khóa

```text
canonical_cadence_minutes           = 10
acf_registered_lags                 = [1, 6, 12, 36, 72, 144]
acf_gap_safe                        = true
sign_run_gap_safe                   = true
sign_run_breaks_at                  = [temporal_gap, sign_change, ZERO]
rolling_window_samples              = 144
rolling_no_partial_windows          = true
rolling_no_interpolation            = true
rolling_no_padding                  = true
histogram_bins                      = 50
histogram_common_range_across_seeds = true
```

Phase 49 sign runs break tại `temporal_gap`, `sign_change` hoặc `ZERO`. Không epsilon threshold.

Phase 49 rolling diagnostics yêu cầu exactly 144 contiguous samples cho mỗi window. Mọi window không đạt `window_valid_count == 144` phải được mark invalid / missing, không partial-fill, không interpolation, không padding.

#### 7.37.5. Phase 49 statistical definitions bị khóa

```text
mad_definition              = median(abs(residual - median(residual)))
skewness_definition         = sample skewness bias=False
kurtosis_definition         = Fisher excess kurtosis bias=False normal_reference=0
histogram_bins              = 50 common bins across seeds
prediction_decile_bins      = 10 intended equal-frequency bins (y_pred-based only)
cross_seed_summary_ddof     = 1
```

Phase 49 không được trộn skew/kurtosis definitions giữa các seeds.

#### 7.37.6. Phase 49 Ljung-Box policy bị khóa

```text
ljung_box_lags                  = [6, 36, 144]
ljung_box_policy                = SECONDARY_DIAGNOSTIC
ljung_box_not_used_for_pass_fail = true
ljung_box_not_applicable_policy  = mark NOT_APPLICABLE if global series disconnected; evaluate per adequate contiguous segment
```

Phase 49 Ljung-Box p-value KHÔNG BAO GIỜ được dùng để quyết định Phase 49 PASS/FAIL.

#### 7.37.7. Phase 49 baseline eligibility

```text
PERSISTENCE       : include if frozen Phase 47 bundle is available on same Test population
LSTM_TUNED_DEV    : preserve upstream eligibility; do NOT fabricate residuals if NOT_ELIGIBLE_CONFIG_MISMATCH
```

#### 7.37.8. Phase 49 strictly forbidden actions

Phase 49 KHÔNG ĐƯỢC thực hiện bất kỳ action nào trong danh sách sau. Mọi action này đều không được weaken bởi amendment v1.11:

```text
new Test inference
model loading for prediction
checkpoint reconstruction
training
model.train()
loss.backward()
optimizer
optimizer.step()
scaler fitting
prediction correction
bias correction
residual correction model
residual forecasting model
recalibration
best-seed selection
ensemble promotion
3N iid pooling
Test-derived target regimes
worst-error ranking
attention analysis
Phase 50 implementation
Phase 51 implementation
Phase 52+ implementation
```

Phase 49 KHÔNG ĐƯỢC modify:

```text
Phase 47 frozen prediction bundles
Phase 47 signoff
Phase 48 canonical artifacts
checkpoints
registry scientific runs
```

#### 7.37.9. Phase 49 notebook boundary

Phase 49 notebook cell là presentation-only. Cấu trúc tối đa:

```text
Markdown: ## Phase 49 - Residual Analysis
Code:    from course_work.reporting.phase_49_dashboard import render_phase_49_dashboard
         display(render_phase_49_dashboard(PROJECT_ROOT))
```

Không inline computation, không `pd.read_csv`, không `def`/`class`, không `materialize_phase49*`, không subprocess / run_path, không checkpoint / torch.load, không `model.train()`, không `optimizer.step()`, không `.backward()`, không `fit()`, không `fit_transform()`.

#### 7.37.10. Phase 49 module ownership

```text
phase49/contract.py           : frozen contract re-export / mirror of phase49_a_contract.json
phase49/sources.py            : read-only Phase 47 bundle loading + checksum verify + recompute residual
phase49/distributions.py      : distribution summary + MAD + skew + kurtosis + MBE + sign balance
phase49/tails.py              : ECDF + common-bin histogram + Q-Q
phase49/autocorrelation.py    : gap-safe residual ACF + sign-run + Ljung-Box policy
phase49/rolling.py            : exact 144-sample rolling mean/std with window_valid_count == 144 gate
phase49/magnitude.py          : residual-vs-prediction and |residual|-vs-prediction associations
phase49/decile.py             : prediction-decile residual diagnostics (y_pred-based only)
phase49/cross_seed.py         : pairwise seed agreement, sign consensus, per-seed-only statistics summary
phase49/baseline.py           : Persistence baseline residual context; LSTM_TUNED_DEV NOT_ELIGIBLE handling
phase49/writers.py            : atomic CSV/JSON writers + contract-aware CSV column order
phase49/findings.py           : Phase 49 findings codes (safe wording; descriptive only)
phase49/handoffs.py           : Phase 50 / 51 / 52+ handoff JSON writers
phase49/signoff.py            : phase_49_signoff.json writer
phase49/materialize_*.py      : phase49-A/B/C/D/E/F entry points (one per sub-phase)
reporting/phase_49_dashboard.py : notebook presentation renderer (sibling of phase_48_dashboard.py)
```

## 8. Hướng dependency

### 8.1. Dependency được phép

| Caller | Dependency được phép |
|---|---|
| Notebook | Public API của contracts, data, evaluation, experiments, reporting và utils |
| Selective phase execution | Approved Phase detail, experiment registry, canonical run artifacts, phase manifests, sign-offs, checksums và artifact utility |
| Sweep recovery audit | Signed environment evidence, current runtime identity, Phase 22 canonical evidence, selective phase inspection và approved Phase 23-35 registries |
| Sweep results | Approved condition registry, experiment registry, Validation metrics, upstream reference update và artifact utility |
| Learning diagnostics | Phase 20-21 training histories, Validation metrics và artifact utility |
| LSTM và Transformer baselines | Phase 15-19 contracts, Dataset/DataLoader, shared metrics, experiment registry, training engine và artifact utility |
| Training engine | Dataset/DataLoader public API, model interfaces, shared metrics, reproducibility và artifact utility |
| Forward sanity | Model public interfaces, attention verification và artifact utility |
| Attention verification | Transformer encoder layer, attention mapping và artifact utility |
| Model implementations | Frozen feature dimensions, model contract config và artifact utility |
| Reporting | Validated Phase 0-33 artifacts, validated phase-state payload và artifact utility |
| Weight-decay sweep | Validated Phase 30 winner, reference update, sign-off, experiment registry, frozen training contract, selective execution gate và artifact utility |
| Dropout sweep | Validated Phase 31 winner, reference update, sign-off, experiment registry, frozen Transformer and training contracts, selective execution gate và artifact utility |
| d_model sweep | Validated Phase 32 winner, reference update, sign-off, experiment registry, frozen Transformer and training contracts, selective execution gate và artifact utility |
| Persistence baseline | Raw Appliances prefix, WINDOWS-v1, WINDOWPOP-v1, METRICS-v1, EXPERIMENTS-v1 và artifact utility |
| Experiment registry | Validated Phase 0-12 artifacts, shared metrics contract và artifact utility |
| Shared metrics | Frozen target scaler, canonical window population, artifact utility và approved metric libraries |
| Datasets | Feature view, feature-set registry, frozen scaler bundles, WINDOWPOP-v1 index và reproducibility utility |
| Windows | Feature view, feature-set registry, split membership, frozen scaler bundles và artifact utility |
| Scaling | Feature view, feature-set registry, split membership và artifact utility |
| Data EDA | Temporal contract, schema contract và artifact utility |
| Temporal | Schema contract và artifact utility |
| Schema | Acquisition contract và artifact utility |
| Acquisition | Artifact utility và approved external libraries |
| Contracts | Standard library và schema validator được duyệt |
| Utils | Standard library và dependency tối thiểu được duyệt |
| Tests | Public API và test fixtures |

### 8.2. Dependency bị cấm

```text
src -> notebook
contracts -> data
utils -> scientific Phase modules
schema -> temporal
temporal -> EDA
reporting -> notebook
data -> notebook
Phase trước -> Phase sau, ngoại trừ explicit validation dependency được architecture phê duyệt
raw data -> generated artifact
Test result -> Phase 0-45 selection decision
Selective phase execution -> prerequisite materializer
Reporting -> training engine
Processing log -> canonical scientific decision
```

Không circular import.

Nếu hai module cần import lẫn nhau, phải dừng và sửa ownership qua architecture plan.

## 9. Phase-to-module mapping

| Phase | Owner chính | Owner hỗ trợ | Notebook responsibility |
|---|---|---|---|
| 0 | `contracts/coursework.py` | `utils/artifacts.py`, `reporting/phase_summary.py` | Contract nội bộ, không hiển thị trong notebook |
| 1 | `utils/environment.py` | `utils/reproducibility.py`, `utils/artifacts.py`, `reporting/phase_summary.py` | Gọi audit và hiển thị HTML summary |
| 2 | `data/acquisition.py` | `utils/artifacts.py`, `reporting/phase_summary.py` | Gọi acquisition verification và hiển thị HTML summary |
| 3 | `data/schema.py` | `utils/artifacts.py`, `reporting/phase_summary.py` | Gọi schema audit và hiển thị HTML summary |
| 4 | `data/temporal.py` | `utils/artifacts.py`, `reporting/phase_summary.py` | Gọi temporal audit và hiển thị HTML summary |
| 5 | `data/splitting.py` | `data/features.py`, `data/feature_sets.py`, `utils/artifacts.py`, `reporting/phase_summary.py` | Gọi Phase 5 public API và hiển thị HTML summary |
| 6 | `data/eda.py` | `reporting/eda.py`, `reporting/phase_summary.py`, `utils/artifacts.py`, Human-approved direct notebook EDA | Gọi EDA workflow với TRAIN-only scope, thực hiện descriptive supplement và hiển thị outputs |
| 7 | `data/features.py` | `utils/artifacts.py`, `reporting/phase_summary.py` | Gọi Phase 7 public API với TRAIN-only scope và hiển thị HTML summary |
| 8 | `data/feature_sets.py` | `data/features.py`, `utils/artifacts.py`, `reporting/phase_summary.py` | Gọi Phase 8 public API với TRAIN-only scope và hiển thị HTML summary |
| 9 | `data/scaling.py` | `data/features.py`, `data/feature_sets.py`, `data/splitting.py`, `utils/artifacts.py`, `reporting/phase_summary.py` | Gọi Phase 9 public API và hiển thị HTML summary |
| 10 | `data/windows.py` | `data/features.py`, `data/feature_sets.py`, `data/splitting.py`, `data/scaling.py`, `utils/artifacts.py`, `reporting/phase_summary.py` | Gọi Phase 10 public API và hiển thị minimal HTML summary |
| 11 | `data/datasets.py` | `data/features.py`, `data/feature_sets.py`, `data/scaling.py`, `data/windows.py`, `utils/reproducibility.py`, `utils/artifacts.py`, `reporting/phase_summary.py` | Gọi Phase 11 public API và chỉ hiển thị Dataset population cùng Loader policy |
| 12 | `evaluation/metrics.py` | `data/scaling.py`, `data/windows.py`, `data/datasets.py`, `utils/artifacts.py`, `reporting/phase_summary.py` | Gọi Phase 12 public API và chỉ hiển thị Metric registry cùng Evaluation policy |
| 13 | `experiments/registry.py` | `evaluation/metrics.py`, Phase 0-12 artifacts, `utils/artifacts.py`, `reporting/phase_summary.py` | Gọi Phase 13 public API và chỉ hiển thị Registry state cùng Core safeguards |
| 14 | `baselines/persistence.py` | `data/windows.py`, `evaluation/metrics.py`, `experiments/registry.py`, `utils/artifacts.py`, `reporting/phase_summary.py` | Gọi Phase 14 public API và chỉ hiển thị Validation performance cùng Baseline contract |
| 15 | `models/lstm_regressor.py` | `data/datasets.py`, `utils/artifacts.py`, `reporting/phase_summary.py` | Gọi Phase 15 public API và hiển thị implementation contract |
| 16 | `models/transformer_regressor.py` | `models/positional_encoding.py`, `models/transformer_encoder_layer.py`, `utils/artifacts.py`, `reporting/phase_summary.py` | Gọi Phase 16 public API và hiển thị implementation contract |
| 17 | `attention/verification.py` | `attention/mapping.py`, `models/transformer_encoder_layer.py`, `utils/artifacts.py`, `reporting/phase_summary.py` | Gọi Phase 17 public API và hiển thị attention verification |
| 18 | `sanity/forward_sanity.py` | Phase 15-17 public model contracts, `utils/artifacts.py`, `reporting/phase_summary.py` | Gọi Phase 18 public API và hiển thị forward sanity matrix |
| 19 | `training/engine.py`, `training/engine_materialize.py` | `data/datasets.py`, `evaluation/metrics.py`, `experiments/registry.py`, `utils/reproducibility.py`, `utils/artifacts.py`, `reporting/phase_summary.py` | Gọi Phase 19 public API và hiển thị engine contract |
| 20 | `baselines/lstm_baseline.py` | Phase 15, 18, 19 contracts, `experiments/registry.py`, `reporting/phase_summary.py` | Gọi Phase 20 public API và hiển thị Validation metrics cùng learning curves |
| 21 | `baselines/transformer_b0.py` | Phase 16-19 contracts, `experiments/registry.py`, `reporting/phase_summary.py` | Gọi Phase 21 public API và hiển thị Validation metrics cùng learning curves |
| 22 | `diagnostics/learning_diagnostics.py` | `diagnostics/learning_curves.py`, Phase 20-21 artifacts, `reporting/phase_summary.py` | Gọi Phase 22 public API và hiển thị diagnostic findings cùng saved figures |
| 23 | `sweeps/sweep_results.py` | `experiments/phase_execution.py`, `experiments/registry.py`, `reporting/phase_summary.py` | Gọi selective Phase 23 public API và hiển thị verified S1 comparison |
| 24 | `sweeps/sweep_results.py` | `experiments/phase_execution.py`, Phase 23 reference, `experiments/registry.py`, `reporting/phase_summary.py` | Gọi selective Phase 24 public API và hiển thị verified S2 comparison |
| 25 | `sweeps/sweep_results.py` | `experiments/phase_execution.py`, Phase 24 reference, `experiments/registry.py`, `reporting/phase_summary.py` | Gọi selective Phase 25 public API và hiển thị verified S3 comparison |
| 26 | `sweeps/sweep_results.py` | `experiments/phase_execution.py`, Phase 25 reference, `experiments/registry.py`, `reporting/phase_summary.py` | Gọi selective Phase 26 public API và hiển thị verified S4 comparison |
| 27 | `sweeps/sweep_results.py` | `experiments/phase_execution.py`, Phase 26 reference, `experiments/registry.py`, `reporting/phase_summary.py` | Gọi selective Phase 27 public API và hiển thị verified S5 comparison |
| 28 | `sweeps/sweep_results.py` | `experiments/phase_execution.py`, Phase 27 reference, `experiments/registry.py`, `reporting/phase_summary.py` | Gọi selective Phase 28 public API và hiển thị verified S6 comparison |
| 29 | `sweeps/sweep_results.py` | `experiments/phase_execution.py`, Phase 28 reference, `experiments/registry.py`, `reporting/phase_summary.py` | Gọi selective Phase 29 public API và hiển thị verified S7 comparison |
| 30 | `sweeps/sweep_results.py` | `experiments/phase_execution.py`, Phase 29 reference, `experiments/registry.py`, `reporting/phase_summary.py` | Gọi một selective Phase 30 public API độc lập và hiển thị verified S8 comparison hoặc block reason |
| 31 | `sweeps/weight_decay.py` | `experiments/phase_execution.py`, Phase 30 winner/reference/sign-off, `experiments/registry.py`, frozen Training Engine, `reporting/phase_summary.py` | Gọi một selective Phase 31 public API độc lập và hiển thị verified WD0/WD1/WD2 comparison hoặc canonical block reason |
| 32 | `sweeps/dropout.py` | `experiments/phase_execution.py`, Phase 31 winner/reference/sign-off, `experiments/registry.py`, frozen Transformer và Training Engine, `reporting/phase_summary.py` | Gọi một selective Phase 32 public API độc lập và hiển thị verified DR01/DR02/DR03 comparison hoặc canonical block reason |
| 33 | `sweeps/d_model.py` | `experiments/phase_execution.py`, Phase 32 winner/reference/sign-off, `experiments/registry.py`, frozen Transformer và Training Engine, `reporting/phase_summary.py` | Gọi một selective Phase 33 public API độc lập và hiển thị verified D32/D64 comparison hoặc canonical block reason |
| 34 | `sweeps/heads.py` | `experiments/phase_execution.py`, Phase 33 winner/reference/sign-off, `experiments/registry.py`, frozen Transformer và Training Engine, `reporting/phase_summary.py` | Gọi một selective Phase 34 public API độc lập và hiển thị verified H2/H4 comparison hoặc canonical block reason |
| 35 | `sweeps/layers.py` | `experiments/phase_execution.py`, Phase 34 winner/reference/sign-off, `experiments/registry.py`, frozen Transformer và Training Engine, `reporting/phase_summary.py` | Gọi một selective Phase 35 public API độc lập và hiển thị N1/N2 preparation/comparison hoặc canonical block reason |
| 36 | `sweeps/ffn.py` | `experiments/phase_execution.py`, Phase 35 winner/reference/sign-off, `experiments/registry.py`, frozen Transformer và Training Engine, `reporting/phase_summary.py` | Gọi một selective Phase 36 public API độc lập và hiển thị F64/F128/F256 preparation/comparison hoặc canonical block reason |
| 37 | `sweeps/loss.py`, `training/losses.py` | `experiments/phase_execution.py`, Phase 36 winner/reference/sign-off, validated target scaler, `experiments/registry.py`, frozen Transformer và Training Engine, `reporting/phase_summary.py` | Gọi một selective Phase 37 public API độc lập và hiển thị L0/L1 preparation/comparison hoặc canonical block reason; không train trong notebook |

Phases 6, 7, 8 thực hiện calculation, validation và feature engineering trên TRAIN rows only. Validation và Test rows được firewall triệt để cho đến Phase 9.

Không Phase nào ngoài direct descriptive Phase 6 exception được triển khai processing logic trong notebook cell.

## 10. Data lifecycle

### 10.1. Raw data

Canonical raw CSV:

```text
COURSE_WORK/data/raw_data/energydata_complete.csv
```

Raw contract:

```text
Immutable by convention
No overwrite
No rename columns
No row sort
No date conversion on disk
No missing-value repair
No outlier removal
No split
No scaling
No feature removal
```

Protected Phase 0-5 baseline SHA-256:

```text
2820bf712ad0275cb18b85a05250926100d8e65ebb9f4d2d016ca91ea152a25d
```

Mọi Phase đọc data phải xác minh lại hash.

### 10.2. Derived audit views

Phase 3 chỉ tạo parse probe.

Phase 4 tạo deep-copy temporal view.

Phase 5 tạo `df_eda` từ validated temporal view.

Derived view phải giữ:

```text
raw_row_index
timestamp lineage
continuity_segment_id khi có
dataset revision
upstream artifact fingerprints
```

### 10.3. Processed và split data

`data_after_processing` và `data_after_split` không được dùng làm nguồn khoa học ngoài contract đã được Phase 0-33 phê duyệt.

Phase 6 chỉ được ghi derived master table đã duyệt tại `data/interim/uci_appliances_energy_prediction/energydata_feature_engineered_v1.csv`.

Phase 7 không ghi data artifact mới. Nó chỉ tham chiếu một `FEATURES-v1` master table và ghi ordered registries dưới `artifacts/feature_sets`.

Phase 8 không tạo ba bản sao feature data. Nó chỉ ghi row membership, boundaries và structural split artifacts dưới `artifacts/splits`.

Phase 9 chỉ ghi scaler/statistics artifacts và không ghi full scaled dataset.

Phase 10 chỉ ghi window indices, common target population, audits, fingerprints và sign-off dưới `artifacts/windows`. Không ghi full 3D tensors hoặc target values.

Phase 11 chỉ ghi Dataset/DataLoader configuration, registries, audits, fingerprints, device policy và sign-off dưới `artifacts/dataloaders`. Không ghi Dataset object, DataLoader object, full 3D tensors hoặc Test target values.

Phase 12 chỉ ghi metric contract, registry, schemas, synthetic reference examples, audits, discrepancies, README, manifest và sign-off dưới `artifacts/metrics`. Không ghi model prediction, model checkpoint, Test target hoặc Test metric.

Phase 13 không ghi data artifact. Nó chỉ ghi experiment registries, family definitions, lifecycle/guard audits, discrepancies, index, README, manifest và sign-off dưới `artifacts/experiments`. Synthetic run records chỉ tồn tại trong temporary directory và không được persist vào production registry.

Phase 14 không ghi derived data dưới `data`. Nó chỉ đọc bounded raw Appliances prefix, dùng Phase 10 window metadata và ghi prediction/evaluation evidence dưới `artifacts/baselines/persistence`. Production run config/status và registry views được owner Phase 13 quản lý dưới `artifacts/runs` và `artifacts/experiments`.

## 11. Configuration ownership

Phase 0 contract canonical:

```text
COURSE_WORK/configs/base/coursework_contract.json
```

Quy tắc:

```text
Human-readable và machine-readable values phải nhất quán.
Contract phải được validate trước khi materialize artifact.
Artifact copy phải có checksum.
Không sửa contract sau experiment mà không có protocol amendment.
Không lưu runtime result trong config.
```

## 12. Artifact lifecycle

### 12.1. Trạng thái artifact

```text
DRAFT
VALIDATED
SIGNED_OFF
SUPERSEDED
FAILED
```

Chỉ artifact `SIGNED_OFF` mới được Phase sau sử dụng.

### 12.2. Field provenance tối thiểu

Mỗi manifest hoặc sign-off phải có khi phù hợp:

```text
artifact_version
phase_id
created_at
environment_id
dataset_revision
input_paths
input_checksums
output_paths
output_checksums
config_fingerprint
status
warnings
discrepancies
```

Field không áp dụng phải là `null` hoặc được loại theo schema. Không điền giá trị giả.

### 12.3. Atomicity

Machine-readable artifact phải được ghi atomically và reload để verify trước sign-off.

Không overwrite artifact đã sign-off.

## 13. Artifact ownership Phase 0-33

```text
artifacts/contracts
-> Phase 0 contract và sign-off

artifacts/environment
-> Phase 1 inventory, smoke tests, dependency freeze và sign-off

artifacts/acquisition
-> Phase 2 acquisition log và sign-off

artifacts/schema
-> Phase 3 schema outputs và sign-off

artifacts/temporal
-> Phase 4 temporal outputs và sign-off

artifacts/splits
-> Phase 5 membership, boundaries, fingerprints, structural/leakage audits, Train-only distribution summary, timestamp-only figure, manifest, discrepancies và sign-off

artifacts/eda
-> Phase 6 tables, figures, manifest, anomalies, Train-only scope audit và sign-off

artifacts/features
-> Phase 7 registry, lineage, availability, leakage audit, engineering audit, manifest, derived checksum, discrepancies, Train-only scope audit và sign-off

artifacts/feature_sets
-> Phase 8 components, ordered variant registries, fingerprints, lineage, semantic/leakage/order audits, manifest, discrepancies, human-readable specification, Train-only validation audit và sign-off

artifacts/scaling
-> Phase 9 scaler registry, statistics, scaling/leakage audits, Validation-only shift diagnostic, checksums, manifest, discrepancies, README và sign-off

artifacts/scalers
-> Phase 9 six X scaler bundles và one YS1 target scaler serialized bằng trusted local joblib

artifacts/windows
-> Phase 10 window index, common target population, population summary, rejected candidates, boundary/leakage/materialization audits, fingerprints, discrepancies, README, manifest và sign-off

artifacts/dataloaders
-> Phase 11 Dataset registry, DataLoader registry, sample coverage, batch, shuffle, chronology, worker, Test-firewall audits, device policy, discrepancies, README, manifest và sign-off

artifacts/metrics
-> Phase 12 metric contract, registry, prediction/comparison schemas, unit/reference/implementation/Test-firewall audits, discrepancies, README, manifest và sign-off

artifacts/experiments
-> Phase 13 canonical JSONL registry, flattened run/family/sweep/artifact/metric/failure/comparison CSV views, validation audit, discrepancies, index, README, manifest và sign-off; Phase 14 cập nhật qua public registry APIs

artifacts/baselines/persistence
-> Phase 14 manifest, baseline summary, Validation predictions, Validation metrics, audit, unit-test evidence, discrepancies, README và sign-off

artifacts/runs
-> Phase 14+ canonical run config và status do EXPERIMENTS-v1 quản lý; Phase 14 hiện có một completed PERSISTENCE_BASELINE run

artifacts/models/lstm
-> Phase 15 LSTM implementation contract, audits, manifest và sign-off

artifacts/models/transformer
-> Phase 16 Transformer implementation contract, audits, manifest và sign-off

artifacts/attention_verification
-> Phase 17 attention tensor verification, audits, manifest và sign-off

artifacts/forward_sanity
-> Phase 18 forward-pass sanity matrix, audits, manifest và sign-off

artifacts/training_engine
-> Phase 19 training-engine contract, smoke tests, manifest và sign-off

artifacts/lstm_baseline
-> Phase 20 LSTM baseline Validation run summary, history, metrics, checkpoint lineage và sign-off

artifacts/transformer_b0
-> Phase 21 Transformer B0 Validation run summary, history, metrics, checkpoint lineage và sign-off

artifacts/learning_diagnostics
-> Phase 22 diagnostic summary, findings, saved figures, manifest và sign-off

artifacts/sweeps
-> Phase 23-34 condition results, condition lineage, manifests, winners, reference updates, revisions và sign-offs; Phase 31 S9 outputs nằm dưới artifacts/sweeps/S9_weight_decay, Phase 32 S10 outputs nằm dưới artifacts/sweeps/S10_dropout, Phase 33 S11 outputs nằm dưới artifacts/sweeps/S11_d_model và Phase 34 S12 outputs nằm dưới artifacts/sweeps/S12_heads
```

Không lưu checkpoint hoặc learned model trong các Phase 0-14 roots. Checkpoint Phase 20 trở đi phải nằm trong owner run root và được EXPERIMENTS-v1 index bằng checksum. Actual Persistence Validation predictions chỉ nằm trong owner root `artifacts/baselines/persistence`; `artifacts/experiments` chỉ index và link artifact do Phase consumer sở hữu.

## 14. Notebook boundary

### 14.1. Nội dung được phép

```text
Markdown title
Markdown scientific explanation
Import public APIs
Resolve an approved config name
Call a Phase public API
Display returned summary
Display saved figure
Display sign-off
Call a selective phase execution public API after kernel restart
Display a persistent widget-free HTML phase state
```

Chỉ được display nội dung nằm trong presentation allowlist của Phase. Không được dump JSON, warning table, discrepancy table, source artifact, checksum, fingerprint hoặc technical lineage ra notebook.

### 14.2. Nội dung bị cấm

```text
def
class
pd.read_csv
fetch_ucirepo
pd.to_datetime
DataFrame mutation
Feature derivation
Hash implementation
Schema comparison implementation
Temporal delta implementation
Gap implementation
Autocorrelation implementation
Rolling implementation
Interpolation
Outlier cleaning
Plot-construction implementation
Artifact serialization
Path-discovery logic
Exception-repair logic
Transient widget state
Direct sweep CSV loading
Condition completeness logic
Training-process dispatch logic
```

### 14.3. Cell order

Notebook phải có section tuần tự:

```text
Phase 1
Phase 2
Phase 3
Phase 4
Phase 5
Phase 6
Phase 7
Phase 8
Phase 9
Phase 10
Phase 11
Phase 12
Phase 13
Phase 14
Phase 15
Phase 16
Phase 17
Phase 18
Phase 19
Phase 20
Phase 21
Phase 22
Phase 23
Phase 24
Phase 25
Phase 26
Phase 27
Phase 28
Phase 29
Phase 30
Phase 31
Phase 32
Phase 1-32 Boundary
```

Trong đó Phase 5 là Chronological Split, Phase 6 là Exploratory Data Analysis với TRAIN-only scope, Phase 7 là Feature Engineering với TRAIN-only scope, Phase 8 là Feature-Set Variants với TRAIN-only scope. Validation và Test rows chỉ xuất hiện trong các phép biến đổi và đánh giá từ Phase 9 trở đi.

Phase 0 vẫn là canonical prerequisite nội bộ nhưng không có heading, orchestration cell, import hoặc output trong notebook.

Notebook không được dựa vào hidden kernel state.

Mỗi code cell phải chạy được sau restart kernel theo đúng thứ tự. Phase 23-33 orchestration cell phải chạy độc lập sau restart kernel bằng một public API call, không phụ thuộc hidden state từ cell trước và không gọi materializer của Phase trước.

### 14.4. Selective phase state

Selective execution phải phân loại Phase thành đúng một trạng thái:

```text
VALID_REUSABLE
LOG_MISSING
LOG_STALE
DERIVED_ARTIFACT_MISSING
CONDITION_INCOMPLETE
SIGNOFF_INVALID
UPSTREAM_INVALID
ENVIRONMENT_INVALID
RUNNING
FAILED
```

Trạng thái được xác định từ canonical evidence, không được xác định chỉ từ processing log hoặc notebook output.

### 14.5. Selective phase action

Action được phép:

```text
RENDER_ONLY
REBUILD_LOG_ONLY
REBUILD_DERIVED_ONLY
EXECUTE_MISSING_ONLY
WAIT_FOR_RUNNING_PROCESS
BLOCK
```

Dispatcher phải chọn action nhỏ nhất đủ an toàn. `EXECUTE_MISSING_ONLY` chỉ được phép khi upstream, environment, condition registry và run lineage đều hợp lệ.

### 14.6. Evidence authority

Thứ tự authority:

```text
Approved Phase detail và architecture
Approved config
Experiment registry run config và status
Run artifacts và checksums
Phase manifest và sign-off
Processing log và source checksums
Notebook stored output
```

Processing log dưới `docs/save_log_in_processing` là derived presentation record. Processing log không được tự mình chứng minh scientific completion.

### 14.7. Signed artifact revision

Artifact đã sign-off không được overwrite để che giấu invalid historical state. Correction phải tạo revision mới và active-revision pointer. Processing log có thể được tái tạo từ active validated revision.

### 14.8. Notebook output preservation

Trước khi sửa output notebook phải ghi checksum, cell ID, execution count, output count và MIME type. Không được global clear output. Chỉ output thuộc cell được refactor hoặc cell được người dùng chủ động chạy lại mới được thay đổi.

## 15. EDA boundary

Phase 5 được phép:

```text
Mô tả target và features.
Tạo EDA-only temporal columns trong df_eda.
Visualize temporal pattern.
Tạo descriptive correlation.
Tạo hypothesis cho Phase sau.
Thực hiện direct descriptive EDA trong CourseWork.ipynb theo plan CW-PHASE-5-EDA-DIRECT-001.
```

Phase 5 không được:

```text
Chọn final feature set.
Chọn final lookback.
Chọn final loss.
Bật RevIN mặc định.
Xóa spike.
Thay outlier bằng NaN.
Interpolate sensor hoặc target.
Tạo final regime từ full dataset.
Tune bằng Test.
Kết luận quan hệ nhân quả từ correlation.
```

Direct notebook smoothing demonstration không phải canonical Phase 5 processing. Nó chỉ được chạy trên deep copy, không được ghi file và không được handoff sang Phase sau.

Lag và rolling calculation phải continuity-segment-aware khi temporal audit phát hiện gap.

## 16. Test architecture

### 16.1. Contract tests

Lưu tại:

```text
COURSE_WORK/tests/contracts/
```

Kiểm tra:

```text
Phase contract schema
Artifact schema
Sign-off schema
Phase-gate dependency
Notebook boundary
```

### 16.2. Unit tests

Lưu tại:

```text
COURSE_WORK/tests/unit/
```

Mỗi public calculation phải có normal, boundary và failure tests.

### 16.3. Integration tests

Lưu tại:

```text
COURSE_WORK/tests/integration/
```

Kiểm tra:

```text
Phase 0 -> Phase 1
Phase 1 -> Phase 2
Phase 2 -> Phase 3
Phase 3 -> Phase 4
Phase 4 -> Phase 5
Phase 5 -> Phase 6
Phase 6 -> Phase 7
Phase 7 -> Phase 8
Phase 8 -> Phase 9
Phase 9 -> Phase 10
Phase 10 -> Phase 11
Phase 11 -> Phase 12
Phase 12 -> Phase 13
Phase 13 -> Phase 14
Phase 14 -> Phase 15
Phase 15 -> Phase 16
Phase 16 -> Phase 17
Phase 17 -> Phase 18
Phase 18 -> Phase 19
Phase 19 -> Phase 20
Phase 20 -> Phase 21
Phase 21 -> Phase 22
Phase 22 -> Phase 23
Phase 23 -> Phase 24
Phase 24 -> Phase 25
Phase 25 -> Phase 26
Phase 26 -> Phase 27
Phase 27 -> Phase 28
Phase 28 -> Phase 29
Phase 29 -> Phase 30
Raw checksum preservation
Artifact reload
Notebook orchestration boundary
Selective phase state resolution
Missing-only condition resolution
Persistent widget-free notebook output
Notebook output preservation
```

## 17. Phase gate

Phase N chỉ được chạy khi:

```text
Phase N-1 sign-off cho phép tiếp tục.
Input artifact tồn tại.
Input checksum khớp.
Input schema hợp lệ.
Không có unresolved critical discrepancy.
Pre-process plan đã được duyệt.
Expected condition coverage và run lineage hợp lệ khi Phase là sweep.
Signed environment hợp lệ trước mọi scientific execution.
```

Nếu một điều kiện không đạt:

```text
STOP
không tạo sign-off PASS
không chạy Phase tiếp theo
ghi issue và correction plan
```

## 18. Sign-off rules

Sign-off phải được tạo từ validation result, không được hard-code `PASS` trước khi chạy checks.

Sign-off tối thiểu chứa:

```text
phase_id
phase_version
status
input_artifacts
input_checksums
output_artifacts
output_checksums
tests
warnings
discrepancies
created_at
```

Allowed status phụ thuộc Phase detail:

```text
PASS
PASS_WITH_WARNING khi Phase cho phép
FAIL
BLOCKED
```

## 19. Code style

```text
Module và function dùng snake_case.
Class dùng PascalCase.
Constant dùng UPPER_SNAKE_CASE.
Path dùng pathlib.Path.
Public API có type annotations.
Function có responsibility đơn nhất.
Không dùng inplace mutation cho canonical inputs.
Không hard-code absolute path.
Không dùng bare except.
Không swallow exception.
Không fabricate result.
Không thêm comment hoặc icon vào code.
Không thêm dependency ngoài approved scope.
```

Scientific table phải giữ full precision. Làm tròn chỉ thuộc presentation.

## 20. Naming conventions

### 20.1. Python

```text
module_name.py
test_<module>_<behavior>.py
```

### 20.2. Artifacts

Tên artifact phải theo Phase detail nếu đã được quy định.

Không dùng:

```text
temp
new
final_final
result2
test1
```

### 20.3. Versions

```text
COURSEWORK-CONTRACT-v1
ENV-v1
DATA-v1
SCHEMA-v1
TEMPORAL-v1
EDA-v1
```

Không tái sử dụng version ID cho nội dung khác.

## 21. Reproducibility rules

```text
Environment phải được ghi trước data-dependent computation.
Representative EDA windows phải deterministic.
Random operation phải dùng approved seed.
Notebook phải chạy sạch từ đầu đến cuối.
Execution counts phải tăng tuần tự.
Không có unexecuted dependency cell.
Không dùng output cũ từ runtime khác làm bằng chứng.
```

## 22. Security and integrity

```text
Không ghi secret vào source, config hoặc artifact.
Không log toàn bộ sensitive environment variables.
Không extract archive bằng path không an toàn.
Không overwrite file ngoài approved root.
Không dùng unresolved user input làm file path.
Không chạy downloaded code từ dataset archive.
```

## 23. Git and ignore policy

Source dưới:

```text
COURSE_WORK/src/course_work/data/
```

phải trackable.

Pattern ignore cho data assets không được vô tình ignore Python source chỉ vì thư mục có tên `data`.

Git không theo dõi thư mục rỗng. Chỉ tạo package khi có `__init__.py` hoặc implementation thực sự.

Không dùng `git add .` cho workflow Phase.

## 24. Change-control gate

Cần architecture amendment và Human approval trước khi:

```text
Tạo package mới ngoài cây canonical.
Đổi canonical notebook.
Đổi owner module.
Đổi dependency direction.
Đổi data lifecycle.
Đổi artifact root.
Đổi config hierarchy.
Đổi Phase-to-module mapping.
Cho phép processing logic trong notebook.
Thêm Phase mới.
```

Không sửa architecture rule trong im lặng để hợp thức hóa code đã viết sai.

Human đã duyệt direct Phase 6 EDA exception qua yêu cầu dẫn đến plan `CW-PHASE-6-EDA-DIRECT-001`. Mọi mở rộng ngoại lệ sang Phase khác vẫn phải quay lại change-control gate.

## 25. Transition state

Trạng thái hiện hành:

```text
Phase 0-33 có canonical source owner.
CourseWork.ipynb giữ direct descriptive Phase 6 EDA exception đã được Human duyệt.
Phase 0 giữ vai trò contract nội bộ và không xuất hiện trong CourseWork.ipynb.
Phase 1-33 dùng presentation allowlist tối giản trên notebook.
Phase 0-33 vẫn lưu processing log JSON đầy đủ, độc lập với notebook presentation.
Phase 5 Chronological Split hiện chạy trước EDA, FE và FS, khoá chronological 70/15/15 row membership, WB0 primary metadata và Test firewall.
Phase 6 EDA trong notebook chỉ gọi public API với TRAIN-only scope và hiển thị outputs.
FEATURES-v1 giữ raw lineage và chỉ thêm năm deterministic calendar features trên TRAIN rows.
Phase 7 Feature Engineering trong notebook chỉ gọi public API với TRAIN-only scope và hiển thị outputs.
FEATURESETS-v1 khóa sáu ordered variants và fingerprints mà không sao chép data trên TRAIN rows.
Phase 8 Feature-Set Variants trong notebook chỉ gọi public API với TRAIN-only scope và hiển thị outputs.
Phase 9 trong notebook chỉ gọi public API và hiển thị outputs.
SCALING-v1 khóa sáu X scaler bundles, YS0 identity, một YS1 scaler và Train-only fit protocol.
Phase 10 trong notebook chỉ gọi public API và hiển thị outputs.
WINDOWS-v1 khóa L36/L72/L144 H1 geometry, WB0/WB1 metadata và lazy materialization contract.
WINDOWPOP-v1 khóa common target population cho mọi controlled comparison.
Phase 11 trong notebook chỉ gọi public API và hiển thị Dataset population cùng Loader policy.
DATALOADERS-v1 khóa lazy map-style Dataset, B32/B64, Train-only shuffle, full sample coverage, split-specific RNG và Test target firewall.
Phase 12 trong notebook chỉ gọi public API và hiển thị Metric registry cùng Evaluation policy.
METRICS-v1 khóa MAE Wh, RMSE Wh, R², full-split aggregation, original-Wh reporting, residual convention, sample-weighted epoch loss và final-Test firewall.
Phase 13 trong notebook chỉ gọi public API và hiển thị Registry state cùng Core safeguards.
EXPERIMENTS-v1 khóa run identity, canonical config fingerprint, complete lineage, lifecycle, artifact/metric links, sweep consistency, completed-config immutability và final-Test firewall.
Phase 13 khởi tạo production registry với zero fabricated runs; synthetic tests không được persist.
Phase 14 trong notebook chỉ gọi public API và hiển thị Validation performance cùng Baseline contract.
PERSISTENCE-v1 khóa task-level last-value formula, L144-anchored Validation population, raw-Wh evaluation và Test firewall.
EXPERIMENTS-v1 hiện quản lý một completed canonical PERSISTENCE_BASELINE run với null feature/scaler/seed fields và zero trainable parameters.
Phase 15-19 khóa model, attention, forward-sanity và training-engine contracts.
Phase 20-21 sở hữu canonical learned-model baseline runs và Validation-only histories.
Phase 22 sở hữu learning-curve diagnostics.
Phase 23-37 sở hữu tuần tự các controlled sweeps S1-S15.
Selective phase execution kiểm tra canonical evidence và không tự chạy upstream Phase.
Processing log là derived record và không đủ để xác nhận completion.
Phase 29, Phase 30, Phase 31, Phase 32, Phase 33, Phase 34, Phase 35, Phase 36 và Phase 37 hiện phải qua selective validation trước khi được phép reuse hoặc scientific recovery.
Phase 31 sở hữu S9 weight-decay sweep, dùng WD0=0, WD1=1e-4, WD2=1e-3 và chỉ được scientific execution sau khi Phase 30 canonical handoff hợp lệ.
Phase 32 sở hữu S10 dropout sweep, dùng DR01=0.1, DR02=0.2, DR03=0.3 và chỉ được scientific execution sau khi Phase 31 canonical handoff hợp lệ.
Phase 33 sở hữu S11 d_model sweep, dùng D32=32, D64=64, giữ H4/N2/F128 cố định, tái sử dụng D64 reference và chỉ chạy mới D32 sau khi Phase 32 canonical handoff hợp lệ.
Phase 34 sở hữu S12 head sweep, dùng H2=2 và H4=4, giữ selected d_model/N2/F128 cố định, tái sử dụng H4 exact reference và chỉ chạy mới H2 sau khi Phase 33 canonical handoff hợp lệ.
Phase 35 sở hữu S13 layer sweep, dùng N1=1 và N2=2, giữ selected d_model/H4/F128 cố định, tái sử dụng N2 exact Phase 34 winner và chỉ chạy mới N1 seed42 sau khi Phase 34 canonical handoff hợp lệ.
Phase 36 sở hữu S14 FFN sweep, dùng F64/F128/F256, tái sử dụng F128 reference và chỉ chạy mới F64/F256 seed42 sau khi Phase 35 canonical handoff hợp lệ.
Phase 37 sở hữu S15 loss sweep, dùng L0=MSE exact reference và L1=Huber(delta=1.0 model-space), giữ toàn bộ Phase 36 winner configuration cố định, chỉ chạy mới L1 seed42 sau khi Phase 36 canonical handoff hợp lệ và giữ Test FORBIDDEN.
Phase 30 recovery phải bắt đầu bằng read-only audit, xác định earliest invalid Phase, thực thi tuần tự từ dependency đó và dừng ngay khi một Phase không đạt canonical verification.
Môi trường lịch sử phải được bảo toàn; runtime identity mới không được âm thầm ghi đè signed environment evidence.
Canonical finalizer Phase 23-37 chỉ được đọc verified registry evidence, áp dụng Validation-only selection và tạo kết quả khi toàn bộ registered conditions hợp lệ. Phase 37 phải dùng full-precision Validation RMSE Wh, exact tie ưu tiên MSE và bảo toàn inherited warning trong winner, handoff và sign-off.
Dependency-aware terminal runner không được chạy lại notebook, không được tái huấn luyện condition có complete exact-match evidence và không được vượt qua Test firewall.
`--audit-only` và `--dry-run` phải giữ nguyên scientific artifacts; `--recover-environment` chỉ được tạo revision mới sau khi kernel, CUDA/MPS, smoke test và dependency freeze đều hợp lệ.
Notebook output phải dùng persistent HTML và không phụ thuộc widget model state.
Phase 49 sở hữu residual analysis: chỉ dùng frozen Phase 47 prediction bundles, giữ 3 Transformer seeds symmetric (42 / 123 / 2026), recompute residual = y_true - y_pred từ y_true_wh và y_pred_wh, MAE/RMSE/R² reconstruction phải match Phase 47 per-seed metrics ở full numerical tolerance, không new Test inference, không training, không scaler fitting, không checkpoint reload, không best-seed selection, không ensemble promotion, không residual/bias/recalibration correction, không residual forecasting model, không Test-derived target regimes, không worst-error ranking, không attention analysis. Phase 49 Phase-A (audit + contract freeze) đã complete; Phase-B / C / D / E / F chỉ được scientific execution sau khi pre-process plan `phase_49_residual_analysis_plan.md` được Human approve. Phase 49+ downstream (Phase 50 / 51 / 52+) vẫn KHÔNG ĐƯỢC triển khai trong vòng này.
Phase 50 sở hữu error-by-regime analysis: chỉ dùng frozen Phase 47 prediction bundles (target_id + y_true_wh cho Test truth), frozen Phase 48 seed-spread source (target_id-level prediction_seed_spread.csv), và frozen Phase 49 residual artifacts (residual_long_table.csv + residual_wide_table.csv). Thresholds (Q25_y, Q75_y, Q90_y, Q90_abs_delta) chỉ derive từ REGIME_REFERENCE_TRAIN-v1 = original Train target_ids (13670) ∩ WINDOWPOP-v1 target_ids ∩ continuity-valid Train target_ids, trên raw Appliances Wh (data/raw_data/energydata_complete.csv). Six regime families (R1 target-level, R2 extreme-high, R3 change-magnitude, R4 change-direction, R5 time-of-day, R6 day-type) locked trước khi stage A freeze. Test regime assignment chỉ dùng Test target_id + target_timestamp + continuity_segment_id + Test truth y_true_wh — NO y_pred, NO residual, NO model_id, NO seed trong assignment CSV. Stage A (Train-only threshold derivation) → Stage B (Test regime labeling) → Stage C (freeze + checksum) → Stage D (residual join + metrics) leakage boundary HARD; Stage D chỉ bắt đầu sau khi Stage C fingerprint freeze. Cross-seed aggregation mean + sample SD với ddof=1; NO 3N iid pooling; NO best-seed selection; NO ensemble promotion. Per-regime RMSE-lift emitted as 3 distinct fields (rmse_lift_wh signed Wh, rmse_lift_ratio dimensionless, rmse_lift_pct percentage) với non-conflated names. R² NOT_DEFINED serialization: r2_status="NOT_DEFINED" + CSV cell empty + JSON cell null; never fabricate R²=0. Sign-consensus taxonomy reused verbatim từ Phase 49 (6 classes: ALL_UNDER / ALL_OVER / ALL_EXACT / TWO_UNDER_ONE_OVER / TWO_OVER_ONE_UNDER / MIXED). Phase 50 Phase-A audit + contract freeze đã complete; pre-process plan `phase_50_error_by_regime_analysis_plan.md` đã được Human approve; amendment v1.12 đã được Human approve tại 2026-09-04. Phase 50-B/C/D/E/F/G/H implementation được authorize trong vòng này, mỗi sub-phase vẫn yêu cầu Human approval tại sub-phase gate per pre-process plan §24. Phase 51 / 52+ vẫn KHÔNG ĐƯỢC triển khai trong vòng này; Phase 51 vẫn là phase đầu tiên được authorize worst-error ranking.

#### 7.37.12. Phase 51 Worst-Error Analysis (authorized v1.13 2026-09-04)

Phase 51 (Worst-Error Analysis) được phép tạo package:

```text
src/course_work/phase51/
src/course_work/reporting/phase_51_dashboard.py
artifacts/worst_error_analysis/
docs/save_log_in_processing/phase_51_worst_error_analysis_log.json
docs/save_log_in_processing/phase_51_architecture_amendment_log.json
```

sau khi amendment `phase-51-architecture-amendment-v1.13` ở §28 được Human approve và pre-process plan `docs/plan-doc/plan_before_process/phase_51_worst_error_analysis_plan.md` đã được Human duyệt.

Phase 51 chỉ phân tích worst-error cases trên frozen Phase 47 prediction bundles, frozen Phase 49 residual artifacts, và frozen Phase 50 regime assignment. Phase 51 được authorize thực hiện deterministic worst-error ranking (W1/W2/W3/W4) với selection contract FROZEN trước khi ranking. Phase 51 KHÔNG được training, không new Test inference, không reload checkpoint để tạo prediction mới, không scaler fitting, không best-seed selection, không ensemble promotion, không prediction correction / bias correction / recalibration, không worst-error-driven retraining, không attention analysis (deferred Phase 52+), không modify Phase 47/48/49/50 canonical artifacts.
```

Phase 9-35 được triển khai theo các Phase detail tương ứng:

```text
Phase_9_Train_only_scaling.md
Phase_10_Window_builder.md
Phase_11_DataLoaders.md
Phase_12_Shared_metrics.md
Phase_13_Experiment_registry.md
Phase_14_Persistence_baseline.md
Phase_15_LSTM_implementation.md
Phase_16_Transformer_implementation.md
Phase_17_Attention-aware_encoder_verification.md
Phase_18_Forward-pass_sanity_tests.md
Phase_19_Baseline_training_engine.md
Phase_20_LSTM_baseline_run.md
Phase_21_Transformer_B0_run.md
Phase_22_Learning-curve_diagnostics.md
Phase_23_S1_Feature-set_sweep.md
Phase_24_S2_Time-feature_sweep.md
Phase_25_S3_Target-scaling_sweep.md
Phase_26_S4_Lookback_sweep.md
Phase_27_S5_Pooling_sweep.md
Phase_28_S6_Activation_sweep.md
Phase_29_S7_Batch_sweep.md
Phase_30_S8_Learning-rate_sweep.md
Phase_31_S9_Weight-decay_sweep.md
```

Không được bỏ qua Phase gate trong quá trình chuyển đổi.

## 26. Architecture validation checklist

```text
[x] Canonical root rõ ràng.
[x] Canonical notebook rõ ràng.
[x] Source ownership rõ ràng.
[x] Phase 0-37 mapping đầy đủ.
[x] Dependency direction rõ ràng.
[x] Raw data contract rõ ràng.
[x] Derived-view contract rõ ràng.
[x] Configuration ownership rõ ràng.
[x] Artifact lifecycle rõ ràng.
[x] Notebook boundary rõ ràng.
[x] EDA boundary rõ ràng.
[x] Test ownership rõ ràng.
[x] Phase gate rõ ràng.
[x] Sign-off contract rõ ràng.
[x] Git tracking rule rõ ràng.
[x] Change-control gate rõ ràng.
[x] Phase 5 Chronological Split có canonical owner, artifacts, tests và notebook orchestration boundary.
[x] Phase 6 EDA có canonical owner, artifacts, tests, notebook orchestration boundary và TRAIN-only scope gate.
[x] Phase 7 Feature Engineering có canonical owner, artifacts, tests, notebook orchestration boundary và TRAIN-only scope gate.
[x] Phase 8 Feature-Set Variants có canonical owner, artifacts, tests, notebook orchestration boundary và TRAIN-only scope gate.
[x] Phase 9 có canonical owner, artifacts, tests và notebook orchestration boundary.
[x] Phase 10 có canonical owner, artifacts, tests và notebook orchestration boundary.
[x] Phase 11 có canonical owner, artifacts, tests và notebook orchestration boundary.
[x] Phase 12 có canonical owner, artifacts, tests và notebook orchestration boundary.
[x] Phase 13 có canonical owner, artifacts, tests và notebook orchestration boundary.
[x] Phase 14 có canonical owner, artifacts, tests và notebook orchestration boundary.
[x] Phase 14 Persistence run đã complete với Validation-only metrics và Test firewall.
[x] Phase 15-22 có canonical source owner và artifact root.
[x] Phase 23-34 có sweep owner, prerequisite chain và Validation-only selection boundary.
[x] Selective phase state và action model đã được quy định.
[x] Processing log không được dùng làm canonical scientific evidence.
[x] Notebook output preservation và widget-free presentation đã được quy định.
[x] Phase 31 có S9-specific owner, selective gate, notebook boundary và Validation-only selection contract.
[x] Phase 32 có S10-specific owner, selective gate, notebook boundary và Validation-only selection contract.
[x] Phase 33 có S11-specific owner, selective gate, terminal-owned execution, presentation boundary và Validation-only selection contract.
[x] Phase 34 có S12-specific owner, selective gate, terminal-owned execution, presentation boundary và Validation-only selection contract.
[x] Phase 35 có S13-specific owner, selective gate, terminal-owned execution preparation, presentation boundary và Validation-only selection contract.
[x] Phase 35 canonical finalizer, N1/N2 evidence audit, Phase 36 handoff và inherited-warning propagation đã được triển khai.
[x] Phase 36 canonical finalizer, F64/F128/F256 evidence audit, Phase 37 handoff và inherited-warning propagation đã được triển khai.
[x] Phase 37 có S15-specific owner, selective gate, terminal-owned Huber preparation, presentation boundary, criterion provenance, loss invariance và Test firewall.
[x] Không triển khai Phase 38.
[x] Phase 48 Prediction Analysis được §7.37.1 và amendment v1.10 ở §28 authorize một cách giới hạn — chỉ dùng frozen Phase 47 predictions, không new Test inference, không training, không best-seed selection, không ensemble metric, không prediction shift/clip, không residual/regime/worst-error/attention analysis. Phase 49+ vẫn KHÔNG ĐƯỢC triển khai trong vòng này.
[x] Phase 49 Residual Analysis được §7.37.2 - §7.37.10 và amendment v1.11 ở §28 authorize một cách giới hạn — chỉ dùng frozen Phase 47 predictions, không new Test inference, không training, không scaler fitting, không checkpoint reload, không best-seed selection, không ensemble promotion, không residual/bias/recalibration correction, không residual forecasting model, không Test-derived target regimes, không worst-error ranking, không attention analysis. Phase 50 / 51 / 52+ vẫn KHÔNG ĐƯỢC triển khai trong vòng này.
[x] Phase 50 Error-by-Regime Analysis được §7.37.11 và amendment v1.12 ở §28 authorize một cách giới hạn — chỉ dùng frozen Phase 47 predictions, frozen Phase 48 seed-spread, và frozen Phase 49 residual artifacts; thresholds chỉ derive từ REGIME_REFERENCE_TRAIN-v1 (original Train ∩ WINDOWPOP-v1 ∩ continuity-valid); six regime families (R1/R2/R3/R4/R5/R6) locked trước khi stage A freeze; Test regime assignment chỉ dùng target_id + timestamp + continuity + Test truth y_true_wh (NO y_pred / NO residual / NO model_id / NO seed); Stage A/B/C/D leakage boundary HARD; không new Test inference, không training, không scaler fitting, không best-seed selection, không ensemble, không 3N iid pooling, không Test-derived threshold tuning, không recalibration, không Cartesian regime mining, không worst-error ranking (deferred Phase 51), không attention analysis (deferred Phase 52+). Phase 51 / 52+ vẫn KHÔNG ĐƯỢC triển khai trong vòng này.
[x] Phase 51 Worst-Error Analysis được §7.37.12 và amendment v1.13 ở §28 authorize một cách giới hạn — chỉ worst-error ranking trên frozen Phase 47 predictions, frozen Phase 49 residuals, và frozen Phase 50 regime assignment; selection contract FROZEN trước ranking; không new Test inference, không training, không scaler fitting, không checkpoint reload, không best-seed selection, không ensemble, không prediction correction, không attention analysis (deferred Phase 52+). Phase 52+ vẫn KHÔNG ĐƯỢC triển khai trong vòng này.
[x] Phase 52 Attention Extraction được §7.37.13 và amendment v1.14 ở §28 authorize một cách giới hạn — chỉ extraction + integrity trên ba frozen final Transformer checkpoints (FINAL_TR_SEED42/123/2026); strict-load, eval + inference_mode, forward_with_attention, no averaging, no thresholding, no smoothing, float32 raw storage; verify prediction tương đương frozen Phase 47; không training, không new Test inference (verified-only), không scaler fitting, không reranking Phase 51 cases, không best-seed selection, không ensemble, không attention interpretation, không feature importance claim, không causal claim, không Phase 53–57 implementation. Phase 53–57 chỉ nhận handoff files.
[x] Phase 53 Attention Heatmaps được §7.37.14 và amendment v1.15 ở §28 authorize một cách giới hạn — chỉ visualization trên frozen Phase 52 dense attention NPZ (float32, no averaging, no thresholding, no smoothing); render V1 case/seed grids + V2 cross-seed grids + Mode A fixed-probability views theo canonical orientation (rows=query, cols=source, row0=top=oldest, row L-1=bottom=newest); case selection = Phase51 W2 SHARED_WORST ranks 1–5 (deterministic, pre-render); không new Test inference, không new attention extraction, không model loading, không training, không scaler fitting, không best-seed/head selection, không attention=feature importance, không attention=causal claim, không Phase 54–57 implementation. Phase 54–57 chỉ nhận handoff files.
[x] Phase 54 Last-Query Attention Analysis được §7.37.15 và amendment v1.16 ở §28 authorize một cách giới hạn — chỉ quantitative last-query analysis trên frozen Phase 52 raw last-query NPZ (float32); per-target × 3 seeds × 2 layers × 4 heads metrics (entropy, normalized_entropy, effective_source_count, expected_lag, lag_sd, top1 lag/weight/tie, top5_mass, recent_1h/6h/12h/24h_mass, Lag50/80/90 coverage radii); non-overlap lag-bin masses; mean/median/SD/p05/p25/p75/p95 temporal profiles theo lag; layer head-mean profiles; top1 lag frequency; deterministic Phase51 W2 SHARED ranks 1–5 case-level line plots; reconstruct+verify Phase 52 summaries từ raw vectors; emit Phase 55 head-comparison handoff + Phase 56/57 context handoffs; không new Test inference, không new attention extraction, không model loading, không training, không scaler fitting, không best-seed/head selection, không head clustering, không head ablation, không error-conditioned groups, không regime-conditioned groups, không cross-seed head matching, không attention=feature importance, không attention=causal claim, không Phase 55–57 implementation. Phase 55–57 chỉ nhận handoff files.
[x] Phase 55 Head Comparison Analysis được §7.37.16 và amendment v1.17 ở §28 authorize một cách giới hạn — chỉ descriptive within-seed within-layer head comparison trên frozen Phase 54 head-level summaries (last_query_metric_summary_by_head.csv), per-vector metrics (last_query_metrics_long.csv), mean temporal profiles (last_query_profile_by_lag.csv), layer head-mean profiles (last_query_layer_head_mean_profile.csv), top1 lag frequencies (last_query_top1_lag_frequency.csv), lag-bin masses (last_query_lag_bin_mass.csv), recent-mass + coverage summaries; pairwise profile metrics (Pearson, Spearman, Cosine, JSD nat-log, L1, L2, Wasserstein minutes); pairwise behavioral differences (median normalized_entropy, median expected_lag_minutes, median recent_1h/6h/12h/24h, median Lag80); paired same-target difference distributions; top1 lag TVD + JSD; head-to-layer-mean distance (JSD, L1, L2, cosine, Wasserstein minutes); head behavior cards (architectural order, NO rank, NO score); layer-level head diversity summary (mean/median/max JSD, mean L1, mean Wasserstein, mean abs expected-lag diff, mean top1 TVD); deterministic Phase51 shared ranks 1–5 line plots reuse; emit Phase 56 error-conditioned attention handoff + Phase 57 seed-stability head context handoff; KHÔNG new Test inference, KHÔNG new attention extraction, KHÔNG model loading, KHÔNG training, KHÔNG scaler fitting, KHÔNG best-seed/head selection, KHÔNG head pruning, KHÔNG head ablation, KHÔNG head clustering core, KHÔNG unsupervised clustering, KHÔNG error-conditioned analysis, KHÔNG regime-conditioned analysis, KHÔNG worst-case statistical comparison, KHÔNG cross-seed head matching, KHÔNG cross-seed same-index semantic alignment assumption, KHÔNG cross-layer same-index semantic identity assumption, KHÔNG weighted head diversity score, KHÔNG post-hoc redundancy threshold, KHÔNG attention=feature importance, KHÔNG attention=causal claim, KHÔNG Phase 56–57 implementation. Phase 56–57 chỉ nhận handoff files.
[x] Phase 56 Error-Conditioned Attention được §7.37.17 và amendment v1.18 ở §28 authorize một cách giới hạn — chỉ diagnostic attention-conditioned-on-realized-Test-error analysis trên frozen Phase 49 residuals (residual_long_table.csv), frozen Phase 50 regime assignment (test_regime_assignment.csv), frozen Phase 51 shared hardness (mean_abs_error_wh derived from residual_long_table.csv theo SharedHardness_t = (|e_42|+|e_123|+|e_2026|)/3 — hardness_vs_seed_disagreement.csv chỉ chứa worst-case subset, do đó Phase 56 sẽ tự derive shared_hardness_all_test từ residual_long_table.csv theo đúng công thức), frozen Phase 52 raw last-query NPZ + attention_full_matrix_summary.csv, frozen Phase 54 per-vector metrics (last_query_metrics_long.csv) + mean temporal profiles (last_query_profile_by_lag.csv) + recent-mass summary + layer head-mean profiles; Phase 56 builds deterministic rank-based 20/60/20 seed-specific error cohorts (LOW/MID/HIGH) + exact rank-based 10 error deciles (DECILE_1..DECILE_10) + shared-hardness 20/60/20 + deciles; freezes cohort assignment SHA256 BEFORE joining attention metrics; computes C1 continuous Spearman associations (AE vs 6 CORE_ATTENTION_METRICS-v1, signed residual vs same, secondary shared-hardness vs same); computes C2 high-vs-low metric differences (mean/median/quantiles) + Cliff's delta + profile JSD/L1/Cosine/Wasserstein minutes; computes D_HL profile-difference (sum≈0 audit); computes under/over residual sign groups (UNDER=residual>0, OVER=residual<0, ZERO=residual==0) + UNDER vs OVER metric/profile comparison; computes error-decile metric summaries + per-decile mean temporal profiles (sum≈1 audit); computes permutation-invariant layer head-mean vectors per target/layer + recomputes CORE_ATTENTION_METRICS-v1 trên head-mean vectors + layer-level continuous + high-low + shared-cohort analyses; computes shared-cohort layer summary (SHARED_LOW/HIGH same-target across seeds); computes secondary full-matrix Spearman associations (mean_query_entropy, mean_self_attention_weight, mean_absolute_query_source_distance_steps, forward_within_input_mass); annotates error cohorts with frozen Phase 50 regime composition (TL_LOW/MID/HIGH, EXTREME_HIGH, CHANGE_RAPID, DIR_DOWN/FLAT/UP, TOD, weekday/weekend) without redefining thresholds; attaches deterministic Phase 51 W2 shared ranks 1–5 worst-case examples without reselection; cross-seed aggregation only after per-seed computation at layer level (no per-head cross-seed averaging, no semantic head alignment assumption); emits Phase 57 seed-stability attention handoff + Phase 58 attention-results context handoff; không training, không fine-tune, không optimizer.step, không .backward, không model.train, không scaler.fit, không scaler.fit_transform, không new Test inference, không new attention extraction, không model checkpoint loading, không model.forward, không return_attention, không materialize_phase52, không extract_attention, không best-seed/head selection, không ensemble, không head ranking, không head pruning, không head ablation, không head clustering, không cross-seed head matching, không cross-seed same-index averaging, không cross-layer same-index identity assumption, không post-hoc redundancy threshold, không weighted evidence score, không attention labeled as feature importance/causal attribution/predictive head quality, không causal claim, không regime threshold modification, không Test regime retuning, không Test error cohort used as deployment regime, không cartesian subgroup mining, không squared error as independent primary conditioning, không heatmap pixels as numeric source, không notebook modification trong run hiện tại, không Phase 57/58 implementation.
```

## 27. Activation gate

Tài liệu này chỉ trở thành architecture contract đang hoạt động sau khi Human đọc và xác nhận rõ.

Trạng thái trước approval:

```text
ARCHITECTURE_RULE_CREATED=true
ARCHITECTURE_RULE_VALIDATED=false
ARCHITECTURE_RULE_APPROVED=false
SOURCE_REFACTOR_ALLOWED=false
PHASE_0_IMPLEMENTATION_ALLOWED=false
```

Sau approval, Step A2 và Phase 0 mới được phép bắt đầu theo plan `CW-REFACTOR-0005-001`.

Trạng thái hiện hành sau Human approval:

```text
ARCHITECTURE_RULE_CREATED=true
ARCHITECTURE_RULE_VALIDATED=true
ARCHITECTURE_RULE_APPROVED=true
SOURCE_REFACTOR_ALLOWED=true
PHASE_0_IMPLEMENTATION_ALLOWED=true
PHASE_15_TO_30_ARCHITECTURE_APPROVED=true
SELECTIVE_PHASE_REFACTOR_ALLOWED=true
PHASE_31_ARCHITECTURE_APPROVED=true
PHASE_30_DEPENDENCY_RECOVERY_APPROVED=true
PHASE_32_ARCHITECTURE_APPROVED=true
PHASE_33_ARCHITECTURE_APPROVED=true
PHASE_49_PHASE_A_AUDIT_APPROVED=true
PHASE_49_PRE_PROCESS_PLAN_APPROVED=APPROVED
PHASE_49_AMENDMENT_V1_11_HUMAN_APPROVED=APPROVED
PHASE_50_PHASE_A_AUDIT_APPROVED=true
PHASE_50_PHASE_A2_GOVERNANCE_APPROVED=true
PHASE_50_PRE_PROCESS_PLAN_APPROVED=APPROVED
PHASE_50_AMENDMENT_V1_12_HUMAN_APPROVAL=APPROVED
PHASE_50_B_PHASE_B_ACTIVE_AFTER_HUMAN_APPROVAL=true
PHASE_51_PHASE_A_AUDIT_APPROVED=true
PHASE_51_AMENDMENT_V1_13_HUMAN_APPROVED=true
PHASE_51_PRE_PROCESS_PLAN_APPROVED=APPROVED
PHASE_51_B_PHASE_B_AUTHORIZED=true
PHASE_52_PHASE_A_AUDIT_APPROVED=true
PHASE_52_AMENDMENT_V1_14_HUMAN_APPROVED=true
PHASE_52_PRE_PROCESS_PLAN_APPROVED=APPROVED
PHASE_52_B_PHASE_B_AUTHORIZED=true
PHASE_52_SIGNOFF_PASS=true
PHASE_53_PHASE_A_AUDIT_APPROVED=true
PHASE_53_AMENDMENT_V1_15_HUMAN_APPROVED=true
PHASE_53_PRE_PROCESS_PLAN_APPROVED=APPROVED
PHASE_53_B_PHASE_B_AUTHORIZED=true
PHASE_53_SIGNOFF_PASS=true
PHASE_54_PHASE_A_AUDIT_APPROVED=true
PHASE_54_AMENDMENT_V1_16_HUMAN_APPROVED=APPROVED
PHASE_54_PRE_PROCESS_PLAN_APPROVED=APPROVED
PHASE_54_B_PHASE_B_AUTHORIZED=true
PHASE_54_SIGNOFF_PASS=true
PHASE_55_PHASE_A_AUDIT_APPROVED=true
PHASE_55_AMENDMENT_V1_17_HUMAN_APPROVED=APPROVED
PHASE_55_PRE_PROCESS_PLAN_APPROVED=APPROVED
PHASE_55_B_PHASE_B_AUTHORIZED=true
PHASE_55_SIGNOFF_PASS=true
PHASE_56_PHASE_A_AUDIT_APPROVED=true
PHASE_56_AMENDMENT_V1_18_HUMAN_APPROVED=APPROVED
PHASE_56_PRE_PROCESS_PLAN_APPROVED=APPROVED
PHASE_56_B_PHASE_B_AUTHORIZED=true
PHASE_56_SIGNOFF_PASS=true
PHASE_57_PHASE_A_AUDIT_APPROVED=true
PHASE_57_AMENDMENT_V1_19_HUMAN_APPROVED=APPROVED
PHASE_57_PRE_PROCESS_PLAN_APPROVED=APPROVED
PHASE_57_B_PHASE_B_AUTHORIZED=true
PHASE_57_SIGNOFF_PASS=true
```

## 28. Amendment log

```text
v1.0 (2026-08-17) - Initial activation
v1.1 (2026-08-17) - Phase reorder amendment
  - Phase 5 = Chronological Split (was EDA)
  - Phase 6 = EDA với TRAIN-only scope (was FE)
  - Phase 7 = Feature Engineering với TRAIN-only scope (was FS)
  - Phase 8 = Feature-Set Variants với TRAIN-only scope (was Split)
  - Authoritative plan: docs/plan-doc/analysis_error/phase_reorder_split_before_eda_train_only_refactor_plan.md
  - Human approval: granted 2026-08-17
v1.2 (2026-08-22) - Phase 15-30 and selective resume amendment
  - Extended canonical ownership and notebook boundary through Phase 30
  - Added selective state, action, evidence authority and artifact revision contracts
  - Added persistent widget-free presentation and output-preservation contracts
  - Authoritative plan: docs/plan-doc/plan_before_process/refactor_notebook_selective_phase_resume_plan.md
  - Human approval: granted 2026-08-22
v1.3 (2026-08-22) - Phase 31 S9 weight-decay amendment
  - Extended canonical ownership and notebook boundary through Phase 31
  - Added S9-specific owner, Phase 30 handoff gate and WD0/WD1/WD2 contract
  - Kept processing logs derived and scientific execution conditional on canonical Phase 30 evidence
  - Authoritative plan: docs/plan-doc/plan_before_process/phase_31_s9_weight_decay_selective_execution_plan.md
  - Human approval: granted 2026-08-22
v1.4 (2026-08-22) - Phase 30 dependency recovery amendment
  - Added read-only Phase 22-30 recovery inspection ownership
  - Added environment reconciliation boundary and minimal execution-set contract
  - Added verified canonical finalization and dependency-aware terminal execution rules
  - Preserved notebook outputs, historical environment evidence and Test firewall
  - Authoritative plan: docs/plan-doc/plan_before_process/refactor_and_rerun_phase_30_dependency_recovery_plan.md
  - Human approval: granted 2026-08-22
v1.5 (2026-08-22) - Phase 32 S10 dropout amendment
  - Extended canonical ownership and notebook boundary through Phase 32
  - Added S10 dropout owner, Phase 31 handoff gate and DR01/DR02/DR03 contract
  - Preserved terminal-owned execution, derived processing logs, static HTML and Test firewall
  - Authoritative plan: docs/plan-doc/plan_before_process/phase_32_s10_dropout_selective_execution_plan.md
  - Human approval: granted 2026-08-22
v1.6 (2026-08-23) - Phase 33 S11 d_model amendment
  - Extended canonical ownership and selective presentation boundary through Phase 33
  - Added S11 d_model owner, Phase 32 handoff gate and D32/D64 contract
  - Froze H4/N2/F128, reused D64 exact reference and limited fresh training to D32
  - Preserved terminal-owned execution, derived processing logs, static HTML and Test firewall
  - Authoritative plan: docs/plan-doc/plan_before_process/phase_33_s11_d_model_selective_execution_plan.md
  - Human approval: granted 2026-08-23
v1.7 (2026-08-23) - Phase 34 S12 head amendment
  - Extended canonical ownership and selective presentation boundary through Phase 34
  - Added S12 head owner, Phase 33 handoff gate and H2/H4 contract
  - Froze selected d_model/N2/F128, reused H4 exact reference and limited fresh training to H2
  - Preserved terminal-owned execution, derived processing logs, static HTML and Test firewall
  - Authoritative plan: docs/plan-doc/plan_before_process/phase_34_s12_head_sweep_selective_terminal_execution_plan.md
  - Human approval: granted 2026-08-23
v1.8 (2026-08-24) - Phase 35 S13 layer preparation amendment
  - Extended canonical ownership and selective presentation boundary through Phase 35 preparation
  - Added S13 layer owner, Phase 34 handoff gate and N1/N2 contract
  - Froze selected d_model/H4/F128, reused N2 exact reference and limited fresh training to N1
  - Preserved terminal-owned execution, JSON processing logs, raw terminal-log routing and Test firewall
  - Authoritative plan: docs/plan-doc/plan_before_process/phase_35_s13_layer_sweep_preparation_plan.md
  - Human approval: granted 2026-08-24
v1.9 (2026-08-24) - Phase 37 S15 loss preparation amendment
  - Extended canonical ownership and selective presentation boundary through Phase 37 preparation
  - Added S15 loss owner, Phase 36 handoff gate, exact L0 MSE reuse and one future fresh L1 Huber(delta=1.0 model-space) run
  - Added separate criterion provenance, architecture/parameter invariance, gradient-clipping instrumentation support, Huber regime diagnostics and Test firewall
  - Preserved terminal-owned execution, JSON processing logs, raw terminal-log routing and prohibited Phase 38 execution
  - Authoritative plan: docs/plan-doc/plan_before_process/phase_37_s15_loss_sweep_preparation_plan.md
  - Human approval: granted 2026-08-24
Phase 48 governance: Phase 48 (Prediction Analysis) is the first Phase 38+ Phase to be authorized. The authorization is documented as a v1.10 amendment under §28 and a §7.37.1 sub-entry; it does not unlock any other Phase 49+ implementation in this round.
Phase 49 governance: Phase 49 (Residual Analysis) is the second Phase 38+ Phase to be authorized. The authorization is documented as a v1.11 amendment under §28 and §7.37.2 through §7.37.10 sub-entries; it does not unlock any Phase 50 / 51 / 52+ implementation in this round. Phase 49 is a strictly derived analysis (residual = y_true - y_pred) over frozen Phase 47 prediction bundles and Phase 48 canonical artifacts.
v1.10 (2026-09-04) - Phase 48 Prediction Analysis amendment
  - Amendment ID: phase-48-architecture-amendment-v1.10
  - Date: 2026-09-04
  - Affected phase: Phase 48 (Prediction Analysis) and its downstream handoffs to Phase 49 / 50 / 51
  - Reason: authorize a strictly descriptive prediction-analysis package over frozen Phase 47 prediction bundles, without any new Test inference, training, scaler fitting, checkpoint reload, model selection, ensemble metric, prediction shifting, clipping, or residual / regime / worst-error / attention analysis.
  - Authorized paths:
    * src/course_work/phase48/ (read-only Phase 48 implementation package; sibling of src/course_work/phase47/)
    * src/course_work/reporting/phase_48_dashboard.py (notebook presentation renderer; sibling of phase_43_47_dashboard.py)
    * artifacts/prediction_analysis/ (derived immutable artifacts; sibling of artifacts/final_test/)
    * docs/save_log_in_processing/phase_48_prediction_analysis_log.json (machine-readable Phase 48 processing log)
    * docs/save_log_in_processing/phase_48_architecture_amendment_log.json (this governance log)
  - Phase 48 responsibilities (read-only):
    * frozen Phase 47 prediction loading and source-bundle checksum verification
    * source verification and prediction alignment audit
    * descriptive prediction statistics (distribution, range/compression, gap-safe change, direction agreement)
    * temporal prediction diagnostics (lag -6..+6, prediction ACF at registered lags, fixed-definition local extrema, ±1-step peak timing)
    * seed agreement and per-target seed spread (K=20 top-disagreement by seed_range_prediction only; NOT worst-error)
    * integrity audits (negative values, saturation, optional baseline context)
    * deterministic figures (full Test, Z1 first 24h / Z2 middle 24h / Z3 last 24h, scatter per seed, ECDF, change magnitude, lag, ACF, optional heatmaps)
    * atomic writers under artifacts/prediction_analysis/ (CSV + JSON, no overwrite of Phase 47 sources)
    * findings code registry with safe descriptive wording
    * Phase 49 / Phase 50 / Phase 51 handoff JSONs
    * phase_48_signoff.json writer and processing log
  - Notebook cells: presentation-only. Exactly one new cell after Phase 47: `from course_work.reporting.phase_48_dashboard import render_phase_48_dashboard; display(render_phase_48_dashboard(PROJECT_ROOT))`. No inline logic, no pd.read_csv, no def/class.
  - Forbidden actions (still prohibited and not weakened by this amendment):
    * new Test inference (any checkpoint-loaded prediction generation)
    * training, optimizer.step(), .backward(), model.train(), scaler fitting
    * best-seed selection, representative-seed selection by Test RMSE
    * ensemble performance metric (seed_mean is descriptive only; seed spread is cross-seed spread, NOT confidence interval)
    * prediction shift, clipping, post-hoc calibration, rounding for metric
    * Test-derived threshold tuning (peak/regime thresholds deferred to Phase 50 / Train-derived)
    * residual histograms / Q-Q / residual ACF / Ljung-Box / heteroskedasticity (Phase 49)
    * low/medium/high regime RMSE / hour / weekend RMSE tables (Phase 50)
    * worst-error ranking by absolute or squared error (Phase 51)
    * attention extraction or visualization (Phase 52+)
  - Source plan reference: docs/plan-doc/plan_before_process/phase_48_prediction_analysis_plan.md (pre-process plan) and docs/plan-doc/plan_detail_for_each_phase/Phase_48_Prediction_analysis.md (canonical Phase detail).
  - Human approval: pending (governance log: docs/save_log_in_processing/phase_48_architecture_amendment_log.json)
  - Test firewall: Phase 48 may read Phase 47 frozen predictions and Test population; it may NOT access Test before Phase 47's gate (already passed); it may NOT recalibrate / regenerate / modify any Test prediction.
  - Architecture strength preserved: this amendment adds new authorized paths and a new §7.37 sub-entry (§7.37.1) but does NOT delete or weaken any prior protection.

v1.11 (2026-09-04) - Phase 49 Residual Analysis amendment
  - Amendment ID: phase-49-architecture-amendment-v1.11
  - Date: 2026-09-04
  - Affected phase: Phase 49 (Residual Analysis) and its downstream handoffs to Phase 50 / 51 / 52+
  - Reason: authorize a strictly descriptive residual-analysis package over frozen Phase 47 prediction bundles, without any new Test inference, training, scaler fitting, checkpoint reload, model selection, ensemble promotion, residual / bias / recalibration correction, residual forecasting model, Test-derived target regimes, worst-error ranking, or attention analysis.
  - Authorized paths:
    * src/course_work/phase49/ (read-only Phase 49 implementation package; sibling of src/course_work/phase48/)
    * src/course_work/reporting/phase_49_dashboard.py (notebook presentation renderer; sibling of phase_48_dashboard.py)
    * artifacts/residual_analysis/ (derived immutable artifacts; sibling of artifacts/prediction_analysis/)
    * docs/save_log_in_processing/phase_49_residual_analysis_log.json (machine-readable Phase 49 processing log)
    * docs/save_log_in_processing/phase_49_architecture_amendment_log.json (this governance log)
  - Phase 49 responsibilities (read-only):
    * frozen Phase 47 prediction loading and source-bundle checksum verification
    * residual recomputation: residual = y_true - y_pred, independently from y_true_wh and y_pred_wh
    * residual integrity verification against stored residual_wh / absolute_error_wh / squared_error_wh
    * MAE / RMSE / R² reconstruction and full-tolerance match against Phase 47 per-seed metrics
    * distribution diagnostics: N, mean, median, std, MAD, min, p01, p05, p10, Q1, Q3, p90, p95, p99, max, IQR, skewness (sample, bias=False), excess kurtosis (Fisher, bias=False, normal reference 0)
    * signed bias: MBE, NMBE, MedBias, underprediction fraction, overprediction fraction
    * tail diagnostics: ECDF, common 50-bin histogram (visualization only), per-seed Q-Q against Gaussian reference
    * gap-safe residual ACF at registered lags [1, 6, 12, 36, 72, 144]
    * optional contiguous-only Ljung-Box at predeclared lags [6, 36, 144] as SECONDARY_DIAGNOSTIC
    * gap-safe sign runs and sign transitions
    * exact 144-sample rolling residual mean and std with window_valid_count == 144 gate
    * residual-vs-prediction and |residual|-vs-prediction magnitude associations
    * 10 intended equal-frequency prediction-decile residual diagnostics (y_pred-based only; diagnostic only, NOT Phase 50 regime)
    * cross-seed residual agreement and cross-seed sign consensus (per-seed primary, descriptive cross-seed summary)
    * Persistence baseline residual context (if frozen Phase 47 bundle available); LSTM_TUNED_DEV preserved as NOT_ELIGIBLE_CONFIG_MISMATCH
    * deterministic figures (ECDF, common histogram, Q-Q, residual over time, ACF, residual-vs-prediction, decile residual std, sign run lengths, pairwise seed agreement, sign consensus over time, residual heatmaps, rolling 24h residual mean/std)
    * atomic writers under artifacts/residual_analysis/ (CSV + JSON, no overwrite of Phase 47 sources)
    * findings code registry with safe descriptive wording
    * Phase 50 / Phase 51 / Phase 52+ handoff JSONs (Phase 50 thresholds TRAIN-derived only; Phase 51 worst-error ranking is Phase 51's job; Phase 52+ attention is Phase 52+'s job)
    * phase_49_signoff.json writer and processing log
  - Phase 49 residual convention contract (locked):
    * residual_definition = Y_TRUE_MINUS_Y_PRED
    * positive_residual_semantics = UNDERPREDICTION
    * negative_residual_semantics = OVERPREDICTION
    * zero_policy = EXACT_ZERO
    * all_three_seeds_retained = true
    * seed_pooling_as_3N_iid = false
    * seed_mean_residual_semantics = SEED_MEAN_RESIDUAL_DESCRIPTIVE
    * best_seed_selection = false
    * ensemble_residual = false
    * prediction_correction = false
    * bias_correction = false
    * residual_model = false
    * new_inference = false
    * training = false
    * target_regime_analysis_deferred_to_phase50 = true
    * worst_error_ranking_deferred_to_phase51 = true
    * attention_analysis_deferred_to_phase52_plus = true
  - Phase 49 temporal contract (locked):
    * canonical_cadence_minutes = 10
    * acf_registered_lags = [1, 6, 12, 36, 72, 144]
    * acf_gap_safe = true
    * sign_run_gap_safe = true
    * sign_run_breaks_at = [temporal_gap, sign_change, ZERO]
    * rolling_window_samples = 144
    * rolling_no_partial_windows = true
    * rolling_no_interpolation = true
    * rolling_no_padding = true
    * histogram_bins = 50
    * histogram_common_range_across_seeds = true
  - Phase 49 statistical definitions (locked):
    * mad_definition = median(abs(residual - median(residual)))
    * skewness_definition = sample skewness bias=False
    * kurtosis_definition = Fisher excess kurtosis bias=False normal_reference = 0
    * cross_seed_summary_ddof = 1
    * prediction_decile_bins = 10 (intended equal-frequency, y_pred-based)
    * decile_basis = y_pred_wh
    * decile_not_phase50_regime = true
  - Phase 49 Ljung-Box policy (locked):
    * ljung_box_lags = [6, 36, 144]
    * ljung_box_policy = SECONDARY_DIAGNOSTIC
    * ljung_box_not_used_for_pass_fail = true
    * ljung_box_not_applicable_policy = mark NOT_APPLICABLE if global series disconnected; evaluate per adequate contiguous segment
  - Phase 49 baseline eligibility (locked):
    * PERSISTENCE: include if frozen Phase 47 bundle is available on same Test population
    * LSTM_TUNED_DEV: preserve upstream eligibility; do NOT fabricate residuals if NOT_ELIGIBLE_CONFIG_MISMATCH
  - Notebook cells: presentation-only. Exactly one new cell after Phase 48: `from course_work.reporting.phase_49_dashboard import render_phase_49_dashboard; display(render_phase_49_dashboard(PROJECT_ROOT))`. No inline logic, no pd.read_csv, no def/class.
  - Forbidden actions (still prohibited and not weakened by this amendment):
    * new Test inference (any checkpoint-loaded prediction generation)
    * training, optimizer.step(), .backward(), model.train(), scaler fitting
    * best-seed selection, representative-seed selection by Test residual bias
    * ensemble promotion, 3N iid pooling
    * residual correction, bias correction, post-hoc recalibration, residual forecasting model
    * Test-derived threshold tuning (deciles are DIAGNOSTIC_ONLY_NOT_REGIME)
    * low/medium/high regime RMSE / hour / weekend RMSE tables (Phase 50)
    * worst-error ranking by absolute or squared error (Phase 51)
    * attention extraction or visualization (Phase 52+)
    * Phase 50 / Phase 51 / Phase 52+ implementation
  - Source plan reference: docs/plan-doc/plan_before_process/phase_49_residual_analysis_plan.md (pre-process plan) and docs/plan-doc/plan_detail_for_each_phase/Phase_49_Residual_analysis.md (canonical Phase detail).
  - Human approval: pending (governance log: docs/save_log_in_processing/phase_49_architecture_amendment_log.json)
  - Test firewall: Phase 49 may read Phase 47 frozen predictions and Phase 48 canonical artifacts; it may NOT access Test before Phase 47's gate (already passed); it may NOT recalibrate / regenerate / modify any Test prediction; it may NOT modify Phase 47 signoff or Phase 48 canonical artifacts.
  - Architecture strength preserved: this amendment adds new authorized paths and new §7.37 sub-entries (§7.37.2 through §7.37.10) but does NOT delete or weaken any prior protection. Phase 50 / 51 / 52+ remain explicitly UNAUTHORIZED.
v1.12 (2026-09-04) - Phase 50 Error-by-Regime Analysis amendment
  - Amendment ID: phase-50-architecture-amendment-v1.12
  - Date: 2026-09-04
  - Affected phase: Phase 50 (Error-by-Regime Analysis) and its downstream handoffs to Phase 51 / 52+
  - Reason: authorize a strictly descriptive regime-partitioned error-analysis package over frozen Phase 47 prediction bundles and frozen Phase 49 residual artifacts, using SIX PREDECLARED regime families (R1 target-level, R2 extreme-high, R3 change-magnitude, R4 change-direction, R5 time-of-day, R6 day-type), with all numeric thresholds derived EXCLUSIVELY from the original Train population (REGIME_REFERENCE_TRAIN-v1). The amendment establishes a HARD Stage A→B→C→D leakage boundary so that Test truth/predictions/residuals cannot influence Train-derived thresholds or Test regime assignment.
  - Authorized paths:
    * src/course_work/phase50/ (read-only Phase 50 implementation package; sibling of src/course_work/phase49/)
    * src/course_work/reporting/phase_50_dashboard.py (notebook presentation renderer; sibling of phase_49_dashboard.py)
    * artifacts/error_by_regime/ (derived immutable artifacts; sibling of artifacts/residual_analysis/)
    * docs/save_log_in_processing/phase_50_error_by_regime_analysis_log.json (machine-readable Phase 50 processing log)
    * docs/save_log_in_processing/phase_50_architecture_amendment_log.json (this governance log)
    * tests/unit/test_phase50_*.py (Phase 50 focused unit tests)
    * docs/plan-doc/plan_before_process/phase_50_error_by_regime_analysis_plan.md (pre-process plan, APPROVED 2026-09-04)
  - Phase 50 responsibilities (read-only over frozen artifacts):
    * REGIME_REFERENCE_TRAIN-v1 reconstruction: original Train target_ids ∩ WINDOWPOP-v1 ∩ continuity-valid ∩ temporally valid, on raw Appliances Wh from data/raw_data/energydata_complete.csv (timeline_target−1 = raw_row_index). Excluded: VALIDATION, TEST, Train+Validation final-refit, YS1 standardized y_model, RevIN normalized coordinates. Expected Train reference N = 13670.
    * Train-only threshold derivation (Stage A): Q25_y, Q75_y (R1), Q90_y (R2), Q90_abs_delta (R3) via numpy.quantile(method="linear") on REGIME_REFERENCE_TRAIN-v1 raw Appliances Wh and gap-safe Train |Δy|.
    * Six frozen regime families (R1/R2/R3/R4/R5/R6) with exact label sets as defined in Phase 50 plan §10-§25.
    * Test regime assignment (Stage B): label each Test target_id with R1..R6 labels using only Test target_id + target_timestamp + continuity_segment_id + Test truth y_true_wh. NO y_pred_wh, NO residual_wh, NO model_id, NO seed fields in the assignment.
    * Assignment freeze (Stage C): test_regime_assignment.csv is atomically written, sha256-fingerprinted, mode 0444, and never re-written. Stage C writes test_regime_assignment_audit.csv (10 checks) and test_regime_assignment_fingerprint.json. Stage C freeze MUST occur BEFORE Stage D begins.
    * Residual join (Stage D): many-to-one on target_id joining test_regime_assignment.csv (FROZEN) with artifacts/residual_analysis/residual_long_table.csv and residual_wide_table.csv. Expected: 0 unmatched, 0 duplicates, same_test_population=PASS.
    * Per-seed per-regime per-family metrics: MAE, RMSE, R², MBE, under/over/exact fractions, SAE, SSE, sample_share, sae_share, sse_share, mae_lift_pct and rmse_lift_pct relative to per-seed global metric; rmse_lift_wh and rmse_lift_ratio emitted as separate fields.
    * SAE/SSE contribution audits: sample_share, sae_share, sse_share sum-to-one within each (family, seed); global SSE and SAE reconstruction within 1e-9 tolerance.
    * Cross-seed aggregation: mean + sample SD with ddof=1 across the 3 seeds (42/123/2026); NO 3N iid pooling; NO best-seed selection; NO ensemble promotion; seed_mean_residual semantics preserved from Phase 49 lock.
    * Predeclared pairwise contrasts: TL_HIGH vs TL_LOW/TL_MID, EXTREME_HIGH vs NON_EXTREME, CHANGE_RAPID vs CHANGE_NORMAL, DIR_UP vs DIR_DOWN, DAY_WEEKEND vs DAY_WEEKDAY. R5 uses hardest/easiest summary rather than all pairwise.
    * Regime rank stability across seeds (rank correlation of MAE/RMSE across the 3 seeds per family).
    * Train-vs-Test prevalence per regime label.
    * Persistence regime analysis: per-regime metrics from artifacts/final_test/predictions/final_test_predictions_persistence.csv (sha256=7115af1c…, N=2961) on the same Test population; baseline-minus-transformer delta signed.
    * LSTM eligibility context: emit a single NOT_APPLICABLE row in regime_metrics_lstm.csv per Phase 47 final_test_lstm_eligibility.json (NOT_ELIGIBLE_CONFIG_MISMATCH); do NOT fabricate LSTM residuals.
    * Phase 48 seed-spread by regime: aggregate artifacts/prediction_analysis/prediction_seed_spread.csv into regime_seed_spread_summary.csv via target_id join.
    * Phase 49 sign-consensus by regime: reuse the canonical 6-class Phase 49 taxonomy (ALL_UNDER / ALL_OVER / ALL_EXACT / TWO_UNDER_ONE_OVER / TWO_OVER_ONE_UNDER / MIXED); compute per-target per-seed sign from residual_long_table.csv and join with test_regime_assignment.csv to produce regime_seed_sign_consensus_summary.csv. If a reduced taxonomy is later required, the mapping MUST be deterministic and explicitly documented before aggregation.
    * Baseline delta summaries: Persistence − Transformer delta per (regime_family, regime_label, metric).
    * Phase 51 handoff: phase50_handoff_to_phase51.json carrying per-target × per-seed × per-regime error context; NO top-K ranking (Phase 51 owns worst-error ranking).
    * Final Phase 50 signoff: 38+ gate checks covering all O50 artifacts, all source-integrity invariants, all 5 approved contract resolutions, the leakage boundary, and the residual-convention lock.
    * Atomic CSV/JSON writers under artifacts/error_by_regime/ with mode 0444 enforcement on frozen files (test_regime_assignment.csv, regime_thresholds_train_only.json, regime_threshold_fingerprint.json, test_regime_assignment_fingerprint.json, phase_50_signoff.json). NO overwrite of Phase 47 / 48 / 49 canonical artifacts.
  - Phase 50 contract resolutions (Human-approved 2026-09-04):
    * C50-I01: three distinct RMSE-lift representations MUST coexist with non-conflated names:
      - rmse_lift_wh   = regime_rmse − global_seed_rmse   (signed, in Wh)
      - rmse_lift_ratio = regime_rmse / global_seed_rmse − 1   (dimensionless)
      - rmse_lift_pct  = 100 × rmse_lift_ratio            (percentage)
    * C50-I02: sign-consensus taxonomy reused verbatim from Phase 49 (6 classes: ALL_UNDER / ALL_OVER / ALL_EXACT / TWO_UNDER_ONE_OVER / TWO_OVER_ONE_UNDER / MIXED); any reduced taxonomy in Phase 50 must be deterministically mapped and documented before aggregation.
    * C50-I03: R² NOT_DEFINED policy:
      - r2_status = "NOT_DEFINED" (explicit string)
      - CSV numeric R² field = empty (no characters between commas)
      - JSON numeric R² field = null
      - Never fabricate R² = 0.
    * C50-I04: authorize creation of a Phase 50-specific Train-only target population SHA256 (REGIME_REFERENCE_TRAIN-v1 sha256). It MUST be computed deterministically from canonical Train target_ids (UTF-8, sorted, LF-separated). Store provenance (source path: artifacts/windows/common_target_population.csv filtered by target_split_id==TRAIN) and serialization method in regime_thresholds_train_only.json.target_ids_sha256 and regime_reference_train_manifest.json. This sha256 is FROZEN before any Stage A threshold derivation.
    * C50-I09: do NOT overwrite ambiguous upstream handoffs destructively. The Phase 49 → Phase 50 consumption handoff is artifacts/residual_analysis/phase50_handoff.json (CANONICAL). If Phase 50 needs a new input-gates artifact, it MUST be a new uniquely-named Phase 50-owned file (e.g., artifacts/error_by_regime/phase50_input_gates.json); the 541-byte Phase 47 placeholder at artifacts/final_test/phase50_error_regime_handoff.json is preserved untouched as historical Phase 47 evidence.
  - Phase 50 leakage boundary (HARD; mandatory execution order):
    * Stage A — TRAIN ONLY. Inputs: data/raw_data/energydata_complete.csv, artifacts/windows/common_target_population.csv, artifacts/splits/split_membership.csv, artifacts/temporal/temporal_manifest.json. Outputs: regime_reference_train_manifest.json, regime_thresholds_train_only.json, regime_threshold_audit.csv, regime_threshold_fingerprint.json. Forbidden inputs: any Phase 47 prediction bundle, any Phase 49 residual artifact, any Phase 48 prediction_seed_spread.csv.
    * Stage B — TEST TRUTH + TIMESTAMP + CONTINUITY ONLY. Inputs: FINAL_TEST_POP-v1 target_ids/target_timestamps, common_target_population.csv.continuity_segment_id, y_true_wh column of seed42/123/2026 prediction bundles (Test truth is identical across the 3 seeds and the persistence bundle). Outputs: train_regime_assignment.csv, test_regime_assignment.csv. Forbidden inputs: y_pred_wh, residual_wh, absolute_error_wh, squared_error_wh2, any model_id/seed column, any residual artifact.
    * Stage C — FREEZE + AUDIT. Inputs: only the just-written test_regime_assignment.csv. Outputs: test_regime_assignment_audit.csv (10 checks), test_regime_assignment_fingerprint.json (sha256 of frozen assignment). NO read of any prediction column. NO further writes to test_regime_assignment.csv.
    * Stage D — JOIN + METRIC, ONLY AFTER STAGE C. Inputs: test_regime_assignment.csv (FROZEN), artifacts/residual_analysis/residual_long_table.csv, artifacts/residual_analysis/residual_wide_table.csv, artifacts/final_test/predictions/final_test_predictions_persistence.csv (Persistence only). Outputs: regime_error_join_audit.csv, regime_metrics_long.csv, regime_metrics_<family>.csv (6 family tables), regime_metrics_persistence.csv, regime_metrics_lstm.csv (single NOT_APPLICABLE row), regime_rmse_lift.csv, regime_pairwise_contrasts.csv, regime_rank_stability.csv, regime_train_vs_test_prevalence.csv, regime_seed_spread_summary.csv, regime_seed_sign_consensus_summary.csv, baseline_delta_summary.csv, regime_persistence_delta_*.csv.
  - Phase 50 statistical and serialization contracts (locked):
    * quantile_method = "linear" (numpy.quantile default)
    * cross_seed_summary_ddof = 1
    * residual_convention_inherited_from_phase49 = "y_true - y_pred"
    * positive_residual_semantics_inherited = "UNDERPREDICTION"
    * negative_residual_semantics_inherited = "OVERPREDICTION"
    * zero_policy_inherited = "EXACT_ZERO"
    * all_three_seeds_retained = true
    * seed_pooling_as_3N_iid = false
    * best_seed_selection = false
    * ensemble_residual = false
    * decile_not_phase50_regime = true (carry forward from Phase 49)
    * train_target_ids_sha256_Phase50_specific = REQUIRED (per C50-I04)
  - Phase 50 forbidden actions (still prohibited and not weakened by this amendment):
    * new Test inference (any checkpoint-loaded prediction generation)
    * training, optimizer.step(), .backward(), model.train(), scaler fitting, scaler.transform() on Test
    * best-seed selection, representative-seed selection by any regime metric
    * ensemble promotion, 3N iid pooling
    * prediction correction, bias correction, post-hoc recalibration, regime-specific recalibration
    * Test-derived threshold tuning, threshold perturbation using Test, cross-validation of regime thresholds against Test error
    * full regime Cartesian product mining (e.g., HIGH × RAPID × EVENING × WEEKEND)
    * regime-driven retuning of features / lookback / loss / learning rate / RevIN / epoch / Transformer / seed
    * worst-error ranking by absolute or squared error (deferred to Phase 51)
    * attention extraction or visualization (deferred to Phase 52+)
    * Phase 51 implementation, Phase 52+ implementation
    * destructive overwrite of artifacts/final_test/phase50_error_regime_handoff.json (per C50-I09)
    * destructive overwrite of artifacts/residual_analysis/phase50_handoff.json (the Phase 49 → Phase 50 consumption handoff)
    * destructive overwrite of any Phase 47 / 48 / 49 canonical artifact
  - Notebook cells: presentation-only. Exactly one new cell after Phase 49: `from course_work.reporting.phase_50_dashboard import render_phase_50_dashboard; display(render_phase_50_dashboard(PROJECT_ROOT))`. No inline logic, no pd.read_csv, no def/class, no threshold computation, no train/test regime assignment logic, no residual joins, no metric computation.
  - Source plan reference: docs/plan-doc/plan_before_process/phase_50_error_by_regime_analysis_plan.md (pre-process plan, APPROVED 2026-09-04) and docs/plan-doc/plan_detail_for_each_phase/Phase_50_Error-by-regime_analysis.md (canonical Phase detail).
  - Human approval: APPROVED 2026-09-04 (governance log: docs/save_log_in_processing/phase_50_architecture_amendment_log.json). Phase 50-B/C/D/E/F/G/H still require Human approval at each sub-phase gate per the pre-process plan §24.
  - Test firewall: Phase 50 may read Phase 47 frozen predictions, Phase 48 canonical artifacts, and Phase 49 residual artifacts; it may NOT access Test for threshold derivation; it may NOT recalibrate / regenerate / modify any Test prediction; it may NOT modify Phase 47 / 48 / 49 canonical artifacts or signoffs.
  - Architecture strength preserved: this amendment adds new authorized paths and new §7.37 sub-entries (§7.37.11) but does NOT delete or weaken any prior protection. Phase 51 / 52+ remain explicitly UNAUTHORIZED.

v1.13 (2026-09-04) - Phase 51 Worst-Error Analysis amendment
  - Amendment ID: phase-51-architecture-amendment-v1.13
  - Date: 2026-09-04
  - Affected phase: Phase 51 (Worst-Error Analysis) and its downstream handoff to Phase 52
  - Reason: authorize a strictly descriptive worst-error case analysis package over frozen Phase 47 prediction bundles, frozen Phase 49 residual artifacts, and frozen Phase 50 regime assignment. The selection contract (K_PER_SEED, K_SHARED, K_UNDER_PER_SEED, K_OVER_PER_SEED, K_SHARED_SIGNED, CONTEXT_RADIUS, primary ranking metric, tie-break rule) MUST be FROZEN in Phase 51-B BEFORE any ranking execution. No new Test inference, no training, no scaler fitting, no checkpoint reload, no model selection, no ensemble metric, no prediction correction, no Test-derived threshold tuning, no Phase 50 regime/threshold modification, no attention analysis (deferred Phase 52+). Phase 51 is the FIRST authorized phase for worst-error ranking; Phase 48 explicitly did NOT execute worst-error ranking.
  - Authorized paths:
    * src/course_work/phase51/ (read-only Phase 51 implementation package; sibling of src/course_work/phase50/)
    * src/course_work/reporting/phase_51_dashboard.py (notebook presentation renderer; sibling of phase_50_dashboard.py)
    * artifacts/worst_error_analysis/ (derived immutable artifacts; sibling of artifacts/error_by_regime/)
    * docs/save_log_in_processing/phase_51_worst_error_analysis_log.json (machine-readable Phase 51 processing log)
    * docs/save_log_in_processing/phase_51_architecture_amendment_log.json (this governance log)
    * tests/unit/test_phase51_*.py (Phase 51 focused unit tests)
    * docs/plan-doc/plan_before_process/phase_51_worst_error_analysis_plan.md (pre-process plan, APPROVED 2026-09-04)
  - Phase 51 selection contract (HUMAN-APPROVED 2026-09-04, MUST be frozen in worst_error_selection_contract.json in Phase 51-B BEFORE any Phase 51-C ranking):
    * K_PER_SEED = 20 (top 20 absolute_error_wh per seed, separately for seed 42 / 123 / 2026)
    * K_SHARED = 20 (top 20 by mean(|e42|+|e123|+|e2026|)/3 across all Test targets)
    * K_UNDER_PER_SEED = 10 (top 10 per seed, residual > 0 only)
    * K_OVER_PER_SEED = 10 (top 10 per seed, residual < 0 only)
    * K_SHARED_SIGNED = 10 (shared all-under top 10 OR shared all-over top 10)
    * CONTEXT_RADIUS = 6 steps (target-centric ±6 on 10-minute cadence)
    * PRIMARY_RANKING_METRIC = "absolute_error_wh DESC"
    * TIE_BREAK = "target_id ASC" (deterministic; no random tiebreak; no manual pre-selection)
    * RANDOM_TIEBREAK_FORBIDDEN = true
    * MANUAL_PRE_SELECTION_FORBIDDEN = true
    * CHERRY_PICKING_FORBIDDEN = true
    * RANKING_FAMILIES_REGISTERED = [W1=PER_SEED_WORST, W2=SHARED_WORST, W3=UNDERPREDICTION_WORST, W4=OVERPREDICTION_WORST, W3_SH=SHARED_ALL_UNDER, W4_SH=SHARED_ALL_OVER]
  - Phase 51 responsibilities (read-only over frozen artifacts):
    * Source verification (Phase 47 prediction bundles, Phase 49 residual tables, Phase 50 regime assignment + thresholds, Phase 50 / Phase 51 handoffs) using verified canonical SHA256.
    * Selection contract freeze: write worst_error_selection_contract.json (Phase 51-B) and selection_contract_fingerprint.json. SHA256-fingerprint the contract BEFORE any ranking execution.
    * W1 ranking: per-seed top 20 by absolute_error_wh DESC, tie-break target_id ASC.
    * W2 ranking: per-target mean(|e42|+|e123|+|e2026|)/3 across all 2,961 Test targets; top 20 by mean_abs_error DESC, tie-break target_id ASC.
    * W3 ranking: per-seed top 10 by absolute_error_wh DESC filtering residual > 0 (UNDERPREDICTION).
    * W4 ranking: per-seed top 10 by absolute_error_wh DESC filtering residual < 0 (OVERPREDICTION).
    * W3_SH ranking: shared all-under top 10 (residual > 0 for ALL 3 seeds) by absolute_error_wh DESC.
    * W4_SH ranking: shared all-over top 10 (residual < 0 for ALL 3 seeds) by absolute_error_wh DESC.
    * Cross-seed overlap / Jaccard: pairwise Jaccard coefficient between W1 sets per (seed_i, seed_j) pair; size of intersection and union.
    * Error concentration: SAE/SSE share of selected top-K cases vs full Test population; cumulative share.
    * Hardness vs seed-spread: Pearson correlation between per-target SharedHardness and Phase 48 seed-spread; per-regime break.
    * Regime enrichment: join selected case target_ids with Phase 50 test_regime_assignment.csv (FROZEN) to assign R1..R6 labels; computing per-regime share in selected vs Test baseline.
    * Persistence context: per-target Persistence MAE/RMSE at selected timestamps using artifacts/final_test/predictions/final_test_predictions_persistence.csv (sha256=7115af1c…); explicit baseline delta.
    * LSTM context: emit a single NOT_APPLICABLE row per Phase 47 final_test_lstm_eligibility.json (NOT_ELIGIBLE_CONFIG_MISMATCH, LSTM lookback=None vs Transformer lookback=72); do NOT fabricate LSTM worst cases.
    * Local temporal context: ±6 step context around each selected target using frozen Phase 49 residual_long_table.csv and data/raw_data/energydata_complete.csv; gap-safe; mark invalid / missing for unavailable left/right context; never interpolate or pad.
    * Exact input-window context: read preprocessed input features from Phase 11 dataloader artifacts (TEST loader fingerprint) at the exact target_id positions WITHOUT reloading checkpoints or performing inference.
    * Casebook: deterministic worst-case casebook (casebook_index.csv + casebook.md) with full metadata (target_id, timestamp, regime labels, persistence context, ±6 context, input-window summary).
    * Deterministic figures: 6-8 diagnostic figures (per-seed top-K scatter, shared top-K scatter, seed-pair Venn diagrams, regime overrepresentation, hardness vs seed-spread, input-window heatmap).
    * Findings + report + README + summary JSON + discrepancies + sign-off.
    * Phase 52 handoff: phase52_attention_extraction_handoff.json + phase52_attention_case_table.csv with case_ids + context fingerprint (does NOT authorize Phase 52 execution).
  - Phase 51 leakage boundary (HARD; mandatory execution order):
    * Sub-phase 51-A: governance + preflight + source audit. NO ranking, NO inspection of worst cases. Status: COMPLETE 2026-09-04.
    * Sub-phase 51-B: selection contract freeze. NO ranking. Selection contract SHA256-fingerprinted BEFORE any ranking execution.
    * Sub-phase 51-C: W1/W2/W3/W4 ranking only (no casebook narrative).
    * Sub-phase 51-D: overlap / concentration / hardness-vs-spread (cross-seed metrics).
    * Sub-phase 51-E: regime enrichment + Persistence context (LSTM row NOT_APPLICABLE).
    * Sub-phase 51-F: temporal ±6 context + input-window context + casebook.
    * Sub-phase 51-G: figures + findings + discrepancies + summary + report + README + Phase52 handoff + signoff.
    * Sub-phase 51-H: notebook presentation-only dashboard.
  - Phase 51 statistical and serialization contracts (locked):
    * canonical_cadence_minutes = 10 (Phase 49 frozen; Phase 51 inherits)
    * local_context_radius_steps = 6 (target-centric; ±6 = 11 total samples per case)
    * cross_seed_summary_ddof = 1
    * residual_convention_inherited_from_phase49 = "y_true - y_pred"
    * positive_residual_semantics_inherited = "UNDERPREDICTION"
    * negative_residual_semantics_inherited = "OVERPREDICTION"
    * zero_policy_inherited = "EXACT_ZERO"
    * all_three_seeds_retained = true
    * seed_pooling_as_3N_iid = false
    * best_seed_selection = false
    * ensemble = false
    * persistence_for_context_only = true (not a competing model; serves as descriptive baseline)
    * lstm_eligibility_inherited = "NOT_ELIGIBLE_CONFIG_MISMATCH" (Phase 47 frozen)
    * target_centric_indexing = true (±6 from target_timestamp, NOT from any seed-specific window)
    * temporal_gap_safe = true (no interpolation; no padding; mark invalid/missing)
  - Phase 51 forbidden actions (still prohibited and not weakened by this amendment):
    * new Test inference (any checkpoint-loaded prediction generation)
    * training, optimizer.step(), .backward(), model.train(), scaler fitting, scaler.transform() on Test
    * best-seed selection by any worst-error metric
    * ensemble promotion, 3N iid pooling
    * prediction correction, bias correction, post-hoc recalibration, regime-specific recalibration
    * Test-derived threshold tuning, threshold perturbation using Test, cross-validation of any Phase 51 contract against Test error
    * worst-error-driven regime recomputation (Phase 50 regimes are FROZEN)
    * manual cherry-picking of cases BEFORE selection contract is frozen
    * random tie-break in ranking (deterministic target_id ASC only)
    * attention extraction or visualization (deferred Phase 52+)
    * Phase 52 implementation
    * destructive overwrite of any Phase 47 / 48 / 49 / 50 canonical artifact
    * destructive overwrite of test_regime_assignment.csv (Phase 50 FROZEN Stage C)
    * destructive overwrite of regime_thresholds_train_only.json (Phase 50 FROZEN Stage C)
  - Notebook cells: presentation-only. Eventually exactly one new cell after Phase 50: `from course_work.reporting.phase_51_dashboard import render_phase_51_dashboard; display(render_phase_51_dashboard(PROJECT_ROOT))`. No inline logic, no pd.read_csv, no def/class, no ranking computation, no casebook logic. To be executed only after Phase 51-G signoff + Human approval.
  - Source plan reference: docs/plan-doc/plan_before_process/phase_51_worst_error_analysis_plan.md (pre-process plan, APPROVED 2026-09-04) and docs/plan-doc/plan_detail_for_each_phase/Phase_51_Worst-error_analysis.md (canonical Phase detail).
  - Human approval: APPROVED 2026-09-04 (governance log: docs/save_log_in_processing/phase_51_architecture_amendment_log.json). Phase 51-B/C/D/E/F/G/H still require Human approval at each sub-phase gate per the pre-process plan §12.
  - Test firewall: Phase 51 may read Phase 47 frozen predictions, Phase 49 residual artifacts, Phase 50 regime/threshold artifacts, and Phase 47 Persistence bundle (for descriptive baseline context only); it may NOT access Test for threshold derivation, threshold tuning, prediction correction, or model retraining; it may NOT recalibrate / regenerate / modify any Test prediction; it may NOT modify Phase 47 / 48 / 49 / 50 canonical artifacts or signoffs.
  - Architecture strength preserved: this amendment adds new authorized paths and a new §7.37 sub-entry (§7.37.12) but does NOT delete or weaken any prior protection. Phase 52+ remains explicitly UNAUTHORIZED.

#### 7.37.13. Phase 52 Attention Extraction (authorized v1.14 2026-09-04)

Phase 52 (Attention Extraction) được phép tạo package:

```text
src/course_work/phase52/
artifacts/attention_extraction/
src/course_work/reporting/phase_52_dashboard.py
docs/save_log_in_processing/phase_52_attention_analysis_log.json
docs/save_log_in_processing/phase_52_architecture_amendment_log.json
tests/unit/test_phase52_*.py
```

sau khi amendment `phase-52-architecture-amendment-v1.14` ở §28 được Human approve và pre-process plan `docs/plan-doc/plan_before_process/phase_52_attention_analysis_plan.md` đã được Human duyệt.

Phase 52 là extraction + integrity phase cho temporal self-attention của ba final Transformer seeds (42/123/2026). Phase 52 chỉ strict-load frozen final checkpoints, reconstruct exact final Transformer, execute eval/inference-mode diagnostic forward passes, obtain raw attention via `forward_with_attention`, verify predictions against frozen Phase 47 values, persist raw attention (float32, no averaging), compute extraction diagnostics, write Phase53–57 handoff files.

Phase 52 KHÔNG được training, fine-tune, optimizer.step, .backward, scaler fitting, thay đổi features/lookback, alter Phase 47 prediction values, rerank Phase 51 cases, select best seed, create ensemble, interpret attention causally, gọi attention = feature importance, decide best head, start heatmap interpretation, hay implement Phase 53–57.

Phase 53–57 chỉ nhận handoff files; PHASE53_IMPLEMENTATION_AUTHORIZED = false, ..., PHASE57_IMPLEMENTATION_AUTHORIZED = false.

v1.14 (2026-09-04) - Phase 52 Attention Extraction amendment
  - Amendment ID: phase-52-architecture-amendment-v1.14
  - Date: 2026-09-04
  - Affected phase: Phase 52 (Attention Extraction) and its downstream handoffs to Phase 53 / 54 / 55 / 56 / 57
  - Reason: authorize a strictly extraction + integrity phase over the frozen final Transformer checkpoints (FINAL_TR_SEED42/123/2026), reading frozen Phase 51 case set, frozen Phase 47 prediction bundles, frozen Phase 48 seed spread, frozen Phase 49 residuals, and frozen Phase 50 regime assignment. No training, no new Test inference, no model retraining, no scaler fitting, no checkpoint re-creation, no case re-ranking, no attention interpretation, no best-seed selection, no ensemble, no feature importance claim, no causal claim, no Phase 53–57 implementation.
  - Authorized paths:
    * src/course_work/phase52/ (read-only Phase 52 implementation package; sibling of src/course_work/phase51/)
    * artifacts/attention_extraction/ (derived immutable artifacts; sibling of artifacts/worst_error_analysis/)
    * src/course_work/reporting/phase_52_dashboard.py (deferred to Phase 52-H; path authorized but not implemented in this run)
    * docs/save_log_in_processing/phase_52_attention_analysis_log.json
    * docs/save_log_in_processing/phase_52_architecture_amendment_log.json (this governance log)
    * tests/unit/test_phase52_*.py
  - Phase 52 responsibilities (extraction + integrity only):
    * strict-load frozen final checkpoints (FINAL_TR_SEED42/123/2026); reject rejected candidates, Phase44 rolling, LSTM, old baseline
    * reconstruct exact final Transformer (same attention-aware implementation as Phase 17 ATTENTION_VERIFY-v1)
    * execute eval + torch.inference_mode diagnostic forward passes via model.forward_with_attention(x)
    * verify inspection-path prediction numerically equivalent to frozen Phase 47 predictions (rtol=atol=1e-5, model-space preferred; Wh acceptable if mapping locked)
    * persist per-seed raw dense attention for the frozen Phase51 case set [K, L, H, L, L] float32
    * persist per-seed raw last-query attention for entire FINAL_TEST_POP-v1 [N_test, L, H, L] float32
    * streaming per-sample/per-layer/per-head summaries (mean_query_entropy, mean_self_attention_weight, mean_absolute_query_source_distance, backward_or_same_mass, forward_within_input_mass)
    * per-target last-query summaries (entropy, expected_lag, top1, top5_mass, recent_1h/6h/12h/24h_mass)
    * integrity audits (finite, nonnegative, row-sum ≈1, max ≤ 1+ε, model mutation false, reproducibility allclose)
    * atomic raw writes with reload verification + chmod read-only
    * SHA256 raw checksums
    * Phase 53 / 54 / 55 / 56 / 57 handoff files (only handoff content; no implementation)
    * findings + discrepancies + tests + summary + report + README + sign-off
  - Phase 52 hard scientific contracts (locked):
    * lookback L = 72, feature_count F = 33, feature_set FS2_TF1, boundary WB0_CONTEXT_CARRY_OVER
    * num_layers = 2, num_heads = 4, d_model = 64, ffn_dim = 256
    * pooling = LAST_STEP, RevIN = disabled
    * attention_axes = [B, H, Q, S]
    * self_attention_shape = [B, H, L, L]
    * need_weights = True, average_attn_weights = False
    * causal_mask = None, padding_mask = None
    * forecast target NOT an attention token
    * last_query_definition = A[:, :, L-1, :]
    * lag_steps_p = L - p (H=1)
    * raw storage dtype = float32 (no float16, no uint8, no image pixels)
    * no head averaging, no layer averaging, no seed averaging, no thresholding, no smoothing, no renormalization
    * same dense case set for all three seeds (deterministic from Phase51 handoff)
    * extraction_batch default = 8 with fallback 8→4→2→1 (memory-driven only)
    * model.eval() + torch.inference_mode(); AMP = false
    * prediction-equivalence tolerance: rtol=atol=1e-5
    * attention-integrity tolerance: atol=1e-5, rtol=1e-5
    * atomic raw writes with reload verification
  - Phase 52 leakage boundary (HARD; mandatory execution order):
    * 52-A: governance + preflight + source verification + architecture amendment
    * 52-B: extraction contract freeze + infrastructure setup
    * 52-C: official raw attention extraction (3 seeds, dense + last-query)
    * 52-D: integrity / probability / ordering / reproducibility / mutation audits
    * 52-E: derived summaries
    * 52-F: Phase 53–57 handoffs + findings + discrepancies
    * 52-G: tests + summary + report + README + sign-off
    * 52-H: notebook presentation-only dashboard (DEFERRED; not part of this run)
  - Phase 52 forbidden actions (still prohibited and not weakened by this amendment):
    * training, fine-tune, optimizer.step, .backward, model.train, scaler.fit, scaler.fit_transform
    * new Test inference for any prediction modification (extraction is diagnostic; predictions are verified-only)
    * reranking Phase 51 cases, modifying the dense case set after attention seen
    * selecting best seed, creating ensemble, seed-averaging attention for raw storage
    * interpreting attention as feature importance, causal explanation, root-cause, head quality
    * implementing Phase 53 / 54 / 55 / 56 / 57 (handoff only)
    * destructive overwrite of any Phase 47 / 48 / 49 / 50 / 51 canonical artifact
    * modifying any frozen prediction values
    * notebook modification (Phase 52-H deferred; not in this run)
  - Notebook cells: NONE in this run. Phase 52-H is deferred to a future Human-approved run after Phase 52-G sign-off.
  - Source plan reference: docs/plan-doc/plan_before_process/phase_52_attention_analysis_plan.md (pre-process plan, APPROVED 2026-09-04) and docs/plan-doc/plan_detail_for_each_phase/Phase_52_Attention_extraction.md (canonical Phase detail).
  - Human approval: APPROVED 2026-09-04 (governance log: docs/save_log_in_processing/phase_52_architecture_amendment_log.json). Phase 52 sub-phase gates still require Human approval at each sub-phase gate per the pre-process plan §2.
  - Test firewall: Phase 52 may read Phase 47 frozen predictions, Phase 48 seed spread, Phase 49 residual artifacts, Phase 50 regime assignment, Phase 51 case set + handoff, final scalers, final feature contract, final lock, and the three frozen final checkpoints for diagnostic forward passes. Phase 52 may NOT modify any frozen artifact, may NOT train, may NOT alter Test predictions, may NOT modify Phase 51 case selection, may NOT interpret attention causally.
  - Architecture strength preserved: this amendment adds new authorized paths and a new §7.37 sub-entry (§7.37.13) but does NOT delete or weaken any prior protection. Phase 53 / 54 / 55 / 56 / 57 remain explicitly UNAUTHORIZED for implementation; only handoff files may be written.

v1.15 (2026-09-04) - Phase 53 Attention Heatmaps amendment
  - Amendment ID: phase-53-architecture-amendment-v1.15
  - Date: 2026-09-04
  - Affected phase: Phase 53 (Attention Heatmaps) and its downstream context handoff to Phase 54 (Phase 54+ remain UNAUTHORIZED)
  - Reason: authorize a strictly visualization phase over the frozen Phase 52 dense attention artifacts (raw float32 NPZ only). Phase 53 reads Phase 52 raw NPZ + case-order + position-map + Phase 51 shared-rank selections and renders traceable heatmaps following a frozen render contract. No new attention extraction, no checkpoint loading, no model forward, no Test inference, no training, no scaler fitting, no best-seed/head selection, no causal claim, no feature-importance claim, no Phase 54–57 implementation.
  - Authorized paths:
    * src/course_work/phase53/ (read-only Phase 53 rendering package; sibling of src/course_work/phase52/)
    * artifacts/attention_heatmaps/ (Phase 53 visualization artifact root; sub-dirs images/case_grids/, images/cross_seed_report/, images/fixed_probability_report/, images/individual_maps/)
    * docs/save_log_in_processing/phase_53_attention_heatmaps_log.json (Phase 53 processing log)
    * docs/save_log_in_processing/phase_53_architecture_amendment_log.json (this governance log)
    * tests/unit/test_phase53_*.py
    * future: src/course_work/reporting/phase_53_dashboard.py (deferred to Phase 53-H; path authorized but NOT implemented in this run)
  - Phase 53 responsibilities (visualization only):
    * freeze render config before official render; compute + persist render-config fingerprint
    * verify frozen Phase52 raw dense attention: SHA256 + dtype + shape + same case order + same L + same L+H
    * run synthetic + real-source orientation tests (M[q,s] ⇒ x=s, y=q; no transpose; row0=top=oldest; row L-1=bottom=newest)
    * compute one Mode-B case-wide max per case over all 3 seeds × L × H × q × s; freeze case-scale manifest
    * freeze report case set = Phase51 W2 SHARED_WORST ranks 1–5 (deterministic, pre-render)
    * render V1 case/seed grids (rows=layers, columns=heads) for ALL dense cases × ALL seeds (44×3 = 132)
    * render V2 cross-seed grids (rows=seeds, columns=heads) per (report case, layer)
    * render Mode A FIXED_PROBABILITY (vmin=0, vmax=1) views for shared top5 cases
    * render optional V3 individual per-head images for shared top5 cases (deterministic filename)
    * maintain heatmap catalog + case visualization index + render QA + image checksums
    * write Phase54 context handoff that pins Phase54 numeric source to Phase52 RAW LAST_QUERY NPZ (NOT PNG)
  - Phase 53 hard scientific contracts (locked):
    * raw source = Phase52 float32 dense NPZ only; no model checkpoint; no re-extraction
    * matrix orientation: rows=query, cols=source (no transpose)
    * row 0 = top = oldest; row L-1 = bottom = newest
    * x-axis oldest→newest left→right; y-axis oldest→newest top→bottom
    * no causal-mask triangle hiding (final encoder has no causal mask)
    * no forecast target token on axis
    * no interpolation; no renormalization; no smoothing; no thresholding; no log; no percentile clipping; no resampling
    * Mode A scale: exactly [0, 1]
    * Mode B scale: case-wide max across all 3 seeds, all layers, all heads for that case (no per-panel autoscale)
    * case selection = Phase51 W2 SHARED_WORST ranks 1–5 (deterministic, pre-render)
    * no seed averaging as primary; no head ranking; no case cherry-pick; no head-matching across seeds
    * PNG/SVG images are DERIVED visualizations; raw NPZ remains scientific source
  - Phase 53 leakage boundary (HARD):
    * may READ Phase 47 frozen predictions, Phase 51 case set, Phase 52 raw NPZ + checksums + position-map + case-order, Phase 50 regime labels
    * may NOT modify any frozen artifact; may NOT touch Phase 47/48/49/50/51/52 canonical files
    * may NOT load model checkpoint; may NOT call `model.forward`, `torch.load`, `return_attention`, `materialize_phase52`, `extract_attention`, `fit`, `fit_transform`
  - Phase 53 forbidden actions (still prohibited and not weakened by this amendment):
    * loading model checkpoint, reconstructing model, running `model.forward`
    * new Test inference, new attention extraction, scaler fitting, training, optimizer, backward
    * best-head selection, best-seed selection, ensemble, prediction correction
    * attention labeled as feature importance or causal attribution
    * implementing Phase 54 / 55 / 56 / 57 (only Phase54 context handoff allowed)
    * extracting last-query numeric metrics from rendered PNG pixels
    * notebook modification (Phase 53-H deferred; not in this run)
  - Notebook cells: NONE in this run. Phase 53-H is deferred to a future Human-approved run after Phase 53-G sign-off.
  - Source plan reference: docs/plan-doc/plan_before_process/phase_53_attention_heatmaps_plan.md (pre-process plan, APPROVED 2026-09-04) and docs/plan-doc/plan_detail_for_each_phase/Phase_53_Attention_heatmaps.md (canonical Phase detail).
  - Human approval: APPROVED 2026-09-04 (governance log: docs/save_log_in_processing/phase_53_architecture_amendment_log.json). Phase 53 sub-phase gates still require Human approval at each sub-phase gate per the pre-process plan.
  - Test firewall: Phase 53 may read Phase 52 raw dense attention NPZ + checksums + case-order + position-map, Phase 51 case set + shared-rank selections, Phase 50 regime labels, and Phase 47 frozen prediction bundles for case title context only. Phase 53 may NOT modify any frozen artifact, may NOT train, may NOT reload model, may NOT alter Test predictions, may NOT modify Phase 51/52 case selection, may NOT interpret attention causally.
  - Architecture strength preserved: this amendment adds new authorized paths and a new §7.37 sub-entry (§7.37.14) but does NOT delete or weaken any prior protection. Phase 54 / 55 / 56 / 57 remain explicitly UNAUTHORIZED for implementation; only Phase54 context handoff file may be written.

#### 7.37.14. Phase 53 Attention Heatmaps (authorized v1.15 2026-09-04)

Phase 53 (Attention Heatmaps) được phép tạo package:

* `src/course_work/phase53/` (read-only rendering package; sibling of `src/course_work/phase52/`)
* `artifacts/attention_heatmaps/` (Phase 53 visualization artifact root)
* `docs/plan-doc/plan_before_process/phase_53_attention_heatmaps_plan.md` (pre-process plan, APPROVED)
* `docs/save_log_in_processing/phase_53_attention_heatmaps_log.json` (Phase 53 processing log)
* `tests/unit/test_phase53_*.py` (Phase 53 test scope)
* future: `src/course_work/reporting/phase_53_dashboard.py` (deferred to Phase 53-H; path authorized but NOT implemented in this run)

sau khi amendment `phase-53-architecture-amendment-v1.15` ở §28 được Human approve và pre-process plan `docs/plan-doc/plan_before_process/phase_53_attention_heatmaps_plan.md` đã được Human duyệt.

Phase 53 là visualization + qualitative phase cho temporal self-attention của ba final Transformer seeds (42/123/2026). Phase 53 chỉ đọc frozen Phase 52 raw dense attention NPZ, frozen Phase 52 position/lag map, frozen Phase 51 case set + shared-rank selections, frozen Phase 50 regime labels, và render heatmaps theo contract đã freeze (orientation: query=rows, source=cols; row0=top=oldest; row L-1=bottom=newest; no transpose; no interpolation; no renormalization; no smoothing; no clipping; no log; no seed/head averaging as primary; no head ranking; no case cherry-pick).

Phase 53 KHÔNG được training, fine-tune, optimizer.step, .backward, scaler fitting, model checkpoint loading, model reconstruction, model.forward, return_attention, new attention extraction, new Test inference, prediction correction, best-seed/head selection, ensemble, attention=feature importance claim, attention=causal explanation, hay implement Phase 54–57.

Phase 53 phải tạo tối thiểu O53.1–O53.28 outputs theo canonical Phase 53 detail (manifest, contract, preflight audit, raw-source verification, frozen render config + fingerprint, orientation tests, axis tick audit, case-shared scale manifest, report case manifest, complete V1 case/seed grids, V2 cross-seed report grids, Mode A fixed-probability views, optional V3 individual maps, heatmap catalog, case visualization index, render QA, optional visual notes, image checksums, findings, Phase54 context handoff, tests, discrepancies, summary JSON, catalog Markdown, report, README, sign-off). Phase 53 chỉ nhận Phase52 handoff files; Phase 54+ vẫn UNAUTHORIZED.

v1.15 (2026-09-04) - Phase 53 Attention Heatmaps amendment
  - Amendment ID: phase-53-architecture-amendment-v1.15
  - Affected phase: Phase 53 (Attention Heatmaps) and its downstream context handoff to Phase 54
  - Reason: authorize a strictly visualization phase over the frozen Phase 52 dense attention artifacts (raw float32 NPZ only). Phase 53 reads Phase 52 raw NPZ + case-order + position-map + Phase 51 shared-rank selections and renders traceable heatmaps following a frozen render contract. No new attention extraction, no checkpoint loading, no model forward, no Test inference, no training, no scaler fitting, no best-seed/head selection, no causal claim, no feature-importance claim, no Phase 54–57 implementation.
  - New authorized paths:
    * `src/course_work/phase53/` (read-only Phase 53 rendering package; sibling of `src/course_work/phase52/`)
    * `artifacts/attention_heatmaps/` (Phase 53 visualization artifact root with sub-dirs `images/case_grids/`, `images/cross_seed_report/`, `images/fixed_probability_report/`, `images/individual_maps/`)
    * Phase 53 test scope: `tests/unit/test_phase53_*.py`
    * Phase 53 processing log: `docs/save_log_in_processing/phase_53_attention_heatmaps_log.json`
    * future: `src/course_work/reporting/phase_53_dashboard.py` (deferred to Phase 53-H; path authorized but NOT implemented in this run)
  - Phase 53 responsibilities (visualization only):
    * Render canonical V1 case/seed per-head grids (rows=layers, columns=heads) for every dense case × every seed
    * Render V2 cross-seed per-layer grids (rows=seeds, columns=heads) for Phase51 W2 SHARED_WORST ranks 1–5
    * Render Mode A FIXED_PROBABILITY (vmin=0, vmax=1) absolute-reference views for shared top5 cases
    * Maintain catalog + case index + render QA + image checksums
    * Write Phase54 context handoff that states Phase54 numeric source remains Phase52 RAW LAST_QUERY NPZ (no PNG digitization)
  - Phase 53 hard scientific contracts (locked):
    * raw source = Phase52 float32 dense NPZ only; no model checkpoint; no re-extraction
    * matrix orientation: rows=query, cols=source (no transpose)
    * row 0 = top = oldest; row L-1 = bottom = newest
    * x-axis oldest→newest left→right; y-axis oldest→newest top→bottom
    * no causal-mask triangle hiding (final encoder has no causal mask)
    * no forecast target token on axis
    * no interpolation; no renormalization; no smoothing; no thresholding; no log; no percentile clipping; no resampling
    * Mode A scale: exactly [0, 1]
    * Mode B scale: case-wide max across all 3 seeds, all layers, all heads for that case (no per-panel autoscale)
    * case selection = Phase51 W2 SHARED_WORST ranks 1–5 (deterministic, pre-render)
    * no seed averaging as primary; no head ranking; no case cherry-pick; no head-matching across seeds
    * PNG/SVG images are DERIVED visualizations; raw NPZ remains scientific source
  - Phase 53 leakage boundary (HARD):
    * may READ Phase 47 frozen predictions, Phase 51 case set, Phase 52 raw NPZ + checksums + position-map + case-order, Phase 50 regime labels
    * may NOT modify any frozen artifact; may NOT touch Phase 47/48/49/50/51/52 canonical files
    * may NOT load model checkpoint; may NOT call `model.forward`, `torch.load`, `return_attention`, `materialize_phase52`, `extract_attention`, `fit`, `fit_transform`
  - Phase 53 forbidden actions (still prohibited and not weakened by this amendment):
    * loading model checkpoint, reconstructing model, running `model.forward`
    * new Test inference, new attention extraction, scaler fitting, training, optimizer, backward
    * best-head selection, best-seed selection, ensemble, prediction correction
    * attention labeled as feature importance or causal attribution
    * implementing Phase 54 / 55 / 56 / 57 (only Phase54 context handoff allowed)
    * extracting last-query numeric metrics from rendered PNG pixels
    * notebook modification (Phase 53-H deferred; not in this run)
  - Notebook cells: NONE in this run. Phase 53-H is deferred to a future Human-approved run after Phase 53-G sign-off.
  - Source plan reference: docs/plan-doc/plan_before_process/phase_53_attention_heatmaps_plan.md (pre-process plan, APPROVED 2026-09-04) and docs/plan-doc/plan_detail_for_each_phase/Phase_53_Attention_heatmaps.md (canonical Phase detail).
  - Human approval: APPROVED 2026-09-04 (governance log: docs/save_log_in_processing/phase_53_architecture_amendment_log.json). Phase 53 sub-phase gates still require Human approval at each sub-phase gate per the pre-process plan.
  - Test firewall: Phase 53 may read Phase 52 raw dense attention NPZ + checksums + case-order + position-map, Phase 51 case set + shared-rank selections, Phase 50 regime labels, and Phase 47 frozen prediction bundles for case title context only. Phase 53 may NOT modify any frozen artifact, may NOT train, may NOT reload model, may NOT alter Test predictions, may NOT modify Phase 51/52 case selection, may NOT interpret attention causally.
  - Architecture strength preserved: this amendment adds new authorized paths and a new §7.37 sub-entry (§7.37.14) but does NOT delete or weaken any prior protection. Phase 54 / 55 / 56 / 57 remain explicitly UNAUTHORIZED for implementation; only Phase54 context handoff file may be written.

#### 7.37.15. Phase 54 Last-Query Attention Analysis (authorized v1.16 2026-09-04)

Phase 54 (Last-Query Attention Analysis) được phép tạo package:
```text
src/course_work/phase54/
artifacts/last_query_attention/
  figures/
  figures/report_cases/
docs/save_log_in_processing/phase_54_last_query_attention_analysis_log.json
docs/save_log_in_processing/phase_54_architecture_amendment_log.json
tests/unit/test_phase54_*.py
```

sau khi amendment `phase-54-architecture-amendment-v1.16` ở §28 được Human approve và pre-process plan `docs/plan-doc/plan_before_process/phase_54_last_query_attention_analysis_plan.md` đã được Human duyệt.

Phase 54 chỉ định lượng hóa last-query attention `A[:,:,L-1,:]` trên toàn bộ FINAL_TEST_POP-v1 (N=2961) cho 3 seeds × 2 layers × 4 heads, đọc từ frozen Phase 52 raw last-query NPZ (float32, `last_query_attention_seed42.npz`, `last_query_attention_seed123.npz`, `last_query_attention_seed2026.npz`); sử dụng frozen position-map (`attention_relative_position_map.csv`) với lag_steps_p = L - p (H=1); đọc frozen target-order (`attention_test_target_order.csv`); tái verify Phase 52 summaries từ raw vectors; tính thêm effective_source_count, lag_sd, Lag50/80/90 coverage radii, non-overlap lag-bin masses (1–6, 7–36, 37–72, 73–144, 145–L), mean/median/SD/p05/p25/p75/p95 temporal profiles theo lag cho mỗi seed/layer/head, layer head-mean profiles, seed overall descriptive profile, top1 lag frequency + top1 tie summary (tie rule NEWEST_SOURCE preserved); deterministic Phase 51 shared ranks 1–5 case-level line plots; emit Phase 55 head-comparison handoff + Phase 56 error-conditioned context handoff + Phase 57 seed-stability context handoff; findings, discrepancies, tests, summary, report, README, sign-off.

Phase 54 KHÔNG được training, fine-tune, optimizer.step, .backward, scaler fitting, model checkpoint loading, model reconstruction, model.forward, return_attention, new attention extraction, new Test inference, prediction correction, best-seed/head selection, ensemble, head clustering, head ablation, cross-seed head matching, head ranking, attention=feature importance claim, attention=causal explanation, error-conditioned groups, regime-conditioned groups, hay implement Phase 55–57.

Phase 54 phải tạo tối thiểu O54.1–O54.31 outputs theo canonical Phase 54 detail (manifest, contract, preflight audit, source verification, integrity audit, Phase 52 reconstruction audit, target-order audit, lag-mapping audit, metrics long table, head-level summary, profile by lag, layer head-mean profile, seed overall profile, lag-bin mass, recent mass summary, coverage radius summary, top1 lag frequency, top1 tie summary, report-case manifest, report-case metrics, core figures, findings, Phase 55/56/57 handoffs, tests, discrepancies, summary JSON, human-readable report, README, sign-off). Phase 54 chỉ nhận Phase 52/53 handoff files; Phase 55+ vẫn UNAUTHORIZED.

v1.16 (2026-09-04) - Phase 54 Last-Query Attention Analysis amendment
  - Amendment ID: phase-54-architecture-amendment-v1.16
  - Date: 2026-09-04
  - Affected phase: Phase 54 (Last-Query Attention Analysis) and its downstream handoffs to Phase 55 / 56 / 57
  - Reason: authorize a strictly quantitative last-query attention analysis over the frozen Phase 52 raw last-query NPZ (float32) for the entire FINAL_TEST_POP-v1 (N=2961) × 3 seeds × 2 layers × 4 heads. Phase 54 reads Phase 52 last-query NPZ + checksums + position-map + target-order + Phase 53 context handoff + Phase 51 shared-rank selection, and computes per-target metrics (entropy, normalized_entropy, effective_source_count, expected_lag_steps, expected_lag_minutes, lag_sd, top1_lag/weight/tie, top5_mass, recent_1h/6h/12h/24h masses, Lag50/80/90 coverage radii), non-overlapping lag-bin masses, mean/median/SD/p05/p25/p75/p95 temporal profiles by lag for every seed/layer/head, layer head-mean profiles, seed overall descriptive profile, top1 lag frequency, deterministic Phase 51 shared ranks 1–5 case-level line plots, and emits handoffs to Phase 55 / 56 / 57. No new attention extraction, no model load, no Test inference, no training, no scaler fitting, no best-seed/head selection, no head clustering, no head ablation, no error-conditioned groups, no regime-conditioned groups, no cross-seed head matching, no feature-importance claim, no causal claim, no Phase 55–57 implementation.
  - New authorized paths:
    * `src/course_work/phase54/` (read-only Phase 54 implementation package; sibling of `src/course_work/phase53/`)
    * `artifacts/last_query_attention/` (Phase 54 derived artifacts root; sub-dirs `figures/`, `figures/report_cases/`)
    * `docs/save_log_in_processing/phase_54_last_query_attention_analysis_log.json` (Phase 54 processing log)
    * `docs/save_log_in_processing/phase_54_architecture_amendment_log.json` (this governance log)
    * `tests/unit/test_phase54_*.py`
    * future: `src/course_work/reporting/phase_54_dashboard.py` (deferred to Phase 54-H; path authorized but NOT implemented in this run)
  - Phase 54 hard scientific contracts (locked):
    * raw source = Phase 52 float32 last-query NPZ only
    * shape [N_test, L, H, L] = [2961, 2, 4, 72] per seed
    * `last_query_definition = A[:, :, L-1, :]`
    * raw axis order = `[target, layer, head, source]`
    * `lag_steps_p = L - p (H=1)`; `lag_minutes_p = 10 * lag_steps_p`
    * source position 0 = oldest; source position L-1 = newest
    * forecast target is NOT an attention token
    * no PNG digitization (do_not_extract_last_query_from_png = true)
    * entropy formula: `H = -sum(p * log(p + epsilon_H))`; `epsilon_H = 1e-12`
    * `normalized_entropy = H / log(L)`
    * `effective_source_count = exp(H)`
    * `expected_lag_steps = sum_p a_p * lag_steps_p`
    * `lag_sd_steps = sqrt(sum_p a_p * (lag_steps_p - expected_lag_steps)^2)`
    * top1 tie rule: `NEWEST_SOURCE` among exact-tied maxima
    * `top5_mass = sum of five largest a_p`
    * recent windows (steps): 1h≤6, 6h≤36, 12h≤72, 24h≤144; `effective_steps = min(requested, L)`
    * Lag50/80/90 = first k s.t. cumulative recency mass (newest→oldest) >= {0.50, 0.80, 0.90}
    * non-overlap lag bins: 1–6, 7–36, 37–72, 73–144, 145–L (only supported bins emitted)
    * mean profile audit: `sum_lag(mean_weight) ≈ 1` per seed/layer/head
    * layer head-mean profile audit: `sum_lag(head_mean_weight) ≈ 1`
    * seed overall profile = mean over (layer, head, target) per lag (descriptive only)
    * report case set = Phase 51 W2 SHARED_WORST ranks 1–5 (deterministic; no re-selection)
    * no head ranking (Phase 55 scope); no head clustering, no head ablation
    * no error-conditioned groups (Phase 56 scope); no regime-conditioned groups (Phase 56 scope)
    * no cross-seed head matching (Phase 57 scope); no seed stability score (Phase 57 scope)
    * no feature-importance claim; no causal claim
  - Phase 54 leakage boundary (HARD):
    * may READ Phase 47 frozen predictions (context only), Phase 50 regime labels, Phase 51 case set + shared-rank selection, Phase 52 raw last-query NPZ + checksums + position-map + target-order + summaries, Phase 53 context handoff + report cases
    * may NOT load model checkpoint; may NOT call `model.forward`, `torch.load`, `return_attention`, `materialize_phase52`, `extract_attention`, `fit`, `fit_transform`
  - Phase 54 forbidden actions (still prohibited and not weakened by this amendment):
    * training, fine-tune, optimizer.step, .backward, model.train, scaler.fit, scaler.fit_transform
    * new Test inference for any prediction modification
    * new attention extraction
    * destructive overwrite of any Phase 47 / 48 / 49 / 50 / 51 / 52 / 53 canonical artifact
    * modifying any frozen prediction values, frozen attention values, frozen target order, frozen position map
    * best-seed selection, ensemble, seed averaging as primary result
    * best-head selection, head ranking, head clustering, head ablation, head matching across seeds
    * attention labeled as feature importance or causal attribution
    * implementing Phase 55 / 56 / 57 (handoff files only)
    * notebook modification (Phase 54-H deferred; not in this run)
    * reading PNG pixels for numeric attention values
  - Notebook cells: NONE in this run. Phase 54-H is deferred to a future Human-approved run after Phase 54-G sign-off.
  - Source plan reference: `docs/plan-doc/plan_before_process/phase_54_last_query_attention_analysis_plan.md` (pre-process plan, APPROVED 2026-09-04) and `docs/plan-doc/plan_detail_for_each_phase/Phase_54_Last-query_attention.md` (canonical Phase detail).
  - Human approval: APPROVED 2026-09-04 (governance log: `docs/save_log_in_processing/phase_54_architecture_amendment_log.json`). Phase 54 sub-phase gates still require Human approval at each sub-phase gate per the pre-process plan.
  - Test firewall: Phase 54 may read Phase 47 frozen predictions (context only), Phase 50 regime labels, Phase 51 case set + shared-rank selection, Phase 52 raw last-query NPZ + checksums + position-map + target-order + summaries, Phase 53 context handoff + report cases. Phase 54 may NOT modify any frozen artifact, may NOT train, may NOT reload model, may NOT alter Test predictions, may NOT modify Phase 51/52/53 case selection, may NOT interpret attention causally, may NOT digitize PNG.
  - Architecture strength preserved: this amendment adds new authorized paths and a new §7.37 sub-entry (§7.37.15) but does NOT delete or weaken any prior protection. Phase 55 / 56 / 57 remain explicitly UNAUTHORIZED for implementation.

v1.17 (2026-09-04) - Phase 55 Head Comparison Analysis amendment
  - Amendment ID: phase-55-architecture-amendment-v1.17
  - Date: 2026-09-04
  - Affected phase: Phase 55 (Head Comparison Analysis) and downstream handoffs to Phase 56 / 57
  - Reason: authorize a strictly descriptive within-seed within-layer head comparison analysis over frozen Phase 54 head-level summaries + per-vector metrics + mean temporal profiles + layer head-mean profiles + top1 lag frequencies + lag-bin masses + recent-mass + coverage summaries. Primary comparison scope = heads within the SAME seed and SAME encoder layer. Required pairwise profile metrics = Pearson, Spearman, Cosine, JSD (natural log), L1, L2, Wasserstein distance in minutes. Required pairwise behavioral differences = median normalized_entropy, median expected_lag_minutes, median recent_1h/6h/12h/24h, median Lag80 (signed Delta(A-B) plus absolute delta). Paired same-target difference distributions for normalized_entropy, expected_lag_minutes, recent_1h_mass, lag80_minutes. Top1 lag distribution TVD + JSD. Head-to-layer-mean distance (JSD, L1, L2, cosine, Wasserstein minutes). Head behavior cards in architectural order (NO rank, NO score). Layer-level head diversity summary (mean/median/max pairwise JSD, mean pairwise L1, mean pairwise Wasserstein, mean pairwise abs expected-lag diff, mean pairwise top1 TVD; NO weighted composite score). Emits Phase 56 error-conditioned attention handoff + Phase 57 seed-stability head context handoff. NO best-head selection, NO head pruning, NO head ablation, NO head clustering core, NO unsupervised clustering, NO error-conditioned analysis, NO regime-conditioned analysis, NO worst-case statistical comparison, NO cross-seed head matching, NO cross-seed same-index semantic alignment assumption, NO cross-layer same-index semantic identity assumption, NO weighted head diversity score, NO post-hoc redundancy threshold, NO attention labeled as feature importance or causal attribution, NO Phase 56–57 implementation.
  - New authorized paths:
    * `src/course_work/phase55/` (Phase 55 implementation package; sibling of `src/course_work/phase54/`)
    * `artifacts/head_comparison/` (Phase 55 derived artifacts root; sub-dir `figures/`)
    * `docs/save_log_in_processing/phase_55_head_comparison_log.json` (Phase 55 processing log)
    * `docs/save_log_in_processing/phase_55_architecture_amendment_log.json` (this governance log)
    * `tests/unit/test_phase55_*.py`
    * future: `src/course_work/reporting/phase_55_dashboard.py` (deferred to Phase 55-H; path authorized but NOT implemented in this run)
  - Phase 55 hard scientific contracts (locked):
    * primary comparison scope = within_seed_within_layer_across_heads; primary unit = (seed, layer, head_a, head_b) with head_a < head_b
    * head order = ARCHITECTURAL; no reordering by similarity in canonical matrices
    * expected pair count per (seed, layer) = H(H-1)/2 = 6 for H=4
    * primary profile source = frozen Phase 54 mean temporal profiles (last_query_profile_by_lag.csv)
    * pairwise profile metrics: Pearson, Spearman, Cosine, JSD (nat-log), L1, L2, Wasserstein-1 in minutes (support = lag_minutes)
    * pairwise behavioral differences: signed Delta(A-B) for median normalized_entropy, median expected_lag_minutes, median recent_1h/6h/12h/24h, median Lag80; absolute delta fields required
    * paired same-target difference metrics: normalized_entropy, expected_lag_minutes, recent_1h_mass, lag80_minutes; identical target_ids across pair
    * top1 lag distribution comparison: TVD (0..1) + JSD (nat-log); inherit Phase 52 NEWEST_SOURCE tie rule
    * head-to-layer-mean distance: JSD, L1, L2, cosine, Wasserstein minutes
    * layer diversity = mean/median/max pairwise JSD + mean pairwise L1 + mean pairwise Wasserstein + mean pairwise abs expected-lag diff + mean pairwise top1 TVD
    * no rank, no score, no weighted composite, no post-hoc threshold
    * typology = OFF by default
  - Phase 55 leakage boundary (HARD):
    * may READ Phase 52 raw last-query NPZ (fallback verification only), Phase 53 context handoff, Phase 54 head-level summaries + per-vector metrics + profiles + top1 distributions + recent-mass + coverage + report cases
    * may NOT load model checkpoint; may NOT call `model.forward`, `torch.load`, `return_attention`, `materialize_phase52`, `extract_attention`, `fit`, `fit_transform`
  - Phase 55 forbidden actions (still prohibited and not weakened by this amendment):
    * training, fine-tune, optimizer.step, .backward, model.train, scaler.fit, scaler.fit_transform
    * new Test inference; new attention extraction
    * destructive overwrite of any Phase 47 / 48 / 49 / 50 / 51 / 52 / 53 / 54 canonical artifact
    * modifying any frozen prediction, frozen attention, frozen target order, frozen position map, frozen per-vector metric, frozen profile, frozen top1 frequency
    * best-seed selection, ensemble
    * best-head selection, head ranking, head pruning, head ablation, head clustering core, unsupervised head clustering, cross-seed head matching
    * post-hoc redundancy threshold invention
    * weighted head diversity score
    * attention labeled as feature importance, causal attribution, predictive head quality, or proof of redundancy
    * implementing Phase 56 / 57 (handoff files only)
    * notebook modification (Phase 55-H deferred; not in this run)
    * reading PNG pixels for numeric attention values
  - Notebook cells: NONE in this run. Phase 55-H is deferred to a future Human-approved run after Phase 55-G sign-off.
  - Source plan reference: `docs/plan-doc/plan_before_process/phase_55_head_comparison_plan.md` (pre-process plan, APPROVED 2026-09-04) and `docs/plan-doc/plan_detail_for_each_phase/Phase_55_Head_comparison.md` (canonical Phase detail).
  - Human approval: APPROVED 2026-09-04 (governance log: `docs/save_log_in_processing/phase_55_architecture_amendment_log.json`). Phase 55 sub-phase gates still require Human approval at each sub-phase gate per the pre-process plan.
  - Test firewall: Phase 55 may read Phase 47 frozen predictions (context only), Phase 50 regime labels, Phase 51 case set + shared-rank selection, Phase 52 raw last-query NPZ (verification fallback only), Phase 53 context handoff, Phase 54 head summaries + per-vector metrics + profiles + top1 distributions + recent mass + coverage + report cases. Phase 55 may NOT modify any frozen artifact, may NOT train, may NOT reload model, may NOT alter Test predictions, may NOT modify Phase 51/52/53/54 case selection, may NOT interpret attention causally, may NOT digitize PNG, may NOT cluster heads, may NOT select best head, may NOT prune head, may NOT perform error conditioning.
  - Architecture strength preserved: this amendment adds new authorized paths and a new §7.37 sub-entry (§7.37.16) but does NOT delete or weaken any prior protection. Phase 56 / 57 remain explicitly UNAUTHORIZED for implementation.

#### 7.37.16. Phase 55 Head Comparison Analysis (authorized v1.17 2026-09-04)

Phase 55 (Head Comparison Analysis) được phép tạo package:

```text
src/course_work/phase55/
artifacts/head_comparison/
  figures/
  docs/save_log_in_processing/phase_55_head_comparison_log.json
docs/save_log_in_processing/phase_55_architecture_amendment_log.json
tests/unit/test_phase55_*.py
```

sau khi amendment `phase-55-architecture-amendment-v1.17` ở §28 được Human approve và pre-process plan `docs/plan-doc/plan_before_process/phase_55_head_comparison_plan.md` đã được Human duyệt.

Phase 55 chỉ thực hiện within-seed within-layer head comparison trên frozen Phase 54 canonical artifacts (head-level summary, per-vector metrics, mean temporal profile by lag, layer head-mean profile, top1 lag frequency, lag-bin mass, recent-mass summary, coverage radius summary, top1 tie summary, report case manifest + metrics). Phase 55 builds canonical head-pair list (seed, layer, head_a, head_b) với head_a < head_b; tính pairwise profile metrics (Pearson, Spearman, Cosine, JSD nat-log, L1, L2, Wasserstein minutes trên lag_minutes support); tính pairwise behavioral differences (signed Delta(A-B) + abs delta cho median normalized_entropy, median expected_lag_minutes, median recent_1h/6h/12h/24h, median Lag80); paired same-target difference distributions cho normalized_entropy, expected_lag_minutes, recent_1h_mass, lag80_minutes; top1 lag TVD + JSD; head-to-layer-mean distance (JSD, L1, L2, cosine, Wasserstein minutes); head behavior cards (architectural order, NO rank, NO score); layer-level head diversity summary (mean/median/max JSD, mean L1, mean Wasserstein, mean abs expected-lag diff, mean top1 TVD; NO weighted composite); emit Phase 56 error-conditioned attention handoff + Phase 57 seed-stability head context handoff; deterministic figures + audit matrices; findings, discrepancies, tests, summary JSON, human-readable report, README, sign-off.

Phase 55 KHÔNG được training, fine-tune, optimizer.step, .backward, scaler fitting, model checkpoint loading, model reconstruction, model.forward, return_attention, new attention extraction, new Test inference, prediction correction, best-seed/head selection, ensemble, head pruning, head ablation, head clustering core, unsupervised head clustering, weighted head diversity score, post-hoc redundancy threshold, cross-seed head matching, cross-seed same-index semantic alignment assumption, cross-layer same-index semantic identity assumption, error-conditioned analysis, regime-conditioned analysis, worst-case statistical comparison, attention=feature importance claim, attention=causal explanation, hay implement Phase 56–57.

Phase 55 phải tạo tối thiểu O55.1–O55.32 outputs theo canonical Phase 55 detail (manifest, contract, preflight audit, source verification, profile integrity audit, target alignment audit, head-pair comparison long, profile similarity, metric difference, paired difference summary, top1 distribution distance, Wasserstein distance, head behavior summary, head-to-layer-mean distance, layer diversity summary, JSD/cosine/Pearson/Spearman/L1/Wasserstein/expected-lag difference/recent1h difference/top1 TVD matrices, core figures, findings, Phase 56 handoff, Phase 57 context handoff, tests, discrepancies, summary JSON, human-readable report, README, sign-off). Phase 55 chỉ nhận Phase 52/53/54 handoff files; Phase 56+ vẫn UNAUTHORIZED.

v1.17 (2026-09-04) - Phase 55 Head Comparison Analysis amendment
  - Amendment ID: phase-55-architecture-amendment-v1.17
  - Date: 2026-09-04
  - Affected phase: Phase 55 (Head Comparison Analysis) and downstream handoffs to Phase 56 / 57
  - Reason: same as §7.37.16; architectural order, no best head, no pruning, no clustering, no error conditioning, no cross-seed semantic alignment, no causal claim, no Phase 56–57 implementation.
  - New authorized paths:
    * `src/course_work/phase55/` (read-only Phase 55 implementation package; sibling of `src/course_work/phase54/`)
    * `artifacts/head_comparison/` (Phase 55 derived artifacts root; sub-dir `figures/`)
    * `docs/save_log_in_processing/phase_55_head_comparison_log.json`
    * `docs/save_log_in_processing/phase_55_architecture_amendment_log.json`
    * `tests/unit/test_phase55_*.py`
    * future: `src/course_work/reporting/phase_55_dashboard.py` (deferred to Phase 55-H)

v1.18 (2026-09-05) - Phase 56 Error-Conditioned Attention amendment
  - Amendment ID: phase-56-architecture-amendment-v1.18
  - Date: 2026-09-05
  - Affected phase: Phase 56 (Error-Conditioned Attention) and downstream handoffs to Phase 57 / 58
  - Reason: authorize a strictly diagnostic attention-conditioned-on-realized-Test-error analysis over frozen Phase 49 residuals, frozen Phase 50 regime assignments, frozen Phase 51 shared hardness (recomputed from residual_long_table.csv theo SharedHardness_t = (|e_42|+|e_123|+|e_2026|)/3 vì hardness_vs_seed_disagreement.csv chỉ chứa worst-case subset, không phải toàn Test), frozen Phase 52 raw last-query attention NPZ + attention_full_matrix_summary.csv, and frozen Phase 54 per-vector metrics + mean temporal profiles + layer head-mean profiles + recent-mass summary. Phase 56 builds deterministic rank-based 20/60/20 seed-specific error cohorts (LOW/MID/HIGH) + exact rank-based 10 error deciles + shared-hardness 20/60/20 + deciles; freezes cohort assignment SHA256 BEFORE joining attention metrics; computes C1 continuous Spearman associations (AE vs 6 CORE_ATTENTION_METRICS-v1, signed residual vs same, secondary shared-hardness vs same); computes C2 high-vs-low metric differences + Cliff's delta + profile JSD/L1/Cosine/Wasserstein minutes; computes under/over residual sign group comparison (UNDER=residual>0, OVER=residual<0, ZERO=residual==0); computes error-decile metric summaries + per-decile mean temporal profiles; computes permutation-invariant layer head-mean vectors per target/layer + recomputes CORE_ATTENTION_METRICS-v1 trên head-mean vectors + layer-level continuous + high-low + shared-cohort analyses; computes secondary full-matrix Spearman associations; annotates error cohorts with frozen Phase 50 regime composition; attaches deterministic Phase 51 W2 shared ranks 1–5 worst-case examples; cross-seed aggregation only after per-seed computation at layer level (no per-head cross-seed averaging, no semantic head alignment assumption); emits Phase 57 seed-stability attention handoff + Phase 58 attention-results context handoff. NO best-head selection, NO best-seed selection, NO head pruning, NO head ablation, NO head clustering, NO cross-seed head matching, NO cross-seed same-index averaging, NO post-hoc redundancy threshold, NO weighted evidence score, NO attention labeled as feature importance/causal attribution/predictive head quality, NO causal claim, NO regime threshold modification, NO Test regime retuning, NO Test error cohort used as deployment regime, NO cartesian subgroup mining, NO squared error as independent primary conditioning, NO heatmap pixels as numeric source, NO Phase 57–58 implementation. Phase 56 is diagnostic only.
  - New authorized paths:
    * `src/course_work/phase56/` (Phase 56 implementation package; sibling of `src/course_work/phase55/`)
    * `artifacts/error_conditioned_attention/` (Phase 56 derived artifacts root; sub-dir `figures/`)
    * `docs/save_log_in_processing/phase_56_error_conditioned_attention_log.json`
    * `docs/save_log_in_processing/phase_56_architecture_amendment_log.json`
    * `tests/unit/test_phase56_*.py`
    * future: `src/course_work/reporting/phase_56_dashboard.py` (deferred to Phase 56-H; path authorized but NOT implemented in this run)
  - Phase 56 hard scientific contracts (locked):
    * primary conditioning variable = absolute_error_wh = |residual_wh|; residual = y_true - y_pred
    * frozen CORE_ATTENTION_METRICS-v1 = [normalized_entropy, expected_lag_minutes, recent_1h_mass, recent_6h_mass, top5_mass, lag80_minutes]
    * rank-based seed cohorts: n_edge = max(1, floor(0.20*N)); LOW first n_edge; HIGH last n_edge; MID remainder; tie-break = timestamp ASC, target_id ASC
    * rank-based seed deciles: decile = 1 + floor(10*r/N), capped at 10; r = 0..N-1 zero-based
    * shared cohorts = Phase 51 SharedHardness_t = (|e_42|+|e_123|+|e_2026|)/3 per target_id, same 20/60/20 + deciles, identical across seeds
    * cohort assignment SHA256 frozen BEFORE any attention join
    * C1: continuous Spearman(AE/residual/shared_hardness, metric) per (seed, layer, head, metric); no iid p-value headline
    * C2: HIGH vs LOW metric deltas + Cliff's delta + profile JSD/L1/Cosine/Wasserstein minutes; D_HL sum ≈ 0; profile sum ≈ 1 per cohort
    * signed: UNDER vs OVER median diff + Cliff's delta + profile JSD/L1/Wasserstein minutes; D_UO sum ≈ 0; ZERO excluded from two-group contrast but counted
    * error-decile: 10 deciles × seed × layer × head × metric summaries; per-decile mean profile by lag with sum ≈ 1
    * layer head-mean: average 4 heads per target/layer FIRST, then recompute CORE_ATTENTION_METRICS-v1 on the head-mean vector; do NOT average head-level metrics
    * shared-cohort layer summary: per-seed first, then aggregate cross-seed (mean/SD/min/max)
    * secondary full-matrix Spearman: mean_query_entropy, mean_self_attention_weight, mean_absolute_query_source_distance_steps, forward_within_input_mass
    * regime context: Phase 50 frozen labels (target_level_regime, extreme_high_regime, change_magnitude_regime, change_direction_regime, time_of_day_regime, day_type_regime) used only for composition reporting
    * worst-case context: deterministic Phase 51 W2 shared ranks 1–5 only; no attention-based case substitution
    * head order ARCHITECTURAL everywhere; no sort by |rho|; no best-head selection
    * no causal claim; association/co-occurrence language only
  - Phase 56 leakage boundary (HARD):
    * may READ Phase 49 frozen residuals, Phase 50 frozen regime assignment, Phase 51 worst-case set + hardness, Phase 52 raw last-query NPZ + checksums + target-order, Phase 54 per-vector metrics + mean temporal profiles + layer head-mean profiles + recent-mass summary
    * may READ Phase 55 head behavior summary + head-pair comparison long + layer diversity summary (for handoff cross-reference only)
    * may NOT load model checkpoint; may NOT call `model.forward`, `torch.load`, `return_attention`, `materialize_phase52`, `extract_attention`, `fit`, `fit_transform`, `materialize_phase54`, `materialize_phase55`
  - Phase 56 forbidden actions (still prohibited and not weakened by this amendment):
    * training, fine-tune, optimizer.step, .backward, model.train, scaler.fit, scaler.fit_transform
    * new Test inference; new attention extraction
    * destructive overwrite of any Phase 47 / 48 / 49 / 50 / 51 / 52 / 53 / 54 / 55 canonical artifact
    * modifying any frozen prediction, frozen attention, frozen target order, frozen position map, frozen per-vector metric, frozen profile, frozen residual, frozen regime label, frozen shared hardness
    * best-seed selection, ensemble
    * best-head selection, head ranking, head pruning, head ablation, head clustering, cross-seed head matching
    * cartesian subgroup mining (error × regime × head × time-of-day)
    * squared error as independent primary conditioning variable
    * Test error cohort used as deployment regime
    * attention labeled as feature importance, causal attribution, predictive head quality
    * implementing Phase 57 / 58 (handoff files only)
    * notebook modification (Phase 56-H deferred; not in this run)
    * reading PNG pixels for numeric attention values
    * post-hoc subgroup selection after viewing attention patterns
    * weighted evidence score combining multiple metrics into one "explanation score"
  - Notebook cells: NONE in this run. Phase 56-H is deferred to a future Human-approved run after Phase 56-G sign-off.
  - Source plan reference: `docs/plan-doc/plan_before_process/phase_56_error_conditioned_attention_plan.md` (pre-process plan, APPROVED 2026-09-05) and `docs/plan-doc/plan_detail_for_each_phase/Phase_56_Error-conditioned_attention.md` (canonical Phase detail).
  - Human approval: APPROVED 2026-09-05 (governance log: `docs/save_log_in_processing/phase_56_architecture_amendment_log.json`). Phase 56 sub-phase gates still require Human approval at each sub-phase gate per the pre-process plan.
  - Test firewall: Phase 56 may read Phase 49 frozen residuals, Phase 50 frozen regime labels, Phase 51 worst-case + shared hardness, Phase 52 raw last-query NPZ + checksums + target-order + full-matrix summary, Phase 54 per-vector metrics + mean temporal profiles + layer head-mean profiles + recent-mass + coverage + top1 frequency + lag-bin mass + report cases, Phase 55 head behavior + head-pair comparison + layer diversity (handoff reference only). Phase 56 may NOT modify any frozen artifact, may NOT train, may NOT reload model, may NOT alter Test predictions, may NOT modify Phase 49/50/51/52/53/54/55 case selection or labels, may NOT interpret attention causally, may NOT digitize PNG, may NOT select best head, may NOT prune head, may NOT perform post-hoc subgroup mining.
  - Architecture strength preserved: this amendment adds new authorized paths and a new §7.37 sub-entry (§7.37.17) but does NOT delete or weaken any prior protection. Phase 57 / 58 remain explicitly UNAUTHORIZED for implementation.

#### 7.37.17. Phase 56 Error-Conditioned Attention (authorized v1.18 2026-09-05)

Phase 56 (Error-Conditioned Attention) được phép tạo package:

```text
src/course_work/phase56/
artifacts/error_conditioned_attention/
  figures/
docs/save_log_in_processing/phase_56_error_conditioned_attention_log.json
docs/save_log_in_processing/phase_56_architecture_amendment_log.json
tests/unit/test_phase56_*.py
```

sau khi amendment `phase-56-architecture-amendment-v1.18` ở §28 được Human approve và pre-process plan `docs/plan-doc/plan_before_process/phase_56_error_conditioned_attention_plan.md` đã được Human duyệt.

Phase 56 chỉ thực hiện diagnostic attention-conditioned-on-realized-Test-error analysis trên frozen Phase 49 canonical residuals + frozen Phase 50 regime labels + frozen Phase 51 shared hardness (derived from residual_long_table.csv theo SharedHardness_t = (|e_42|+|e_123|+|e_2026|)/3) + frozen Phase 52 raw last-query NPZ + attention_full_matrix_summary.csv + frozen Phase 54 per-vector metrics + mean temporal profiles + layer head-mean profiles + recent-mass summary. Phase 56 builds deterministic rank-based 20/60/20 seed-specific error cohorts + exact rank-based 10 error deciles + shared-hardness 20/60/20 + deciles; freezes cohort assignment SHA256 BEFORE joining attention; computes C1 continuous Spearman associations (AE/residual/shared_hardness vs CORE_ATTENTION_METRICS-v1); computes C2 HIGH vs LOW metric deltas + Cliff's delta + profile JSD/L1/Cosine/Wasserstein minutes (sum≈0 audit); computes under/over residual sign group comparison (UNDER=residual>0, OVER=residual<0, ZERO=residual==0); computes error-decile metric summaries + per-decile mean temporal profiles (sum≈1 audit); computes permutation-invariant layer head-mean vectors per target/layer + recomputes CORE_ATTENTION_METRICS-v1 trên head-mean vectors + layer-level continuous + high-low + shared-cohort analyses; computes secondary full-matrix Spearman associations; annotates error cohorts with frozen Phase 50 regime composition; attaches deterministic Phase 51 W2 shared ranks 1–5 worst-case examples; cross-seed aggregation only after per-seed computation at layer level (no per-head cross-seed averaging, no semantic head alignment assumption); emits Phase 57 seed-stability attention handoff + Phase 58 attention-results context handoff; deterministic figures + audit matrices + findings + tests + discrepancies + summary JSON + human-readable report + README + sign-off.

Phase 56 KHÔNG được training, fine-tune, optimizer.step, .backward, scaler fitting, model checkpoint loading, model reconstruction, model.forward, return_attention, new attention extraction, new Test inference, prediction correction, best-seed/head selection, ensemble, head pruning, head ablation, head clustering, cross-seed head matching, cross-seed same-index semantic alignment assumption, cross-layer same-index semantic identity assumption, cartesian subgroup mining, Test regime retuning, Test error cohort used as deployment regime, attention=feature importance claim, attention=causal explanation, hay implement Phase 57–58.

Phase 56 phải tạo tối thiểu O56.1–O56.38 outputs theo canonical Phase 56 detail (manifest, contract, preflight audit, source verification, frozen cohort assignment + fingerprint, error cohort assignment audit, shared cohort audit, join audit, continuous association long table + matrices, error-decile metric summary + profile by lag, high-vs-low metric comparison + Cliff's-delta matrix + profile comparison + profile difference by lag, under-vs-over metric comparison + profile comparison + profile difference by lag, layer head-mean per-target metrics long + association + high-low, shared-cohort layer summary, cross-seed layer summary, full-matrix association, regime composition, worst-case context, findings, tests, discrepancies, summary JSON, human-readable report, README, Phase 57 handoff, Phase 58 context handoff, sign-off). Phase 56 chỉ nhận Phase 49/50/51/52/54/55 frozen handoff files; Phase 57+ vẫn UNAUTHORIZED.

v1.19 (2026-09-05) - Phase 57 Seed-Stability Attention Check amendment
  - Amendment ID: phase-57-architecture-amendment-v1.19
  - Date: 2026-09-05
  - Affected phase: Phase 57 (Seed-Stability Attention Check) and downstream handoffs to Phase 58 / 59
  - Reason: authorize a strictly descriptive seed-stability attention check over frozen Phase 52 raw attention NPZ (last-query + dense cases), frozen Phase 54 per-vector metrics + mean temporal profiles + layer head-mean profiles + top1 frequency, frozen Phase 55 head behavior + head-pair + layer diversity (handoff ref only), frozen Phase 56 error-conditioned attention effects (continuous association, HIGH vs LOW, signed UNDER/OVER, layer head-mean, shared-cohort), and frozen Phase 48 prediction_seed_spread.csv (secondary diagnostic only). Phase 57 builds two parallel stability views: S57-A permutation-invariant layer head-mean stability (averaging over heads first, then comparing across seeds) and S57-B permutation-aware canonical head matching within each encoder layer using full-Test mean last-query temporal profiles, exhaustive H! enumeration (under locked H2/H4 protocol), minimum total JSD cost (natural log), MATCH_TIE_TOL=1e-12, Wasserstein tie-break, lexicographic final tie-break. Seed42 is the deterministic alignment anchor ONLY because it is the first predeclared final seed; it is NOT a performance-based best seed. Three pairwise mappings (42-123, 42-2026, 123-2026) are retained; cycle consistency is audited; Wasserstein-only matching is computed as sensitivity only and never replaces canonical JSD. After matching is frozen and fingerprinted, Phase 57 computes matched-head mean-profile stability, per-target matched-head stability (frozen mapping applied to every Test target, NO target-specific rematching), matched-head metric stability, matched-head top1-lag stability, dense-case full-attention stability on frozen Phase51 cases using raw numerical attention (NO PNG pixels, NO renormalization), layer error-conditioned seed stability (primary), matched-head error-conditioned stability (secondary, ambiguity-propagated), shared-cohort robustness, and prediction-seed-spread vs layer-attention-disagreement secondary association. NO best-seed selection, NO best-head selection, NO head ranking, NO head pruning, NO head ablation, NO model retraining, NO new Test inference, NO new attention extraction, NO weighted stability score, NO causal claim, NO attention labeled as feature importance, NO cross-seed same-index averaging before matching, NO target/error/regime/case-specific rematching, NO same-index semantic alignment assumption, NO notebook modification, NO Phase 58/59 implementation.
  - New authorized paths:
    * `src/course_work/phase57/` (Phase 57 implementation package; sibling of `src/course_work/phase56/`)
    * `artifacts/seed_stability_attention/` (Phase 57 derived artifacts root; sub-dir `figures/`)
    * `docs/save_log_in_processing/phase_57_seed_stability_attention_log.json`
    * `docs/save_log_in_processing/phase_57_architecture_amendment_log.json`
    * `tests/unit/test_phase57_*.py`
    * future: `src/course_work/reporting/phase_57_dashboard.py` (deferred to Phase 57-H; path authorized but NOT implemented in this run)
  - Phase 57 hard scientific contracts (locked):
    * three official final seeds: [42, 123, 2026] — locked, no replacement, no addition, no removal
    * primary stability view: layer head-mean attention (permutation-invariant) — computed FIRST before any head-level analysis
    * canonical matching representation: full-Test mean last-query temporal profile per (seed, layer, head)
    * canonical matching cost: Jensen-Shannon divergence using natural log, range [0, ln(2)]
    * matching scope: within each encoder layer only; no cross-layer matching
    * matching search: exhaustive enumeration of all H! permutations (H=4 under locked H2/H4 protocol -> 24 perms; H=2 -> 2 perms; canonical via lexicographic ordering)
    * matching objective: minimum total JSD across matched edges
    * MATCH_TIE_TOL = 1e-12 on total JSD — frozen before any computation
    * tie-break order: (1) minimum total JSD; (2) if total JSD ties within 1e-12 -> minimum total Wasserstein (minutes); (3) if still tied -> lexicographically smallest permutation
    * matching fingerprint written BEFORE applying Phase56 effects
    * canonical anchor seed = 42 — used only for three-way group naming because 42 is the FIRST predeclared final seed; NOT a performance-based choice
    * all three pairwise mappings retained: 42-123, 42-2026, 123-2026
    * cycle consistency: direct 123->2026 vs anchor-induced 123->42->2026, transparent per-head boolean + per-layer fraction
    * Wasserstein matching: sensitivity-only, computed independently, agreement fraction reported, NEVER replaces canonical JSD mapping
    * matched-head analyses: mean-profile stability, per-target last-query stability (global mapping reused, NO target-specific rematch), metric stability (6 CORE_ATTENTION_METRICS-v1), top1-lag stability (TVD + JSD + modal agreement)
    * consensus matched-head profile: only after matching, mean of three matched seeds per (layer, group, lag), sum approx 1
    * dense-case stability: Phase 51 frozen case IDs, same order, raw [L,L] matrices, rowwise JSD + cosine + normalized Frobenius, NO PNG/image-pixel similarity
    * layer error-conditioned stability: per (analysis_type, conditioning_variable, attention_metric), collect seed42/123/2026 values, mean/SD/min/max/sign-counts; primary robustness view
    * matched-head error-conditioned stability: same metrics reindexed to canonical matched groups using frozen matching; ambiguity warnings propagated
    * shared-cohort layer stability: identical target IDs across seeds -> directly comparable effect magnitudes
    * prediction-attention disagreement: Spearman between Phase48 prediction_range / prediction_std and layer mean-pairwise JSD/Wasserstein (Permutation-invariant); secondary only
    * head order ARCHITECTURAL everywhere; layer order ARCHITECTURAL; seed-pair order = (42-123, 42-2026, 123-2026); NO sort by stability/similarity
    * status taxonomy: PASS / PASS_WITH_WARNING / FAIL (no STABLE/UNSTABLE by ad-hoc threshold)
    * finding codes: descriptive only, e.g. LAYER_HEAD_MEAN_PROFILES_SIMILAR_DESCRIPTIVE, LAYER_PER_TARGET_ATTENTION_VARIABLE_DESCRIPTIVE, HEAD_MATCHING_AMBIGUOUS, ERROR_ATTENTION_SIGN_CONSISTENT_ACROSS_SEEDS; no causal language
  - Phase 57 leakage boundary (HARD):
    * may READ Phase 48 prediction_seed_spread.csv (secondary diagnostic only); Phase 52 raw last_query_attention_seed*.npz + dense_case_attention_seed*.npz + raw_attention_checksums.json + attention_test_target_order.csv + attention_dense_case_order.csv; Phase 54 last_query_metrics_long.csv + last_query_profile_by_lag.csv + last_query_layer_head_mean_profile.csv + last_query_top1_lag_frequency.csv + last_query_lag_bin_mass.csv + last_query_seed_overall_profile.csv; Phase 55 head_behavior_summary.csv + head_pair_comparison_long.csv + layer_head_diversity_summary.csv + phase57_seed_stability_head_context_handoff.json; Phase 56 error_attention_*.csv + error_conditioning_assignment.csv + phase57_seed_stability_attention_handoff.json
    * may NOT load model checkpoint; may NOT call `model.forward`, `torch.load`, `return_attention`, `materialize_phase52`, `extract_attention`, `fit`, `fit_transform`
    * may NOT modify any Phase 47 / 48 / 49 / 50 / 51 / 52 / 53 / 54 / 55 / 56 frozen artifact
  - Phase 57 forbidden actions (still prohibited and not weakened by this amendment):
    * training, fine-tune, optimizer.step, .backward, model.train, scaler.fit, scaler.fit_transform
    * new Test inference, new attention extraction
    * destructive overwrite of any Phase 47 / 48 / 49 / 50 / 51 / 52 / 53 / 54 / 55 / 56 canonical artifact
    * modifying any frozen prediction, frozen attention, frozen target order, frozen position map, frozen per-vector metric, frozen profile, frozen residual, frozen regime label, frozen shared hardness, frozen error-conditioning cohort assignment
    * best-seed selection, ensemble, weighted overall stability score
    * best-head selection, head ranking, head pruning, head ablation, head clustering
    * cross-seed head matching except the deterministic JSD-exhaustive canonical matching defined above
    * target-specific rematching, error-specific rematching, regime-specific rematching, case-specific rematching
    * anchor change after seeing results (seed42 stays as anchor even if 123/2026 mapping looks "cleaner")
    * mismatch-method replacement: Wasserstein mapping never replaces canonical JSD mapping
    * Test error cohort used as deployment regime
    * attention labeled as feature importance, causal attribution, predictive head quality
    * attention stability labeled as proof of functional equivalence
    * cartesian subgroup mining (error x regime x head x time-of-day)
    * reading PNG pixels for numeric attention values
    * implementing Phase 58 / 59 (handoff files only)
    * notebook modification (Phase 57-H deferred to a future Human-approved run after Phase 57 sign-off)
  - Notebook cells: NONE in this run. Phase 57-H is deferred to a future Human-approved run after Phase 57-G sign-off.
  - Source plan reference: `docs/plan-doc/plan_before_process/phase_57_seed_stability_attention_plan.md` (pre-process plan, APPROVED 2026-09-05) and `docs/plan-doc/plan_detail_for_each_phase/Phase_57_Seed-stability_attention_check.md` (canonical Phase detail).
  - Human approval: APPROVED 2026-09-05 (governance log: `docs/save_log_in_processing/phase_57_architecture_amendment_log.json`). Phase 57 sub-phase gates still require Human approval at each sub-phase gate per the pre-process plan.
  - Test firewall: Phase 57 may read Phase 48 prediction_seed_spread.csv; Phase 52 raw last-query NPZ + dense-case NPZ + checksums + target order + dense case order + position map; Phase 54 per-vector metrics + mean temporal profiles + layer head-mean profiles + top1 frequency + lag-bin mass + report cases + recent-mass summary; Phase 55 head behavior + head-pair comparison + layer diversity (handoff reference only); Phase 56 error_attention_* artifacts + error-conditioning assignment + Phase 57 attention handoff. Phase 57 may NOT modify any frozen artifact, may NOT train, may NOT reload model, may NOT alter Test predictions, may NOT modify Phase 48/49/50/51/52/53/54/55/56 case selection or labels, may NOT interpret attention causally, may NOT digitize PNG, may NOT select best seed/head, may NOT prune head, may NOT perform post-hoc subgroup mining, may NOT perform weighted overall stability score.
  - Architecture strength preserved: this amendment adds new authorized paths and a new §7.37 sub-entry (§7.37.18) but does NOT delete or weaken any prior protection. Phase 58 / 59 remain explicitly UNAUTHORIZED for implementation.

#### 7.37.18. Phase 57 Seed-Stability Attention Check (authorized v1.19 2026-09-05)

Phase 57 (Seed-Stability Attention Check) được phép tạo package:

```text
src/course_work/phase57/
artifacts/seed_stability_attention/
  figures/
docs/save_log_in_processing/phase_57_seed_stability_attention_log.json
docs/save_log_in_processing/phase_57_architecture_amendment_log.json
tests/unit/test_phase57_*.py
```

sau khi amendment `phase-57-architecture-amendment-v1.19` ở §28 được Human approve và pre-process plan `docs/plan-doc/plan_before_process/phase_57_seed_stability_attention_plan.md` đã được Human duyệt.

Phase 57 chỉ thực hiện strictly descriptive seed-stability attention analysis trên frozen Phase 48 prediction_seed_spread (secondary diagnostic), frozen Phase 52 raw last-query NPZ + dense NPZ + checksums + target order + dense case order, frozen Phase 54 per-vector metrics + mean temporal profiles + layer head-mean profiles + top1 frequency + lag-bin mass + recent-mass summary, frozen Phase 55 head behavior + head-pair + layer diversity (handoff ref only), frozen Phase 56 error_attention_* artifacts + error-conditioning assignment + Phase 57 handoff. Phase 57 builds S57-A permutation-invariant layer head-mean stability first (mean 4 heads per target/layer FIRST, then compare layer-mean vectors across 3 seed pairs with JSD / L1 / L2 / Cosine / Pearson / Spearman / Wasserstein-minutes); builds S57-B permutation-aware canonical head matching within each encoder layer using full-Test mean last-query temporal profiles, exhaustive H! enumeration under locked H2/H4 (H=2 -> 2 perms, H=4 -> 24 perms), minimum total JSD cost with MATCH_TIE_TOL=1e-12, Wasserstein tie-break, lexicographic final tie-break; freezes matching fingerprint BEFORE applying any Phase56 effects; audits ambiguity (best-vs-second-best gap, edge margins); audits cycle consistency (direct 123->2026 vs anchor-induced 123->42->2026); computes Wasserstein-only sensitivity matching (independent, agreement-fraction reported, NEVER replaces canonical JSD); freezes canonical three-seed matched groups anchored at seed42 (anchor is first-predeclared only, NOT performance-based); computes matched-head mean-profile stability + per-target matched-head stability (frozen mapping reused per target, NO target-specific rematch) + matched-head behavior metric stability + matched-head top1-lag stability; computes dense-case full-map stability on frozen Phase51 cases using raw [L,L] matrices (rowwise JSD + cosine + normalized Frobenius; NO PNG); computes layer error-conditioned stability (PRIMARY error-effect robustness) + matched-head error-conditioned stability (SECONDARY, ambiguity-propagated) + shared-cohort robustness; joins Phase 48 prediction_seed_spread to layer mean-pairwise attention disagreement, reports Spearman secondary; emits Phase 58 final-tables handoff + Phase 59 context handoff.

Phase 57 KHÔNG được training, fine-tune, optimizer.step, .backward, scaler fitting, model checkpoint loading, model reconstruction, model.forward, return_attention, new attention extraction, new Test inference, prediction correction, best-seed/head selection, ensemble, weighted overall stability score, head ranking, head pruning, head ablation, head clustering, target-specific rematching, error-specific rematching, regime-specific rematching, case-specific rematching, anchor change after seeing results, mismatch-method replacement (Wasserstein never replaces JSD), cross-seed same-index semantic alignment assumption, cross-layer same-index semantic identity assumption, cartesian subgroup mining, Test regime retuning, attention=feature importance claim, attention=causal explanation, attention stability=functional equivalence proof, hay implement Phase 58–59.

Phase 57 phải tạo tối thiểu O57.1–O57.42 outputs theo canonical Phase 57 detail (manifest, contract, preflight audit, source verification, seed-pair manifest, layer head-mean stability + summary, per-target layer stability + three-seed disagreement, layer metric stability, head matching cost matrices + assignments + ambiguity audit + edge margins + cycle consistency + Wasserstein sensitivity, canonical matched groups, matching fingerprint, matching independence audit, matched-head profile stability + summary + consensus profiles, per-target matched-head stability + three-seed disagreement, matched-head metric stability, matched-head top1 stability, dense-case stability + summary, layer error-conditioned seed stability, matched-head error-conditioned stability, prediction-attention disagreement + matched variant, attention stability evidence summary, findings, tests, discrepancies, summary JSON, human-readable report, README, Phase 58 handoff, Phase 59 context handoff, sign-off). Phase 57 chỉ nhận Phase 48/52/54/55/56 frozen handoff files; Phase 58+ vẫn UNAUTHORIZED.


v1.20 (2026-09-05) - Phase 58 Final Tables amendment
  - Amendment ID: phase-58-architecture-amendment-v1.20
  - Date: 2026-09-05
  - Affected phase: Phase 58 (Final Tables) and downstream handoff to Phase 59
  - Reason: authorize a strictly reporting synthesis and governance phase that produces the final report-ready tables (FT01–FT10 + FA01–FA12) under artifacts/final_tables/ from frozen upstream machine-readable artifacts (Phase 44–57). Phase 58 is NOT a new analysis phase; it may only copy / join / reshape / format / audit / recompute display aggregates already authorized upstream. Phase 58 freezes main + appendix table inventories, figure references, render/rounding config, model labels, metric labels, source-of-truth ledger, cell lineage, and cross-table consistency audits. It builds FT01 from Phase 45 final model lock, FT02 from Phase 47 final Test metrics (with the authorized three-seed mean ± sample SD, ddof=1; NOT an ensemble), FT03 from Phase 44 rolling-origin (pooled RMSE primary), FT04 from Phase 48/49 prediction+residual diagnostics, FT05 from Phase 50/51 regimes+worst-cases, FT06 from Phase 54 last-query attention, FT07 from Phase 55 head diversity, FT08 from Phase 56 layer head-mean error-conditioned attention, FT09 from Phase 57 stability + matching, FT10 from upstream-supported claim trace; emits FA01–FA12 appendix detail; generates full-precision CSV → rounded Markdown → rounded LaTeX; emits cross-table audit (consistency, population, model_lock, seed, unit, rounding); emits coursework coverage audit; emits Phase 59 final-conclusions handoff. NO new training, NO new Test inference, NO new attention extraction, NO new metric, NO new cohort, NO new threshold, NO new hypothesis test, NO new confidence interval, NO ensemble reconstruction, NO best-seed/head selection, NO Test reranking, NO causal claim, NO PNG-pixel numeric reading, NO attention as feature importance, NO same-index head semantic alignment assumption, NO notebook modification (Phase 58-H is deferred to a separate Human-approved run).
  - New authorized paths:
    * `src/course_work/phase58/` (Phase 58 implementation package; sibling of `src/course_work/phase57/`)
    * `artifacts/final_tables/` (Phase 58 derived artifacts root; sub-dirs `tables/csv/`, `tables/markdown/`, `tables/latex/`, `tables/metadata/`)
    * `docs/save_log_in_processing/phase_58_final_tables_log.json`
    * `docs/save_log_in_processing/phase_58_architecture_amendment_log.json`
    * `tests/unit/test_phase58_*.py`
    * future: `src/course_work/reporting/phase_58_dashboard.py` (deferred to Phase 58-H; path authorized but NOT implemented in this run)
  - Phase 58 hard scientific contracts (locked):
    * source authority follows the canonical precedence exactly: Phase 45 (final lock) > Phase 46 (seeds) > Phase 47 (Test metrics) > Phase 48 (prediction spread) > Phase 49 (residuals) > Phase 50 (regimes) > Phase 51 (worst-cases) > Phase 52 (raw attention) > Phase 53 (attention figures) > Phase 54 (last-query) > Phase 55 (head comparison) > Phase 56 (error-conditioned) > Phase 57 (seed-stability); Phase 44 (rolling-origin) and Phase 43 (LSTM tuning) provide lineage context only
    * every scientific numeric table cell must trace to a machine-readable upstream artifact; narrative Markdown is NOT an authoritative numeric source
    * official Transformer seeds = [42, 123, 2026]; Three-seed summary = mean ± sample SD (ddof=1) of seed-level metrics, NOT an ensemble forecast
    * FT02 model order = [Persistence, Tuned LSTM, Final Transformer × 3 seeds, Final Transformer Three-Seed Summary]; do not sort by performance; do not bold/color the best Test value
    * display precision: Wh = 2dp; R² = 3dp; dimensionless (JSD/cosine/Spearman/Cliff's delta) = 3dp; minutes = 1dp; percent = 1dp; counts = integer
    * full-precision CSV is produced BEFORE display rounding; display rounding applied to Markdown/LaTeX only
    * aggregate BEFORE round (mean/SD computed on full precision; display tables present 2dp Wh / 3dp R² / etc.)
    * three-seed SD is descriptive only, NOT a confidence interval
    * Persistence and Tuned LSTM baselines do NOT receive fake ±SD
    * no best-value bolding; no color-coded winner; no row-specific emphasis
    * Phase 56 HIGH_ERROR / LOW_ERROR cohorts are Test-relative diagnostic cohorts; NEVER deployment regimes
    * Phase 57 same-index heads are NOT assumed semantically aligned across seeds
    * attention values are temporal allocation, NOT raw-feature importance; NOT causal explanation
    * pooled vs macro safeguard: rolling-origin FT03 pooled RMSE comes from Phase 44 authoritative output; do not average fold RMSE and relabel as pooled
    * R² aggregation safeguard: NEVER average per-regime R²; use upstream overall R² only
    * seed metric summary safeguard: mean of three seed-level metrics only; never metric of mean prediction
    * No MAPE, no new accuracy %, no new significance test, no new confidence interval
    * development evidence (Phase 44 rolling-origin) presented in a separate panel/column with explicit label; NEVER mixed into HELD_OUT_TEST_EVIDENCE
    * Phase 50 regime thresholds are FROZEN; do not redefine
    * Phase 51 worst-case ranking is FROZEN; do not reselect; do not remove cases from final metrics
    * status taxonomy: PASS / PASS_WITH_WARNING / FAIL (no STABLE / UNSTABLE / BEST by ad-hoc threshold)
  - Phase 58 leakage boundary (HARD):
    * may READ all frozen upstream artifacts listed in the source authority precedence
    * may recompute display aggregates already authorized upstream (three-seed mean ± SD with ddof=1, percentage share with explicit % header, deterministic ordering)
    * may READ machine-readable JSON / CSV / NPZ summaries only; may NOT load model checkpoint; may NOT call `model.forward`, `torch.load`, `return_attention`, `materialize_phase*`, `extract_attention`, `fit`, `fit_transform`
    * may NOT modify any frozen upstream artifact from Phase 43–57
  - Phase 58 forbidden actions (still prohibited and not weakened by this amendment):
    * training, fine-tune, optimizer.step, .backward, model.train, scaler.fit, scaler.fit_transform
    * new Test inference, new attention extraction, return_attention
    * destructive overwrite of any frozen Phase 43–57 canonical artifact
    * best-seed selection, best-head selection, ensemble reconstruction, weighted overall stability or weighted diversity score
    * Test reranking by metric magnitude, best-value highlighting (bold/color) by Test performance, post-Test model selection
    * MAPE or new accuracy %; new hypothesis test (paired t-test, Wilcoxon, Diebold-Mariano, bootstrap); new confidence interval
    * Phase 50 regime redefinition, Phase 51 worst-case reselection/removal
    * attention labeled as feature importance or causal contribution; attention stability labeled as functional-equivalence proof
    * cross-seed head semantic alignment assumption by same index; head pruning/ablation implication
    * squared error, MAPE, asymmetric error variants introduced as new primary metrics
    * reading numeric attention values from PNG heatmaps; manual typing of scientific values without source lineage
    * implementing Phase 59 substantive conclusions (handoff file only); the Phase 59 conclusions phase remains UNAUTHORIZED
    * notebook modification in this run (Phase 58-H is deferred to a separate Human-authorized run)
  - Notebook cells: NONE in this run. Phase 58-H is deferred to a separate Human-approved run after Phase 58 sign-off.
  - Source plan reference: `docs/plan-doc/plan_before_process/phase_58_final_tables_plan.md` (pre-process plan, APPROVED 2026-09-05) and `docs/plan-doc/plan_detail_for_each_phase/Phase_58_Final_tables.md` (canonical Phase detail).
  - Human approval: APPROVED 2026-09-05 (governance log: `docs/save_log_in_processing/phase_58_architecture_amendment_log.json`). Phase 58 sub-phase gates still require Human approval at each sub-phase gate per the pre-process plan.
  - Test firewall: Phase 58 may read all Phase 43–57 frozen machine-readable artifacts (JSON / CSV / NPZ summaries / checksums / target order / position map / regime labels / shared hardness / cohort assignments / matching fingerprint). Phase 58 may NOT modify any frozen artifact, may NOT train, may NOT reload model, may NOT run new Test inference, may NOT extract attention, may NOT alter Test predictions, may NOT modify Phase 43–57 case selection or labels, may NOT select best seed/head, may NOT perform new significance tests, may NOT introduce MAPE, may NOT interpret attention causally, may NOT digitize PNG, may NOT recompute frozen upstream aggregates using a different definition, may NOT weight multiple metrics into a single "ensemble" score, may NOT bolt on a Phase 59 substantive conclusions module.
  - Architecture strength preserved: this amendment adds new authorized paths and a new §7.37 sub-entry (§7.37.19) but does NOT delete or weaken any prior protection. Phase 59 remains explicitly UNAUTHORIZED for substantive implementation.

#### 7.37.19. Phase 58 Final Tables (authorized v1.20 2026-09-05)

Phase 58 (Final Tables) được phép tạo package:

```text
src/course_work/phase58/
artifacts/final_tables/
  tables/csv/
  tables/markdown/
  tables/latex/
  tables/metadata/
docs/save_log_in_processing/phase_58_final_tables_log.json
docs/save_log_in_processing/phase_58_architecture_amendment_log.json
tests/unit/test_phase58_*.py
```

sau khi amendment `phase-58-architecture-amendment-v1.20` ở §28 được Human approve và pre-process plan `docs/plan-doc/plan_before_process/phase_58_final_tables_plan.md` đã được Human duyệt.

Phase 58 chỉ thực hiện reporting synthesis và governance dựa trên frozen upstream machine-readable artifacts của Phase 43–57. Phase 58 builds FT01 từ Phase 45 final lock, FT02 từ Phase 47 Test metrics (Three-Seed Summary = mean ± sample SD với ddof=1, KHÔNG ensemble), FT03 từ Phase 44 rolling-origin (pooled RMSE primary, development evidence label rõ ràng), FT04 từ Phase 48/49 (prediction-spread + residual diagnostics), FT05 từ Phase 50/51 (regime thresholds và worst-case ranks FROZEN, NO post-hoc reselection), FT06 từ Phase 54 last-query metrics + mean profiles + layer head-mean profiles, FT07 từ Phase 55 layer head diversity (architectural order, NO score), FT08 từ Phase 56 layer head-mean error-conditioned effects, FT09 từ Phase 57 layer head-mean stability + head matching summary (matching fingerprint FROZEN before any effect reindexing), FT10 evidence/limitation từ upstream-supported claim trace; FA01–FA12 appendix detail. Generates full-precision CSV trước, sau đó rounded Markdown và LaTeX. Emits cross-table consistency / population / model-lock / seed / unit / rounding audits; coursework requirement coverage audit; table-to-claim traceability; Phase 59 final-conclusions handoff.

Phase 58 KHÔNG được training, fine-tune, optimizer.step, .backward, model.train, scaler.fit, scaler.fit_transform, new Test inference, new attention extraction, model checkpoint loading, model.forward, return_attention, materialize_phase*, destructive overwrite of any Phase 43–57 canonical artifact, best-seed/head selection, ensemble reconstruction, weighted overall stability score, Test reranking, best-value bolding by Test performance, MAPE/accuracy %, new hypothesis test, new confidence interval, Phase 50 regime redefinition, Phase 51 worst-case reselection/removal, attention labeled as feature importance or causal contribution, attention stability labeled as functional equivalence proof, cross-seed head semantic alignment by same index, reading numeric attention values from PNG, manual typing of scientific values without source lineage, hay implement Phase 59 substantive conclusions (handoff JSON only).

Phase 58 phải tạo tối thiểu O58.1–O58.43 outputs theo canonical Phase 58 detail (manifest, contract, preflight audit, frozen table inventory, frozen figure inventory, render config, source ledger, critical cell lineage, model label map, label dictionary, FT01–FT10 main tables, FA01–FA12 appendix tables, CSV/Markdown/LaTeX packages, per-table metadata JSON, table checksums, cross-consistency/population/model-lock/seed/unit/rounding audits, coursework requirement coverage, table-to-claim traceability, FINAL_TABLE_CATALOG.md, findings, tests, discrepancies, Phase 59 handoff, summary JSON, human-readable report, README, sign-off). Phase 58 chỉ nhận Phase 43–57 frozen artifacts; Phase 59 substantive conclusions vẫn UNAUTHORIZED.

v1.21 (2026-09-05) - Phase 59 Final Conclusions amendment
  - Amendment ID: phase-59-architecture-amendment-v1.21
  - Date: 2026-09-05
  - Affected phase: Phase 59 (Final Conclusions) — the final scientific closure and claim-governance phase.
  - Reason: authorize a strictly SCIENTIFIC-CLOSURE + CLAIM-GOVERNANCE phase that closes RQ1–RQ10 from frozen Phase 58 FINAL_TABLES-v1, freezes the final scientific narrative, and emits the canonical conclusion package. Phase 59 is NOT a new analysis phase; it may only read frozen evidence, classify claim strength (LEVEL_0..LEVEL_3; LEVEL_4 = NOT_SUPPORTED), close research questions, write conclusions, document limitations, define future work, run provenance/language/numeric/claim audits, and freeze the final scientific narrative.
  - New authorized paths:
    * `src/course_work/phase59/` (Phase 59 implementation package; sibling of `src/course_work/phase58/`)
    * `artifacts/final_conclusions/` (Phase 59 derived artifacts root; sub-dir `final_submission_conclusion_package/`)
    * `docs/save_log_in_processing/phase_59_final_conclusions_log.json`
    * `docs/save_log_in_processing/phase_59_architecture_amendment_log.json`
    * `tests/unit/test_phase59_*.py`
    * future: `src/course_work/reporting/phase_59_dashboard.py` (deferred to Phase 59-H; path authorized but NOT implemented in this run)
  - Phase 59 hard scientific contracts (locked):
    * input is exclusively Phase 58 FINAL_TABLES-v1 + claim-traceability ledger + FA12 upstream warnings
    * evidence classes preserved exactly: DEVELOPMENT_EVIDENCE / HELD_OUT_TEST_EVIDENCE / POST_TEST_DIAGNOSTIC_EVIDENCE
    * claim-strength taxonomy frozen: LEVEL_0 DESCRIPTIVE_ONLY, LEVEL_1 OBSERVED_ASSOCIATION, LEVEL_2 ROBUST_DESCRIPTIVE_PATTERN, LEVEL_3 FINAL_HELD_OUT_RESULT, LEVEL_4 CAUSAL/UNIVERSAL/EXTERNAL_GENERALIZATION (NOT_SUPPORTED in this coursework)
    * three-seed summary remains mean ± sample SD (ddof=1), NEVER an ensemble
    * Persistence and tuned LSTM are reported even when unfavorable to the Transformer; mixed outcomes are NOT spun positively
    * rolling-origin is DEVELOPMENT_EVIDENCE only; never relabeled as Test
    * worst-error cases remain valid frozen Test observations; never justify deletion
    * residual sign convention frozen: y_true - y_pred; positive = UNDERPREDICTION, negative = OVERPREDICTION
    * attention = temporal token allocation, NOT raw-feature importance, NOT causal attribution
    * head-profile similarity ≠ functional redundancy (value/output projections can differ)
    * HIGH_ERROR/LOW_ERROR are Test-relative diagnostic cohorts, NOT deployment regimes
    * Phase 57 same-index heads are NOT assumed semantically aligned across seeds
    * Phase 57 cycle consistency is reported when complete; ambiguity surfaced when partial
  - Phase 59 leakage boundary (HARD):
    * may READ all Phase 58 frozen artifacts (FT01–FT10, FA01–FA12, source ledger, cell lineage, FA12 caveats, manifest, signoff)
    * may recompute only deterministic formatting (display rounding) and narrative synthesis over already-authorized evidence
    * may NOT modify any Phase 43–58 frozen artifact
    * may NOT call any training/inference/attention-extraction code path
  - Phase 59 forbidden actions (still prohibited):
    * training, fine-tune, optimizer.step, .backward, model.train, scaler.fit
    * new Test inference, new attention extraction, return_attention, materialize_phase*
    * destructive overwrite of any frozen Phase 43–58 canonical artifact
    * best-seed selection, best-head selection, ensemble reconstruction, Test reranking
    * new metric, new cohort/regime/threshold, new statistical/hypothesis test, new confidence interval
    * post-Test retuning, model reselection based on Test diagnostics
    * causal attention claims, deployment-ready claims, external/multi-house generalization claims, economic-impact claims
    * attention labeled as feature importance or causal explanation; attention stability labeled as functional-equivalence proof
    * cross-seed head semantic alignment assumption by same index
    * squared error or MAPE introduced as new primary metric; new accuracy %
    * reading numeric attention values from PNG heatmaps
    * phrasing future work as completed improvement on current Test
  - Notebook cells: NONE in this run. Phase 59-H is deferred to a separate Human-approved run after Phase 59 sign-off.
  - Source plan reference: `docs/plan-doc/plan_before_process/phase_59_final_conclusions_plan.md` (pre-process plan, APPROVED 2026-09-05) and `docs/plan-doc/plan_detail_for_each_phase/Phase_59_Final_conclusions.md` (canonical Phase detail).
  - Human approval: APPROVED 2026-09-05 (governance log: `docs/save_log_in_processing/phase_59_architecture_amendment_log.json`).
  - Test firewall: Phase 59 may READ all Phase 58 frozen machine-readable artifacts. Phase 59 may NOT modify any frozen artifact, may NOT train, may NOT reload model, may NOT run new Test inference, may NOT extract attention, may NOT alter Test predictions, may NOT modify Phase 43–58 case selection or labels, may NOT select best seed/head, may NOT perform new significance tests, may NOT introduce new metric, may NOT interpret attention causally, may NOT digitize PNG, may NOT recompute frozen upstream aggregates using a different definition, may NOT weight multiple metrics into a single score.
  - Architecture strength preserved: this amendment adds new authorized paths and a new §7.37 sub-entry (§7.37.20) but does NOT delete or weaken any prior protection.

#### 7.37.20. Phase 59 Final Conclusions (authorized v1.21 2026-09-05)

Phase 59 (Final Conclusions) được phép tạo package:

```text
src/course_work/phase59/
artifacts/final_conclusions/
  final_submission_conclusion_package/
docs/save_log_in_processing/phase_59_final_conclusions_log.json
docs/save_log_in_processing/phase_59_architecture_amendment_log.json
tests/unit/test_phase59_*.py
```

sau khi amendment `phase-59-architecture-amendment-v1.21` ở §28 được Human approve và pre-process plan `docs/plan-doc/plan_before_process/phase_59_final_conclusions_plan.md` đã được Human duyệt.

Phase 59 chỉ thực hiện scientific closure + claim governance dựa trên frozen Phase 58 FINAL_TABLES-v1. Phase 59 closes RQ1–RQ10 using only frozen evidence; emits research_question_conclusion_matrix.csv, final_claim_strength_ledger.csv, final_conclusion_outcome_matrix.csv, final_limitation_ledger.csv, final_future_work_ledger.csv, final_conclusion_sentence_ledger.csv, final_conclusion_language_audit.csv, final_conclusion_numeric_audit.csv, final_conclusion_claim_table_audit.csv, final_limitation_coverage_audit.csv, final_future_work_integrity_audit.csv, final_coursework_objective_closure.csv; emits the canonical submission package (final_conclusion_section.md, final_conclusion_short.md, final_abstract_results_summary.md, final_key_takeaways.md, final_research_question_answers.md, final_limitations.md, final_future_work.md, final_viva_defense_notes.md); emits coursework_completion_manifest.json, final_scientific_narrative_fingerprint.json, FINAL_PROJECT_SUMMARY.md, README_FINAL_CONCLUSIONS.md, findings/tests/discrepancies, and phase_59_signoff.json.

Phase 59 KHÔNG được training, fine-tune, optimizer.step, .backward, model.train, scaler.fit, scaler.fit_transform, new Test inference, new attention extraction, model checkpoint loading, model.forward, return_attention, materialize_phase*, destructive overwrite of any Phase 43–58 canonical artifact, best-seed/head selection, ensemble reconstruction, weighted overall score, Test reranking, MAPE/accuracy %, new hypothesis test, new confidence interval, new cohort/regime/threshold, Phase 50 regime redefinition, Phase 51 worst-case reselection/removal, attention labeled as feature importance or causal contribution, attention stability labeled as functional equivalence proof, cross-seed head semantic alignment by same index, reading numeric attention values from PNG, manual typing of scientific values without source lineage, hay bất kỳ Phase > 59 nào.

v1.22 (2026-09-06) - Supplementary MAPE Metric Addendum amendment
  - Amendment ID: supplementary-mape-metric-addendum-v1.22
  - Date: 2026-09-06
  - Affected scope: shared metric implementation, derived supplementary metric artifacts, process compliance audit and read-only notebook presentation
  - Reason: authorize standard MAPE as supplementary evidence without changing any Phase 0–59 selection decision, Test access history or frozen scientific narrative
  - New authorized paths:
    * `src/course_work/metric_addendum/`
    * `src/course_work/reporting/mape_addendum.py`
    * `artifacts/metric_addendum/mape/`
    * `docs/save_log_in_processing/mape_metric_addendum_log.json`
    * `docs/save_log_in_processing/ml_pipeline_compliance_audit_log.json`
    * `tests/unit/test_mape_metric.py`
    * `tests/integration/test_mape_addendum.py`
  - MAPE formula: `100 * mean(abs((y_true_wh - y_pred_wh) / y_true_wh))`
  - MAPE unit: percent
  - MAPE direction: lower is better
  - MAPE role: supplementary reporting only
  - Zero-target policy: no epsilon, no silent filtering, any exact zero target makes population MAPE undefined with status `UNDEFINED_ZERO_TARGET`
  - Computation policy: original Wh, NumPy float64, full aligned population, no batch-average MAPE, no prediction clipping and no prediction rounding
  - Selection policy preserved: Validation RMSE Wh remains the only model-selection, early-stopping and BEST-checkpoint metric
  - Historical contract preservation: `METRICS-v1`, `FINAL_TEST_EVAL-v1`, `FINAL_TABLES-v2` and `FINAL_CONCLUSIONS-v2` remain immutable
  - Test evidence label: any MAPE derived from already-frozen Test predictions must be labeled `POSTHOC_SUPPLEMENTARY_TEST_METRIC`
  - Test source gate: frozen Test prediction bundles must exist and match `prediction_checksums.json`; otherwise Test MAPE is `BLOCKED_SOURCE_UNAVAILABLE`
  - Notebook boundary: the notebook may only import and call the public MAPE addendum renderer; formula, source discovery, validation, computation and serialization remain outside the notebook
  - Human approval: APPROVED 2026-09-06 through the accepted `mape_metric_addendum_preprocess_plan.md`
  - Forbidden actions: training, fine-tuning, new Test inference, checkpoint loading, model forward, scaler fitting, winner reselection, best-seed selection, ensemble reconstruction, Phase 23–41 reranking, Phase 45 lock change, destructive overwrite of Phase 0–59 artifacts, mutation of the Phase 59 scientific narrative, manual scientific values and numeric extraction from images

#### 7.37.21. Supplementary MAPE Metric Addendum

The supplementary MAPE addendum is a post-completion derived reporting package and is not Phase 60.

The implementation is separated by responsibility:

```text
src/course_work/evaluation/metrics.py
src/course_work/metric_addendum/
src/course_work/reporting/mape_addendum.py
artifacts/metric_addendum/mape/
docs/save_log_in_processing/mape_metric_addendum_log.json
docs/save_log_in_processing/ml_pipeline_compliance_audit_log.json
tests/unit/test_mape_metric.py
tests/integration/test_mape_addendum.py
```

The evaluation layer owns formula and numerical guards. The metric addendum layer owns frozen-source discovery, checksum verification, population verification and derived artifact creation. The reporting layer owns static HTML only. The notebook owns public renderer invocation only.

Validation MAPE may be derived only from existing prediction artifacts. Test MAPE may be derived only from existing frozen Phase 47 prediction bundles whose SHA-256 values match the frozen checksum registry. Missing Test prediction bundles must remain blocked and must not trigger Test inference.

The addendum may report MAPE per model and per official Transformer seed, and may report mean plus sample standard deviation across seeds. It may not select a seed, create an ensemble, modify rankings or rewrite the frozen Phase 59 conclusion package.
