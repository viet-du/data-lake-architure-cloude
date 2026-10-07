
Tự động tạo toàn bộ Data Lake infrastructure trên cloud.


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



```bash
brew install terraform

sudo apt install terraform
```


1. Login https://cloud.oracle.com
2. **Identity** → **Users** → copy **User OCID**
3. **Administration** → **Tenancy** → copy **Tenancy OCID**
4. Tạo API key:
   - **User Settings** → **API Keys** → **Add API Key**
   - Download **Private Key** (`.pem`)
   - Note **Fingerprint**


```bash
ssh-keygen -t rsa -b 4096 -f ~/.ssh/oracle_cloud_key
cat ~/.ssh/oracle_cloud_key.pub  # Copy nội dung
```


```bash
cd terraform/oracle
cp variables.tf terraform.tfvars

terraform init

terraform plan

terraform apply
```

⏰ Chờ ~3-5 phút để VM được tạo.


```bash
terraform output
```


```bash
ssh -i ~/.ssh/oracle_cloud_key ubuntu@<PUBLIC_IP>
```


```bash
docker ps
```


```
http://<PUBLIC_IP>:9001    MinIO
http://<PUBLIC_IP>:8080    Spark UI
http://<PUBLIC_IP>:8088    Airflow
http://<PUBLIC_IP>:8081    Kafka UI
http://<PUBLIC_IP>:3000    Metabase
```


```bash
terraform destroy
```


```bash
cd terraform/gcp

export TF_VAR_project_id="your-gcp-project-id"

terraform init

terraform apply
```

Sau khi apply, Terraform tạo:
-  4 GCS buckets (bronze, silver, gold, scripts)
-  3 Pub/Sub topics
-  2 Pub/Sub subscriptions
-  1 BigQuery dataset
-  1 Service account


| Cloud | Cost |
|-------|-------|
| **Oracle** | **$0/tháng vĩnh viễn** |
| **GCP** | $0.5-5/tháng (với $300 credit) |



```bash
[DEFAULT]
user=ocid1.user.oc1..aaaa...
fingerprint=xx:xx:...
tenancy=ocid1.tenancy.oc1..aaaa...
region=ap-singapore-1
key_file=~/.oci/api_key.pem

gcloud auth application-default login
```


Oracle free tier có thể hết capacity ở region Singapore. Giải pháp:
- Thử region khác (Mumbai, Sydney)
- Đợi vài giờ rồi tạo lại
- Dùng shape khác (VM.Standard.E2.1.Micro - 1GB RAM, cũng free)


- Kiểm tra Security List đã mở port 22
- Verify SSH key đã upload đúng
- Thử với `ssh -v` để debug