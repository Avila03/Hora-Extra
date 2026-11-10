export default function BrandSignature({workspaceName,compact=false}){
 return <div className={'he-brand-signature'+(compact?' compact':'')}>
  <svg viewBox="20 25 210 215" width="90" height="100" role="img" aria-label="Monograma HE do Hora Extra"><path fill="#edfaff" d="M33 48 75 78V141H103V98L128 80V225H103V165H75V225H33Z"/><path fill="#21d8f1" d="M144 86 218 35V107L172 138V155L218 127V159L172 187V193L218 169V212L144 232Z"/></svg>
  <div className="he-brand-wordmark">HORA EXTRA</div>
  <div className="he-brand-tagline"><span/>ENCONTROS &amp; GESTÃO<span/></div>
  {workspaceName&&<div className="he-brand-workspace" title={workspaceName}>{workspaceName}</div>}
 </div>;
}
