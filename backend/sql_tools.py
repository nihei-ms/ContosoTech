"""SQL function tools exposed to the Foundry agent."""
import os
import struct
import json
import logging
import pyodbc
from azure.identity import DefaultAzureCredential, get_bearer_token_provider

logger = logging.getLogger(__name__)

_credential = DefaultAzureCredential()
_token_provider = get_bearer_token_provider(_credential, "https://database.windows.net/.default")

SQL_SERVER = os.environ["SQL_SERVER"]
SQL_DATABASE = os.environ["SQL_DATABASE"]

# Cached schema so we don't re-query on every agent call
_schema_cache: str | None = None


def _get_connection() -> pyodbc.Connection:
    """Return a pyodbc connection authenticated via system-assigned managed identity."""
    token = _credential.get_token("https://database.windows.net/.default").token
    token_bytes = token.encode("UTF-16-LE")
    token_struct = struct.pack(f"<I{len(token_bytes)}s", len(token_bytes), token_bytes)

    conn_str = (
        "Driver={ODBC Driver 18 for SQL Server};"
        f"Server={SQL_SERVER};"
        f"Database={SQL_DATABASE};"
        "Encrypt=yes;TrustServerCertificate=no;"
    )
    return pyodbc.connect(conn_str, attrs_before={1256: token_struct})


def execute_sql(query: str) -> str:
    """
    Execute a read-only SQL SELECT query against the HCC risk adjustment database.
    Only SELECT statements are permitted.

    Args:
        query: The T-SQL SELECT query to execute.

    Returns:
        JSON string with 'columns' list and 'rows' list-of-lists, or 'error' key on failure.
        Row count is capped at 500 to avoid huge payloads.
    """
    # Safety: reject any non-SELECT query
    stripped = query.strip().lstrip("--").strip()
    if not stripped.upper().startswith("SELECT"):
        return json.dumps({"error": "Only SELECT queries are permitted."})

    try:
        conn = _get_connection()
        cursor = conn.cursor()
        cursor.execute(query)
        columns = [col[0] for col in cursor.description]
        rows = []
        for i, row in enumerate(cursor):
            if i >= 500:
                break
            rows.append([
                v.isoformat() if hasattr(v, "isoformat") else v
                for v in row
            ])
        conn.close()
        return json.dumps({"columns": columns, "rows": rows})
    except Exception as exc:
        logger.exception("SQL execution error")
        return json.dumps({"error": str(exc)})


def get_schema() -> str:
    """
    Return the database schema — all user tables with column names, data types,
    and nullable flags. Results are cached after the first call.
    """
    global _schema_cache
    if _schema_cache:
        return _schema_cache

    schema_query = """
        SELECT
            t.TABLE_NAME,
            c.COLUMN_NAME,
            c.DATA_TYPE,
            c.IS_NULLABLE,
            c.CHARACTER_MAXIMUM_LENGTH,
            c.NUMERIC_PRECISION,
            c.NUMERIC_SCALE
        FROM INFORMATION_SCHEMA.TABLES t
        JOIN INFORMATION_SCHEMA.COLUMNS c
            ON t.TABLE_NAME = c.TABLE_NAME AND t.TABLE_SCHEMA = c.TABLE_SCHEMA
        WHERE t.TABLE_TYPE = 'BASE TABLE'
            AND t.TABLE_SCHEMA = 'dbo'
        ORDER BY t.TABLE_NAME, c.ORDINAL_POSITION
    """
    try:
        conn = _get_connection()
        cursor = conn.cursor()
        cursor.execute(schema_query)
        tables: dict[str, list] = {}
        for row in cursor:
            table = row[0]
            col_info = {
                "column": row[1],
                "type": row[2],
                "nullable": row[3] == "YES",
            }
            if row[4]:
                col_info["max_length"] = row[4]
            if row[5]:
                col_info["precision"] = row[5]
                col_info["scale"] = row[6]
            tables.setdefault(table, []).append(col_info)
        conn.close()
        _schema_cache = json.dumps({"tables": tables})
        return _schema_cache
    except Exception as exc:
        logger.exception("Schema retrieval error")
        return json.dumps({"error": str(exc)})
