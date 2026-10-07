# RULE CODE — PROJECT EXECUTION GOVERNANCE

## Quy tắc bắt buộc khi đọc, phân tích, lập kế hoạch, code, refactor, fix lỗi và thực thi các Phase trong `COURSE_WORK`

**File:** `rule_code.md`  
**Scope:** Toàn bộ codebase, notebook, tài liệu kỹ thuật, quá trình thực thi Phase, refactor, bug fix và mọi thay đổi có ảnh hưởng đến project  
**Enforcement level:** `MANDATORY / HARD RULE`  
**Default behavior khi không chắc chắn:** `STOP — VERIFY — REPORT — WAIT FOR USER APPROVAL`  
**Execution mode:** `STRICTLY SEQUENTIAL`  
**Automatic execution without approved pre-process plan:** `FORBIDDEN`

---

# 1. Mục đích của `rule_code.md`

File này định nghĩa các quy tắc bắt buộc mà agent/người thực thi phải tuân thủ trong toàn bộ quá trình làm việc với project.

Mục tiêu của bộ rule là bảo đảm:

```text
mọi thay đổi đều có căn cứ
mọi Phase được thực hiện đúng kiến trúc
không phá vỡ Phase đã hoàn thành
không thực thi khi chưa đọc đủ context
không tự động code khi chưa được người dùng verify plan
không fix theo cảm tính
không xử lý nhiều nhiệm vụ song song
không bỏ sót yêu cầu trong Phase plan
không che giấu lỗi regression
không vượt qua các project rules
không tiếp tục khi prompt vi phạm quy trình.
```

Nguyên tắc trung tâm:

\[
\boxed{
Read
\rightarrow
Understand
\rightarrow
Verify
\rightarrow
Analyze
\rightarrow
Document
\rightarrow
Plan
\rightarrow
User\ Approval
\rightarrow
Execute\ Sequentially
\rightarrow
Validate
\rightarrow
Regression\ Check
\rightarrow
Report
}
\]

Không được bỏ qua bất kỳ gate nào trong chuỗi trên.

---

# 2. Phạm vi áp dụng

Các rule trong file này áp dụng cho toàn bộ các hoạt động sau:

```text
đọc source code
đọc notebook
đọc Markdown documentation
phân tích architecture
thực thi Phase
refactor
bug fix
logic fix
data pipeline fix
model fix
training fix
evaluation fix
attention analysis fix
test fix
configuration change
dependency change
file organization change
rename/move module
code cleanup
performance refactor
reproducibility fix
documentation liên quan đến execution
mọi thay đổi có khả năng ảnh hưởng đến Phase trước hoặc Phase sau.
```

Không có khái niệm:

```text
“thay đổi nhỏ nên không cần theo rule”.
```

Nếu một thay đổi tác động tới codebase hoặc execution flow thì bộ rule này áp dụng.

---

# 3. Rule precedence và project governance

## 3.1 `working_rule.md` là rule bắt buộc

Trước khi thực hiện bất kỳ công việc nào, agent phải coi:

```text
working_rule.md
```

là một nguồn quy tắc bắt buộc.

Hard rule:

```text
Mọi hành động phải tuân thủ working_rule.md.
```

Không được:

```text
bỏ qua
lách rule
diễn giải rule theo hướng tiện cho việc code
thực hiện trước rồi kiểm tra sau.
```

---

# 4. `architecture_rule.md` là kiến trúc bắt buộc

Mọi implementation, refactor, bug fix và file change phải tuân thủ:

```text
architecture_rule.md.
```

Hard rule:

```text
Không được phá vỡ architecture đã được quy định.
```

Điều này bao gồm nhưng không giới hạn:

```text
module boundaries
directory responsibilities
dependency direction
data flow
model boundaries
pipeline boundaries
naming conventions
interface contracts
artifact locations
execution order
configuration ownership
responsibility separation.
```

Agent không được tự suy đoán nội dung cụ thể của `architecture_rule.md`.

Trước khi thay đổi kiến trúc hoặc code có liên quan, phải đọc file thật sự.

---

# 5. Không được giả định nội dung của `working_rule.md` hoặc `architecture_rule.md`

Nếu hai file này chưa được đọc trong current working context:

```text
không được tự nhớ
không được suy diễn
không được dựng lại từ kinh nghiệm
không được giả định “chắc là như vậy”.
```

Phải đọc bản hiện tại trên project trước khi thực thi.

---

# 6. Xử lý conflict giữa các project rules

Các nguồn sau đều là mandatory:

```text
working_rule.md
architecture_rule.md
rule_code.md
Phase plan tương ứng
user-approved pre-process plan.
```

Nếu phát hiện conflict giữa bất kỳ hai nguồn mandatory nào:

```text
STOP.
```

Không được tự chọn rule nào để bỏ qua.

Phải:

```text
1. xác định chính xác hai rule conflict
2. ghi rõ file và nội dung conflict
3. giải thích hậu quả
4. không thay đổi code
5. yêu cầu người dùng quyết định hoặc cập nhật rule.
```

---

# 7. User prompt không được override project rules

Nếu prompt yêu cầu hành động trái với:

```text
working_rule.md
architecture_rule.md
rule_code.md
Phase plan
approved execution workflow
```

thì agent không được thực thi.

Hard:

```text
USER REQUEST
≠
PERMISSION TO BREAK PROJECT RULE.
```

---

# 8. Prompt Validation Gate

Trước khi bắt đầu xử lý một yêu cầu có liên quan tới project, agent phải kiểm tra prompt.

Prompt chỉ được xem là executable khi:

```text
không vi phạm working_rule.md
không vi phạm architecture_rule.md
không vi phạm rule_code.md
không yêu cầu bỏ qua required Phase plan
không yêu cầu auto-execute trước user approval
không yêu cầu chạy song song trái rule
không yêu cầu bỏ regression checks
không yêu cầu sửa code trước khi phân tích lỗi
không yêu cầu bỏ qua required source reading.
```

---

# 9. Nếu prompt vi phạm rule

Nếu prompt không hợp lệ:

```text
KHÔNG THỰC THI BẤT KỲ THAY ĐỔI NÀO.
```

