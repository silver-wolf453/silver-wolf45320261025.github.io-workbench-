(function(){
  function boot(){
  var ECRS_BUILD='2026.11.18.1';
  try{performance.mark('ecrs-app-start');}catch(e){}
  var SPEEDS=[0.25,0.5,1,2,3,4];
  var VSM={customer:'顾客增值',business:'业务增值',necessary:'必要非增值',waste:'浪费'};
  var FLOW=[
    {id:'operation',label:'操作'},
    {id:'inspect',label:'检验'},
    {id:'transport',label:'搬运'},
    {id:'storage',label:'存储'},
    {id:'wait',label:'等待'},
    {id:'op-inspect',label:'操作+检验'}
  ];
  var ECRS={E:'取消(E)',C:'合并(C)',R:'重排(R)',S:'简化(S)'};
  var TRASH='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var firstRegion=blankRegion('people',1);
  var project={id:'ecrs_'+Date.now().toString(36),title:'未命名项目',videoName:'',videoKey:'',fps:30,fields:defaultFields(),regions:[firstRegion],activeRegionId:firstRegion.id};
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
  function defaultFields(){
    return [
      {id:'model',label:'产品型号',type:'text',value:''},
      {id:'process',label:'工序',type:'text',value:''},
      {id:'workshop',label:'车间',type:'text',value:''},
      {id:'people',label:'人员数量',type:'int',value:1},
      {id:'equipment',label:'设备数量',type:'int',value:0}
    ];
  }
  function regionHeading(role,index){
    return window.EcrsActions?EcrsActions.regionHeading(role,index):(role==='equipment'?'设备':'操作员')+index;
  }
  function blankRegion(role,index){
    return {id:uid(),role:role,index:index,title:regionHeading(role,index),marks:[],actions:[]};
  }
  function fieldById(id){
    var fields=project.fields||[];
    for(var i=0;i<fields.length;i++) if(fields[i].id===id) return fields[i];
    return null;
  }
  function parseCount(value){
    if(typeof value==='number'){
      if(isFinite(value)&&Math.floor(value)===value&&value>=0) return {ok:true,n:value};
      return {ok:false};
    }
    var text=String(value==null?'':value).trim();
    if(!/^\d+$/.test(text)) return {ok:false};
    return {ok:true,n:Number(text)};
  }
  function validationIssues(){
    var issues=[];
    (project.fields||[]).forEach(function(field){
      if(field.type==='int'){
        if(!parseCount(field.value).ok) issues.push({id:field.id,label:field.label,kind:String(field.value==null?'':field.value).trim()?'integer':'empty'});
      }else if(!String(field.value||'').trim()) issues.push({id:field.id,label:field.label,kind:'empty'});
    });
    var people=fieldById('people'),equipment=fieldById('equipment');
    var peopleCount=people?parseCount(people.value):{ok:false};
    var equipmentCount=equipment?parseCount(equipment.value):{ok:false};
    if(peopleCount.ok&&equipmentCount.ok&&peopleCount.n+equipmentCount.n<1){
      issues.push({id:'people',label:'人员数量',sum:true});
      issues.push({id:'equipment',label:'设备数量',sum:true});
    }
    return issues;
  }
  function fieldInvalid(id){return validationIssues().some(function(issue){return issue.id===id;});}
  function regionHasRows(region){return !!((region.marks&&region.marks.length)||(region.actions&&region.actions.length));}
  function appliedCount(role){return (project.regions||[]).filter(function(region){return region.role===role;}).length;}
  function activeRegion(){
    var regions=project.regions||[],found=null,i=0;
    for(;i<regions.length;i++) if(regions[i].id===project.activeRegionId) found=regions[i];
    if(!found) found=regions[0]||null;
    if(found) project.activeRegionId=found.id;
    return found;
  }
  function regionById(id){
    var regions=project.regions||[];
    for(var i=0;i<regions.length;i++) if(regions[i].id===id) return regions[i];
    return null;
  }
  function refreshActions(){
    if(!window.EcrsActions) return;
    (project.regions||[]).forEach(function(region){
      region.actions=EcrsActions.rowsFromMarks(region.marks||[]);
    });
  }
  function eachTagged(id,fn){
    (project.regions||[]).forEach(function(region){
      (region.actions||[]).forEach(function(action){if(action.id===id) fn(action);});
      (region.marks||[]).forEach(function(mark){if(mark.id===id) fn(mark);});
    });
  }
  function removeMark(id){
    var regions=project.regions||[];
    for(var r=0;r<regions.length;r++){
      var marks=regions[r].marks||[],idx=-1;
      for(var i=0;i<marks.length;i++) if(marks[i].id===id) idx=i;
      if(idx<0) continue;
      if(marks[idx].type==='start'){
        var end=idx+1;
        while(end<marks.length&&marks[end].type!=='start') end++;
        marks.splice(idx,end-idx);
      }else marks.splice(idx,1);
      refreshActions();
      return;
    }
  }
  function clearWorkingAnalysis(){
    (project.regions||[]).forEach(function(region){region.marks=[];region.actions=[];});
    render();
  }
  function flowSvg(id){
    return window.EcrsActions?EcrsActions.flowSymbol(id):'';
  }
  var MARK_ICON={
    start:'<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-start"/></svg>',
    end:'<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-end"/></svg>',
    insert:'<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-insert"/></svg>'
  };
  function regionTools(regionId){
    var id=escapeHtml(regionId);
    function button(kind,label){
      return '<button class="btn icon-only" type="button" data-mark="'+kind+'" data-region-id="'+id+'" title="'+label+'" aria-label="'+label+'">'+MARK_ICON[kind]+'</button>';
    }
    return '<span class="region-tools">'+button('start','标记开始')+button('end','标记结束')+button('insert','插入重叠动作')+'</span>';
  }
  function flowById(id){
    for(var i=0;i<FLOW.length;i++) if(FLOW[i].id===id) return FLOW[i];
    return null;
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
    document.getElementById('fields').innerHTML=(project.fields||[]).map(function(field){
      var invalid=fieldInvalid(field.id);
      var input=field.type==='int'
        ?'<input id="ecrs-field-'+field.id+'" data-field="'+field.id+'" type="number" min="0" step="1" inputmode="numeric" autocomplete="off" value="'+escapeHtml(field.value)+'" aria-label="'+escapeHtml(field.label)+'" aria-invalid="'+(invalid?'true':'false')+'">'
        :'<input id="ecrs-field-'+field.id+'" data-field="'+field.id+'" type="text" value="'+escapeHtml(field.value)+'" aria-label="'+escapeHtml(field.label)+'" aria-invalid="'+(invalid?'true':'false')+'">';
      return '<div class="field"><label class="field-label" for="ecrs-field-'+field.id+'">'+escapeHtml(field.label)+'</label>'+input+'</div>';
    }).join('');
  }
  function escapeHtml(value){return String(value==null?'':value).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];});}
  function options(map,selected,allowBlank){
    var html=allowBlank?'<option value=""'+(selected===''?' selected':'')+'></option>':'';
    return html+Object.keys(map).map(function(key){return '<option value="'+key+'"'+(key===selected?' selected':'')+'>'+map[key]+'</option>';}).join('');
  }
  function flowControl(action){
    var current=flowById(action.flow);
    var label=current?current.label:'—';
    var menu=FLOW.map(function(item){
      var selected=item.id===action.flow;
      return '<li role="option" tabindex="-1" data-flow-value="'+item.id+'" data-flow-for="'+escapeHtml(action.id)+'" aria-selected="'+(selected?'true':'false')+'">'+flowSvg(item.id)+'<span>'+item.label+'</span></li>';
    }).join('');
    var id=escapeHtml(action.id);
    return '<div class="flow"><button type="button" class="flow-btn" data-flow-btn="'+id+'" aria-haspopup="listbox" aria-expanded="false" aria-controls="flow-menu-'+id+'" aria-label="流程'+(current?'：'+current.label:'')+'">'+(current?flowSvg(current.id):'')+'<span>'+label+'</span></button><ul class="flow-menu" id="flow-menu-'+id+'" role="listbox" aria-label="流程" hidden>'+menu+'</ul></div>';
  }
  function renderRegions(){
    var host=document.getElementById('regions');
    var active=activeRegion();
    host.innerHTML=(project.regions||[]).map(function(region){
      var rows=(region.actions||[]).map(function(action,index){
        var id=escapeHtml(action.id);
        return '<tr><td>'+(index+1)+'</td><td><input data-desc="'+id+'" value="'+escapeHtml(action.description)+'" aria-label="动作描述"></td><td>'+fmt(action.start)+'</td><td>'+(action.end==null?'—':fmt(action.end))+'</td><td>'+fmt(duration(action))+'</td><td>'+flowControl(action)+'</td><td><select data-vsm="'+id+'" aria-label="VSM">'+options(VSM,action.value,true)+'</select></td><td><select data-ecrs="'+id+'" aria-label="ECRS">'+options(ECRS,action.ecrs)+'</select></td><td><input data-direction="'+id+'" value="'+escapeHtml(action.direction)+'" aria-label="改善方向"></td><td><button class="icon" data-del="'+id+'" type="button" aria-label="删除动作">'+TRASH+'</button></td></tr>';
      }).join('');
      var on=active&&region.id===active.id;
      var heading=escapeHtml(regionHeading(region.role, region.index));
      return '<section class="region'+(on?' is-active':'')+'" data-region="'+escapeHtml(region.id)+'"><div class="region-head"><h2><button type="button" class="region-select" aria-pressed="'+(on?'true':'false')+'">'+heading+'</button></h2>'+regionTools(region.id)+'</div><div class="region-body"><table><thead><tr><th>#</th><th>动作描述</th><th>开始</th><th>结束</th><th>时长</th><th>流程</th><th>VSM</th><th>ECRS</th><th>改善方向</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div></section>';
    }).join('');
  }
  function renderTimeline(){
    var host=document.getElementById('timeline');host.innerHTML='';
    var region=activeRegion();
    var total=Math.max(player.duration||0,1);
    ((region&&region.actions)||[]).forEach(function(action){
      if(action.start==null)return;
      var end=action.end==null?Math.min(total,action.start+0.4):action.end;
      var mark=document.createElement('div');
      mark.className='mark'+(action.value?' '+action.value:'');
      mark.style.left=(action.start/total*100)+'%';
      mark.style.width=Math.max(0.4,(end-action.start)/total*100)+'%';
      mark.title=action.description||'动作';
      host.appendChild(mark);
    });
  }
  function combinedStats(){
    var buckets={customer:0,business:0,necessary:0,waste:0};
    var flows={operation:0,inspect:0,transport:0,storage:0,wait:0,'op-inspect':0};
    var total=0,count=0;
    (project.regions||[]).forEach(function(region){
      var summary=window.EcrsActions?EcrsActions.statsFromRows(region.actions||[]):{total:0,buckets:{},flows:{}};
      total+=summary.total||0;
      count+=(region.actions||[]).length;
      Object.keys(buckets).forEach(function(key){buckets[key]+=summary.buckets&&summary.buckets[key]||0;});
      Object.keys(flows).forEach(function(key){flows[key]+=summary.flows&&summary.flows[key]||0;});
    });
    Object.keys(buckets).forEach(function(key){buckets[key]=round2(buckets[key]);});
    Object.keys(flows).forEach(function(key){flows[key]=round2(flows[key]);});
    return {total:round2(total),buckets:buckets,flows:flows,count:count};
  }
  function renderStats(){
    var summary=combinedStats();
    var total=summary.total;
    document.getElementById('stats').innerHTML=['customer','business','necessary','waste'].map(function(key){
      var share=total?Math.round(summary.buckets[key]/total*1000)/10:0;
      return '<div class="stat"><span>'+VSM[key]+'</span><b>'+fmt(summary.buckets[key])+'</b><span>'+share+'%</span></div>';
    }).join('')+'<div class="stat"><span>总 CT</span><b>'+fmt(total)+'</b><span>'+summary.count+' 个动作</span></div>';
  }
  function renderArchive(){
    document.getElementById('archive').innerHTML=archive.map(function(item){
      return '<div class="row"><button class="btn" data-open="'+item.id+'" type="button">'+escapeHtml(item.title||'项目')+'</button><span class="muted">'+(item.savedAt||'')+'</span></div>';
    }).join('')||'<p class="muted">本机还没有存档。</p>';
  }
  function render(){renderFields();renderRegions();renderTimeline();renderStats();renderArchive();document.getElementById('clock').textContent=fmt(player.currentTime||0);reportLayout();}
  function paintFieldValidity(){
    var root=document.getElementById('fields');
    if(!root) return;
    Array.prototype.forEach.call(root.querySelectorAll('[data-field]'),function(input){
      input.setAttribute('aria-invalid',fieldInvalid(input.getAttribute('data-field'))?'true':'false');
    });
  }
  function reshapeRegions(peopleN,equipmentN,ask){
    var removed=[];
    function shape(role,count){
      var have=(project.regions||[]).filter(function(region){return region.role===role;});
      removed=removed.concat(have.slice(count));
      var out=[],i=0;
      for(;i<count;i++){
        var region=have[i]||{id:uid(),role:role,marks:[],actions:[]};
        region.role=role;
        region.index=i+1;
        region.title=regionHeading(role,i+1);
        if(!Array.isArray(region.marks)) region.marks=[];
        out.push(region);
      }
      return out;
    }
    var people=shape('people',peopleN);
    var equipment=shape('equipment',equipmentN);
    var doomed=removed.filter(regionHasRows);
    if(ask&&doomed.length){
      var names=doomed.map(function(region){return region.title;}).join('、');
      if(!window.confirm('将删除'+names+'，继续？')) return false;
    }
    project.regions=people.concat(equipment);
    if(!project.regions.some(function(region){return region.id===project.activeRegionId;})) project.activeRegionId=project.regions.length?project.regions[0].id:'';
    refreshActions();
    renderRegions();
    renderTimeline();
    renderStats();
    reportLayout();
    return true;
  }
  function setActiveRegion(id){
    if(!id||id===project.activeRegionId) return;
    var regions=project.regions||[],found=false,i=0;
    for(;i<regions.length;i++) if(regions[i].id===id) found=true;
    if(!found) return;
    project.activeRegionId=id;
    var root=document.getElementById('regions');
    Array.prototype.forEach.call(root.querySelectorAll('.region'),function(node){
      var on=node.getAttribute('data-region')===id;
      node.classList.toggle('is-active',on);
      var button=node.querySelector('.region-select');
      if(button) button.setAttribute('aria-pressed',on?'true':'false');
    });
    renderTimeline();
  }
  function closeFlowMenus(){
    document.querySelectorAll('.flow-menu').forEach(function(menu){
      menu.hidden=true;
      var btn=menu.parentNode&&menu.parentNode.querySelector('.flow-btn');
      if(btn) btn.setAttribute('aria-expanded','false');
    });
  }
  function openFlow(btn){
    closeFlowMenus();
    var menu=document.getElementById(btn.getAttribute('aria-controls'));
    if(!menu) return;
    menu.hidden=false;
    btn.setAttribute('aria-expanded','true');
    var selected=menu.querySelector('[aria-selected="true"]')||menu.querySelector('[role="option"]');
    if(selected) selected.focus();
  }
  function chooseFlow(actionId,value){
    eachTagged(actionId,function(action){action.flow=value;});
    renderRegions();
    renderStats();
  }

  document.getElementById('fields').addEventListener('input',function(event){
    var input=event.target;
    var id=input.getAttribute('data-field');
    if(!id) return;
    var field=fieldById(id);
    if(!field) return;
    if(field.type==='int'){
      var parsed=parseCount(input.value);
      if(!parsed.ok){field.value=input.value;paintFieldValidity();return;}
      field.value=parsed.n;
      var otherId=id==='people'?'equipment':'people';
      var other=parseCount(fieldById(otherId).value);
      if(other.ok){
        var peopleN=id==='people'?parsed.n:other.n;
        var equipmentN=id==='equipment'?parsed.n:other.n;
        if(peopleN!==appliedCount('people')||equipmentN!==appliedCount('equipment')){
          if(!reshapeRegions(peopleN,equipmentN,true)){
            var back=appliedCount(id==='people'?'people':'equipment');
            field.value=back;
            input.value=String(back);
          }
        }
      }
      paintFieldValidity();
      return;
    }
    field.value=input.value;
    input.setAttribute('aria-invalid',String(field.value||'').trim()?'false':'true');
  });
  document.getElementById('regions').addEventListener('input',function(event){
    var id=event.target.getAttribute('data-desc')||event.target.getAttribute('data-direction');
    if(!id) return;
    eachTagged(id,function(action){if(event.target.hasAttribute('data-desc'))action.description=event.target.value;else action.direction=event.target.value;});
  });
  document.getElementById('regions').addEventListener('change',function(event){
    var vsmId=event.target.getAttribute('data-vsm'),ecrsId=event.target.getAttribute('data-ecrs');
    if(vsmId) eachTagged(vsmId,function(action){action.value=event.target.value;});
    if(ecrsId) eachTagged(ecrsId,function(action){action.ecrs=event.target.value;});
    if(vsmId||ecrsId){renderTimeline();renderStats();}
  });
  document.getElementById('regions').addEventListener('click',function(event){
    var markBtn=event.target.closest('[data-mark]');
    if(markBtn){
      event.preventDefault();
      event.stopPropagation();
      closeFlowMenus();
      markRegion(markBtn.getAttribute('data-region-id'), markBtn.getAttribute('data-mark'));
      return;
    }
    var option=event.target.closest('[data-flow-value]');
    if(option){
      event.preventDefault();
      chooseFlow(option.getAttribute('data-flow-for'),option.getAttribute('data-flow-value'));
      return;
    }
    var flowBtn=event.target.closest('.flow-btn');
    if(flowBtn){
      if(flowBtn.getAttribute('aria-expanded')==='true') closeFlowMenus();
      else openFlow(flowBtn);
    }
    var del=event.target.closest('[data-del]');
    if(del){removeMark(del.getAttribute('data-del'));render();return;}
    var section=event.target.closest('.region');
    if(section) setActiveRegion(section.getAttribute('data-region'));
  });
  document.getElementById('regions').addEventListener('keydown',function(event){
    var btn=event.target.closest('.flow-btn');
    var option=event.target.closest('[role="option"]');
    if(btn&&(event.key==='ArrowDown'||event.key==='Enter'||event.key===' ')){event.preventDefault();openFlow(btn);return;}
    if(btn&&event.key==='Escape'){closeFlowMenus();return;}
    if(!option) return;
    var items=Array.prototype.slice.call(option.parentNode.querySelectorAll('[role="option"]'));
    var index=items.indexOf(option);
    if(event.key==='ArrowDown'){event.preventDefault();items[Math.min(items.length-1,index+1)].focus();}
    else if(event.key==='ArrowUp'){event.preventDefault();items[Math.max(0,index-1)].focus();}
    else if(event.key==='Home'){event.preventDefault();items[0].focus();}
    else if(event.key==='End'){event.preventDefault();items[items.length-1].focus();}
    else if(event.key==='Enter'||event.key===' '){event.preventDefault();chooseFlow(option.getAttribute('data-flow-for'),option.getAttribute('data-flow-value'));}
    else if(event.key==='Escape'){
      event.preventDefault();
      var owner=document.querySelector('.flow-btn[data-flow-btn="'+option.getAttribute('data-flow-for')+'"]');
      closeFlowMenus();
      if(owner) owner.focus();
    }
  });
  document.addEventListener('click',function(event){
    if(event.target.closest&&event.target.closest('.flow')) return;
    closeFlowMenus();
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

  function blankMark(type,time){return {id:uid(),type:type,time:time,description:'',value:'necessary',ecrs:'R',direction:'',flow:''};}
  function markAlert(code){
    if(code==='open') return '已有未结束的周期';
    if(code==='none') return '没有未结束的动作';
    if(code==='need-start') return '请先标记开始';
    if(code==='order') return '请在上一个标记之后插入';
    return '没有动作明细';
  }
  var markBusy=false;
  function markRegion(id,kind){
    if(markBusy) return;
    markBusy=true;
    try{
      var region=regionById(id);
      if(!region||!window.EcrsActions){alert('没有动作明细');return;}
      if(!Array.isArray(region.marks)) region.marks=[];
      var result=EcrsActions.applyRegionMark(region.marks, kind, markTime(), function(decision){
        return blankMark(decision.type, decision.time);
      });
      var switched=project.activeRegionId!==region.id;
      if(!result.ok){
        if(switched){project.activeRegionId=region.id;render();}
        alert(markAlert(result.code));
        return;
      }
      project.activeRegionId=region.id;
      refreshActions();
      render();
    }finally{
      markBusy=false;
    }
  }

  function normalizeMark(mark){
    if(!mark||typeof mark!=='object') return null;
    var next={id:mark.id||uid(),type:mark.type,time:mark.time,description:mark.description||'',ecrs:mark.ecrs||'R',direction:mark.direction||''};
    if(mark.value==null) next.value='necessary';
    else next.value=window.EcrsActions?EcrsActions.vsmKey(mark.value):String(mark.value);
    next.flow=window.EcrsActions?EcrsActions.flowKey(mark.flow):'';
    return next;
  }
  function fitRole(role,count,source){
    var have=source.filter(function(region){return region.role===role;});
    var n=count;
    if(have.length>n) n=have.length;
    var out=[],i=0;
    for(;i<n;i++){
      var region=have[i]||{id:uid(),role:role,marks:[],actions:[]};
      region.role=role;
      region.index=i+1;
      region.title=regionHeading(role,i+1);
      if(!Array.isArray(region.marks)) region.marks=[];
      region.actions=[];
      out.push(region);
    }
    return {regions:out,count:n};
  }
  function normalizeProject(raw){
    raw=raw&&typeof raw==='object'?raw:{};
    var incoming=Array.isArray(raw.fields)?raw.fields:[];
    function findValue(ids,labels){
      for(var i=0;i<incoming.length;i++){
        var field=incoming[i];
        if(!field||typeof field!=='object') continue;
        if(ids.indexOf(field.id)>=0) return field.value;
        if(labels.indexOf(String(field.label||'').trim())>=0) return field.value;
      }
      return undefined;
    }
    function textOf(ids,labels){
      var value=findValue(ids,labels);
      return value==null?'':String(value);
    }
    function countOf(ids,labels,fallback){
      var value=findValue(ids,labels);
      if(value==null||value==='') return fallback;
      var parsed=parseCount(value);
      return parsed.ok?parsed.n:String(value);
    }
    var fields=[
      {id:'model',label:'产品型号',type:'text',value:textOf(['model'],['产品型号'])},
      {id:'process',label:'工序',type:'text',value:textOf(['process'],['工序'])},
      {id:'workshop',label:'车间',type:'text',value:textOf(['workshop'],['车间'])},
      {id:'people',label:'人员数量',type:'int',value:countOf(['people'],['人员数量'],1)},
      {id:'equipment',label:'设备数量',type:'int',value:countOf(['equipment'],['设备数量'],0)}
    ];
    var regions=[];
    if(Array.isArray(raw.regions)){
      raw.regions.forEach(function(region){
        if(!region||typeof region!=='object') return;
        var title=String(region.title||'');
        var role=region.role==='equipment'||region.role==='people'?region.role:(title.indexOf('设备')===0?'equipment':'people');
        var marks=[];
        (Array.isArray(region.marks)?region.marks:[]).forEach(function(mark){var next=normalizeMark(mark);if(next) marks.push(next);});
        regions.push({id:region.id||uid(),role:role,index:0,title:title,marks:marks,actions:[]});
      });
    }else{
      var legacy=[];
      (Array.isArray(raw.marks)?raw.marks:[]).forEach(function(mark){var next=normalizeMark(mark);if(next) legacy.push(next);});
      regions.push({id:uid(),role:'people',index:1,title:regionHeading('people',1),marks:legacy,actions:[]});
    }
    var peopleParsed=parseCount(fields[3].value);
    var equipmentParsed=parseCount(fields[4].value);
    var peopleFit=fitRole('people',peopleParsed.ok?peopleParsed.n:regions.filter(function(region){return region.role==='people';}).length,regions);
    var equipmentFit=fitRole('equipment',equipmentParsed.ok?equipmentParsed.n:regions.filter(function(region){return region.role==='equipment';}).length,regions);
    if(peopleParsed.ok) fields[3].value=peopleFit.count;
    if(equipmentParsed.ok) fields[4].value=equipmentFit.count;
    var fitted=peopleFit.regions.concat(equipmentFit.regions);
    var active=raw.activeRegionId;
    if(!fitted.some(function(region){return region.id===active;})) active=fitted.length?fitted[0].id:'';
    return {id:raw.id||uid(),title:raw.title||'未命名项目',videoName:raw.videoName||'',videoKey:raw.videoKey||'',fps:Number(raw.fps)||30,fields:fields,regions:fitted,activeRegionId:active};
  }
  function adoptProject(raw){
    project=normalizeProject(raw);
    refreshActions();
    render();
  }
  function guardArchive(){
    paintFieldValidity();
    var issues=validationIssues();
    if(!issues.length) return true;
    var labels=[],integers=[],sum=false;
    issues.forEach(function(issue){
      if(issue.sum) sum=true;
      else if(issue.kind==='integer'){if(integers.indexOf(issue.label)<0) integers.push(issue.label);}
      else if(labels.indexOf(issue.label)<0) labels.push(issue.label);
    });
    var parts=[];
    if(labels.length) parts.push('请填写必填字段：'+labels.join('、'));
    if(integers.length) parts.push(integers.join('、')+'须为不小于 0 的整数');
    if(sum) parts.push('人员数量与设备数量合计至少为 1');
    alert(parts.join('\n'));
    return false;
  }
  function rememberLocal(){
    if(!guardArchive()) return false;
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
    if(!guardArchive()) return;
    var blob=new Blob([JSON.stringify(payload(),null,2)],{type:'application/json'});
    var link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=(fieldById('model').value||'ecrs')+'.json';link.click();
  };
  document.getElementById('importJson').onclick=function(){document.getElementById('jsonFile').click();};
  document.getElementById('jsonFile').onchange=function(){
    var file=this.files&&this.files[0];if(!file)return;
    var input=this;
    file.text().then(function(text){adoptProject(JSON.parse(text));}).catch(function(){alert('无法读取 JSON');}).then(function(){input.value='';});
  };
  document.getElementById('archive').addEventListener('click',function(event){
    var id=event.target.getAttribute('data-open');if(!id)return;
    var item=archive.filter(function(entry){return entry.id===id;})[0];if(!item)return;
    adoptProject(item);
    if(item.videoKey)loadVideo(item.videoKey).then(function(blob){if(blob)return showVideo(blob,item.videoName||project.videoName);}).catch(function(error){reportVideo(error);alert(error.message||'无法恢复本机视频，请重新导入');});
  });

  document.getElementById('exportExcel').onclick=function(){
    if(!guardArchive()) return;
    var script=document.createElement('script');
    script.src='../vendor/exceljs-4.4.0.min.js?v=f4f230487d2d';
    script.onload=function(){exportWorkbook();};
    if(window.ExcelJS)exportWorkbook();else document.head.appendChild(script);
  };
  function flowLabel(id){var item=flowById(id);return item?item.label:'';}
  function exportWorkbook(){
    var workbook=new ExcelJS.Workbook();
    var details=workbook.addWorksheet('动作明细');
    details.addRow(['序号','区域','动作描述','开始(秒)','结束(秒)','时长(秒)','流程','VSM','ECRS','改善方向']);
    var index=0;
    (project.regions||[]).forEach(function(region){
      (region.actions||[]).forEach(function(action){
        index+=1;
        details.addRow([index,region.title,action.description,action.start,action.end,duration(action),flowLabel(action.flow),VSM[action.value]||'',ECRS[action.ecrs]||'',action.direction]);
      });
    });
    var stats=workbook.addWorksheet('时间统计');
    var summary=combinedStats();
    var total=summary.total;
    stats.addRow(['项目字段','值']);project.fields.forEach(function(field){stats.addRow([field.label,field.value]);});
    stats.addRow([]);stats.addRow(['VSM','时长(秒)','占比']);
    ['customer','business','necessary','waste'].forEach(function(key){
      var amount=summary.buckets[key]||0;
      stats.addRow([VSM[key],amount,total?amount/total:0]);
    });
    stats.addRow(['总 CT',total,1]);
    stats.addRow([]);stats.addRow(['流程','时长(秒)','占比']);
    FLOW.forEach(function(item){
      var amount=summary.flows[item.id]||0;
      stats.addRow([item.label,amount,total?amount/total:0]);
    });
    var records=workbook.addWorksheet('ECRS改善记录');
    records.addRow(['区域','动作','VSM','流程','ECRS','改善方向','时长(秒)']);
    (project.regions||[]).forEach(function(region){
      (region.actions||[]).forEach(function(action){records.addRow([region.title,action.description,VSM[action.value]||'',flowLabel(action.flow),ECRS[action.ecrs]||'',action.direction,duration(action)]);});
    });
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
