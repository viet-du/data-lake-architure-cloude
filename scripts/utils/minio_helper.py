"""
Helper functions cho MinIO (S3-compatible storage).
"""
import os
from minio import Minio
from minio.error import S3Error


def get_minio_client(endpoint: str = "localhost:9000", access_key: str = None, secret_key: str = None):
    """Trả về MinIO client."""
    return Minio(
        endpoint,
        access_key=access_key or os.getenv("MINIO_ACCESS_KEY", "minioadmin"),
        secret_key=secret_key or os.getenv("MINIO_SECRET_KEY", "minioadmin"),
        secure=False,
    )


def ensure_bucket(client, bucket_name: str):
    """Tạo bucket nếu chưa tồn tại."""
    try:
        if not client.bucket_exists(bucket_name):
            client.make_bucket(bucket_name)
            print(f"✅ Created bucket: {bucket_name}")
    except S3Error as e:
        print(f"❌ Error: {e}")


def list_objects(client, bucket: str, prefix: str = "") -> list:
    """List objects trong bucket với prefix."""
    objects = client.list_objects(bucket, prefix=prefix, recursive=True)
    return [obj.object_name for obj in objects]


def upload_file(client, bucket: str, local_path: str, object_name: str = None):
    """Upload file lên MinIO."""
    object_name = object_name or local_path
    client.fput_object(bucket, object_name, local_path)
    print(f"✅ Uploaded {local_path} → s3://{bucket}/{object_name}")