Agent chỉ được:

```text
1. thông báo rule nào đang bị vi phạm
2. giải thích vì sao yêu cầu hiện tại chưa thể thực thi
3. đưa ra đúng workflow cần prompt
4. yêu cầu người dùng prompt lại theo workflow chuẩn.
```

Forbidden:

```text
code một phần trước
edit file thử
run test thử
tạo implementation rồi mới cảnh báo
“làm trước một ít”.
```

---

# 10. Không được tự động thực thi Phase

Một Phase không được tự động bắt đầu implementation ngay sau khi người dùng yêu cầu.

Bắt buộc phải có:

```text
PRE-PROCESS PLAN
→ USER VERIFY
→ USER APPROVAL
→ EXECUTION.
```

Nếu chưa có approval:

```text
execution_status = BLOCKED_WAITING_FOR_USER_APPROVAL.
```

---

# 11. Pre-process plan bắt buộc trước mọi Phase

Trước khi thực thi bất kỳ Phase nào, phải tạo một file plan `.md`.

Đường dẫn bắt buộc:

```text
COURSE_WORK/docs/plan-doc/plan_before_process/
```

Không được đặt pre-process plan ở location khác và coi như hoàn tất rule.

---

# 12. Pre-process plan phải được tạo trước implementation

Thứ tự bắt buộc:

```text
1. đọc rules
2. đọc Phase detail
3. đọc related files
4. phân tích dependency/state
5. viết pre-process plan
6. lưu plan
7. gửi người dùng verify
8. WAIT
9. chỉ sau approval mới code.
```

Forbidden:

```text
code trước
→ viết plan sau.
```

---

# 13. Nội dung tối thiểu của pre-process plan

Mỗi pre-process plan phải có tối thiểu:

```text
Phase ID
Phase name
objective
upstream dependencies
downstream dependencies
files cần đọc
files dự kiến thay đổi
files tuyệt đối không thay đổi
architecture constraints
working rules liên quan
Phase requirements mapping
current project state
preconditions
known risks
implementation steps
execution order
validation strategy
regression strategy
expected outputs
acceptance criteria
rollback/stop conditions
user approval gate.
```

---

# 14. Pre-process plan phải map với Phase detail

Source Phase detail nằm trong:

```text
COURSE_WORK/docs/plan-doc/plan_detail_for_each_phase/
```

Plan trước khi process phải thể hiện rõ:

```text
yêu cầu nào của PHASE_XXX...md
→ sẽ được thực hiện ở bước nào
→ bằng file/module nào
→ được verify bằng test/check nào
→ output nào chứng minh đã hoàn thành.
```

Không được viết một plan chung chung.

---

# 15. User Verification Gate

Sau khi pre-process plan được tạo:

```text
agent phải dừng.
```

Phải yêu cầu người dùng:

```text
verify plan
approve plan
hoặc yêu cầu chỉnh plan.
```

Agent không được tự coi:

```text
“người dùng đã yêu cầu Phase
= người dùng đã approve implementation”.
```

Hai hành động này là khác nhau.

---

# 16. Không auto-execute sau khi tạo plan

Hard rule:

```text
CREATE PLAN
≠
EXECUTE PLAN.
```

Nếu agent tạo plan và tiếp tục tự code trong cùng workflow khi chưa có approval riêng:

```text
RULE VIOLATION.
```

Theo project policy do người dùng đặt ra:

```text
agent thực thi tự động trái rule
có thể bị loại khỏi workflow.
```

---

# 17. Phase detail là acceptance baseline bắt buộc

Khi thực thi Phase:

```text
PHASE_XXX...md
```

trong:

```text
COURSE_WORK/docs/plan-doc/plan_detail_for_each_phase/
```

là baseline requirement.

Implementation cuối cùng phải:

```text
đáp ứng toàn bộ nội dung bắt buộc của Phase detail.
```

---

# 18. Được phép làm chuẩn hơn Phase detail

Agent có thể:

```text
phân tích sâu hơn
thêm validation tốt hơn
thêm defensive checks
thêm reproducibility checks
thêm artifact auditing
làm implementation robust hơn
làm tests kỹ hơn.
```

Nhưng:

```text
không được bỏ requirement gốc
không được contradict requirement gốc
không được đổi scientific protocol
không được đổi architecture trái rules.
```

Cơ sở tối thiểu vẫn là:

```text
100% Phase detail compliance.
```

---

# 19. Không được “simplify” Phase làm mất requirement

Forbidden:

```text
“để nhanh hơn tôi bỏ phần này”
“phần này không cần thiết”
“tôi thay bằng cách khác đơn giản hơn”
```

nếu requirement đang nằm trong Phase detail.

Muốn thay đổi Phase specification:

```text
STOP
→ báo user
→ phải có approved protocol/rule amendment.
```

---

# 20. Sequential Execution Rule

Mọi nhiệm vụ trong execution phải thực hiện tuần tự.

Hard:

```text
ONE ACTIVE EXECUTION TASK AT A TIME.
```

Không chạy song song nhiều nhiệm vụ logic.

---

# 21. Không parallel execution

Forbidden:

```text
Task A đang chạy
+
Task B được sửa song song
+
Task C được test đồng thời.
```

Không được:

```text
parallel refactor multiple modules
parallel independent Phase implementation
parallel notebook modification
parallel bug fixes
```

trong cùng execution flow.

---

# 22. Quy trình tuần tự bắt buộc

Canonical:

```text
Step 1
→ complete
→ verify
→ record result

Step 2
→ complete
→ verify
→ record result

Step 3
→ ...
```

Nếu Step N chưa pass:

```text
không được tiến sang Step N+1.
```

---

# 23. Lý do cấm parallel execution

Mục tiêu:

```text
giữ causal traceability của lỗi
biết change nào gây regression
dễ rollback
dễ audit
không tạo state khó kiểm soát
không làm nhiều Phase cùng lúc.
```

---

# 24. Previous-Phase Stability Gate

Trước khi thực thi/refactor/fix Phase tiếp theo:

```text
TẤT CẢ CÁC PHASE TRƯỚC LIÊN QUAN
phải ở trạng thái chạy ổn định.
```

