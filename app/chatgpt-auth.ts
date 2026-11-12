// Compatibility name for the existing app: identity comes ONLY from local sessions.
import {cookies} from 'next/headers';
import {sessionUser,cookieName} from '@/server/security.mjs';
export async function getChatGPTUser(allowPasswordChange=false){
 const userId=sessionUser((await cookies()).get(cookieName)?.value,allowPasswordChange);
 return userId?{userId}:null;
}
export function chatGPTSignInPath(_returnTo:string){return '/login';}
