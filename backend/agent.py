"""Foundry Agent initialization and per-request query processing."""
import os
import json
import logging
from azure.ai.agents import AgentsClient
from azure.ai.agents.models import FunctionTool, ToolSet
from azure.identity import DefaultAzureCredential
from sql_tools import execute_sql, get_schema

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an AI assistant for ContosoTech's hospital risk analytics platform.
You help hospital risk managers analyze HCC (Hierarchical Condition Category) risk adjustment data
by translating their natural language questions into SQL queries and presenting clear insights.

## Your capabilities
- Generate T-SQL SELECT queries against the HCC risk adjustment database
- Execute queries using the execute_sql tool
- Retrieve the database schema using the get_schema tool
- Summarize results in plain English using healthcare/risk adjustment terminology
- Recommend appropriate chart types to visualize the data

## Key domain concepts
- HCC: Hierarchical Condition Category — CMS risk adjustment classification for chronic conditions
- RAF Score: Risk Adjustment Factor — predicts a member's healthcare cost relative to average
- Recapture Rate: % of prior-year HCCs successfully re-documented this year
- Missed Opportunity: HCC suggested by clinical data but not yet documented
- Compliance Opportunity: coding or documentation gap identified by compliance algorithms
- Prevalence Rate: expected rate of a condition in a population per CMS benchmarks

## Core tables (use get_schema for exact columns and types)
- MEMBERS — patients enrolled in risk adjustment programs
- PROVIDERS — clinicians and facilities
- HCC_CODES — CMS condition categories with risk weights
- MEMBER_HCC_HISTORY — year-over-year HCC capture and recapture per member
- RAF_SCORES — monthly RAF scores per member (demographic + HCC components)
- ALGORITHM_OPPORTUNITIES — missed revenue and compliance opportunities
- PREVALENCE_RATES — CMS benchmark vs actual prevalence by region

## Rules
1. ALWAYS call get_schema first if you are unsure about column names or table structure
2. Generate ONLY SELECT statements — never INSERT, UPDATE, DELETE, or DDL
3. Use TOP or LIMIT clauses for potentially large result sets
4. Alias columns with meaningful names (e.g., AS "Recapture Rate")

## Response format
Always respond in this exact JSON structure:
{
  "text": "<clear natural language summary of findings, 2-5 sentences>",
  "chart": {
    "type": "<bar|line|pie|scatter|none>",
    "title": "<descriptive chart title>",
    "xKey": "<column name for x-axis or labels>",
    "yKey": "<column name for y-axis or values>",
    "data": [<array of row objects from the query result>]
  },
  "sql": "<the SQL query you generated>"
}

If no chart is appropriate, set "type": "none" and "data": [].
If a query returns a single number, use "type": "none" and put the value in "text".
For trend data over time, use "line". For comparisons, use "bar". For distributions, use "pie".
"""

_agents_client: AgentsClient | None = None
_agent_id: str | None = None


def get_agents_client() -> AgentsClient:
    global _agents_client
    if _agents_client is None:
        _agents_client = AgentsClient(
            endpoint=os.environ["FOUNDRY_PROJECT_ENDPOINT"],
            credential=DefaultAzureCredential(),
        )
    return _agents_client


def initialize_agent() -> str:
    """Create the HCC analytics agent on startup. Returns the agent ID."""
    global _agent_id
    client = get_agents_client()

    # Reuse existing agent if already created in this process
    if _agent_id:
        return _agent_id

    # Try to find an existing agent with our name to avoid duplicates on restarts
    try:
        for ag in client.list_agents():
            if ag.name == "HCC Risk Analytics Assistant":
                _agent_id = ag.id
                logger.info(f"Reusing existing agent: {_agent_id}")
                return _agent_id
    except Exception:
        pass

    # Define function tools the agent can invoke
    functions = FunctionTool(functions=[execute_sql, get_schema])
    toolset = ToolSet()
    toolset.add(functions)
    client.enable_auto_function_calls(toolset)

    agent = client.create_agent(
        model=os.environ.get("FOUNDRY_MODEL_NAME", "gpt-4o"),
        name="HCC Risk Analytics Assistant",
        instructions=SYSTEM_PROMPT,
        toolset=toolset,
        temperature=0.1,
    )
    _agent_id = agent.id
    logger.info(f"Created agent: {_agent_id}")
    return _agent_id


def create_thread() -> str:
    """Create a new conversation thread. Returns the thread ID."""
    client = get_agents_client()
    thread = client.threads.create()
    return thread.id


def run_query(thread_id: str, question: str) -> dict:
    """
    Send a question to the agent and return the structured response.

    Args:
        thread_id: Foundry Agent thread ID for this conversation session.
        question: Natural language question from the user.

    Returns:
        dict with keys: text, chart, sql (parsed from agent JSON response)
    """
    client = get_agents_client()
    agent_id = initialize_agent()

    # Add user message to thread
    client.messages.create(
        thread_id=thread_id,
        role="user",
        content=question,
    )

    # Run the agent (this handles function tool callbacks automatically)
    run = client.runs.create_and_process(
        thread_id=thread_id,
        agent_id=agent_id,
    )

    if run.status != "completed":
        logger.error(f"Agent run ended with status: {run.status}, error: {run.last_error}")
        return {
            "text": f"The agent encountered an issue: {run.last_error}",
            "chart": {"type": "none", "title": "", "xKey": "", "yKey": "", "data": []},
            "sql": "",
        }

    # Retrieve the latest assistant message
    messages = client.messages.list(thread_id=thread_id)
    for msg in messages:
        if msg.role == "assistant":
            raw = ""
            for block in msg.content:
                if hasattr(block, "text"):
                    raw = block.text.value
                    break

            # Strip markdown code fences if present
            raw = raw.strip()
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            raw = raw.strip()

            try:
                parsed = json.loads(raw)
                return {
                    "text": parsed.get("text", ""),
                    "chart": parsed.get("chart", {"type": "none", "title": "", "xKey": "", "yKey": "", "data": []}),
                    "sql": parsed.get("sql", ""),
                }
            except json.JSONDecodeError:
                # Agent returned plain text — treat as text-only response
                return {
                    "text": raw,
                    "chart": {"type": "none", "title": "", "xKey": "", "yKey": "", "data": []},
                    "sql": "",
                }

    return {
        "text": "No response received from the agent.",
        "chart": {"type": "none", "title": "", "xKey": "", "yKey": "", "data": []},
        "sql": "",
    }
