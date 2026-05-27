# ContosoTech HCC Risk Analytics POC

AI-powered natural language query interface for HCC risk adjustment data, built with:
- **Microsoft Foundry Agent Service SDK** (`azure-ai-projects>=2.0.0`)
- **Azure Container Apps** (backend + frontend)
- **System-assigned Managed Identity** (no passwords, no secrets)
- **Existing Azure SQL Database** (connecting to customer data — no seeding)

## Quick Start

### Prerequisites
- [Azure CLI](https://docs.microsoft.com/cli/azure/install-azure-cli)
- [Azure Developer CLI (azd)](https://aka.ms/azd-install)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Node.js 20+](https://nodejs.org/)
- [Python 3.12+](https://www.python.org/)

### Deploy

```bash
# 1. Log in
azd auth login
az login

# 2. Initialize (choose your subscription + region)
azd init

# 3. Deploy everything in one command
azd up
```

`azd up` will:
1. Provision all Azure resources (Container Apps, AI Services, Foundry Project, GPT-4o)
2. Build Docker images for backend and frontend
3. Push images to Azure Container Registry
4. Deploy Container Apps with correct environment variables
5. Print the frontend URL when complete

### Post-Deploy: Grant SQL Access (one time)

After the first `azd up`, grant the backend's managed identity read access to the database:

1. Find the MI name from the deployment output: `BACKEND_MI_DISPLAY_NAME`
2. Connect to `sqldb-hcc-g36o34t3bsjyc` on `nh-sql-external.database.windows.net` as an Entra ID admin
3. Run `scripts/grant-sql-access.sql` with the MI name substituted

## Architecture

```
Browser
  → React SPA (Azure Container App, nginx)
    → FastAPI Backend (Azure Container App, system-assigned MI)
      → Foundry Agent Service (azure-ai-projects SDK)
        → GPT-4o (Azure OpenAI)
        → execute_sql / get_schema tools → Existing Azure SQL DB (MI auth, read-only)
      → Application Insights (agent execution traces)
```

## Project Structure

```
├── azure.yaml               # azd configuration
├── infra/
│   ├── main.bicep           # All Azure resources (no SQL — DB already exists)
│   └── main.bicepparam      # Parameter defaults
├── backend/
│   ├── main.py              # FastAPI app + /api/chat endpoint
│   ├── agent.py             # Foundry Agent initialization and query execution
│   ├── sql_tools.py         # execute_sql + get_schema function tools
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   └── components/
│   │       ├── ChatInterface.tsx   # Main chat UI + starter questions
│   │       ├── MessageBubble.tsx   # User/AI message bubbles + Show SQL
│   │       └── ChartRenderer.tsx   # Bar, line, pie charts via Recharts
│   ├── package.json
│   ├── Dockerfile
│   └── nginx.conf
└── scripts/
    └── grant-sql-access.sql  # One-time MI database access grant
```

## Environment Variables

Set automatically by `azd up` from Bicep outputs. For local development, copy `.env.sample` to `.env`:

| Variable | Description |
|---|---|
| `FOUNDRY_PROJECT_ENDPOINT` | `https://<account>.services.ai.azure.com/api/projects/hcc-analytics` |
| `FOUNDRY_MODEL_NAME` | GPT-4o deployment name (`gpt-4o`) |
| `SQL_SERVER` | `nh-sql-external.database.windows.net` |
| `SQL_DATABASE` | `sqldb-hcc-g36o34t3bsjyc` |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Set by Bicep from App Insights |

## Local Development

```bash
# Backend
cd backend
pip install -r requirements.txt
# Set env vars from .env.sample then:
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm install
VITE_BACKEND_URL=http://localhost:8000 npm run dev
```

For local development, `DefaultAzureCredential` will use `az login` credentials.
The SQL server must allow your local IP and have your Entra ID user granted `db_datareader`.

## Security Notes

- **No passwords or secrets stored anywhere** — all auth via Managed Identity
- Backend MI has `Cognitive Services OpenAI Contributor` role on the AI account
- Backend MI has `AcrPull` on the Container Registry
- SQL access granted via Entra ID contained database user (read-only `db_datareader`)
- All queries validated as SELECT-only before execution
- HTTPS enforced on all Container Apps endpoints