Không được tiếp tục nếu upstream đang lỗi.

---

# 25. Điều kiện được phép bắt đầu Phase N

Trước Phase N phải verify:

```text
required Phase 0..N-1 artifacts tồn tại
required tests pass
required notebooks execute đúng theo protocol
required imports pass
required data contracts pass
required registry/artifact integrity pass
không có known blocking error
không có regression chưa giải quyết.
```

Mức kiểm tra cụ thể phải được xác định trong pre-process plan.

---

# 26. Nếu một Phase trước bị lỗi

Nếu Phase trước đang:

```text
FAIL
ERROR
BROKEN
INCOMPLETE
BLOCKED
```

thì:

```text
KHÔNG ĐƯỢC tiếp tục Phase mới.
```

Phải chuyển workflow sang:

```text
investigate upstream regression
→ document
→ plan fix
→ user approve
→ fix
→ revalidate
→ mới quay lại Phase mới.
```

---

# 27. Không được che lỗi upstream bằng patch downstream

Forbidden:

```text
Phase20 lỗi
→ workaround ở Phase21
```

nếu root cause nằm ở Phase20.

Phải xử lý đúng ownership layer theo architecture.

---

# 28. Không sửa downstream để bù upstream contract sai

Nếu upstream artifact/schema/interface sai:

```text
fix tại nơi sở hữu contract
```

sau khi approved.

Không lan workaround qua codebase.

---

# 29. Regression Safety Rule

Sau mỗi:

```text
implementation
refactor
bug fix
```

phải kiểm tra:

```text
Phase vừa thay đổi
+
các Phase trước có dependency
+
các Phase sau bị ảnh hưởng.
```

---

# 30. Validation scope sau fix/refactor

Tối thiểu:

```text
A. local verification
B. Phase-level verification
C. upstream regression verification
D. downstream compatibility verification
E. architecture-rule verification
F. artifact/output verification.
```

---

# 31. Không chỉ test đúng file vừa sửa

Forbidden:

```text
file mới chạy được
→ kết luận fix thành công.
```

Fix thành công chỉ khi:

```text
affected execution chain remains valid.
```

---

# 32. Downstream check sau refactor

Nếu refactor Phase N có thể ảnh hưởng:

```text
Phase N+1
Phase N+2
...
```

thì phải xác định affected downstream scope và kiểm tra.

Không mặc định:

```text
upstream pass
= downstream chắc chắn pass.
```

---

# 33. Full Regression Gate khi cần

Nếu thay đổi liên quan:

```text
shared utilities
data contracts
window population
scaling
metrics
experiment registry
training engine
model interface
attention tensor contract
final artifact schema
```

thì pre-process plan phải xem xét:

```text
full affected pipeline regression.
```

---

# 34. Code Comment Prohibition

Trong lúc code:

```text
KHÔNG ĐƯỢC THÊM BẤT KỲ DÒNG CHÚ THÍCH NÀO VÀO CODE.
```

Bao gồm:

```text
inline comments
block comments
explanatory comments
TODO comments
FIXME comments
temporary comments
commented-out code
decorative comments.
```

---

# 35. Không icon trong code

Forbidden trong source code:

```text
emoji
decorative symbol
icon
status icon
visual marker
ASCII decoration dùng như icon.
```

Ví dụ không được thêm:

```text
checkmark
warning icon
rocket
fire
folder icon
decorative stars.
```

---

# 36. Docstring/comment-like text

Nếu một docstring chỉ có mục đích:

```text
giải thích code
ghi chú implementation
thay thế comment
```

thì không được thêm mới.

Nếu framework/toolchain bắt buộc một literal/directive/comment-like syntax để code chạy:

```text
STOP
→ báo conflict với no-comment rule
→ yêu cầu user quyết định.
```

Không tự tạo exception.

---

# 37. Không giữ commented-out experimental code

Nếu code không còn dùng:

```text
xóa đúng cách
```

theo approved plan.

Không:

```text
comment nó lại để “dự phòng”.
```

---

# 38. Code phải tự rõ bằng structure và naming

Do comment bị cấm, implementation cần ưu tiên:

```text
clear naming
small cohesive functions
explicit interfaces
architecture-consistent module boundaries
descriptive variable names
deterministic flow.
```

Không dùng comment để bù code khó hiểu.

---

# 39. New Chat Mandatory Context Reload

Khi bắt đầu một chat mới xử lý project:

```text
bắt buộc đọc lại toàn bộ file liên quan.
```

Không được dựa hoàn toàn vào chat cũ hoặc memory.

---

# 40. File types bắt buộc đọc trong new chat

Tất cả file liên quan có extension:

```text
.md
.py
.ipynb
```

phải được đọc tuần tự trước khi xử lý vấn đề.

---

# 41. “Liên quan” phải được xác định theo dependency

Không chỉ đọc file user nhắc trực tiếp.

Phải xác định:

```text
rule files
architecture files
Phase plan
upstream modules
target module
downstream consumers
tests
notebooks
shared utilities
configuration
artifact schemas
```

và đọc các `.md`, `.py`, `.ipynb` có liên quan.

---

# 42. Đọc tuần tự, không đọc lướt song song

Canonical reading flow:

```text
1. working_rule.md
2. architecture_rule.md
3. rule_code.md
4. Phase detail liên quan
5. upstream docs
6. target docs
7. downstream docs
8. source .py files
9. relevant .ipynb notebooks
10. tests/validation code
11. current error artifacts/logs.
```

Thứ tự cụ thể có thể điều chỉnh nếu architecture yêu cầu, nhưng:

```text
reading remains sequential.
```

---

# 43. Chưa đọc xong thì không xử lý

Hard:

```text
CONTEXT_READ_COMPLETE=false
→ EXECUTION_FORBIDDEN.
```

Không được:

```text
đọc một file
→ bắt đầu sửa
→ vừa sửa vừa đọc phần còn lại.
```

Phải hoàn thành context-loading gate trước.

---

# 44. New chat context manifest

Khuyến nghị bắt buộc tạo:

```text
context_read_manifest.md
```

