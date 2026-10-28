from __future__ import annotations

import ast
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_retail_elt_dag_limits_concurrent_tasks() -> None:
    dag_path = ROOT / "airflow_dags" / "retail_elt_dag.py"
    tree = ast.parse(dag_path.read_text(encoding="utf-8"))

    dag_calls = [
        node
        for node in ast.walk(tree)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id == "DAG"
    ]
    assert len(dag_calls) == 1
    max_active_tasks = next(
        keyword.value
        for keyword in dag_calls[0].keywords
        if keyword.arg == "max_active_tasks"
    )
    assert isinstance(max_active_tasks, ast.Constant)
    assert max_active_tasks.value == 1


def test_airflow_auth_enables_basic_and_session_backends() -> None:
    compose = (ROOT / "docker-compose.yml").read_text(encoding="utf-8")
    expected = (
        'AIRFLOW__API__AUTH_BACKENDS: '
        '"airflow.api.auth.backend.basic_auth,airflow.api.auth.backend.session"'
    )
    assert compose.count(expected) == 2
