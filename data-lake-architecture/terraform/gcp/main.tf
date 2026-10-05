# Terraform - GCP Free Tier
# Tự động tạo GCS + Dataproc + Pub/Sub

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

# ============ Provider ============
provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

# ============ Variables ============
variable "project_id" {}
variable "region" { default = "asia-southeast1" }
variable "zone" { default = "asia-southeast1-a" }
variable "bucket_prefix" { default = "data-lake-architecture" }

# ============ GCS Buckets ============
resource "google_storage_bucket" "bronze" {
  name     = "${var.bucket_prefix}-bronze"
  location = var.region

  lifecycle_rule {
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
    condition {
      age = 30
    }
  }
}

resource "google_storage_bucket" "silver" {
  name     = "${var.bucket_prefix}-silver"
  location = var.region

  lifecycle_rule {
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
    condition {
      age = 30
    }
  }
}

resource "google_storage_bucket" "gold" {
  name     = "${var.bucket_prefix}-gold"
  location = var.region

  lifecycle_rule {
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
    condition {
      age = 30
    }
  }
}

resource "google_storage_bucket" "scripts" {
  name     = "${var.bucket_prefix}-scripts"
  location = var.region
}

# ============ Pub/Sub Topics ============
resource "google_pubsub_topic" "tiki_category" {
  name = "tiki-category-stream"
}

resource "google_pubsub_topic" "clickstream" {
  name = "clickstream-events"
}

resource "google_pubsub_topic" "ecommerce" {
  name = "ecommerce-products-stream"
}

# ============ Pub/Sub Subscriptions ============
resource "google_pubsub_subscription" "tiki_sub" {
  name  = "tiki-stream-sub"
  topic = google_pubsub_topic.tiki_category.name

  ack_deadline_seconds = 20
}

resource "google_pubsub_subscription" "clickstream_sub" {
  name  = "clickstream-sub"
  topic = google_pubsub_topic.clickstream.name

  ack_deadline_seconds = 20
}

# ============ BigQuery Dataset ============
resource "google_bigquery_dataset" "datalake" {
  dataset_id                 = "datalake"
  location                  = var.region
  delete_contents_on_destroy = false
}

# ============ Service Account ============
resource "google_service_account" "datalake_sa" {
  account_id   = "datalake-sa"
  display_name = "Data Lake Service Account"
}

resource "google_project_iam_member" "datalake_storage" {
  project = var.project_id
  role    = "roles/storage.admin"
  member  = "serviceAccount:${google_service_account.datalake_sa.email}"
}

resource "google_project_iam_member" "datalake_dataproc" {
  project = var.project_id
  role    = "roles/dataproc.editor"
  member  = "serviceAccount:${google_service_account.datalake_sa.email}"
}

resource "google_project_iam_member" "datalake_bigquery" {
  project = var.project_id
  role    = "roles/bigquery.user"
  member  = "serviceAccount:${google_service_account.datalake_sa.email}"
}

# ============ Outputs ============
output "bucket_bronze" { value = google_storage_bucket.bronze.name }
output "bucket_silver" { value = google_storage_bucket.silver.name }
output "bucket_gold"   { value = google_storage_bucket.gold.name }
output "service_account_email" { email }