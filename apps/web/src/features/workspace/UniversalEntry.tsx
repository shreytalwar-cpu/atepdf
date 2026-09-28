'use client';
import dynamic from 'next/dynamic';
const App=dynamic(()=>import('../../../../universal/App'),{ssr:false});
export default function UniversalEntry(){return <App/>;}
