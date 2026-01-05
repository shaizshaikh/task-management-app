// Azure Bicep template for Task Management System
// Production-ready infrastructure with security best practices

@description('Environment name (dev, staging, prod)')
param environment string = 'prod'

@description('Location for all resources')
param location string = resourceGroup().location

@description('Application name prefix')
param appName string = 'taskmanagement'

@description('Database administrator login')
@secure()
param dbAdminLogin string

@description('Database administrator password')
@secure()
param dbAdminPassword string

@description('Keycloak admin password')
@secure()
param keycloakAdminPassword string

// Variables
var uniqueSuffix = substring(uniqueString(resourceGroup().id), 0, 6)
var resourcePrefix = '${appName}-${environment}-${uniqueSuffix}'

// Container Registry
resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-01-01-preview' = {
  name: '${resourcePrefix}acr'
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: true
  }
}

// MySQL Database
resource mysqlServer 'Microsoft.DBforMySQL/flexibleServers@2023-06-30' = {
  name: '${resourcePrefix}-mysql'
  location: location
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    administratorLogin: dbAdminLogin
    administratorLoginPassword: dbAdminPassword
    version: '8.0'
    storage: {
      storageSizeGB: 20
      iops: 360
      autoGrow: 'Enabled'
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
  }
}

// Database
resource database 'Microsoft.DBforMySQL/flexibleServers/databases@2023-06-30' = {
  parent: mysqlServer
  name: 'task_management'
  properties: {
    charset: 'utf8mb4'
    collation: 'utf8mb4_unicode_ci'
  }
}

// Firewall rule to allow Azure services
resource firewallRule 'Microsoft.DBforMySQL/flexibleServers/firewallRules@2023-06-30' = {
  parent: mysqlServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// Log Analytics Workspace
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${resourcePrefix}-logs'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

// Application Insights
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${resourcePrefix}-insights'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

// Container Group for the application
resource containerGroup 'Microsoft.ContainerInstance/containerGroups@2023-05-01' = {
  name: '${resourcePrefix}-containers'
  location: location
  properties: {
    containers: [
      {
        name: 'frontend'
        properties: {
          image: '${containerRegistry.properties.loginServer}/taskmanagement-frontend:latest'
          ports: [
            {
              port: 80
              protocol: 'TCP'
            }
          ]
          resources: {
            requests: {
              cpu: 1
              memoryInGB: 1
            }
          }
          environmentVariables: [
            {
              name: 'REACT_APP_KEYCLOAK_REALM'
              value: 'task-management'
            }
            {
              name: 'REACT_APP_KEYCLOAK_CLIENT_ID'
              value: 'task-management-frontend'
            }
          ]
        }
      }
      {
        name: 'backend'
        properties: {
          image: '${containerRegistry.properties.loginServer}/taskmanagement-backend:latest'
          ports: [
            {
              port: 5000
              protocol: 'TCP'
            }
          ]
          resources: {
            requests: {
              cpu: 1
              memoryInGB: 2
            }
          }
          environmentVariables: [
            {
              name: 'DB_HOST'
              value: mysqlServer.properties.fullyQualifiedDomainName
            }
            {
              name: 'DB_PORT'
              value: '3306'
            }
            {
              name: 'DB_NAME'
              value: 'task_management'
            }
            {
              name: 'DB_USER'
              value: dbAdminLogin
            }
            {
              name: 'DB_PASSWORD'
              secureValue: dbAdminPassword
            }
            {
              name: 'KEYCLOAK_URL'
              value: 'http://localhost:8080'
            }
            {
              name: 'KEYCLOAK_EXTERNAL_URL'
              value: 'https://${containerGroup.properties.ipAddress.fqdn}:8080'
            }
            {
              name: 'KEYCLOAK_REALM'
              value: 'task-management'
            }
            {
              name: 'KEYCLOAK_CLIENT_ID'
              value: 'task-management-frontend'
            }
            {
              name: 'KEYCLOAK_ADMIN_USERNAME'
              value: 'admin'
            }
            {
              name: 'KEYCLOAK_ADMIN_PASSWORD'
              secureValue: keycloakAdminPassword
            }
            {
              name: 'KEYCLOAK_ADMIN_CLIENT_ID'
              value: 'admin-cli'
            }
            {
              name: 'FRONTEND_URL'
              value: 'https://${containerGroup.properties.ipAddress.fqdn}'
            }
          ]
        }
      }
      {
        name: 'keycloak'
        properties: {
          image: 'quay.io/keycloak/keycloak:23.0.0'
          ports: [
            {
              port: 8080
              protocol: 'TCP'
            }
          ]
          resources: {
            requests: {
              cpu: 1
              memoryInGB: 2
            }
          }
          environmentVariables: [
            {
              name: 'KEYCLOAK_ADMIN'
              value: 'admin'
            }
            {
              name: 'KEYCLOAK_ADMIN_PASSWORD'
              secureValue: keycloakAdminPassword
            }
            {
              name: 'KC_DB'
              value: 'dev-file'
            }
            {
              name: 'KC_HEALTH_ENABLED'
              value: 'true'
            }
          ]
          command: [
            'start-dev'
            '--import-realm'
          ]
        }
      }
      {
        name: 'nginx'
        properties: {
          image: '${containerRegistry.properties.loginServer}/taskmanagement-nginx:latest'
          ports: [
            {
              port: 80
              protocol: 'TCP'
            }
          ]
          resources: {
            requests: {
              cpu: 0.5
              memoryInGB: 0.5
            }
          }
        }
      }
    ]
    osType: 'Linux'
    restartPolicy: 'Always'
    ipAddress: {
      type: 'Public'
      ports: [
        {
          port: 80
          protocol: 'TCP'
        }
        {
          port: 8080
          protocol: 'TCP'
        }
      ]
      dnsNameLabel: '${resourcePrefix}-app'
    }
    imageRegistryCredentials: [
      {
        server: containerRegistry.properties.loginServer
        username: containerRegistry.listCredentials().username
        password: containerRegistry.listCredentials().passwords[0].value
      }
    ]
    diagnostics: {
      logAnalytics: {
        workspaceId: logAnalytics.properties.customerId
        workspaceKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

// Outputs
output containerRegistryLoginServer string = containerRegistry.properties.loginServer
output applicationUrl string = 'https://${containerGroup.properties.ipAddress.fqdn}'
output keycloakUrl string = 'https://${containerGroup.properties.ipAddress.fqdn}:8080'
output databaseHost string = mysqlServer.properties.fullyQualifiedDomainName