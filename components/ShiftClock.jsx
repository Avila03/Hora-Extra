'use client';
import {useEffect,useState} from 'react';
const pad=n=>String(n).padStart(2,'0');
export default function ShiftClock(){
 const [now,setNow]=useState(null);
 useEffect(()=>{setNow(new Date());const t=setInterval(()=>setNow(new Date()),30000);return()=>clearInterval(t)},[]);
 if(!now)return <div className="hx2-shift" aria-hidden="true"><span>Expediente</span><strong>--:--</strong></div>;
 const h=now.getHours(),working=h>=8&&h<18;
 return <div className={'hx2-shift'+(working?' working':'')}><span>{working?'Em expediente':'Expediente encerrado'}</span><strong>{pad(h)}:{pad(now.getMinutes())}</strong></div>;
}
