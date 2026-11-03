import fs from 'node:fs';
const s=JSON.parse(fs.readFileSync('/tmp/pcc-local-status.json','utf8'));
const url=s.API_URL;const u=new URL(url);
if(u.protocol!=='http:'||!['127.0.0.1','localhost'].includes(u.hostname)||u.port!=='54321')throw Error('Only disposable loopback backend allowed');
for(const [name,value] of Object.entries({NEXT_PUBLIC_SUPABASE_URL:url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:s.ANON_KEY??s.PUBLISHABLE_KEY,PCC_LOCAL_SERVICE_ROLE_KEY:s.SERVICE_ROLE_KEY})){
 if(!value)throw Error('Missing local credential: '+name);
 console.log('::add-mask::'+value);
 fs.appendFileSync(process.env.GITHUB_ENV,`${name}=${value}\n`);
}
