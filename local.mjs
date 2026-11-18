import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import worker from './dist/server/index.js';

export function sqlite(path) {
  const db=new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=3000;');
  db.exec(readFileSync(new URL('./drizzle/0001_init.sql',import.meta.url),'utf8'));
  return {
    close:()=>db.close(),
    prepare(sql) {
      const statement=db.prepare(sql);
      return {bind(...args) {
        return {
          first:async()=>statement.get(...args)??null,
          all:async()=>({results:statement.all(...args)}),
          run:()=>statement.run(...args),
        };
      }};
    },
    async batch(statements) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const result=statements.map(statement=>statement.run());
        db.exec('COMMIT');
        return result;
      } catch(error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

export function createLocalServer(db,config={}) {
  return createServer(async(incoming,outgoing)=>{
    try {
      const authority=incoming.headers.host ?? '127.0.0.1';
      const protocol=config.publicOrigin ? null : 'http:';
      const origin=config.publicOrigin ?? protocol+'//'+authority;
      const request=new Request(origin+(incoming.url??'/'),{
        method:incoming.method,headers:incoming.headers,
        ...(!['GET','HEAD'].includes(incoming.method)?{body:Readable.toWeb(incoming),duplex:'half'}:{})
      });
      request.headers.delete('CF-Connecting-IP');
      const result=await worker.fetch(request,{DB:db,LOCAL:!config.publicOrigin,CLIENT_IP:incoming.socket.remoteAddress});
      outgoing.writeHead(result.status,Object.fromEntries(result.headers));
      if(result.body)Readable.fromWeb(result.body).pipe(outgoing);
      else outgoing.end();
    } catch {
      if(!outgoing.headersSent)outgoing.writeHead(500,{'Content-Type':'application/json'});
      outgoing.end(JSON.stringify({error:'Временная ошибка сервера.'}));
    }
  });
}
if(process.argv[1] && pathToFileURL(process.argv[1]).href===import.meta.url) {
  const db=process.env.AEGIS_FORCE_UNAVAILABLE==='1'?undefined:sqlite(process.env.AEGIS_SQLITE_PATH??'aegis.sqlite');
  const port=Number(process.env.PORT??4173);
  createLocalServer(db,{publicOrigin:process.env.AEGIS_PUBLIC_ORIGIN}).listen(port,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+port));
}
