#!/usr/bin/env python3
"""Seed the Lakehouse BI content (questions + dashboard) in Metabase.

Creates questions backed by native SQL against the ``Lakehouse Gold (MinIO)``
PostgreSQL mirror (Metabase database id 3), then assembles them into the
``Tổng quan Lakehouse`` dashboard (id 2).

The script is idempotent in the sense that it archives any previously seeded
cards (cards whose name matches one of the definitions below) and recreates
them, so it can be re-run after the Gold tables are refreshed.

Usage::

    python3 scripts/seed_metabase_dashboard.py

Configuration (environment variables, with sensible local defaults):

``METABASE_URL``
    Base URL of the Metabase instance. Default ``http://localhost:3000``.
``METABASE_USER``
    Metabase account that owns the dashboard. Default ``duviet720@gmail.com``.
``METABASE_PASSWORD``
    Password for that account. **Required** — it is intentionally not
    defaulted, so no credential is ever committed to the repository. Read it
    from the ignored local ``.env`` file, e.g.::

        export METABASE_PASSWORD="$(grep '^METABASE_PASSWORD=' .env | cut -d= -f2-)"

``METABASE_DASHBOARD_ID``
    Dashboard to populate. Default ``2`` (``Tổng quan Lakehouse``).
``METABASE_GOLD_DB_ID``
    Metabase database id of the Gold PostgreSQL mirror. Default ``3``.

This script talks to the local Metabase instance only. It never reads or
writes R2, MinIO, or any pipeline state.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

BASE = os.environ.get("METABASE_URL", "http://localhost:3000").rstrip("/")
USERNAME = os.environ.get("METABASE_USER", "duviet720@gmail.com")
PASSWORD = os.environ.get("METABASE_PASSWORD", "")
DASHBOARD_ID = int(os.environ.get("METABASE_DASHBOARD_ID", "2"))
GOLD_DB_ID = int(os.environ.get("METABASE_GOLD_DB_ID", "3"))

SESSION: str | None = None

#: ``name -> (sql, display, visualization_settings, description)``
QUESTIONS: dict[str, tuple[str, str, dict, str]] = {
    "Chỉ số tổng quan (KPI)": (
        """
        select count(*) as total_orders,
               count(distinct customer_id) as total_customers,
               sum(revenue) as total_revenue,
               round(avg(total_amount)::numeric, 2) as avg_order_value,
               round((sum(profit) / nullif(sum(revenue), 0) * 100)::numeric, 2) as margin_pct
        from fact_orders
        """,
        "table",
        {},
        "Headline KPI của toàn bộ tầng Gold.",
    ),
    "Doanh thu & lợi nhuận theo tháng": (
        """
        select date_trunc('month', order_date) as month,
               sum(revenue) as total_revenue,
               sum(profit) as total_profit
        from fact_orders
        group by 1
        order by 1
        """,
        "line",
        {
            "graph.dimensions": [["name", "month"]],
            "graph.metrics": [["name", "total_revenue"], ["name", "total_profit"]],
        },
        "Xu hướng doanh thu và lợi nhuận gộp theo tháng từ tầng Gold (fact_orders).",
    ),
    "Doanh thu theo danh mục sản phẩm": (
        """
        select category,
               sum(revenue) as total_revenue,
               count(*) as order_count
        from fact_orders
        group by 1
        order by 2 desc
        """,
        "donut",
        {
            "graph.dimensions": [["name", "category"]],
            "graph.metrics": [["name", "total_revenue"]],
        },
        "Phân bổ doanh thu theo 3 danh mục: Electronics, Home, Fashion.",
    ),
    "Top danh mục con theo doanh thu": (
        """
        select subcategory,
               sum(revenue) as total_revenue
        from fact_orders
        group by 1
        order by 2 desc
        limit 10
        """,
        "bar",
        {
            "graph.dimensions": [["name", "subcategory"]],
            "graph.metrics": [["name", "total_revenue"]],
        },
        "10 danh mục con có doanh thu cao nhất.",
    ),
    "Hiệu quả theo phân khúc khách hàng": (
        """
        select segment,
               count(*) as order_count,
               sum(revenue) as total_revenue,
               round(avg(total_amount)::numeric, 2) as avg_order_value,
               round((sum(profit) / nullif(sum(revenue), 0) * 100)::numeric, 2) as margin_pct
        from fact_orders
        group by 1
        order by 3 desc
        """,
        "table",
        {
            "graph.dimensions": [["name", "segment"]],
            "graph.metrics": [
                ["name", "order_count"],
                ["name", "total_revenue"],
                ["name", "avg_order_value"],
                ["name", "margin_pct"],
            ],
        },
        "So sánh 4 phân khúc (VIP, Gold, Silver, Bronze) theo doanh thu, AOV và biên lợi nhuận.",
    ),
    "Doanh thu & AOV theo ngày": (
        """
        select order_date,
               sum(revenue) as total_revenue,
               round(avg(total_amount)::numeric, 2) as avg_order_value
        from fact_orders
        group by 1
        order by 1
        """,
        "line",
        {
            "graph.dimensions": [["name", "order_date"]],
            "graph.metrics": [["name", "total_revenue"], ["name", "avg_order_value"]],
        },
        "175 ngày dữ liệu, từ 2025-11-03 đến 2026-10-31.",
    ),
    "Doanh thu theo thành phố": (
        """
        select city,
               sum(revenue) as total_revenue,
               count(*) as order_count
        from fact_orders
        group by 1
        order by 2 desc
        """,
        "bar",
        {
            "graph.dimensions": [["name", "city"]],
            "graph.metrics": [["name", "total_revenue"]],
        },
        "Doanh thu theo 8 thành phố.",
    ),
    "Phân bổ khách hàng theo tuổi": (
        """
        select case
                 when age between 18 and 24 then '18-24'
                 when age between 25 and 34 then '25-34'
                 when age between 35 and 44 then '35-44'
                 when age between 45 and 54 then '45-54'
                 when age between 55 and 64 then '55-64'
                 else '65+'
               end as age_band,
               count(*) as customer_count,
               round(sum(total_revenue)::numeric, 0) as lifetime_revenue
        from dim_customers
        group by 1
        order by 1
        """,
        "bar",
        {
            "graph.dimensions": [["name", "age_band"]],
            "graph.metrics": [["name", "customer_count"]],
        },
        "200 khách hàng phân bổ theo nhóm tuổi, kèm doanh thu vòng đời.",
    ),
    "Tỷ trọng doanh thu theo phương thức thanh toán": (
        """
        select payment_method,
               sum(revenue) as total_revenue,
               count(*) as order_count
        from fact_orders
        group by 1
        order by 2 desc
        """,
        "donut",
        {
            "graph.dimensions": [["name", "payment_method"]],
            "graph.metrics": [["name", "total_revenue"]],
        },
        "Credit Card, COD, E-Wallet, Bank Transfer.",
    ),
    "Top sản phẩm bán chạy": (
        """
        select product_name,
               category,
               sum(quantity) as quantity_sold,
               sum(revenue) as total_revenue
        from fact_orders
        group by 1, 2
        order by 4 desc
        limit 10
        """,
        "table",
        {
            "graph.dimensions": [["name", "product_name"], ["name", "category"]],
            "graph.metrics": [["name", "quantity_sold"], ["name", "total_revenue"]],
        },
        "10 sản phẩm doanh thu cao nhất.",
    ),
    "Hiệu quả theo thương hiệu": (
        """
        select brand,
               count(*) as product_count,
               round(sum(total_revenue)::numeric, 0) as total_revenue,
               round(avg(avg_selling_price)::numeric, 0) as avg_price
        from dim_products
        group by 1
        order by 3 desc
        """,
        "table",
        {
            "graph.dimensions": [["name", "brand"]],
            "graph.metrics": [
                ["name", "product_count"],
                ["name", "total_revenue"],
                ["name", "avg_price"],
            ],
        },
        "5 thương hiệu: Sony, Xiaomi, Apple, Generic, Samsung.",
    ),
    "Doanh thu tích luỹ": (
        """
        select order_date,
               sum(sum(revenue)) over (order by order_date) as cumulative_revenue
        from fact_orders
        group by order_date
        order by order_date
        """,
        "area",
        {
            "graph.dimensions": [["name", "order_date"]],
            "graph.metrics": [["name", "cumulative_revenue"]],
        },
        "Doanh thu cộng dồn từ đầu kỳ đến hiện tại.",
    ),
}

#: ``(card name, row, col, size_x, size_y)`` — dashboard grid is 24 columns wide.
LAYOUT: list[tuple[str, int, int, int, int]] = [
    ("Chỉ số tổng quan (KPI)", 0, 0, 24, 4),
    ("Doanh thu & lợi nhuận theo tháng", 4, 0, 12, 8),
    ("Doanh thu theo danh mục sản phẩm", 4, 12, 12, 8),
    ("Top danh mục con theo doanh thu", 12, 0, 12, 8),
    ("Hiệu quả theo phân khúc khách hàng", 12, 12, 12, 8),
    ("Doanh thu & AOV theo ngày", 20, 0, 12, 8),
    ("Doanh thu theo thành phố", 20, 12, 12, 8),
    ("Phân bổ khách hàng theo tuổi", 28, 0, 12, 8),
    ("Tỷ trọng doanh thu theo phương thức thanh toán", 28, 12, 12, 8),
    ("Top sản phẩm bán chạy", 36, 0, 12, 8),
    ("Hiệu quả theo thương hiệu", 36, 12, 12, 8),
    ("Doanh thu tích luỹ", 44, 0, 24, 8),
]


def api(path: str, method: str = "GET", body: dict | None = None):
    """Call a Metabase API endpoint and return ``(status, parsed_body)``."""
    req = urllib.request.Request(BASE + path, method=method)
    if SESSION:
        req.add_header("X-Metabase-Session", SESSION)
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        req.add_header("Content-Type", "application/json")
    req.data = data
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode()
            return resp.status, (json.loads(raw) if raw.strip() else None)
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode()[:800]


def login() -> None:
    global SESSION
    if not PASSWORD:
        raise SystemExit(
            "METABASE_PASSWORD is not set.\n"
            "Export it from the ignored local .env file, e.g.:\n"
            "  export METABASE_PASSWORD=\"$(grep '^METABASE_PASSWORD=' .env | cut -d= -f2-)\""
        )
    status, body = api(
        "/api/session",
        "POST",
        {"username": USERNAME, "password": PASSWORD},
    )
    if status != 200:
        raise SystemExit("login failed (%s): %s" % (status, body))
    SESSION = body["id"]
    print("logged in as %s" % USERNAME)


def archive_previous() -> None:
    """Archive cards from a previous run so re-seeding does not duplicate them."""
    status, cards = api("/api/card")
    if status != 200:
        return
    for card in cards or []:
        if card["name"] in QUESTIONS:
            api("/api/card/%d" % card["id"], "PUT", {"archived": True})
            print("   archived previous card %d (%s)" % (card["id"], card["name"]))


def create_question(name: str, sql: str, display: str, viz: dict, description: str) -> int:
    status, body = api(
        "/api/card",
        "POST",
        {
            "name": name,
            "description": description,
            "dataset_query": {
                "type": "native",
                "database": GOLD_DB_ID,
                "native": {"query": sql, "template-tags": {}},
            },
            "display": display,
            "visualization_settings": viz,
            "collection_id": None,
            "enable_embedding": False,
        },
    )
    if status != 200:
        print("   FAILED %r -> %s %s" % (name, status, body))
        raise SystemExit(1)
    print("   created card %d | %s" % (body["id"], name))
    return body["id"]


def set_dashboard_cards(cards: list[dict]) -> None:
    """Replace the dashboard card list.

    ``PUT /api/dashboard/{id}/cards`` replaces the whole list, so the full
    desired set has to be sent in one call — adding cards one by one drops the
    previously added ones.

    Metabase rejects a single call that mixes dashcards that already exist
    (they carry their own dashcard ``id``) with brand-new cards (where ``id``
    must equal ``card_id``). The dashboard is therefore cleared first and then
    populated with one call that only contains new cards.
    """
    status, body = api("/api/dashboard/%d/cards" % DASHBOARD_ID, "PUT", {"cards": []})
    if status != 200:
        print("   FAILED clearing dashboard -> %s %s" % (status, body))
        raise SystemExit(1)

    status, body = api(
        "/api/dashboard/%d/cards" % DASHBOARD_ID, "PUT", {"cards": cards}
    )
    if status != 200:
        print("   FAILED dashboard cards -> %s %s" % (status, body))
        raise SystemExit(1)


def main() -> None:
    login()
    archive_previous()

    print("\ncreating questions:")
    created: dict[str, int] = {}
    for name, (sql, display, viz, description) in QUESTIONS.items():
        created[name] = create_question(name, sql, display, viz, description)

    print("\narranging dashboard %d:" % DASHBOARD_ID)
    status, dash = api("/api/dashboard/%d" % DASHBOARD_ID)
    existing = {d["card_id"]: d for d in (dash or {}).get("dashcards", [])}

    # New cards: Metabase expects `id == card_id` for cards that are not yet
    # on the dashboard. Existing dashcards are re-added below.
    cards = []
    for name, row, col, size_x, size_y in LAYOUT:
        card_id = created[name]
        cards.append(
            {
                "id": card_id,
                "card_id": card_id,
                "row": row,
                "col": col,
                "size_x": size_x,
                "size_y": size_y,
                "visualization_settings": {},
                "parameter_mappings": [],
                "series": [],
            }
        )

    # Keep any pre-existing dashboard cards that this script does not own,
    # parked below the seeded block so nothing is silently deleted.
    managed = {created[name] for name, *_ in LAYOUT}
    row = max((c["row"] + c["size_y"]) for c in cards) + 2
    for card_id, prev in existing.items():
        if card_id in managed:
            continue
        cards.append(
            {
                "id": card_id,
                "card_id": card_id,
                "row": row,
                "col": 0,
                "size_x": prev.get("size_x") or 12,
                "size_y": prev.get("size_y") or 8,
                "visualization_settings": prev.get("visualization_settings") or {},
                "parameter_mappings": prev.get("parameter_mappings") or [],
                "series": prev.get("series") or [],
            }
        )
        row += prev.get("size_y") or 8

    set_dashboard_cards(cards)

    status, dash = api("/api/dashboard/%d" % DASHBOARD_ID)
    print("\nfinal layout (%d cards):" % len((dash or {}).get("dashcards", [])))
    for dc in sorted(
        (dash or {}).get("dashcards", []),
        key=lambda d: (d.get("row") or 0, d.get("col") or 0),
    ):
        print(
            "  row=%-3s col=%-3s %sx%s | %s"
            % (
                dc.get("row"),
                dc.get("col"),
                dc.get("size_x"),
                dc.get("size_y"),
                (dc.get("card") or {}).get("name"),
            )
        )

    print("\nDashboard URL: %s/dashboard/%d" % (BASE, DASHBOARD_ID))


if __name__ == "__main__":
    main()
