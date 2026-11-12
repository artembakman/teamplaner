import {adapter} from '@/server/database.mjs';
interface Statement {
 bind(...values:any[]):Statement;
 first<T=any>():T|null;
 all<T=any>():{results:T[]};
 run():{meta:{changes:number}};
}
interface Database {prepare(sql:string):Statement;batch(statements:Statement[]):{meta:{changes:number}}[]}
export function db():Database{return adapter as Database;}
