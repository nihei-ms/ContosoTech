using './main.bicep'

param environmentName = readEnvironmentVariable('AZURE_ENV_NAME', 'demo')
param location = readEnvironmentVariable('AZURE_LOCATION', 'northcentralus')
param gpt4oDeploymentName = 'gpt-4o'
param gpt4oModelVersion = '2024-11-20'
param gpt4oCapacity = 30
param sqlServer = 'nh-sql-external.database.windows.net'
param sqlDatabase = 'sqldb-hcc-g36o34t3bsjyc'
