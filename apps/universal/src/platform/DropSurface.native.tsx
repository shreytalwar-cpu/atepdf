import type {ReactNode} from 'react';
import {View} from 'react-native';
export default function DropSurface({children}:{children:ReactNode;onFiles:(files:File[])=>void;disabled:boolean}){return <View style={{flex:1}}>{children}</View>;}
