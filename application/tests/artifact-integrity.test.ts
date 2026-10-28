import {it,expect} from 'vitest';
import {fileChecksum,verifyArchivedBytes} from '@/lib/artifacts/integrity';
it('only reuses exact archived bytes declared in the immutable manifest',()=>{
 const bytes=Buffer.from('actual artifact');const manifest={sha256:fileChecksum(bytes),size:bytes.length};
 expect(()=>verifyArchivedBytes(bytes,manifest)).not.toThrow();
 expect(()=>verifyArchivedBytes(Buffer.from('changed artifact'),manifest)).toThrow('ARCHIVE_INTEGRITY_FAILED');
 expect(()=>verifyArchivedBytes(bytes,{...manifest,sha256:''})).toThrow();
 expect(()=>verifyArchivedBytes(bytes,{...manifest,size:0})).toThrow();
});