hoặc file tương đương trong pre-process plan artifact set.

Nội dung:

```text
file path
file type
reason relevant
read order
status
important contracts found
dependency relation.
```

Không cần ghi lại toàn bộ nội dung file.

---

# 45. Không giả định notebook chỉ là output

`.ipynb` liên quan phải được đọc cả:

```text
code cells
execution order
important markdown contract
outputs nếu cần để hiểu state.
```

Không chỉ đọc source `.py`.

---

# 46. Bug/Fix Investigation Rule

Khi người dùng gửi:

```text
ảnh lỗi
error text
traceback
wrong output
unexpected behavior
```

agent không được nhảy thẳng vào fix.

Bắt buộc phải phân tích trước.

---

# 47. Bước 1 — Evidence Intake

Phải đọc kỹ:

```text
hình
text
traceback
log
expected behavior
actual behavior
user description.
```

Mục tiêu:

```text
xác định symptom chính xác.
```

Không phỏng đoán nhanh.

---

# 48. Bước 2 — Problem Statement

Phải mô tả lại vấn đề dưới dạng kỹ thuật:

```text
Observed:
Expected:
Difference:
Where:
When:
Affected Phase:
Potential impact:
```

---

# 49. Bước 3 — Root-Cause Investigation

Phải kiểm tra kỹ các file liên quan:

```text
owner module
caller
callee
shared utility
config
schema
notebook
test
upstream producer
downstream consumer.
```

Không fix chỉ dựa vào một dòng traceback.

---

# 50. Không kết luận root cause trước khi kiểm tra dependencies

Có thể có:

```text
symptom ở file A
root cause ở file B.
```

Phải trace data/control flow.

---

# 51. Kiểm tra architecture ownership khi debug

Mỗi lỗi phải hỏi:

```text
module nào thực sự sở hữu responsibility này?
contract thuộc layer nào?
fix ở đâu mới đúng architecture?
```

Không patch ở nơi symptom xuất hiện nếu ownership ở nơi khác.

---

# 52. Bước 4 — Issue Synthesis File

Nếu phát hiện vấn đề:

```text
phải tổng hợp lại thành một file `.md`.
```

File issue synthesis phải được tạo trước fix plan.

---

# 53. Nội dung Issue Synthesis bắt buộc

Tối thiểu:

```text
Issue ID
user evidence
observed behavior
expected behavior
affected Phase
affected files
related architecture rules
related working rules
reproduction path
root-cause analysis
confirmed cause
contributing factors
upstream impact
downstream impact
risk level
what must not be changed
recommended correction direction
open questions
evidence references.
```

---

# 54. Không trộn issue report và fix implementation

Thứ tự:

```text
Analyze
→ Issue Report
→ Fix Plan
→ User Approval
→ Fix.
```

Không:

```text
Analyze
→ Fix
→ viết report sau.
```

---

# 55. Bước 5 — Fix/Refactor Plan File

Sau khi tổng hợp đủ issue:

```text
phải tạo một plan `.md` riêng cho fix/refactor.
```

Plan phải nằm ở location phù hợp với project planning rule, mặc định:

```text
COURSE_WORK/docs/plan-doc/plan_before_process/
```

---

# 56. Nội dung Fix Plan bắt buộc

Tối thiểu:

```text
Issue references
root cause
goal
non-goals
architecture constraints
files to modify
files not to modify
exact sequential steps
test after each step
upstream regression checks
current Phase checks
downstream compatibility checks
expected outputs
rollback/stop condition
Definition of Done
user approval gate.
```

---

# 57. Fix Plan phải dựa trên confirmed issue report

Không được viết fix plan dựa trên:

```text
guess
one screenshot only
first plausible hypothesis.
```

Nếu root cause chưa đủ evidence:

```text
plan phải là investigation plan
không phải implementation plan.
```

---

# 58. User Approval trước fix

Sau fix plan:

```text
STOP.
```

Không sửa code cho đến khi user approve.

---

# 59. Refactor Rule

Refactor chỉ được thực hiện khi:

```text
current behavior understood
contracts identified
tests/state verified
Phase requirements mapped
architecture ownership verified
pre-process plan approved.
```

---

# 60. Refactor không được thay scientific behavior ngoài scope

Nếu mục tiêu là:

```text
cleanup
structure
readability
maintenance
```

thì output scientific behavior phải giữ nguyên, trừ khi plan được approve để thay behavior.

---

# 61. Fix không được biến thành broad rewrite

Nếu issue scope nhỏ:

```text
fix root cause tối thiểu nhưng đúng architecture.
```

Không tự ý:

```text
rewrite unrelated modules
rename toàn project
change pipeline
upgrade unrelated dependencies.
```

---

# 62. Scope Expansion Gate

Nếu trong lúc thực thi phát hiện cần thay đổi ngoài approved plan:

```text
STOP.
```

Phải:

```text
document new issue
update plan
ask user approval again.
```

Không tự mở rộng scope.

---

# 63. Unexpected Issue Gate

Nếu xuất hiện lỗi mới:

```text
không tiếp tục “fix tiện”.
```

Phải xác định:

```text
new issue
hay
consequence của current change.
```

Sau đó follow issue workflow.

---

# 64. Stop Conditions

Execution phải dừng khi:

```text
rule conflict
architecture conflict
unread required file
upstream Phase failure
precondition failure
unexpected schema mismatch
new unplanned dependency
unexpected regression
missing artifact
test failure not explained by approved plan
need for scope expansion
user approval not present.
```

---

# 65. Không “push through” test failure

Forbidden:

```text
test fail nhưng nghĩ không quan trọng
→ tiếp tục.
```

Phải resolve hoặc document/block.

---

# 66. Execution Logging

Trong quá trình thực thi từng bước:

```text
record:
step
files changed
command/action
result
validation
status.
```

Có thể lưu trong execution report `.md`.

Không cần thêm comment vào code.

---

# 67. One Change Set at a Time

Trong một step:

```text
chỉ thực hiện một logical change set.
```

Sau đó:

```text
test
verify
record.
```

Không gom nhiều unrelated changes vào một step.

---

