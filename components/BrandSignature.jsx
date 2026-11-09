export default function BrandSignature({workspaceName,compact=false}){
 return <div className={'he-brand-signature'+(compact?' compact':'')}>
  <img src="/brand/mark.svg" alt="Monograma HE do Hora Extra" width="90" height="100"/>
  <div className="he-brand-wordmark">HORA EXTRA</div>
  <div className="he-brand-tagline"><span/>ENCONTROS &amp; GESTÃO<span/></div>
  {workspaceName&&<div className="he-brand-workspace" title={workspaceName}>{workspaceName}</div>}
 </div>;
}
