import type {Metadata,Viewport} from 'next';
import './globals.css';
export const metadata:Metadata={title:'atepdf — your files, on your device',description:'Merge, make searchable and optimise PDFs locally.',robots:{index:false,follow:false},icons:{icon:'/brand/approved-8-mark-source-crop.png'}};
export const viewport:Viewport={width:'device-width',initialScale:1,interactiveWidget:'resizes-content'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
