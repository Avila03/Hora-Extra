import './hora-extra.css';
export const metadata={
 title:'Hora Extra | Encontros & Gestão',
 applicationName:'Hora Extra',
 description:'Nosso espaço, nossos encontros. Organize eventos, compromissos compartilhados e estoque.',
 manifest:'/manifest.webmanifest',
 appleWebApp:{capable:true,title:'Hora Extra',statusBarStyle:'black-translucent'},
 icons:{icon:[{url:'/icon.svg',type:'image/svg+xml'}],apple:[{url:'/apple-icon.png',sizes:'180x180',type:'image/png'}]}
};
export const viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#00141e'};
export default function RootLayout({children}){return <html lang="pt-BR"><body>{children}</body></html>;}
