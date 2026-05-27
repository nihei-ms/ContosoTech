-- SQL MI Grant Script
-- Run this ONCE against the existing database after the first `azd up` deployment.
-- The backend Container App's system-assigned managed identity needs read access.
--
-- How to find the MI display name:
--   After `azd up`, the Bicep outputs print:
--     BACKEND_MI_DISPLAY_NAME = ca-backend-<token>
--   OR run:
--     az containerapp show -n <app-name> -g <rg> --query identity.principalId -o tsv
--     az ad sp show --id <principalId> --query displayName -o tsv
--
-- Connect to the database as an Entra ID admin (or SQL admin if MI auth not yet configured)
-- and run the following two statements, replacing the placeholder below.

-- Replace <BACKEND_CONTAINER_APP_MI_NAME> with the display name of the Container App's MI.
-- It will look like: ca-backend-abc123def456

DECLARE @miName NVARCHAR(255) = '<BACKEND_CONTAINER_APP_MI_NAME>';

-- Create the user from the managed identity
EXEC('CREATE USER [' + @miName + '] FROM EXTERNAL PROVIDER');

-- Grant read-only access
EXEC('ALTER ROLE db_datareader ADD MEMBER [' + @miName + ']');

-- Verify
SELECT name, type_desc FROM sys.database_principals WHERE name = @miName;
