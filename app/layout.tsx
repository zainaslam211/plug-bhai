import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:{default:'PLUG BHAI — Better Accessories. Happier Phones.',template:'%s | PLUG BHAI'},description:'Everyday phone accessories, charging essentials, audio, cases and more. Your phone has a bhai.',robots:{index:false,follow:false},icons:{icon:'/plug-bhai-wordmark.png'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
