const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') })

const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { Pool } = require('pg')

const globalForPrisma = globalThis

let prisma = globalForPrisma.prisma

if (!prisma) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })
    const adapter = new PrismaPg(pool)
    prisma = new PrismaClient({ adapter })

    if (process.env.NODE_ENV !== 'production') {
        globalForPrisma.prisma = prisma
    }
}

module.exports = { prisma }
