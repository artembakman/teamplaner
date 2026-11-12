import {cookies} from 'next/headers';
import {sameOrigin,endSession,cookieName,cookieOptions} from '@/server/security.mjs';
export async function POST(req:Request){
 if(!sameOrigin(req))return new Response('Nicht erlaubt',{status:403});
 const c=await cookies();endSession(c.get(cookieName)?.value);c.set(cookieName,'',{...cookieOptions(),maxAge:0} as any);
 return Response.json({ok:true});
}