# 68. File Change Ownership

Trước khi edit file:

```text
phải biết file này thuộc Phase/module nào
ai consume nó
ai produce data cho nó.
```

Không edit blind.

---

# 69. No Unrelated File Modification

Không được sửa file ngoài approved list trừ khi:

```text
scope expansion được user approve.
```

---

# 70. No Silent Rename/Move

Rename hoặc move file/module là architecture-impacting change.

Phải có trong approved plan.

---

# 71. Dependency Change Rule

Nếu cần thay:

```text
Python package
version
environment config
requirements
```

thì phải:

```text
verify Phase1 environment contract
document reason
analyze upstream/downstream compatibility
include regression checks.
```

Không upgrade dependency chỉ để “thử”.

---

# 72. Notebook Execution Rule

Khi sửa `.ipynb`:

```text
cell execution order
state dependence
outputs
random seeds
artifact writes
```

phải được kiểm tra.

Không được chỉ sửa text cell và mặc định notebook state valid.

---

# 73. Notebook Sequentiality

Notebook phải được verify theo intended execution order.

Không dựa vào hidden stale state.

---

# 74. Reproducibility Rule

Mọi Phase có reproducibility contract phải giữ:

```text
seed
data population
scaler state
config fingerprint
artifact lineage
metric semantics.
```

Refactor không được vô tình thay RNG flow hoặc sample population nếu không nằm trong approved scientific change.

---

# 75. Data Integrity Rule

Mọi code liên quan data phải bảo vệ:

```text
target leakage constraints
chronological order
split contract
window population
continuity contract
train-only fitting
Test firewall semantics.
```

Không thay chỉ để code “chạy được”.

---

# 76. Test Firewall Rule

Các Phase trước Test-opening gate phải tiếp tục tuân thủ Test firewall.

Refactor không được tạo accidental Test access.

Nếu project đã ở post-Test diagnostic Phase:

```text
không được dùng Test evidence để retune upstream model.
```

---

# 77. Scientific Protocol Preservation

Một refactor/fix không được tự ý thay:

```text
forecast horizon
feature set
target scaling
lookback
loss
metric
seed list
boundary protocol
error cohort
attention definition
head matching protocol.
```

Các thay đổi này là scientific/protocol changes và cần amendment/approval riêng.

---

# 78. Output Contract Preservation

Nếu Phase đã định nghĩa output artifacts:

```text
filename
schema
path
columns
metadata
checksum
status fields
```

thì refactor phải preserve contract hoặc có approved migration plan.

---

# 79. Downstream Consumer Check

Trước khi đổi artifact schema:

```text
tìm toàn bộ downstream consumer.
```

Không đổi producer rồi để consumer lỗi.

---

# 80. Architecture Conformance Check sau code

Sau implementation/fix:

```text
đọc lại relevant architecture rules
```

và verify:

```text
module placement
dependency direction
responsibility ownership
interface boundaries
artifact ownership.
```

---

# 81. Working Rule Conformance Check sau code

Tương tự:

```text
kiểm tra lại working_rule.md requirements
```

trước sign-off.

---

# 82. Phase Requirement Conformance Check

Sau khi thực thi:

```text
map từng Phase requirement
→ evidence thực tế.
```

Không chỉ nói:

```text
“Phase completed”.
```

Phải chứng minh.

---

# 83. Phase Compliance Matrix

Mỗi Phase implementation nên tạo:

```text
phase_compliance_matrix.md
```

hoặc `.csv`.

Fields:

```text
requirement_id
Phase requirement
implementation evidence
artifact
test
status
notes.
```

---

# 84. Không được PASS Phase khi requirement chưa hoàn thành

Nếu một requirement:

```text
missing
failed
not verified
```

thì:

```text
Phase != PASS.
```

Có thể:

```text
BLOCKED
FAIL
INCOMPLETE
```

theo project status model.

---

# 85. Validation Evidence Rule

Một claim:

```text
“đã fix”
“đã pass”
“không lỗi”
```

chỉ được nói khi có validation evidence.

Không dựa trên:

```text
code inspection alone
confidence
assumption.
```

---

# 86. Required post-execution verification

Sau execution:

```text
1. syntax/import verification
2. local unit/contract tests
3. Phase-specific tests
4. upstream regression
5. downstream compatibility
6. architecture conformance
7. working-rule conformance
8. Phase compliance
9. artifact/output integrity
10. final error scan.
```

Exact scope do approved plan xác định.

---

# 87. Error-free requirement trước khi tiếp tục

Chỉ được chuyển sang Phase tiếp theo khi:

```text
không còn blocking error
không còn unresolved regression
không còn broken upstream contract
required tests pass
required outputs valid.
```

---

# 88. Warning handling

Warning chỉ có thể cho phép tiếp tục nếu:

```text
Phase/rule cho phép PASS_WITH_WARNING
warning được hiểu rõ
warning không phá scientific contract
warning được document
user được thông báo khi cần.
```

Không dùng warning để che error.

---

# 89. Regression Report

Sau fix/refactor nên tạo report:

```text
what changed
what was tested
upstream phases checked
current Phase checked
downstream affected phases checked
results
warnings
remaining risks.
```

---

# 90. No False Completion

Không được báo:

```text
“xong”
```

nếu chỉ mới:

```text
code xong
```

mà chưa:

```text
validate
regression check
Phase compliance check.
```

---

# 91. Definition of Complete Execution

Một execution chỉ hoàn thành khi:

```text
approved plan executed sequentially
all planned changes done
current Phase requirements satisfied
all required tests pass
upstream remains healthy
downstream compatibility verified
architecture remains valid
working rules remain valid
artifacts correct
report generated
no blocking issue remains.
```

---

# 92. Documentation không thay thế validation

Viết report tốt không có nghĩa code đúng.

Phải có actual checks.

---

# 93. Validation không thay thế architecture compliance

Code chạy được nhưng architecture sai:

```text
execution FAIL.
```

---

# 94. Architecture compliance không thay thế Phase compliance

Code đẹp nhưng thiếu Phase requirement:

```text
Phase INCOMPLETE/FAIL.
```

---

