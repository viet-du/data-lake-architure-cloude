# ===========================================
# Terraform - Cloud Infrastructure as Code
# ===========================================

Tự động tạo toàn bộ Data Lake infrastructure trên cloud.

## 📋 Cấu trúc

```
terraform/
├── oracle/                       ← Oracle Cloud (FREE vĩnh viễn)
│   ├── main.tf                  # VM + VCN + Security
│   ├── outputs.tf               # Output IP, SSH command
│   ├── variables.tf             # Variables template
│   └── cloud-init.sh            # Script chạy trong VM
└── gcp/                          ← Google Cloud Platform
    └── main.tf                      # GCS + Dataproc + Pub/Sub
```

## 🚀 Setup Oracle Cloud với Terraform

### 1. Cài Terraform

```bash
# macOS
brew install terraform

# Linux
sudo apt install terraform
```

### 2. Lấy OCID từ Oracle Cloud

1. Login https://cloud.oracle.com
2. **Identity** → **Users** → copy **User OCID**
3. **Administration** → **Tenancy** → copy **Tenancy OCID**
4. Tạo API key:
   - **User Settings** → **API Keys** → **Add API Key**
   - Download **Private Key** (`.pem`)
   - Note **Fingerprint**

### 3. Tạo SSH Key

```bash
ssh-keygen -t rsa -b 4096 -f ~/.ssh/oracle_cloud_key
cat ~/.ssh/oracle_cloud_key.pub  # Copy nội dung
```

### 4. Configure Terraform

```bash
cd terraform/oracle
cp variables.tf terraform.tfvars
# Sửa terraform.tfvars với giá trị thật

# Init
terraform init

# Plan (xem trước)
terraform plan

# Apply (tạo)
terraform apply
# Gõ "yes" để xác nhận
```

⏰ Chờ ~3-5 phút để VM được tạo.

### 5. Lấy thông tin

```bash
terraform output
# vm_public_ip = "xxx.xxx.xxx.xxx"
# ssh_command = "ssh -i ~/.ssh/oracle_cloud_key ubuntu@xxx.xxx.xxx.xxx"
```

### 6. SSH vào VM

```bash
ssh -i ~/.ssh/oracle_cloud_key ubuntu@<PUBLIC_IP>
```

### 7. Đợi cloud-init chạy xong (~5-10 phút)

```bash
# Trên VM:
docker ps
# → Thấy 10+ containers đang chạy
```

### 8. Truy cập services

```
http://<PUBLIC_IP>:9001    MinIO
http://<PUBLIC_IP>:8080    Spark UI
http://<PUBLIC_IP>:8088    Airflow
http://<PUBLIC_IP>:8081    Kafka UI
http://<PUBLIC_IP>:3000    Metabase
```

### 9. Cleanup (xóa VM)

```bash
terraform destroy
# Gõ "yes"
```

## 🚀 Setup GCP với Terraform

```bash
cd terraform/gcp

# Tạo project ID
export TF_VAR_project_id="your-gcp-project-id"

# Init
terraform init

# Apply
terraform apply
```

Sau khi apply, Terraform tạo:
- ✅ 4 GCS buckets (bronze, silver, gold, scripts)
- ✅ 3 Pub/Sub topics
- ✅ 2 Pub/Sub subscriptions
- ✅ 1 BigQuery dataset
- ✅ 1 Service account

## 💰 Cost

| Cloud | Cost |
|-------|-------|
| **Oracle** | **$0/tháng vĩnh viễn** |
| **GCP** | $0.5-5/tháng (với $300 credit) |

## 🛠️ Troubleshooting

### Terraform không tìm thấy credentials

```bash
# Oracle: tạo file ~/.oci/config
[DEFAULT]
user=ocid1.user.oc1..aaaa...
fingerprint=xx:xx:...
tenancy=ocid1.tenancy.oc1..aaaa...
region=ap-singapore-1
key_file=~/.oci/api_key.pem

# GCP: gcloud auth
gcloud auth application-default login
```

### Out of capacity (Oracle)

Oracle free tier có thể hết capacity ở region Singapore. Giải pháp:
- Thử region khác (Mumbai, Sydney)
- Đợi vài giờ rồi tạo lại
- Dùng shape khác (VM.Standard.E2.1.Micro - 1GB RAM, cũng free)

### SSH không vào được

- Kiểm tra Security List đã mở port 22
- Verify SSH key đã upload đúng
- Thử với `ssh -v` để debug