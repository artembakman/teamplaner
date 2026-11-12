import {getChatGPTUser,chatGPTSignInPath} from './chatgpt-auth';
import Planner from './planner';
export const dynamic='force-dynamic';
export default async function Page(){const user=await getChatGPTUser();if(!user)return <main className="signin"><div className="brandmark brandmark-wordmark">OSPW</div><h1>Teamplaner</h1><p>Arbeitsplätze buchen, Anwesenheit planen und Urlaub im Blick behalten.</p><a className="primary" href={chatGPTSignInPath('/')} target="_top">Anmelden →</a><small>Geschützter PoC · Zugang über dein persönliches Konto</small></main>;return <Planner/>}
