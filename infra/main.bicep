@description('Short environment suffix, e.g. "dev" or "demo".')
param environmentName string

@description('Azure region for all resources.')
param location string = 'northcentralus'

@description('GPT-4o deployment name.')
param gpt4oDeploymentName string = 'gpt-4o'

@description('GPT-4o model version.')
param gpt4oModelVersion string = '2024-11-20'

@description('Tokens-per-minute capacity for the GPT-4o deployment (in thousands).')
param gpt4oCapacity int = 30

// Existing SQL Database (not provisioned here — already exists with customer data)
@description('Hostname of the existing Azure SQL Server (e.g. myserver.database.windows.net).')
param sqlServer string

@description('Name of the existing database.')
param sqlDatabase string

var abbrs = {
  logAnalyticsWorkspace: 'log'
  appInsights: 'appi'
  containerRegistry: 'acr'
  containerAppsEnv: 'cae'
  containerApp: 'ca'
  aiServices: 'ai'
}

var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))
var tags = { 'azd-env-name': environmentName, project: 'contosotech-hcc-poc' }

// Log Analytics — required for Container Apps environment + App Insights
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${abbrs.logAnalyticsWorkspace}-${resourceToken}'
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

// Application Insights — backend API + Foundry Agent traces
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${abbrs.appInsights}-${resourceToken}'
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

// Azure Container Registry
resource acr 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' = {
  name: '${abbrs.containerRegistry}${resourceToken}'
  location: location
  tags: tags
  sku: { name: 'Basic' }
  properties: {
    adminUserEnabled: false
  }
}

// Container Apps Environment
resource containerAppsEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${abbrs.containerAppsEnv}-${resourceToken}'
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

// Azure AI Services account — hosts the Foundry project and GPT-4o deployment
resource aiAccount 'Microsoft.CognitiveServices/accounts@2025-04-01-preview' = {
  name: '${abbrs.aiServices}-${resourceToken}'
  location: location
  tags: tags
  kind: 'AIServices'
  sku: { name: 'S0' }
  identity: { type: 'SystemAssigned' }
  properties: {
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: false
    allowProjectManagement: true
    customSubDomainName: '${abbrs.aiServices}-${resourceToken}'
  }
}

// Foundry Project — scope for Agent Service threads/agents
resource foundryProject 'Microsoft.CognitiveServices/accounts/projects@2025-04-01-preview' = {
  parent: aiAccount
  name: 'hcc-analytics'
  location: location
  tags: tags
  identity: { type: 'SystemAssigned' }
  properties: {
    displayName: 'HCC Risk Analytics'
    description: 'ContosoTech HCC natural language analytics agent'
  }
}

// GPT-4o deployment
resource gpt4oDeployment 'Microsoft.CognitiveServices/accounts/deployments@2025-04-01-preview' = {
  parent: aiAccount
  name: gpt4oDeploymentName
  sku: {
    name: 'GlobalStandard'
    capacity: gpt4oCapacity
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'gpt-4o'
      version: gpt4oModelVersion
    }
    versionUpgradeOption: 'OnceCurrentVersionExpired'
  }
}

// Placeholder image used until azd deploys the real containers
var placeholderImage = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

// Backend Container App — system-assigned MI for Foundry + SQL access
resource backendApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${abbrs.containerApp}-backend-${resourceToken}'
  location: location
  tags: union(tags, { 'azd-service-name': 'backend' })
  identity: { type: 'SystemAssigned' }
  properties: {
    managedEnvironmentId: containerAppsEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8000
        transport: 'http'
        corsPolicy: {
          allowedOrigins: ['*']
          allowedMethods: ['GET', 'POST', 'OPTIONS']
          allowedHeaders: ['*']
        }
      }
      registries: [
        {
          server: acr.properties.loginServer
          identity: 'system'
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'backend'
          image: placeholderImage
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: [
            { name: 'FOUNDRY_PROJECT_ENDPOINT', value: foundryProjectEndpoint }
            { name: 'FOUNDRY_MODEL_NAME', value: gpt4oDeploymentName }
            { name: 'SQL_SERVER', value: sqlServer }
            { name: 'SQL_DATABASE', value: sqlDatabase }
            { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsights.properties.ConnectionString }
          ]
        }
      ]
      scale: { minReplicas: 1, maxReplicas: 3 }
    }
  }
  dependsOn: [gpt4oDeployment]
}

// Frontend Container App — serves the React SPA
resource frontendApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${abbrs.containerApp}-frontend-${resourceToken}'
  location: location
  tags: union(tags, { 'azd-service-name': 'frontend' })
  identity: { type: 'SystemAssigned' }
  properties: {
    managedEnvironmentId: containerAppsEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 80
        transport: 'http'
      }
      registries: [
        {
          server: acr.properties.loginServer
          identity: 'system'
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'frontend'
          image: placeholderImage
          resources: { cpu: json('0.25'), memory: '0.5Gi' }
          env: [
            { name: 'BACKEND_URL', value: 'https://${backendApp.properties.configuration.ingress.fqdn}' }
          ]
        }
      ]
      scale: { minReplicas: 1, maxReplicas: 2 }
    }
  }
}

// Computed Foundry project endpoint
var foundryProjectEndpoint = 'https://${aiAccount.name}.services.ai.azure.com/api/projects/${foundryProject.name}'

// RBAC: Backend MI → AcrPull on ACR (image pulls on scale-out/restarts)
resource backendAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, backendApp.id, 'acrpull')
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d') // AcrPull
    principalId: backendApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// RBAC: Backend MI → Cognitive Services OpenAI Contributor on AI account
// Grants ability to call GPT-4o deployments
resource backendAiContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(aiAccount.id, backendApp.id, 'openai-contributor')
  scope: aiAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'a001fd3d-188f-4b5d-821b-7da978bf7442') // Cognitive Services OpenAI Contributor
    principalId: backendApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// RBAC: Backend MI → Foundry User (Azure AI User) on AI account
// Required for Foundry Agent Service writes: Microsoft.CognitiveServices/accounts/AIServices/agents/*
// Role name is not resolvable via az CLI in all tenants; assigned by GUID.
resource backendFoundryUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(aiAccount.id, backendApp.id, 'foundry-user')
  scope: aiAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '53ca6127-db72-4b80-b1b0-d745d6d5456d') // Foundry User
    principalId: backendApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// RBAC: Frontend MI → AcrPull on ACR
resource frontendAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, frontendApp.id, 'acrpull')
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d') // AcrPull
    principalId: frontendApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// Outputs consumed by azd to set environment variables and service URLs
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = acr.properties.loginServer
output FOUNDRY_PROJECT_ENDPOINT string = foundryProjectEndpoint
output FOUNDRY_MODEL_NAME string = gpt4oDeploymentName
output SQL_SERVER string = sqlServer
output SQL_DATABASE string = sqlDatabase
output APPLICATIONINSIGHTS_CONNECTION_STRING string = appInsights.properties.ConnectionString
output SERVICE_BACKEND_URI string = 'https://${backendApp.properties.configuration.ingress.fqdn}'
output SERVICE_FRONTEND_URI string = 'https://${frontendApp.properties.configuration.ingress.fqdn}'

// Print for easy copy-paste post-deploy
output BACKEND_MI_PRINCIPAL_ID string = backendApp.identity.principalId
output BACKEND_MI_DISPLAY_NAME string = backendApp.name
