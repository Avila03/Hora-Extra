import { createClient } from "npm:@supabase/supabase-js@2.57.0";
import webpush from "npm:web-push@3.6.7";

// Hora Extra: confidential database-triggered Web Push delivery.
// Uses Supabase's server-only credential and a second token stored in Database Vault.
const endpointAllowed = (raw: string) => {
  try {
    const address = new URL(raw);
    const host = address.hostname.toLowerCase();
    return address.protocol === "https:" &&
      (host === "web.push.apple.com" || host.endsWith(".push.apple.com") ||
        host === "fcm.googleapis.com" || host === "android.googleapis.com" ||
        host === "updates.push.services.mozilla.com" ||
        host === "push.services.mozilla.com" || host.endsWith(".notify.windows.com"));
  } catch { return false; }
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const respond = (data: unknown, status=200) => new Response(JSON.stringify(data), {
  status, headers: {"Content-Type": "application/json","Cache-Control":"no-store"}
});

Deno.serve(async req => {
  if(req.method !== "POST") return respond({error:"Method not allowed"},405);
  const token=req.headers.get("x-he-push-secret")||"";
  if(token.length<48) return respond({error:"Unauthorized"},401);
  let body: {notification_id?: string};
  try { body=await req.json(); } catch { return respond({error:"Invalid JSON"},400); }
  if(!body.notification_id || !uuid.test(body.notification_id)) return respond({error:"Invalid notification"},400);

  const keySet=Deno.env.get("SUPABASE_SECRET_KEYS");
  const adminKey=(keySet?JSON.parse(keySet)?.default:null)||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const projectUrl=Deno.env.get("SUPABASE_URL");
  if(!adminKey||!projectUrl) return respond({error:"Server not configured"},503);
  const supabase=createClient(projectUrl,adminKey,{
    auth:{autoRefreshToken:false,persistSession:false}
  });
  const {data,error}=await supabase.rpc("he_push_claim",{
    p_notification_id:body.notification_id,p_token:token
  });
  if(error){
    // Never log credentials, subscription endpoints, VAPID keys, or message contents.
    return respond({error:error.code==="28000"?"Unauthorized":"Push dispatch failed"},
      error.code==="28000"?401:500);
  }
  if(!data) return respond({status:"already processed or no subscribed devices"});
  const subs=Array.isArray(data.subscriptions)?data.subscriptions:[];
  if(!subs.length) return respond({status:"no subscriptions"});
  webpush.setVapidDetails(data.vapid_subject,data.vapid_public,data.vapid_private);
  const payload=JSON.stringify({
    id:data.id,
    title:data.title,
    body:data.body,
    url:data.url,
    icon:"/apple-icon.png",
    badge:"/icon.svg"
  });
  const result=await Promise.allSettled(subs.slice(0,30).map(async sub=>{
    if(!endpointAllowed(sub.endpoint)){
      // Do not issue arbitrary server-side HTTP requests to user-controlled URLs.
      return "blocked";
    }
    try{
      await webpush.sendNotification({
        endpoint:sub.endpoint,
        expirationTime:null,
        keys:{p256dh:sub.p256dh,auth:sub.auth}
      },payload,{TTL:3600,urgency:"normal",timeout:10000});
      return "sent";
    }catch(error:unknown){
      const status=(error as {statusCode?: number})?.statusCode;
      if(status===404||status===410){
        await supabase.rpc("he_push_prune",{p_id:sub.id,p_token:token});
        return "expired";
      }
      return "failed";
    }
  }));
  const counts={sent:0,expired:0,failed:0,blocked:0};
  for(const entry of result){
    if(entry.status==="fulfilled" && entry.value in counts) counts[entry.value as keyof typeof counts]++;
    else counts.failed++;
  }
  return respond({status:"processed",...counts});
});
