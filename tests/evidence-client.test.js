import {expect,it} from 'vitest';
import {fetchEvidence} from '../lib/evidence-client.mjs';
const settings={endpoint:'https://retrieval.example.com/api/retrieve'};
it('连接失败明确提示后端与网络问题，不披露底层错误',async()=>{
 const error=await fetchEvidence(settings,'问题',undefined,async()=>{throw Error('private transport details');}).catch(e=>e);
 expect(error.code).toBe('EVIDENCE_NETWORK_ERROR');expect(error.message).toContain('无法连接检索接口');expect(error.message).not.toContain('private');
});
it('响应格式无效与用户取消保持各自的错误类别',async()=>{
 await expect(fetchEvidence(settings,'问题',undefined,async()=>Response.json({invalid:true}))).rejects.toMatchObject({code:'EVIDENCE_FORMAT_INVALID'});
 const controller=new AbortController();controller.abort();
 await expect(fetchEvidence(settings,'问题',controller.signal,async()=>{throw Error('aborted');})).rejects.toMatchObject({code:'ABORTED'});
});
