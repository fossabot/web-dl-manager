import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.log('No DATABASE_URL found, skipping prisma provider auto-detection.');
  process.exit(0);
}

let provider = 'sqlite'; // Default

if (databaseUrl.startsWith('mysql://')) {
  provider = 'mysql';
} else if (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://')) {
  provider = 'postgresql';
} else if (databaseUrl.startsWith('mongodb://')) {
  provider = 'mongodb';
}

console.log(`Detected database provider: ${provider}`);

try {
  let schema = fs.readFileSync(schemaPath, 'utf-8');
  
  // Replace the provider inside the datasource db block
  const updatedSchema = schema.replace(
    /(datasource\s+db\s*{[\s\S]*?provider\s*=\s*")([^"]*)(")/,
    `$1${provider}$3`
  );

  if (schema !== updatedSchema) {
    fs.writeFileSync(schemaPath, updatedSchema);
    console.log(`Successfully updated prisma/schema.prisma provider to ${provider}`);
  } else {
    console.log('Prisma schema provider is already correct.');
  }
} catch (error) {
  console.error('Error updating Prisma schema:', error.message);
  process.exit(1);
}