# 95. Phase compliance không thay thế upstream safety

Phase N chạy nhưng Phase N-1 bị break:

```text
không được PASS toàn workflow.
```

---

# 96. Required workflow khi thực thi Phase mới

Canonical:

```text
GATE 1 — Prompt Validation
GATE 2 — Rule Reading
GATE 3 — Context Reload
GATE 4 — Upstream Health
GATE 5 — Phase Detail Reading
GATE 6 — Architecture Analysis
GATE 7 — Pre-Process Plan
GATE 8 — User Approval
GATE 9 — Sequential Implementation
GATE 10 — Local Verification
GATE 11 — Phase Verification
GATE 12 — Upstream Regression
GATE 13 — Downstream Compatibility
GATE 14 — Architecture/Rule Audit
GATE 15 — Artifact Audit
GATE 16 — Execution Report
GATE 17 — Phase Sign-Off.
```

Không skip gate.

---

# 97. Required workflow khi fix lỗi

Canonical:

```text
GATE F1 — Prompt Validation
GATE F2 — Read Rules
GATE F3 — Read User Evidence
GATE F4 — Read Related .md/.py/.ipynb
GATE F5 — Reproduce/Understand Symptom
GATE F6 — Trace Dependencies
GATE F7 — Root-Cause Analysis
GATE F8 — Issue Synthesis .md
GATE F9 — Fix Plan .md
GATE F10 — User Approval
GATE F11 — Sequential Fix
GATE F12 — Local Tests
GATE F13 — Current Phase Tests
GATE F14 — Upstream Regression
GATE F15 — Downstream Compatibility
GATE F16 — Rule/Architecture Audit
GATE F17 — Regression Report
GATE F18 — Final Sign-Off.
```

---

# 98. Required workflow khi refactor

Canonical:

```text
GATE R1 — Prompt Validation
GATE R2 — Full Related Context Reading
GATE R3 — Existing Behavior Baseline
GATE R4 — Architecture Ownership Analysis
GATE R5 — Regression Risk Analysis
GATE R6 — Refactor Plan .md
GATE R7 — User Approval
GATE R8 — One Logical Refactor Step
GATE R9 — Verify
GATE R10 — Next Step
...
GATE R11 — Full Affected Regression
GATE R12 — Architecture Audit
GATE R13 — Phase Compliance
GATE R14 — Refactor Report
GATE R15 — Sign-Off.
```

---

# 99. Không xử lý một request mới giữa execution nếu nó phá sequentiality

Nếu đang execution Step N và user đưa một request khác:

```text
phải xác định request mới có thay đổi scope không.
```

Nếu có:

```text
pause current execution
document state
handle scope/approval
```

không chạy cả hai song song.

---

# 100. Task State phải rõ

Mỗi thời điểm chỉ có một:

```text
ACTIVE_TASK.
```

Các task khác:

```text
QUEUED
BLOCKED
WAITING_APPROVAL
COMPLETED.
```

---

# 101. Không tự queue rồi chạy ngầm

Không background execution nếu user chưa yêu cầu và project rule không cho phép.

---

# 102. No Hidden Assumptions

Mọi assumption quan trọng phải:

```text
verify từ file
hoặc
ghi rõ trong plan để user approve.
```

Không giấu assumption trong implementation.

---

# 103. No Hidden Fallback

Nếu intended path fail:

```text
không tự chuyển sang một implementation khác
```

mà không report.

---

# 104. No Silent Data Repair

Không:

```text
drop row
fill NaN
sort
deduplicate
rescale
clip
```

để code chạy, trừ khi protocol cho phép.

---

# 105. No Silent Model Repair

Không:

```text
change dimensions
change activation
change heads
change loss
change output shape
```

để fix runtime error nếu scientific config đang locked.

Root cause phải được xử lý đúng layer.

---

# 106. No Silent Artifact Repair

Artifact mismatch:

```text
không sửa tay file output
```

để downstream pass.

Fix producer/process.

---

# 107. No Silent Test Weakening

Nếu test fail:

```text
không giảm assertion
không tăng tolerance
không skip test
```

chỉ để pass.

Muốn thay tolerance/test contract phải có evidence + approved plan.

---

# 108. No Silent Exception Catching

Không thêm broad exception handling:

```text
try/except Exception
→ ignore
```

để che lỗi.

Nếu error cần handle:

```text
handle đúng expected failure mode.
```

---

# 109. No Error Suppression

Không suppress:

```text
warning/error/output
```

nếu nó chứa thông tin cần cho regression analysis.

---

# 110. No Unapproved Formatting-Only Changes trong code fix

Nếu fix logic:

```text
không đồng thời reformat unrelated project files.
```

Giữ diff focused.

---

# 111. Change Diff Review

Sau mỗi step:

```text
review changed files
verify only intended lines/files changed
verify no comment/icon introduced.
```

---

# 112. No Comment/Icon Audit

Sau code change phải chạy/manual verify:

```text
không có comment mới
không có docstring giải thích mới
không có commented-out code mới
không có emoji/icon mới.
```

Nếu phát hiện:

```text
remove trước sign-off.
```

---

# 113. File Read Completeness Gate

Trước implementation, pre-process plan phải xác nhận:

```text
RELATED_FILE_READ_COMPLETE=true.
```

Nếu false:

```text
BLOCK.
```

---

# 114. Rule Read Completeness Gate

Phải xác nhận:

```text
WORKING_RULE_READ=true
ARCHITECTURE_RULE_READ=true
RULE_CODE_READ=true.
```

Nếu chưa:

```text
BLOCK.
```

---

# 115. Phase Detail Read Gate

Phải xác nhận:

```text
PHASE_DETAIL_READ_COMPLETE=true.
```

Nếu false:

```text
BLOCK.
```

---

# 116. Upstream Health Gate

Phải xác nhận:

```text
UPSTREAM_REQUIRED_PHASES_HEALTHY=true.
```

Nếu false:

```text
BLOCK.
```

---

# 117. User Approval Gate

Phải xác nhận:

```text
USER_APPROVED_PREPROCESS_PLAN=true.
```

Nếu false:

```text
BLOCK.
```

---

