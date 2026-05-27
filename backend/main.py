"""FastAPI backend for ContosoTech HCC Risk Analytics."""
import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import agent as agent_module

# App Insights tracing — must be configured before other imports touch telemetry
def _setup_telemetry() -> None:
    conn_str = os.environ.get("APPLICATIONINSIGHTS_CONNECTION_STRING")
    if not conn_str:
        return
    try:
        from azure.monitor.opentelemetry import configure_azure_monitor
        from azure.ai.projects.telemetry import AIProjectInstrumentor
        configure_azure_monitor(connection_string=conn_str)
        AIProjectInstrumentor().instrument()
        logging.getLogger(__name__).info("Azure Monitor telemetry configured")
    except Exception as exc:
        logging.getLogger(__name__).warning(f"Telemetry setup failed: {exc}")


logging.basicConfig(level=logging.INFO)
_setup_telemetry()

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm-up: initialize Foundry agent at startup
    logger.info("Initializing Foundry agent...")
    try:
        agent_id = agent_module.initialize_agent()
        logger.info(f"Agent ready: {agent_id}")
    except Exception as exc:
        logger.error(f"Agent initialization failed: {exc}")
    yield


app = FastAPI(title="ContosoTech HCC Analytics API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    question: str
    thread_id: str | None = None


class ChartSpec(BaseModel):
    type: str
    title: str
    xKey: str
    yKey: str
    data: list


class ChatResponse(BaseModel):
    text: str
    chart: ChartSpec
    sql: str
    thread_id: str


@app.get("/api/health")
def health():
    return {"status": "ok", "agent_ready": agent_module._agent_id is not None}


@app.post("/api/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="question must not be empty")

    # Use existing thread or start a new conversation
    thread_id = request.thread_id or agent_module.create_thread()

    try:
        result = agent_module.run_query(thread_id, request.question)
    except Exception as exc:
        logger.exception("Error running agent query")
        raise HTTPException(status_code=500, detail=str(exc))

    return ChatResponse(
        text=result["text"],
        chart=ChartSpec(**result["chart"]),
        sql=result["sql"],
        thread_id=thread_id,
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
