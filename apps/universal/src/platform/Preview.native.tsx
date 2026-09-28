import {useEffect,useRef,useState} from 'react';
import {AccessibilityInfo,ActivityIndicator,Image,Keyboard,Pressable,ScrollView,Text,View,useWindowDimensions} from 'react-native';
import {ChevronLeft,ChevronRight,FileText,Minus,Plus,X,type LucideIcon} from 'lucide-react-native';
import {File} from 'expo-file-system';
import {Icon} from '../components/ui/icon';
import NativePDF from '../../modules/atepdf-pdf';
import {temporaryPDF,removeTemporary} from './runtime.native';

function PreviewButton({label,icon,onPress,disabled=false}:{label:string;icon:LucideIcon;onPress:()=>void;disabled?:boolean}){
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled}} disabled={disabled} onPress={onPress}
    className={`min-h-11 min-w-11 items-center justify-center rounded-lg active:bg-accent ${disabled?'opacity-35':''}`}>
    <Icon as={icon} size={18} className="text-foreground"/>
  </Pressable>;
}

export default function Preview({bytes,count,onClose}:{bytes:Uint8Array;count:number;onClose:()=>void}){
  const {height:windowHeight}=useWindowDimensions();
  const [page,setPage]=useState(1),[image,setImage]=useState<{uri:string;width:number;height:number}|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  const [width,setWidth]=useState(0),[zoom,setZoom]=useState(1),[reducedMotion,setReducedMotion]=useState(true),[keyboardHeight,setKeyboardHeight]=useState(()=>Keyboard.metrics()?.height??0);
  const rendering=useRef(true);
  // Reserve the same bounded space while loading and rendering. The actual page
  // fits inside it initially; zooming pans within the preview, never the chat.
  const viewportHeight=Math.round(Math.max(104,Math.min(320,(windowHeight-keyboardHeight)*.34)));
  const fit=image?Math.min(Math.max(1,width-24)/image.width,(viewportHeight-24)/image.height):1;
  useEffect(()=>{
    let active=true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(active)setReducedMotion(value);});
    const motion=AccessibilityInfo.addEventListener('reduceMotionChanged',setReducedMotion);
    const shown=Keyboard.addListener('keyboardDidShow',event=>setKeyboardHeight(event.endCoordinates.height));
    const hidden=Keyboard.addListener('keyboardDidHide',()=>setKeyboardHeight(0));
    return()=>{active=false;motion.remove();shown.remove();hidden.remove();};
  },[]);
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
      const result=await NativePDF.renderPageAsync(file.uri,page,1800);rendered=new File(result.uri);
      if(active)setImage(result);else removeTemporary(rendered);
    })().catch(()=>{if(active)setError('This page could not be previewed. Your PDF is unchanged.');}).finally(()=>{if(file)removeTemporary(file);if(active){rendering.current=false;setLoading(false);}});
    return()=>{active=false;if(rendered)removeTemporary(rendered);};
  },[bytes,page]);
  return <View accessibilityLabel="Read-only preview" className="overflow-hidden rounded-xl border border-border bg-background">
    <View className="min-h-12 flex-row items-center justify-between border-b border-border px-2">
      <Text className="flex-1 pl-2 text-sm font-semibold text-foreground">Read-only preview</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Fit page" disabled={loading} accessibilityState={{disabled:loading}} onPress={()=>setZoom(1)} className="min-h-11 min-w-11 items-center justify-center rounded-lg px-2 active:bg-accent"><Text className="text-sm text-foreground">Fit</Text></Pressable>
      <PreviewButton label="Close preview" icon={X} onPress={onClose}/>
    </View>
    <View className="min-h-12 flex-row items-center justify-between border-b border-border px-1">
      <PreviewButton label="Previous page" icon={ChevronLeft} disabled={loading||page===1} onPress={()=>navigate(-1)}/>
      <Text accessibilityLiveRegion="polite" className="text-sm tabular-nums text-foreground">Page {page} of {count}</Text>
      <PreviewButton label="Next page" icon={ChevronRight} disabled={loading||page>=count} onPress={()=>navigate(1)}/>
      <View className="mx-1 h-5 w-px bg-border"/>
      <PreviewButton label="Zoom out" icon={Minus} disabled={loading||zoom<=1} onPress={()=>setZoom(value=>Math.max(1,value-.5))}/>
      <PreviewButton label="Zoom in" icon={Plus} disabled={loading||zoom>=3} onPress={()=>setZoom(value=>Math.min(3,value+.5))}/>
    </View>
    <View onLayout={event=>setWidth(event.nativeEvent.layout.width)} style={{height:viewportHeight}} className="overflow-hidden bg-muted">
      {image&&width>0?<ScrollView key={page} style={{flex:1}} minimumZoomScale={1} maximumZoomScale={3} zoomScale={zoom} centerContent pinchGestureEnabled
        contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} nestedScrollEnabled scrollEventThrottle={100}
        onScroll={event=>{const scale=event.nativeEvent.zoomScale;if(Number.isFinite(scale)&&scale>=1&&scale<=3)setZoom(scale);}}>
        <View style={{width,height:viewportHeight,alignItems:'center',justifyContent:'center'}}>
          <Image accessibilityLabel={`PDF page ${page}`} source={{uri:image.uri}} resizeMode="contain" style={{width:image.width*fit,height:image.height*fit,backgroundColor:'white'}}/>
        </View>
      </ScrollView>:<View className="flex-1 items-center justify-center gap-3 px-5">
        {error?<Text accessibilityRole="alert" className="text-center text-sm leading-5 text-destructive">{error}</Text>:<>
          {reducedMotion?<Icon as={FileText} size={22} className="text-muted-foreground"/>:<ActivityIndicator accessibilityElementsHidden importantForAccessibility="no-hide-descendants"/>}
          <Text accessibilityLabel="Rendering page" accessibilityLiveRegion="polite" className="text-sm text-muted-foreground">Rendering page…</Text>
        </>}
      </View>}
    </View>
  </View>;
}
