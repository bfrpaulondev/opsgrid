import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/opsgrid'

const globalForMongoose = globalThis as unknown as {
  mongooseConn: typeof mongoose | undefined
}

export async function connectDB() {
  if (globalForMongoose.mongooseConn) {
    return globalForMongoose.mongooseConn
  }

  const conn = await mongoose.connect(MONGODB_URI)
  globalForMongoose.mongooseConn = conn
  return conn
}

// Default export for convenience
export default connectDB
