import sys
import subprocess
from pathlib import Path
SCRIPTS_DIR = Path(__file__).parent

def run_script(script_name: str):
    print(f"\n{'=' * 60}")
    print(f'▶  Running: {script_name}')
    print('=' * 60)
    script_path = SCRIPTS_DIR / script_name
    result = subprocess.run([sys.executable, str(script_path)], capture_output=False, text=True)
    return result.returncode

def main():
    print('=' * 60)
    print('  FULL ELT PIPELINE (Bronze → Silver → Gold)')
    print('=' * 60)
    if run_script('01_ingest_to_bronze.py') != 0:
        print(' Step 1 failed!')
        return 1
    if run_script('02_transform_to_silver.py') != 0:
        print(' Step 2 failed!')
        return 1
    if run_script('03_aggregate_to_gold.py') != 0:
        print(' Step 3 failed!')
        return 1
    print(f"\n{'=' * 60}")
    print(' FULL PIPELINE COMPLETED!')
    print('=' * 60)
    return 0
if __name__ == '__main__':
    sys.exit(main())