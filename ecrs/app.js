(function(){
  function boot(){
  var ECRS_BUILD='2026.11.16.3';
  try{performance.mark('ecrs-app-start');}catch(e){}
  var SPEEDS=[0.25,0.5,1,2,3,4];
  var VALUE={value:'增值',necessary:'必要非增值',waste:'浪费'};
  var ECRS={E:'取消(E)',C:'合并(C)',R:'重排(R)',S:'简化(S)'};
  var project={id:'ecrs_'+Date.now().toString(36),title:'未命名项目',videoName:'',videoKey:'',fps:30,fields:[
    {id:'model',label:'产品型号',value:'',required:true},
    {id:'process',label:'工序',value:'',required:true},
    {id:'operator',label:'作业员编号',value:'',required:false},
    {id:'date',label:'拍摄日期',value:'',required:true},
    {id:'workshop',label:'车间',value:'',required:false}
  ],actions:[],marks:[]};
  var archive=[];
  var player=document.getElementById('player');
  var hevcControl=null;
  var nativeTime=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'currentTime');
  var nativePlay=HTMLMediaElement.prototype.play,nativePause=HTMLMediaElement.prototype.pause;
  var nativeRate=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'playbackRate');
  Object.defineProperty(player,'currentTime',{configurable:true,get:function(){return hevcControl?hevcControl.getTime():nativeTime.get.call(player);},set:function(value){if(hevcControl)hevcControl.seek(value);else nativeTime.set.call(player,value);}});
  Object.defineProperty(player,'playbackRate',{configurable:true,get:function(){return hevcControl?hevcControl.getRate():nativeRate.get.call(player);},set:function(value){if(hevcControl)hevcControl.setRate(value);else nativeRate.set.call(player,value);}});
  player.play=function(){return hevcControl?hevcControl.play():nativePlay.call(player);};
  player.pause=function(){if(hevcControl)hevcControl.pause();else nativePause.call(player);};

  function uid(){return 'a'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);}
  function clone(value){return JSON.parse(JSON.stringify(value));}
  function payload(){var data=clone(project);delete data.videoKey;return data;}
  function round2(n){return window.EcrsActions?EcrsActions.round2(n):Math.round((Number(n)||0)*100)/100;}
  function duration(action){return window.EcrsActions?EcrsActions.duration(action):(action.end==null||action.start==null?0:Math.max(0,action.end-action.start));}
  function fmt(seconds){return (Number(seconds)||0).toFixed(2)+'s';}
  function refreshActions(){
    if(!Array.isArray(project.marks)||!window.EcrsActions) return;
    project.actions=EcrsActions.rowsFromMarks(project.marks);
  }
  function eachTagged(id,fn){
    project.actions.forEach(function(action){if(action.id===id) fn(action);});
    if(Array.isArray(project.marks)) project.marks.forEach(function(mark){if(mark.id===id) fn(mark);});
  }
  function openStartIndex(){
    if(!Array.isArray(project.marks)) return -1;
    var open=-1;
    for(var i=0;i<project.marks.length;i++){
      if(project.marks[i].type==='start') open=i;
      else if(project.marks[i].type==='end') open=-1;
    }
    return open;
  }
  function removeMark(id){
    if(!Array.isArray(project.marks)){project.actions=project.actions.filter(function(action){return action.id!==id;});return;}
    var idx=-1;
    for(var i=0;i<project.marks.length;i++) if(project.marks[i].id===id) idx=i;
    if(idx<0){project.actions=project.actions.filter(function(action){return action.id!==id;});return;}
    if(project.marks[idx].type==='start'){
      var end=idx+1;
      while(end<project.marks.length&&project.marks[end].type!=='start') end++;
      project.marks.splice(idx,end-idx);
    }else project.marks.splice(idx,1);
    refreshActions();
  }
  function clearWorkingAnalysis(){
    project.marks=[];
    project.actions=[];
    render();
  }
  function markTime(){
    var t=player.currentTime||0;
    if(t<0) t=0;
    return round2(t);
  }

  function openDb(){
    return new Promise(function(resolve,reject){
      var request=indexedDB.open('wb_ecrs_videos',1);
      request.onupgradeneeded=function(){request.result.createObjectStore('videos');};
      request.onsuccess=function(){resolve(request.result);};
      request.onerror=function(){reject(request.error);};
    });
  }
  function storeVideo(key,blob){
    return openDb().then(function(db){return new Promise(function(resolve,reject){
      var tx=db.transaction('videos','readwrite');tx.objectStore('videos').put(blob,key);
      tx.oncomplete=function(){resolve();};tx.onerror=function(){reject(tx.error);};
    });});
  }
  function loadVideo(key){
    return openDb().then(function(db){return new Promise(function(resolve,reject){
      var tx=db.transaction('videos','readonly'),request=tx.objectStore('videos').get(key);
      request.onsuccess=function(){resolve(request.result||null);};request.onerror=function(){reject(request.error);};
    });});
  }

  function renderFields(){
    document.getElementById('fields').innerHTML=project.fields.map(function(field){
      return '<label class="muted">'+escapeHtml(field.label)+'</label><div class="field"><input data-field="'+field.id+'" type="text" value="'+escapeHtml(field.value)+'" aria-label="'+escapeHtml(field.label)+'"><label><input data-required="'+field.id+'" type="checkbox"'+(field.required?' checked':'')+'>必填</label><button class="icon" data-remove="'+field.id+'" type="button" title="删除字段" aria-label="删除字段">🗑</button></div>';
    }).join('');
  }
  function escapeHtml(value){return String(value==null?'':value).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];});}
  function renderTable(){
    var rows=project.actions.map(function(action,index){
      return '<tr><td>'+(index+1)+'</td><td><input data-desc="'+action.id+'" value="'+escapeHtml(action.description)+'"></td><td>'+fmt(action.start)+'</td><td>'+(action.end==null?'—':fmt(action.end))+'</td><td>'+fmt(duration(action))+'</td><td><select data-value="'+action.id+'">'+options(VALUE,action.value)+'</select></td><td><select data-ecrs="'+action.id+'">'+options(ECRS,action.ecrs)+'</select></td><td><input data-direction="'+action.id+'" value="'+escapeHtml(action.direction)+'"></td><td><button class="icon" data-del="'+action.id+'" type="button" aria-label="删除动作">🗑</button></td></tr>';
    }).join('');
    document.getElementById('table').innerHTML='<table><thead><tr><th>#</th><th>动作描述</th><th>开始</th><th>结束</th><th>时长</th><th>分类</th><th>ECRS</th><th>改善方向</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>';
  }
  function options(map,selected){return Object.keys(map).map(function(key){return '<option value="'+key+'"'+(key===selected?' selected':'')+'>'+map[key]+'</option>';}).join('');}
  function renderTimeline(){
    var host=document.getElementById('timeline');host.innerHTML='';
    var total=Math.max(player.duration||0,1);
    project.actions.forEach(function(action){
      if(action.start==null)return;
      var end=action.end==null?Math.min(total,action.start+0.4):action.end;
      var mark=document.createElement('div');
      mark.className='mark '+(action.value||'value');
      mark.style.left=(action.start/total*100)+'%';
      mark.style.width=Math.max(0.4,(end-action.start)/total*100)+'%';
      mark.title=action.description||'动作';
      host.appendChild(mark);
    });
  }
  function renderStats(){
    var summary=window.EcrsActions?EcrsActions.statsFromRows(project.actions):{total:0,buckets:{value:0,necessary:0,waste:0}};
    var total=summary.total;
    var buckets=summary.buckets;
    document.getElementById('stats').innerHTML=['value','necessary','waste'].map(function(key){
      var share=total?Math.round(buckets[key]/total*1000)/10:0;
      return '<div class="stat"><span>'+VALUE[key]+'</span><b>'+fmt(buckets[key])+'</b><span>'+share+'%</span></div>';
    }).join('')+'<div class="stat"><span>总 CT</span><b>'+fmt(total)+'</b><span>'+project.actions.length+' 个动作</span></div>';
  }
  function renderArchive(){
    document.getElementById('archive').innerHTML=archive.map(function(item){
      return '<div class="row"><button class="btn" data-open="'+item.id+'" type="button">'+escapeHtml(item.title||'项目')+'</button><span class="muted">'+(item.savedAt||'')+'</span></div>';
    }).join('')||'<p class="muted">本机还没有存档。</p>';
  }
  function render(){renderFields();renderTable();renderTimeline();renderStats();renderArchive();document.getElementById('clock').textContent=fmt(player.currentTime||0);}

  document.getElementById('fields').addEventListener('input',function(event){
    var id=event.target.getAttribute('data-field');if(!id)return;
    project.fields.forEach(function(field){if(field.id===id)field.value=event.target.value;});
  });
  document.getElementById('fields').addEventListener('change',function(event){
    var id=event.target.getAttribute('data-required');if(!id)return;
    project.fields.forEach(function(field){if(field.id===id)field.required=event.target.checked;});
  });
  document.getElementById('fields').addEventListener('click',function(event){
    var id=event.target.getAttribute('data-remove');if(!id)return;
    project.fields=project.fields.filter(function(field){return field.id!==id;});renderFields();
  });
  document.getElementById('addField').onclick=function(){
    var label=document.getElementById('newField').value.trim();if(!label)return;
    project.fields.push({id:uid(),label:label,value:'',required:false});
    document.getElementById('newField').value='';renderFields();
  };
  document.getElementById('table').addEventListener('input',function(event){
    var id=event.target.getAttribute('data-desc')||event.target.getAttribute('data-direction');
    if(!id)return;
    eachTagged(id,function(action){if(event.target.hasAttribute('data-desc'))action.description=event.target.value;else action.direction=event.target.value;});
  });
  document.getElementById('table').addEventListener('change',function(event){
    var valueId=event.target.getAttribute('data-value'),ecrsId=event.target.getAttribute('data-ecrs');
    if(valueId) eachTagged(valueId,function(action){action.value=event.target.value;});
    if(ecrsId) eachTagged(ecrsId,function(action){action.ecrs=event.target.value;});
    renderTimeline();renderStats();
  });
  document.getElementById('table').addEventListener('click',function(event){
    var id=event.target.getAttribute('data-del');if(!id)return;
    removeMark(id);render();
  });

  function mimeFor(name,fallback){
    var lower=String(name||'').toLowerCase();
    if(lower.endsWith('.webm'))return 'video/webm';
    if(lower.endsWith('.ogg')||lower.endsWith('.ogv'))return 'video/ogg';
    if(lower.endsWith('.mp4')||lower.endsWith('.m4v'))return 'video/mp4';
    return fallback&&String(fallback).indexOf('video/')===0?fallback:'video/mp4';
  }
  function asVideoBlob(data,name){
    if(!data)return null;
    if(data instanceof ArrayBuffer)return new Blob([data],{type:mimeFor(name)});
    if(ArrayBuffer.isView(data))return new Blob([data.buffer],{type:mimeFor(name)});
    if(typeof Blob!=='undefined'&&data instanceof Blob)return data;
    return new Blob([data],{type:mimeFor(name)});
  }
  function videoErrorMessage(video,type){
    var code=video&&video.error&&video.error.code;
    var names={1:'播放被中断',2:'视频读取失败',3:'视频解码中断',4:'浏览器无法解码该视频'};
    var probe=video&&video.canPlayType?video.canPlayType(type||'video/mp4'):'';
    return (names[code]||'视频无法播放')+'（错误码 '+(code||0)+'，canPlayType '+(probe||'empty')+'）';
  }
  function desktopVideo(){return !(window.matchMedia&&window.matchMedia('(max-width: 599px)').matches);}
  function codecMessage(info){
    if(window.EcrsMp4&&EcrsMp4.hevc(info))return '该视频为 H.265/HEVC 编码，浏览器无法解码。可转为 H.264（720p）后再播放，画面时间与原片对齐。';
    if(info&&info.audio&&EcrsMp4.awkwardAudio(info))return '音轨为 '+info.audio.codec+'，浏览器无法解码。桌面端会先去掉音轨再播放。';
    return '浏览器无法解码该视频。'+((info&&EcrsMp4.summary(info))||'');
  }
  function logCodec(info,file){
    var video=info&&info.video,audio=info&&info.audio;
    trace('video',{eventName:'codec',command:'codec.'+(video&&video.codec||'unknown'),message:window.EcrsMp4?EcrsMp4.summary(info):'',count:info&&info.trackCount||0,mediaMs:Math.max(0,Math.round((info&&info.duration||0)*1000)),fileName:file&&file.name,fileSize:file&&file.size||0,fileType:file&&file.type||''});
  }
  function showFix(message,offer){
    var box=document.getElementById('videoFix'),text=document.getElementById('videoFixText'),button=document.getElementById('videoTranscode');
    if(text)text.textContent=message||'';
    if(button)button.hidden=!offer;
    if(box)box.hidden=!message;
    var status=document.getElementById('videoStatus');if(status)status.textContent=message||'';
  }
  var ZOOM_MIN=1,ZOOM_MAX=4,zoomScale=1,zoomPanX=0,zoomPanY=0,zoomDrag=null,zoomDragMoved=false;
  function stageEl(){return document.getElementById('stage');}
  function zoomLayer(){return document.getElementById('stageZoom');}
  function magnifyOn(){
    var btn=document.getElementById('zoomToggle');
    return !!(btn&&btn.getAttribute('aria-pressed')==='true');
  }
  function videoReady(){
    var canvas=document.getElementById('hevcCanvas');
    if(canvas&&!canvas.hidden)return true;
    if(player.videoWidth>0)return true;
    var source=player.querySelector('source');
    return !!(player.readyState>=1&&((source&&source.src)||player.currentSrc||player.src));
  }
  function syncStageEmpty(){
    var empty=document.getElementById('stageEmpty');
    if(empty)empty.hidden=videoReady();
  }
  function hostViewportHeight(){
    try{
      if(window.parent&&window.parent!==window&&window.parent.innerHeight>240)return window.parent.innerHeight;
    }catch(e){}
    return window.innerHeight||800;
  }
  function applyZoomTransform(){
    var el=zoomLayer();
    if(!el)return;
    el.style.transform='translate('+zoomPanX.toFixed(2)+'px,'+zoomPanY.toFixed(2)+'px) scale('+zoomScale.toFixed(4)+')';
    var stage=stageEl();
    if(stage)stage.classList.toggle('magnify-pan',magnifyOn()&&zoomScale>1.001);
  }
  function clampZoomPan(){
    var stage=stageEl();
    if(!stage||zoomScale<=1){zoomScale=1;zoomPanX=0;zoomPanY=0;return;}
    var w=stage.clientWidth,h=stage.clientHeight;
    var minX=w-w*zoomScale,minY=h-h*zoomScale;
    if(zoomPanX>0)zoomPanX=0;
    if(zoomPanY>0)zoomPanY=0;
    if(zoomPanX<minX)zoomPanX=minX;
    if(zoomPanY<minY)zoomPanY=minY;
  }
  function resetZoom(){zoomScale=1;zoomPanX=0;zoomPanY=0;applyZoomTransform();}
  function setMagnify(on){
    var btn=document.getElementById('zoomToggle');
    if(btn)btn.setAttribute('aria-pressed',on?'true':'false');
    try{localStorage.setItem('wb_ecrs_magnify',on?'1':'0');}catch(e){}
    if(!on){resetZoom();postStageScrollLock(false);}
    else{
      applyZoomTransform();
      var stage=stageEl();
      if(stage&&stage.matches(':hover'))postStageScrollLock(true);
    }
  }
  function wheelPixels(event,stage,axis){
    var delta=axis==='x'?event.deltaX:event.deltaY;
    if(event.deltaMode===1)delta*=16;
    else if(event.deltaMode===2)delta*=(axis==='x'?stage.clientWidth:stage.clientHeight)||400;
    return delta||0;
  }
  function postStageScrollLock(lock){
    lock=!!lock;
    if(postStageScrollLock.sent===lock)return;
    postStageScrollLock.sent=lock;
    try{parent.postMessage({source:'wb-ecrs',type:'stage-scroll',lock:lock},location.origin);}catch(e){postStageScrollLock.sent=!lock;}
  }
  function fitStage(){
    var stage=stageEl();
    if(!stage)return;
    var width=stage.clientWidth;
    if(!(width>40))return;
    var maxH=Math.max(420,Math.round(hostViewportHeight()*0.86));
    var height=Math.round(Math.min(width*9/16,maxH));
    var prevW=fitStage.width||0,prevH=fitStage.height||0;
    if(prevH&&Math.abs(prevH-height)<24&&Math.abs(prevW-width)<24)return;
    fitStage.width=width;fitStage.height=height;
    stage.style.height=height+'px';
    clampZoomPan();
    applyZoomTransform();
  }
  function useCanvas(on){
    var canvas=document.getElementById('hevcCanvas');
    player.hidden=!!on;
    if(canvas){
      canvas.hidden=!on;
      if(!on){canvas.style.width='';canvas.style.height='';}
    }
    if(!on&&hevcControl){hevcControl.stop();hevcControl=null;}
    fitStage();
    syncStageEmpty();
  }
  function reportVideo(error){
    var message=error&&error.message?String(error.message):'视频无法播放';
    var stack=error&&error.stack?String(error.stack).split('\n').slice(0,3).join('\n'):'';
    var status=document.getElementById('videoStatus');if(status)status.textContent=message;
    try{parent.postMessage({source:'wb-ecrs',type:'video-error',errorName:error&&error.name||'Error',message:message,stack:stack,code:player.error&&player.error.code||0},location.origin);}catch(ignore){}
  }
  function showVideo(data,name){
    var blob=asVideoBlob(data,name);
    if(!blob)return Promise.reject(new Error('没有视频数据'));
    var type=blob.type&&blob.type.indexOf('video/')===0?blob.type:mimeFor(name,blob.type);
    var previous=player._url;
    var url=URL.createObjectURL(blob);
    player._url=url;
    player.preload='auto';player.playsInline=true;player.muted=false;player.controls=true;
    while(player.firstChild)player.removeChild(player.firstChild);
    var source=document.createElement('source');
    source.src=url;source.type=type;
    player.appendChild(source);
    return new Promise(function(resolve,reject){
      var settled=false;
      function finish(error){
        if(settled)return;settled=true;
        player.removeEventListener('loadeddata',onLoad);
        player.removeEventListener('error',onError);
        if(!error&&previous)URL.revokeObjectURL(previous);
        if(error)reject(error);else{applySelectedRate();var status=document.getElementById('videoStatus');if(status)status.textContent='';resolve();}
      }
      function onLoad(){finish();}
      function onError(){var code=player.error&&player.error.code;if(code===1)return;finish(new Error(videoErrorMessage(player,type)));}
      player.addEventListener('loadeddata',onLoad);
      player.addEventListener('error',onError);
      var timer=setTimeout(function(){finish(new Error(videoErrorMessage(player,type)));},12000);
      var wrapped=finish;finish=function(error){clearTimeout(timer);wrapped(error);};
      player.load();
      if(player.currentSrc===url&&player.readyState>=2)finish();
    });
  }
  var activeFile=null,transcodeRun=null;
  function nativeFailed(error){return !!(player.error&&player.error.code>=3)||/无法解码|解码中断|HEVC|H\.265/.test(error&&error.message||'');}
  function recoverPlayback(file,info,error){
    var message=codecMessage(info);
    if(!desktopVideo()){showFix(message,false);reportVideo(new Error(message));return Promise.resolve();}
    if(window.EcrsMp4&&EcrsMp4.avc(info)&&(EcrsMp4.awkwardAudio(info)||nativeFailed(error))){
      document.getElementById('videoStatus').textContent='音轨无法解码，正在去掉音轨…';
      return EcrsMp4.dropAudio(file).then(function(blob){return showVideo(blob,file.name);}).then(function(){showFix('已去掉无法解码的音轨，正在播放画面。',false);trace('video',{eventName:'remux',command:'codec.video-only',message:'去掉音轨后播放'});}).catch(function(){return offerTranscode(file,info,message);});
    }
    if(window.EcrsMp4&&EcrsMp4.hevc(info)&&desktopVideo()){
      return playHevc(file,info).then(function(ok){if(!ok)return offerTranscode(file,info,message);}).catch(function(){return offerTranscode(file,info,message);});
    }
    return offerTranscode(file,info,message);
  }
  function offerTranscode(file,info,message){
    activeFile=file;showFix(message,desktopVideo());reportVideo(new Error(message));return Promise.resolve();
  }
  function loadFfmpeg(){
    if(window.FFmpegWASM&&window.FFmpegWASM.FFmpeg)return Promise.resolve();
    return new Promise(function(resolve,reject){
      var script=document.createElement('script');
      script.src=new URL('../vendor/ffmpeg/ffmpeg.js?v='+ECRS_BUILD,location.href).href;
      script.onload=function(){resolve();};script.onerror=function(){reject(new Error('转码组件加载失败'));};
      document.head.appendChild(script);
    });
  }
  function formatRemain(seconds){
    seconds=Math.max(0,Math.round(seconds));
    if(seconds<60)return seconds+' 秒';
    return Math.floor(seconds/60)+' 分 '+(seconds%60)+' 秒';
  }
  function startTranscode(){
    if(!activeFile||!desktopVideo())return;
    var file=activeFile,button=document.getElementById('videoTranscode'),cancel=document.getElementById('videoCancel'),bar=document.getElementById('videoProgress'),eta=document.getElementById('videoEta');
    button.disabled=true;cancel.hidden=false;bar.hidden=false;bar.value=0;
    var started=performance.now(),ffmpeg=null,cancelled=false;
    cancel.onclick=function(){cancelled=true;if(ffmpeg)ffmpeg.terminate();button.disabled=false;cancel.hidden=true;bar.hidden=true;eta.textContent='已取消转码';};
    document.getElementById('videoStatus').textContent='正在加载转码组件…';
    loadFfmpeg().then(function(){
      if(cancelled)return;
      ffmpeg=new FFmpegWASM.FFmpeg();transcodeRun=ffmpeg;
      ffmpeg.on('progress',function(data){
        var ratio=data&&typeof data.progress==='number'?Math.max(0,Math.min(1,data.progress)):0;
        bar.value=ratio;
        if(ratio>0.01){var elapsed=(performance.now()-started)/1000;eta.textContent='正在转为 H.264… 约还需 '+formatRemain(elapsed/ratio-elapsed); }
      });
      var core=new URL('../vendor/ffmpeg/ffmpeg-core.js?v='+ECRS_BUILD,location.href).href;
      var wasm=new URL('../vendor/ffmpeg/ffmpeg-core.wasm?v='+ECRS_BUILD,location.href).href;
      return ffmpeg.load({coreURL:core,wasmURL:wasm});
    }).then(function(){
      if(cancelled||!ffmpeg)return;
      document.getElementById('videoStatus').textContent='正在转为 H.264（720p，快速预设）…';
      return file.arrayBuffer().then(function(buffer){return ffmpeg.writeFile('input.mp4',new Uint8Array(buffer));});
    }).then(function(){
      if(cancelled||!ffmpeg)return;
      return ffmpeg.exec(['-i','input.mp4','-an','-c:v','libx264','-preset','ultrafast','-vf','scale=-2:720','-crf','26','-movflags','+faststart','output.mp4'],-1);
    }).then(function(){
      if(cancelled||!ffmpeg)return;
      return ffmpeg.readFile('output.mp4');
    }).then(function(data){
      if(cancelled||!data)return;
      var blob=new Blob([data.buffer],{type:'video/mp4'});
      useCanvas(false);
      return showVideo(blob,file.name).then(function(){showFix('已转为 H.264 并开始播放。标注时间与原片对齐。',false);trace('video',{eventName:'transcode',command:'codec.h264',message:'转码完成',fileSize:blob.size});if(project.videoKey)return storeVideo(project.videoKey,blob);});
    }).catch(function(error){if(!cancelled){reportVideo(error);document.getElementById('videoStatus').textContent=error&&error.message||'转码失败';}}).then(function(){button.disabled=false;cancel.hidden=true;bar.hidden=true;});
  }
  document.getElementById('videoTranscode').onclick=startTranscode;
  function loadScriptOnce(url){
    var key=url.split('?')[0];
    if(loadScriptOnce.cache[key]) return loadScriptOnce.cache[key];
    loadScriptOnce.cache[key]=new Promise(function(resolve,reject){
      var script=document.createElement('script');
      script.src=url;
      script.async=true;
      script.onload=function(){resolve();};
      script.onerror=function(){loadScriptOnce.cache[key]=null;reject(new Error('组件加载失败'));};
      document.head.appendChild(script);
    });
    return loadScriptOnce.cache[key];
  }
  loadScriptOnce.cache={};
  function loadMp4(){
    if(window.EcrsMp4) return Promise.resolve();
    return loadScriptOnce(new URL('mp4.js?v='+ECRS_BUILD,location.href).href);
  }
  function loadHevc(){
    if(window.EcrsHevc) return Promise.resolve();
    return loadScriptOnce(new URL('hevc.js?v='+ECRS_BUILD,location.href).href);
  }
  function playHevc(file,info){
    return loadHevc().then(function(){
      return EcrsHevc.supported(info.video).then(function(ok){
        trace('video',{eventName:'webcodecs',command:ok?'codec.webcodecs-yes':'codec.webcodecs-no',message:info.video.codecString||info.video.codec});
        if(!ok) return false;
        useCanvas(true);
        return EcrsHevc.attach(file,info,player,document.getElementById('hevcCanvas')).then(function(control){
          hevcControl=control;
          applySelectedRate();
          showFix('正在用浏览器的 HEVC 解码器播放。',false);
          return true;
        });
      });
    });
  }
  function openVideoFile(file){
    activeFile=file;useCanvas(false);showFix('',false);resetZoom();
    var inspectable=/\.mp4$|\.m4v$|\.mov$/i.test(file.name||'')||/mp4|quicktime/i.test(file.type||'');
    var prepare=inspectable?loadMp4():Promise.resolve();
    prepare.then(function(){
      return window.EcrsMp4&&inspectable?EcrsMp4.inspectFile(file):null;
    }).then(function(info){
      logCodec(info,file);
      if(info&&window.EcrsMp4&&EcrsMp4.hevc(info)&&desktopVideo()){
        return playHevc(file,info).then(function(ok){
          if(ok) return;
          showFix(codecMessage(info),true);
          return showVideo(file,file.name).then(function(){showFix('',false);},function(){});
        });
      }
      return showVideo(file,file.name).then(function(){},function(error){return recoverPlayback(file,info,error);});
    },function(){return showVideo(file,file.name);}).catch(function(error){reportVideo(error);alert(error.message||'视频无法播放');});
    storeVideo(project.videoKey,file).catch(function(error){project.videoKey='';reportVideo(error);});
  }
  document.getElementById('videoFile').onchange=function(){
    var file=this.files&&this.files[0];if(!file)return;
    clearWorkingAnalysis();
    project.videoName=file.name;project.videoKey='video_'+project.id+'_'+Date.now().toString(36);
    openVideoFile(file);
  };
  var selectedRate=1;
  function applySelectedRate(){
    try{player.playbackRate=selectedRate||1;}catch(e){}
  }
  SPEEDS.forEach(function(speed){
    var button=document.createElement('button');button.type='button';button.className='btn';button.textContent=speed+'x';button.setAttribute('aria-pressed',speed===1?'true':'false');
    button.onclick=function(){selectedRate=speed;applySelectedRate();document.querySelectorAll('#speeds button').forEach(function(item){item.setAttribute('aria-pressed',item===button?'true':'false');});};
    document.getElementById('speeds').appendChild(button);
  });
  document.getElementById('play').onclick=function(){
    if(!hevcControl&&!player.currentSrc&&!player.src&&!player.querySelector('source')){alert('请先导入视频');return;}
    applySelectedRate();
    var pending=player.play();
    if(pending&&typeof pending.catch==='function')pending.catch(function(error){
      var reported=new Error('无法播放：'+(error&&error.message?error.message:videoErrorMessage(player)));
      reported.name=error&&error.name||'Error';if(error&&error.stack)reported.stack=error.stack;
      reportVideo(reported);alert(reported.message);
    });
  };
  document.getElementById('pause').onclick=function(){player.pause();};
  function step(sign){var amount=1/(project.fps||30);player.pause();player.currentTime=Math.max(0,player.currentTime+sign*amount);render();}
  document.getElementById('back').onclick=function(){step(-1);};
  document.getElementById('forward').onclick=function(){step(1);};
  player.addEventListener('timeupdate',function(){document.getElementById('clock').textContent=fmt(player.currentTime||0);});
  player.addEventListener('loadedmetadata',function(){applySelectedRate();syncStageEmpty();fitStage();renderTimeline();reportLayout();});
  player.addEventListener('emptied',syncStageEmpty);
  (function installMagnify(){
    var btn=document.getElementById('zoomToggle');
    var stage=stageEl();
    if(btn){
      try{if(localStorage.getItem('wb_ecrs_magnify')==='1')btn.setAttribute('aria-pressed','true');}catch(e){}
      btn.onclick=function(){setMagnify(!magnifyOn());};
    }
    if(!stage)return;
    stage.addEventListener('pointerenter',function(){if(magnifyOn())postStageScrollLock(true);});
    stage.addEventListener('pointermove',function(){postStageScrollLock(magnifyOn());});
    stage.addEventListener('pointerleave',function(){if(!zoomDrag)postStageScrollLock(false);});
    window.addEventListener('blur',function(){postStageScrollLock(false);});
    stage.addEventListener('wheel',function(event){
      if(!magnifyOn()){
        if(window.parent&&window.parent!==window){
          var dx=wheelPixels(event,stage,'x'),dy=wheelPixels(event,stage,'y');
          if(dx||dy){
            var parentBeforeY=0,parentBeforeX=0,readable=false;
            try{parentBeforeY=window.parent.scrollY||0;parentBeforeX=window.parent.scrollX||0;readable=true;}catch(e){}
            requestAnimationFrame(function(){
              var moved=false;
              if(readable){try{moved=Math.abs((window.parent.scrollY||0)-parentBeforeY)>0.5||Math.abs((window.parent.scrollX||0)-parentBeforeX)>0.5;}catch(e){}}
              if(!moved){try{parent.postMessage({source:'wb-ecrs',type:'stage-wheel',deltaX:dx,deltaY:dy},location.origin);}catch(e){}}
            });
          }
        }
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if(!videoReady())return;
      var delta=wheelPixels(event,stage,'y');
      if(!delta)return;
      var rect=stage.getBoundingClientRect();
      var x=event.clientX-rect.left,y=event.clientY-rect.top;
      var next=Math.max(ZOOM_MIN,Math.min(ZOOM_MAX,zoomScale*Math.exp(-delta*0.0016)));
      if(Math.abs(next-zoomScale)<0.0001){if(next<=1)resetZoom();return;}
      var contentX=(x-zoomPanX)/zoomScale,contentY=(y-zoomPanY)/zoomScale;
      zoomScale=next;
      zoomPanX=x-contentX*zoomScale;
      zoomPanY=y-contentY*zoomScale;
      clampZoomPan();
      applyZoomTransform();
    },{capture:true,passive:false});
    function overNativeControls(event){
      if(event.target!==player)return false;
      var rect=player.getBoundingClientRect();
      var bar=Math.min(rect.height*0.22,40*zoomScale+16);
      return event.clientY>=rect.bottom-bar;
    }
    stage.addEventListener('pointerdown',function(event){
      if(event.button!==0||!magnifyOn()||zoomScale<=1||overNativeControls(event))return;
      zoomDrag={id:event.pointerId,x:event.clientX,y:event.clientY,panX:zoomPanX,panY:zoomPanY};
      zoomDragMoved=false;
    });
    stage.addEventListener('pointermove',function(event){
      if(!zoomDrag||event.pointerId!==zoomDrag.id)return;
      var dx=event.clientX-zoomDrag.x,dy=event.clientY-zoomDrag.y;
      if(!zoomDragMoved){
        if(dx*dx+dy*dy<16)return;
        zoomDragMoved=true;
        stage.classList.add('is-panning');
        try{stage.setPointerCapture(event.pointerId);}catch(e){}
      }
      zoomPanX=zoomDrag.panX+dx;
      zoomPanY=zoomDrag.panY+dy;
      clampZoomPan();
      applyZoomTransform();
    });
    function endDrag(event){
      if(!zoomDrag||(event&&event.pointerId!==zoomDrag.id))return;
      zoomDrag=null;
      stage.classList.remove('is-panning');
      postStageScrollLock(stage.matches(':hover'));
    }
    stage.addEventListener('pointerup',endDrag);
    stage.addEventListener('pointercancel',endDrag);
    window.addEventListener('pointerup',endDrag);
    stage.addEventListener('click',function(event){
      if(!zoomDragMoved)return;
      zoomDragMoved=false;
      event.preventDefault();
      event.stopPropagation();
    },true);
    stage.addEventListener('dragstart',function(event){event.preventDefault();});
  })();

  function blankMark(type,time){return {id:uid(),type:type,time:time,description:'',value:'necessary',ecrs:'R',direction:''};}
  document.getElementById('markStart').onclick=function(){
    if(openStartIndex()>=0){alert('已有未结束的周期');return;}
    if(!Array.isArray(project.marks)) project.marks=[];
    project.marks.push(blankMark('start',markTime()));
    refreshActions();render();
  };
  document.getElementById('markEnd').onclick=function(){
    var open=openStartIndex();
    if(open<0){alert('没有未结束的动作');return;}
    var time=markTime();
    if(time<project.marks[open].time) time=project.marks[open].time;
    project.marks.push(blankMark('end',time));
    refreshActions();render();
  };
  document.getElementById('markOther').onclick=function(){
    var open=openStartIndex();
    if(open<0){alert('请先标记开始');return;}
    var time=markTime(),prev=project.marks[open].time;
    for(var i=open+1;i<project.marks.length;i++){
      if(project.marks[i].type==='insert') prev=Math.max(prev,project.marks[i].time);
    }
    if(time<prev){alert('请在上一个标记之后插入');return;}
    project.marks.push(blankMark('insert',time));
    refreshActions();render();
  };

  function missingRequired(){return project.fields.filter(function(field){return field.required&&!String(field.value||'').trim();}).map(function(field){return field.label;});}
  function rememberLocal(){
    var missing=missingRequired();if(missing.length){alert('请填写必填字段：'+missing.join('、'));return false;}
    var saved=payload();saved.savedAt=new Date().toISOString();saved.videoKey=project.videoKey;
    archive=archive.filter(function(item){return item.id!==project.id;});archive.unshift(saved);
    localStorage.setItem('wb_ecrs_archive',JSON.stringify(archive));
    renderArchive();return true;
  }
  document.getElementById('saveLocal').onclick=rememberLocal;
  document.getElementById('saveSync').onclick=function(){
    if(!rememberLocal())return;
    var projects=archive.map(function(item){var copy=clone(item);delete copy.videoKey;return copy;});
    parent.postMessage({source:'wb-ecrs',type:'save',projects:projects},location.origin);
  };
  document.getElementById('exportJson').onclick=function(){
    var blob=new Blob([JSON.stringify(payload(),null,2)],{type:'application/json'});
    var link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=(project.fields[0].value||'ecrs')+'.json';link.click();
  };
  document.getElementById('importJson').onclick=function(){document.getElementById('jsonFile').click();};
  document.getElementById('jsonFile').onchange=function(){
    var file=this.files&&this.files[0];if(!file)return;
    file.text().then(function(text){project=JSON.parse(text);project.actions=project.actions||[];project.fields=project.fields||[];if(!project.id)project.id=uid();if(Array.isArray(project.marks))refreshActions();render();});
  };
  document.getElementById('archive').addEventListener('click',function(event){
    var id=event.target.getAttribute('data-open');if(!id)return;
    var item=archive.filter(function(entry){return entry.id===id;})[0];if(!item)return;
    project=clone(item);if(Array.isArray(project.marks))refreshActions();render();
    if(item.videoKey)loadVideo(item.videoKey).then(function(blob){if(blob)return showVideo(blob,item.videoName||project.videoName);}).catch(function(error){reportVideo(error);alert(error.message||'无法恢复本机视频，请重新导入');});
  });

  document.getElementById('exportExcel').onclick=function(){
    var missing=missingRequired();if(missing.length){alert('请填写必填字段：'+missing.join('、'));return;}
    var script=document.createElement('script');
    script.src='../vendor/exceljs-4.4.0.min.js?v=f4f230487d2d';
    script.onload=function(){exportWorkbook();};
    if(window.ExcelJS)exportWorkbook();else document.head.appendChild(script);
  };
  function exportWorkbook(){
    var workbook=new ExcelJS.Workbook();
    var details=workbook.addWorksheet('动作明细');
    details.addRow(['序号','动作描述','开始(秒)','结束(秒)','时长(秒)','分类','ECRS','改善方向']);
    project.actions.forEach(function(action,index){details.addRow([index+1,action.description,action.start,action.end,duration(action),VALUE[action.value]||'',ECRS[action.ecrs]||'',action.direction]);});
    var stats=workbook.addWorksheet('时间统计');
    var summary=window.EcrsActions?EcrsActions.statsFromRows(project.actions):{total:0,buckets:{value:0,necessary:0,waste:0}};
    var total=summary.total;
    stats.addRow(['项目字段','值']);project.fields.forEach(function(field){stats.addRow([field.label,field.value]);});
    stats.addRow([]);stats.addRow(['分类','时长(秒)','占比']);
    ['value','necessary','waste'].forEach(function(key){
      var amount=summary.buckets[key]||0;
      stats.addRow([VALUE[key],amount,total?amount/total:0]);
    });
    stats.addRow(['总 CT',total,1]);
    var records=workbook.addWorksheet('ECRS改善记录');
    records.addRow(['动作','现状分类','ECRS','改善方向','时长(秒)']);
    project.actions.forEach(function(action){records.addRow([action.description,VALUE[action.value]||'',ECRS[action.ecrs]||'',action.direction,duration(action)]);});
    workbook.xlsx.writeBuffer().then(function(buffer){
      var blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
      var link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='ECRS动作分析.xlsx';link.click();
    });
  }

  function applyAppearance(data){
    if(!data||data.type!=='appearance')return;
    var root=document.documentElement;
    root.classList.toggle('theme-live',!!data.live);
    root.classList.toggle('tl-light',!!data.light);
    var vars=data.vars||{};
    Object.keys(vars).forEach(function(key){
      if(vars[key])root.style.setProperty(key,vars[key]);
      else root.style.removeProperty(key);
    });
    reportLayout();
  }
  window.addEventListener('message',function(event){
    if(event.origin!==location.origin||!event.data||event.data.source!=='wb-host')return;
    if(event.data.type==='projects'&&Array.isArray(event.data.projects)){archive=event.data.projects;renderArchive();}
    if(event.data.type==='appearance')applyAppearance(event.data);
    if(event.data.type==='hidden'){try{player.pause();}catch(e){}}
    if(event.data.type==='shown'){applySelectedRate();fitStage();syncStageEmpty();reportLayout();}
  });
  function trace(eventName,detail){
    try{parent.postMessage({source:'wb-ecrs',type:'trace',event:eventName,detail:detail||{}},location.origin);}catch(ignore){}
  }
  document.addEventListener('click',function(event){
    var el=event.target&&event.target.closest?event.target.closest('button,a,[role="button"]'):null;
    if(!el)return;
    trace('click',{label:(el.getAttribute('aria-label')||el.textContent||'').replace(/\s+/g,' ').trim().slice(0,60),target:el.id||el.tagName.toLowerCase()});
  },true);
  document.addEventListener('change',function(event){
    var input=event.target;if(!input)return;
    if(input.type==='file'&&input.files&&input.files[0]){var file=input.files[0];trace('file',{fileName:String(file.name||'').split(/[\\/]/).pop(),fileSize:file.size||0,fileType:file.type||'',count:input.files.length,target:input.id||''});return;}
    if(input.type==='password')return;
    trace('change',{target:input.id||'',valueLength:String(input.value||'').length,inputType:input.type||''});
  },true);
  ['loadstart','loadedmetadata','canplay','play','pause','error','ratechange'].forEach(function(name){
    player.addEventListener(name,function(){
      var detail={eventName:name};
      if(name==='loadedmetadata')detail.mediaMs=Math.max(0,Math.round((player.duration||0)*1000));
      if(name==='ratechange')detail.valueLength=Math.round((player.playbackRate||1)*100);
      if(name==='error'){detail.media=player.error&&player.error.code||0;detail.message=videoErrorMessage(player);}
      trace('video',detail);
    });
  });
  (function installAnalysisToggle(){
    var btn=document.getElementById('analysisToggle');
    if(!btn)return;
    function apply(collapsed){
      document.documentElement.classList.toggle('ecrs-panel-collapsed',!!collapsed);
      btn.setAttribute('aria-expanded',collapsed?'false':'true');
      btn.setAttribute('aria-label',collapsed?'展开':'收起');
      btn.setAttribute('title',collapsed?'展开':'收起');
    }
    var collapsed=false;
    try{collapsed=localStorage.getItem('wb_ecrs_panel_collapsed')==='1';}catch(e){}
    apply(collapsed);
    btn.onclick=function(){
      var next=!document.documentElement.classList.contains('ecrs-panel-collapsed');
      apply(next);
      try{localStorage.setItem('wb_ecrs_panel_collapsed',next?'1':'0');}catch(e){}
      fitStage();
      reportLayout();
    };
  })();
  function reportLayout(){
    var block=document.querySelector('.ecrs');
    var height=block?Math.ceil(block.offsetTop+block.offsetHeight):Math.ceil(document.body.offsetHeight);
    if(!height||reportLayout.last===height)return;
    reportLayout.last=height;
    try{parent.postMessage({source:'wb-ecrs',type:'layout',height:height},location.origin);}catch(ignore){}
  }
  var hevcCanvas=document.getElementById('hevcCanvas');
  if(window.MutationObserver&&hevcCanvas){
    new MutationObserver(function(){syncStageEmpty();fitStage();reportLayout();}).observe(hevcCanvas,{attributes:true,attributeFilter:['width','height','hidden']});
  }
  window.addEventListener('resize',function(){fitStage();reportLayout();});
  try{if(window.parent&&window.parent!==window)window.parent.addEventListener('resize',function(){fitStage();reportLayout();});}catch(e){}
  if(window.ResizeObserver){
    var stageBox=document.getElementById('stage');
    if(stageBox)new ResizeObserver(function(entries){
      var w=entries&&entries[0]&&entries[0].contentRect?entries[0].contentRect.width:0;
      if(w&&Math.abs(w-(fitStage.width||0))>=24)fitStage();
      reportLayout();
    }).observe(stageBox);
    new ResizeObserver(reportLayout).observe(document.body);
  }
  try{archive=JSON.parse(localStorage.getItem('wb_ecrs_archive')||'[]');}catch(e){archive=[];}
  parent.postMessage({source:'wb-ecrs',type:'request'},location.origin);
  render();
  syncStageEmpty();
  fitStage();
  reportLayout();
  try{performance.mark('ecrs-app-ready');}catch(e){}
  }
  if(typeof requestAnimationFrame==='function') requestAnimationFrame(function(){setTimeout(boot,0);});
  else boot();
})();
