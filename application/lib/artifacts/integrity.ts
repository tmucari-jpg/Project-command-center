import {createHash} from 'node:crypto';
export function fileChecksum(bytes:Uint8Array){return createHash('sha256').update(bytes).digest('hex');}
export function verifyArchivedBytes(bytes:Uint8Array, expected:{sha256:string;size:number}) {
 if(!/^[a-f0-9]{64}$/.test(expected.sha256)||!Number.isSafeInteger(expected.size)||expected.size<1||bytes.length!==expected.size||fileChecksum(bytes)!==expected.sha256)throw new Error('ARCHIVE_INTEGRITY_FAILED');
}