# 118. Sequential Gate

Phải xác nhận:

```text
NO_OTHER_ACTIVE_EXECUTION_TASK=true.
```

Nếu false:

```text
BLOCK.
```

---

# 119. Execution Gate Summary

Implementation chỉ được bắt đầu khi:

```text
WORKING_RULE_READ
AND
ARCHITECTURE_RULE_READ
AND
RULE_CODE_READ
AND
RELATED_FILE_READ_COMPLETE
AND
PHASE_DETAIL_READ_COMPLETE
AND
UPSTREAM_REQUIRED_PHASES_HEALTHY
AND
PREPROCESS_PLAN_CREATED
AND
USER_APPROVED_PREPROCESS_PLAN
AND
NO_OTHER_ACTIVE_EXECUTION_TASK
=
TRUE.
```

Nếu bất kỳ một điều kiện là false:

```text
DO NOT EXECUTE.
```

---

# 120. Fix Gate Summary

Fix chỉ được bắt đầu khi:

```text
USER_EVIDENCE_REVIEWED
AND
RELATED_FILES_REVIEWED
AND
ROOT_CAUSE_SUFFICIENTLY_ESTABLISHED
AND
ISSUE_SYNTHESIS_WRITTEN
AND
FIX_PLAN_WRITTEN
AND
USER_APPROVED_FIX_PLAN
AND
UPSTREAM_STATE_UNDERSTOOD
AND
NO_PARALLEL_ACTIVE_TASK
=
TRUE.
```

---

# 121. Post-Execution Gate Summary

Không được sign off cho đến khi:

```text
CURRENT_PHASE_VALID
AND
UPSTREAM_REGRESSION_PASS
AND
DOWNSTREAM_COMPATIBILITY_PASS
AND
ARCHITECTURE_CONFORMANCE_PASS
AND
WORKING_RULE_CONFORMANCE_PASS
AND
PHASE_REQUIREMENT_COMPLIANCE_PASS
AND
OUTPUT_ARTIFACTS_VALID
AND
NO_BLOCKING_ERROR
=
TRUE.
```

---

# 122. Violation policy

Nếu agent phát hiện chính nó sắp vi phạm rule:

```text
STOP trước khi action.
```

Nếu đã lỡ có action trái rule:

```text
1. dừng ngay
2. không tiếp tục change khác
3. báo chính xác violation
4. liệt kê file/action bị ảnh hưởng
5. không che giấu
6. đề xuất recovery workflow
7. chờ user approval.
```

---

# 123. Không tự “sửa violation” trong im lặng

Violation phải được visible trong execution report.

---

# 124. Prompt Correction Response

Nếu user prompt vi phạm workflow, response phải tập trung vào:

```text
rule vi phạm
trạng thái bị block
quy trình đúng
prompt mẫu để tiếp tục.
```

Không thực thi code.

---

# 125. Prompt mẫu cho Phase execution

Người dùng nên prompt theo dạng:

```text
Hãy chuẩn bị thực thi PHASE N.

Trước tiên:
1. đọc working_rule.md
2. đọc architecture_rule.md
3. đọc rule_code.md
4. đọc PHASE_N...md
5. đọc tuần tự toàn bộ .md/.py/.ipynb liên quan
6. kiểm tra trạng thái các Phase upstream
7. tạo pre-process plan tại
   COURSE_WORK/docs/plan-doc/plan_before_process/
8. chưa được code
9. dừng để tôi verify plan.
```

---

# 126. Prompt mẫu sau khi đã approve plan

```text
Tôi đã verify và approve pre-process plan của PHASE N.

Hãy thực thi đúng plan đã duyệt:
- tuần tự từng step
- không thêm comment/icon vào code
- verify sau từng step
- không mở rộng scope
- sau cùng regression check Phase hiện tại, upstream và downstream liên quan
- tạo execution report
- chỉ báo complete khi mọi acceptance criteria pass.
```

---

# 127. Prompt mẫu cho bug investigation

```text
Hãy điều tra lỗi này.

Chưa được fix.

Trước tiên:
1. đọc rules
2. đọc evidence tôi cung cấp
3. đọc tuần tự toàn bộ .md/.py/.ipynb liên quan
4. trace root cause
5. tạo issue synthesis .md
6. tạo fix plan .md trong plan_before_process
7. dừng để tôi verify.
```

---

# 128. Prompt mẫu cho refactor

```text
Hãy chuẩn bị refactor <scope>.

Chưa được thay code.

Trước tiên:
1. đọc rules và architecture
2. đọc related files tuần tự
3. baseline current behavior
4. phân tích regression risk
5. tạo refactor plan .md
6. dừng để tôi approve.
```

---

# 129. Definition of Rule Compliance

Một task được xem là tuân thủ `rule_code.md` khi:

```text
prompt hợp lệ
rules đã đọc
architecture đã đọc
related files đã đọc đủ
Phase detail đã đọc
upstream healthy
plan đã viết
user đã approve
execution tuần tự
không parallel
không comment/icon
không scope creep
fix dựa trên root cause
validation đầy đủ
regression pass
downstream compatibility pass
Phase requirements complete
artifacts valid
report complete.
```

---

# 130. Definition of Rule Violation

Bất kỳ điều nào sau đây là violation:

```text
code trước plan
code trước approval
không đọc working_rule.md
không đọc architecture_rule.md
không đọc related files
bắt đầu sửa khi context chưa load xong
bỏ qua Phase detail
parallel tasks
thêm comment
thêm icon
fix theo guess
không tạo issue report trước fix
không tạo fix plan
bỏ upstream regression
bỏ downstream check
continue khi upstream Phase đang lỗi
scope expansion không approval
silent architecture change
silent protocol change
silent data repair
silent artifact repair
new Test access trái protocol
report complete khi test chưa pass
thực thi prompt vi phạm rule.
```

---

# 131. Final Hard Rules Summary

