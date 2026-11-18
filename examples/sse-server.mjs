/** Explicit non-RAG fixture: deterministic answers, no model or private data. */
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { encodeEvent } from '../protocol/info-card-v1.mjs';
export function createExampleServer({ token = 'example-only-token' } = {}) {
  return http.createServer(async(req,res)=>{
    if(req.method!=='POST'||req.url!=='/api/chat'){res.writeHead(404);res.end();return;}
    if(req.headers.authorization!==`Bearer ${token}`){res.writeHead(401);res.end();return;}
    try{
      const buffers=[];let size=0;
      for await(const chunk of req){size+=chunk.length;if(size>16000)throw Error();buffers.push(chunk);}
      const {message,request_id}=JSON.parse(Buffer.concat(buffers).toString('utf8'));
      if(typeof message!=='string'||!message.trim()||message.length>8000||typeof request_id!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(request_id))throw Error();
      const text=`这是非RAG协议演示，已收到：${message}。来源链接演示使用SSE规范。[1]`;
      res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store'});
      let seq=0;
      const emit=(type,payload)=>res.write(encodeEvent(type,{request_id,seq:seq++,...payload}));
      emit('meta',{protocol:'info-card-sse',version:1});
      for(const textPart of text.match(/.{1,12}/gs)){
        if(res.destroyed)return;
        emit('text_delta',{text:textPart});await new Promise(resolve=>setTimeout(resolve,60));
      }
      emit('info_card',{info_card:[{id:'sse-spec',title:'Server-sent events规范',url:'https://html.spec.whatwg.org/multipage/server-sent-events.html',excerpt:'这是演示卡片，未执行检索，也未调用LLM。',used:true,order:1}]});
      emit('done',{text_length:[...text].length,card_count:1});res.end();
    }catch{if(!res.headersSent)res.writeHead(400);res.end();}
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const port=Number(process.env.PORT||8788);
  createExampleServer({token:process.env.DSH_SSE_EXAMPLE_TOKEN||'example-only-token'}).listen(port,'127.0.0.1',()=>console.log(`Non-RAG fixture: http://127.0.0.1:${port}/api/chat; demonstration only`));
}
