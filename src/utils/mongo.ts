import { MongoClient } from '../deps.ts';

const MONGODB_URI = Deno.env.get('MONGODB_URI') || 'mongodb://root:password@localhost:27017?authSource=admin';
const mongoClient = new MongoClient();

export { MONGODB_URI, mongoClient }