```text
RULE 01
Luôn tuân thủ working_rule.md.

RULE 02
Luôn tuân thủ architecture_rule.md.

RULE 03
Không giả định nội dung rule files; phải đọc bản hiện tại.

RULE 04
Conflict giữa mandatory rules → STOP.

RULE 05
Prompt vi phạm rules → không thực thi; chỉ hướng dẫn prompt lại.

RULE 06
Trước Phase → đọc toàn bộ related .md/.py/.ipynb tuần tự.

RULE 07
Chưa đọc xong → không xử lý/code.

RULE 08
Trước Phase → verify upstream Phases healthy.

RULE 09
Upstream có error/regression → không tiếp tục Phase mới.

RULE 10
Trước execution → tạo pre-process plan .md tại
COURSE_WORK/docs/plan-doc/plan_before_process/.

RULE 11
Sau khi tạo plan → STOP và chờ user verify.

RULE 12
Không auto-execute sau plan.

RULE 13
Implementation phải đáp ứng 100% PHASE_XXX...md trong
COURSE_WORK/docs/plan-doc/plan_detail_for_each_phase/.

RULE 14
Được làm sâu/chặt hơn nhưng không được bỏ hoặc contradict Phase requirement.

RULE 15
Execution strictly sequential.

RULE 16
Không chạy nhiều task song song.

RULE 17
Không thêm bất kỳ comment nào vào source code.

RULE 18
Không thêm icon/emoji/decorative symbol vào source code.

RULE 19
Bug fix phải bắt đầu từ evidence analysis.

RULE 20
Phải trace root cause qua các related files.

RULE 21
Phải tạo issue synthesis .md trước fix plan.

RULE 22
Phải tạo fix/refactor plan .md trước code.

RULE 23
Fix/refactor plan phải được user approve.

RULE 24
Không scope creep trong lúc execution.

RULE 25
Sau change phải test Phase hiện tại.

RULE 26
Sau change phải regression-check upstream affected Phases.

RULE 27
Sau change phải compatibility-check downstream affected Phases.

RULE 28
Code chạy nhưng architecture sai → FAIL.

RULE 29
Code đúng architecture nhưng thiếu Phase requirement → INCOMPLETE/FAIL.

RULE 30
Không báo complete khi chưa có validation evidence.

RULE 31
Không silent repair data/model/artifact/test.

RULE 32
Không thay scientific protocol nếu chưa approved.

RULE 33
Không phá artifact/output contracts.

RULE 34
Không bỏ warning/error để tiếp tục cho nhanh.

RULE 35
Mọi scientific execution phải traceable và reproducible.

RULE 36
Sau Phase59/frozen scientific narrative, mọi scientific change cần revision/audit mới.
```

---

# 132. Mandatory Execution State Machine

```text
STATE_0
REQUEST_RECEIVED

→ validate prompt

STATE_1
RULES_READING

→ working_rule
→ architecture_rule
→ rule_code

STATE_2
CONTEXT_READING

→ related .md
→ related .py
→ related .ipynb

STATE_3
UPSTREAM_VERIFICATION

→ all required prior phases healthy

STATE_4
ANALYSIS

→ Phase requirements
or
root-cause analysis

STATE_5
DOCUMENTATION

→ pre-process plan
or
issue report + fix plan

STATE_6
WAITING_USER_APPROVAL

→ NO EXECUTION

STATE_7
APPROVED

STATE_8
SEQUENTIAL_EXECUTION

STATE_9
LOCAL_VALIDATION

STATE_10
PHASE_VALIDATION

STATE_11
UPSTREAM_REGRESSION

STATE_12
DOWNSTREAM_COMPATIBILITY

STATE_13
RULE_ARCHITECTURE_AUDIT

STATE_14
ARTIFACT_AUDIT

STATE_15
REPORTING

STATE_16
COMPLETE
```

Any failed gate transitions to:

```text
BLOCKED
or
INVESTIGATION_REQUIRED.
```

---

# 133. Final Enforcement Contract

\[
\boxed{
No\ Read
\Rightarrow
No\ Analysis
}
\]

\[
\boxed{
No\ Analysis
\Rightarrow
No\ Plan
}
\]

\[
\boxed{
No\ Plan
\Rightarrow
No\ Execution
}
\]

\[
\boxed{
No\ User\ Approval
\Rightarrow
No\ Execution
}
\]

\[
\boxed{
Upstream\ Broken
\Rightarrow
No\ Next\ Phase
}
\]

\[
\boxed{
No\ Validation
\Rightarrow
No\ Completion
}
\]

\[
\boxed{
Rule\ Violation
\Rightarrow
Stop\ And\ Report
}
\]

---

# 134. Final Project Rule Statement

Mọi người/agent làm việc với project phải hiểu rằng:

```text
tốc độ thực thi không được ưu tiên hơn tính đúng đắn
code chạy được không đủ để được xem là hoàn thành
mỗi thay đổi phải phù hợp architecture
mỗi Phase phải giữ toàn bộ upstream khỏe mạnh
mọi fix phải dựa trên root cause
mọi execution phải có plan và user approval
mọi task phải tuần tự
mọi conclusion phải có evidence.
```

Bất kỳ workflow nào cố tình bỏ qua các gate trên:

```text
không được xem là một execution hợp lệ của project.
```

---

# 135. Definition of Done cho `rule_code.md`

`rule_code.md` được xem là đầy đủ khi nó enforce được toàn bộ các nguyên tắc sau:

```text
working_rule.md mandatory
architecture_rule.md mandatory
no code comments
no code icons
previous Phase stability required
full Phase-detail compliance
pre-process plan before Phase
mandatory user verification
no automatic execution
strict sequential execution
new-chat full related-file reload
deep bug evidence analysis
deep related-file root-cause analysis
issue synthesis before fix
fix/refactor plan before code
post-fix current/upstream/downstream validation
prompt validation and refusal workflow
scope expansion gate
regression safety
architecture conformance
artifact contract preservation
scientific protocol preservation
no silent repair
traceable sign-off.
```

---

# 136. Final Rule

Nếu có bất kỳ nghi ngờ nào rằng một action có thể vi phạm rule:

```text
KHÔNG THỰC HIỆN ACTION.
```

Phải chuyển sang:

```text
READ
→ VERIFY
→ DOCUMENT
→ ASK USER.
```

Đây là default behavior bắt buộc của project.
