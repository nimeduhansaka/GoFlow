const { defineConfig } = require('prisma/config')
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '.env') })

console.log('DATABASE_URL loaded:', !!process.env.DATABASE_URL)

module.exports = defineConfig({
    earlyAccess: true,
    schema: './prisma/schema.prisma',
    datasource: {
        url: process.env.DATABASE_URL,
        directUrl: process.env.DIRECT_URL,
    },
    migrate: {
        adapter: async () => {
            const { PrismaPg } = require('@prisma/adapter-pg')
            const { Pool } = require('pg')
            const pool = new Pool({ connectionString: process.env.DIRECT_URL })
            return new PrismaPg(pool)
        },
    },
})
