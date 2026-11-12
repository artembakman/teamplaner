import {rawDatabase} from '@/server/database.mjs';
export const dynamic='force-dynamic';
export async function GET(){try{rawDatabase().prepare('SELECT 1 FROM local_accounts LIMIT 1').get();return Response.json({status:'ok'});}catch{return Response.json({status:'unavailable'},{status:503});}}
