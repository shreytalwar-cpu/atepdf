import {useEffect,useRef,useState} from 'react';
import {Image,Pressable,ScrollView,View} from 'react-native';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Minus from 'lucide-react-native/icons/minus';
import Plus from 'lucide-react-native/icons/plus';
import X from 'lucide-react-native/icons/x';
import {File} from 'expo-file-system';
import NativePDF from '../../modules/atepdf-pdf';
import {temporaryPDF,removeTemporary} from './runtime.native';
import {ActivityGlyph,IconButton,Separator,Txt} from '../ui/primitives';
import {radius,shadow,useTheme} from '../ui/theme';

// E1 Quick Look page view (native). PDFKit renders each page locally at display resolution
// (the raster-scale fix lives in the engine); the page fits the sheet's well and zoom pans
// inside it. Read-only: no editing or annotation controls.
export default function Preview({bytes,count,onClose}:{bytes:Uint8Array;count:number;onClose:()=>void;fill?:boolean}){
  const {c,scheme}=useTheme();
  const [page,setPage]=useState(1),[image,setImage]=useState<{uri:string;width:number;height:number}|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  const [well,setWell]=useState({width:0,height:0}),[zoom,setZoom]=useState(1);
  const rendering=useRef(true);
  const fit=image&&well.width?Math.min((well.width-48)/image.width,(well.height-48)/image.height):1;
  const navigate=(direction:-1|1)=>{
    const next=page+direction;if(rendering.current||next<1||next>count)return;
    // Claim the render slot before React commits the disabled button state.
    rendering.current=true;setLoading(true);setImage(null);setZoom(1);setPage(next);
  };
  useEffect(()=>{
    let active=true,rendered:File|undefined,file:File|undefined;rendering.current=true;setLoading(true);setImage(null);setError('');
    void(async()=>{
      if(!NativePDF?.readerAvailable)throw new Error('Native preview is unavailable.');
      file=temporaryPDF(bytes);
      const result=await NativePDF.renderPageAsync(file.uri,page,2400);rendered=new File(result.uri);
      if(active)setImage(result);else removeTemporary(rendered);
    })().catch(()=>{if(active)setError('This page could not be previewed. Your PDF is unchanged.');}).finally(()=>{if(file)removeTemporary(file);if(active){rendering.current=false;setLoading(false);}});
    return()=>{active=false;if(rendered)removeTemporary(rendered);};
  },[bytes,page]);
  return <View accessibilityLabel="Read-only preview" style={{flex:1,minHeight:0}}>
    <View onLayout={event=>setWell({width:event.nativeEvent.layout.width,height:event.nativeEvent.layout.height})} style={{flex:1,backgroundColor:c.sunken,borderTopWidth:1,borderBottomWidth:1,borderColor:c.hairline,overflow:'hidden'}}>
      {image&&well.width>0?<ScrollView key={page} style={{flex:1}} minimumZoomScale={1} maximumZoomScale={3} zoomScale={zoom} centerContent pinchGestureEnabled
        contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} scrollEventThrottle={100}
        onScroll={event=>{const scale=event.nativeEvent.zoomScale;if(Number.isFinite(scale)&&scale>=1&&scale<=3)setZoom(scale);}}>
        <View style={{width:well.width,height:well.height,alignItems:'center',justifyContent:'center'}}>
          <View style={[{borderRadius:radius.thumb,overflow:'hidden',backgroundColor:c.paper},shadow('page',scheme)]}>
            <Image accessibilityLabel={`PDF page ${page}`} source={{uri:image.uri}} resizeMode="contain" style={{width:image.width*fit,height:image.height*fit,backgroundColor:c.paper}}/>
          </View>
        </View>
      </ScrollView>:<View style={{flex:1,alignItems:'center',justifyContent:'center',gap:10,padding:24}}>
        {error?<Txt variant="ui" tone="danger" accessibilityRole="alert" style={{textAlign:'center'}}>{error}</Txt>:<><ActivityGlyph/><Txt variant="ui" tone="secondary" accessibilityLiveRegion="polite">Rendering page…</Txt></>}
      </View>}
    </View>
    <View style={{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:12,paddingVertical:8}}>
      <IconButton icon={ChevronLeft} label="Previous page" disabled={loading||page===1} onPress={()=>navigate(-1)}/>
      <Txt variant="ui" tabular accessibilityLiveRegion="polite" style={{minWidth:96,textAlign:'center'}}>Page {page} of {count}</Txt>
      <IconButton icon={ChevronRight} label="Next page" disabled={loading||page>=count} onPress={()=>navigate(1)}/>
      <View style={{height:16,marginHorizontal:6}}><Separator vertical/></View>
      <IconButton icon={Minus} label="Zoom out" disabled={loading||zoom<=1} onPress={()=>setZoom(value=>Math.max(1,value-.5))}/>
      <Pressable accessibilityRole="button" accessibilityLabel="Fit page" disabled={loading} onPress={()=>setZoom(1)} style={({pressed})=>({height:28,paddingHorizontal:8,borderRadius:radius.sm,justifyContent:'center',backgroundColor:pressed?c.pressed:'transparent'})}><Txt variant="uiStrong" tone="secondary">Fit</Txt></Pressable>
      <IconButton icon={Plus} label="Zoom in" disabled={loading||zoom>=3} onPress={()=>setZoom(value=>Math.min(3,value+.5))}/>
      <View style={{flex:1}}/>
      <IconButton icon={X} label="Close preview" onPress={onClose}/>
    </View>
  </View>;
}
