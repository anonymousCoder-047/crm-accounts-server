import mongoose from 'mongoose'
import { logDBError, logInfo } from '../utils/logger'
import { initializeDefaultCurrencies } from '../services/currencyService'

const connectDB = async () => {
  try {
    let mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/crm-accounts'
    
    // Log connection string info (without exposing password)
    if (process.env.MONGODB_URI) {
      const uriForLog = mongoUri.includes('@') 
        ? mongoUri.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@')
        : mongoUri
      console.log(`Using MongoDB URI: ${uriForLog}`)
    } else {
      console.warn('WARNING: MONGODB_URI not set in environment variables. Using default connection string.')
      console.warn('If your MongoDB requires authentication, set MONGODB_URI in your .env file.')
    }
    
    // If MONGODB_URI doesn't include authentication but we have separate credentials
    // Build the connection string with authentication
    if (!mongoUri.includes('@') && process.env.MONGODB_USERNAME && process.env.MONGODB_PASSWORD) {
      // Extract host, port, and database from URI
      const uriMatch = mongoUri.match(/mongodb:\/\/([^\/]+)\/(.+)/)
      if (uriMatch) {
        const hostPort = uriMatch[1]
        const database = uriMatch[2]
        const authSource = process.env.MONGODB_AUTH_SOURCE || 'admin'
        mongoUri = `mongodb://${encodeURIComponent(process.env.MONGODB_USERNAME)}:${encodeURIComponent(process.env.MONGODB_PASSWORD)}@${hostPort}/${database}?authSource=${authSource}`
        console.log('Built MongoDB URI with authentication from separate credentials')
      }
    }
    
    // Ensure authSource is in the URI if authentication is required
    // If URI has @ (username:password) but no authSource, add it
    if (mongoUri.includes('@') && !mongoUri.includes('authSource=')) {
      const authSource = process.env.MONGODB_AUTH_SOURCE || 'admin'
      mongoUri += (mongoUri.includes('?') ? '&' : '?') + `authSource=${authSource}`
      console.log(`Added authSource=${authSource} to MongoDB URI`)
    }
    
    // Connection options
    const connectionOptions: mongoose.ConnectOptions = {
      // Additional options for better connection handling
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    }
    
    // Only add authSource to options if not in URI
    if (!mongoUri.includes('authSource=')) {
      connectionOptions.authSource = process.env.MONGODB_AUTH_SOURCE || 'admin'
    }
    
    const conn = await mongoose.connect(mongoUri, connectionOptions)
    const message = `MongoDB Connected: host=${conn.connection.host} db=${conn.connection.name}`
    console.log(message)
    await logInfo(message, { host: conn.connection.host, db: conn.connection.name }, false)
    
    // Run database migrations
    try {
      await runMigrations()
    } catch (error: any) {
      console.error('Error running migrations:', error)
    }
    
    // Initialize default currencies
    try {
      await initializeDefaultCurrencies()
    } catch (error: any) {
      console.error('Error initializing default currencies:', error)
    }
  } catch (error: any) {
    const errorMessage = 'Error connecting to MongoDB'
    console.error(errorMessage, error)
    await logDBError(errorMessage, error, {
      operation: 'connect',
      collection: 'connection',
      uri: process.env.MONGODB_URI ? '[REDACTED]' : 'mongodb://localhost:27017/crm-accounts',
    })
    process.exit(1)
  }
}

// Database migrations
async function runMigrations() {
  try {
    // Drop old indexes from collections if they exist
    // These indexes were from old schema versions and cause duplicate key errors
    const collectionsToCheck = ['salesinvoices', 'purchaseinvoices']
    const oldIndexesToDrop = ['serialNumber_1', 'invoiceNumber_1', 'supplierNumber_1']
    
    for (const collectionName of collectionsToCheck) {
      try {
        const collection = mongoose.connection.collection(collectionName)
        const indexes = await collection.indexes()
        
        for (const indexName of oldIndexesToDrop) {
          const hasIndex = indexes.some((idx: any) => idx.name === indexName)
          
          if (hasIndex) {
            try {
              await collection.dropIndex(indexName)
              console.log(`Successfully dropped old ${indexName} index from ${collectionName} collection`)
              await logInfo(`Dropped ${indexName} index from ${collectionName}`, {}, false)
            } catch (dropError: any) {
              if (dropError.code !== 27 && dropError.codeName !== 'IndexNotFound' && !dropError.message?.includes('index not found')) {
                console.warn(`Warning: Could not drop ${indexName} index from ${collectionName}:`, dropError.message)
              }
            }
          }
        }
      } catch (collectionError: any) {
        // Collection might not exist yet, that's fine
        if (!collectionError.message?.includes('does not exist')) {
          console.warn(`Warning: Could not check ${collectionName} collection:`, collectionError.message)
        }
      }
    }
  } catch (error: any) {
    // Migration errors shouldn't stop the app from starting
    console.warn('Migration warning:', error.message)
  }
}

// Log database connection events
mongoose.connection.on('error', async (error) => {
  await logDBError('MongoDB connection error', error, {
    operation: 'connection',
    collection: 'connection',
  })
})

mongoose.connection.on('disconnected', async () => {
  await logInfo('MongoDB disconnected', {}, false)
})

mongoose.connection.on('reconnected', async () => {
  await logInfo('MongoDB reconnected', {}, false)
})

export default connectDB

