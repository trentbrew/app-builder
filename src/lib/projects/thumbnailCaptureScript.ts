/** Inline guest script — injected into project index.html for preview screenshots. */
export const THUMBNAIL_CAPTURE_MARKER = 'app-builder-thumbnail-capture';

export const THUMBNAIL_CAPTURE_SCRIPT = `(function(){
if(window.__appBuilderThumb)return;
window.__appBuilderThumb=1;
window.addEventListener('message',function(ev){
  var d=ev.data;
  if(!d||d.v!==1||d.type!=='app-builder-capture-thumbnail')return;
  var id=d.requestId;
  capture().then(function(dataUrl){
    window.parent.postMessage({v:1,type:'app-builder-thumbnail-result',requestId:id,ok:true,dataUrl:dataUrl},'*');
  }).catch(function(err){
    window.parent.postMessage({v:1,type:'app-builder-thumbnail-result',requestId:id,ok:false,error:String(err)},'*');
  });
});
function capture(){
  return new Promise(function(resolve,reject){
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        var outW=640;
        var outH=400;
        var vw=document.documentElement.clientWidth||800;
        var vh=document.documentElement.clientHeight||500;
        import('https://esm.sh/html-to-image@1.11.11').then(function(mod){
          return mod.toJpeg(document.body,{quality:0.72,cacheBust:true,pixelRatio:1,width:vw,height:vh});
        }).then(function(dataUrl){
          return cropCenter(dataUrl,outW,outH,1.4);
        }).then(resolve).catch(function(){
          try{
            resolve(svgFallback(outW,outH));
          }catch(e){
            reject(e);
          }
        });
      });
    });
  });
}
function cropCenter(dataUrl,outW,outH,zoom){
  return new Promise(function(resolve,reject){
    var img=new Image();
    img.onload=function(){
      var canvas=document.createElement('canvas');
      canvas.width=outW;canvas.height=outH;
      var ctx=canvas.getContext('2d');
      if(!ctx)return reject(new Error('no canvas'));
      var sw=img.width/zoom;
      var sh=img.height/zoom;
      var sx=Math.max(0,(img.width-sw)/2);
      var sy=Math.max(0,(img.height-sh)/2);
      ctx.drawImage(img,sx,sy,sw,sh,0,0,outW,outH);
      resolve(canvas.toDataURL('image/jpeg',0.72));
    };
    img.onerror=function(){reject(new Error('crop failed'));};
    img.src=dataUrl;
  });
}
function svgFallback(w,h){
  var node=document.body.cloneNode(true);
  node.querySelectorAll('script').forEach(function(el){el.remove();});
  var html=new XMLSerializer().serializeToString(node);
  var svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml">'+html+'</div></foreignObject></svg>';
  var img=new Image();
  var url='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
  return new Promise(function(res,rej){
    img.onload=function(){
      var canvas=document.createElement('canvas');
      canvas.width=w;canvas.height=h;
      var ctx=canvas.getContext('2d');
      if(!ctx)return rej(new Error('no canvas'));
      ctx.drawImage(img,0,0);
      res(canvas.toDataURL('image/jpeg',0.72));
    };
    img.onerror=function(){rej(new Error('svg fallback failed'));};
    img.src=url;
  });
}
})();`;

export function thumbnailCaptureScriptTag() {
	return `<script data-${THUMBNAIL_CAPTURE_MARKER}="1">${THUMBNAIL_CAPTURE_SCRIPT}<\/script>`;
}
