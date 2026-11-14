(function(){
  var SPEEDS=[0.25,0.5,1,2,3,4];
  var VALUE={value:'增值',necessary:'必要非增值',waste:'浪费'};
  var ECRS={E:'取消(E)',C:'合并(C)',R:'重排(R)',S:'简化(S)'};
  var project={id:'ecrs_'+Date.now().toString(36),title:'未命名项目',videoName:'',videoKey:'',fps:30,fields:[
    {id:'model',label:'产品型号',value:'',required:true},
    {id:'process',label:'工序',value:'',required:true},
    {id:'operator',label:'作业员编号',value:'',required:false},
    {id:'date',label:'拍摄日期',value:'',required:true},
    {id:'workshop',label:'车间',value:'',required:false}
  ],actions:[]};
  var archive=[];
  var player=document.getElementById('player');

  function uid(){return 'a'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);}
  function clone(value){return JSON.parse(JSON.stringify(value));}
  function payload(){var data=clone(project);delete data.videoKey;return data;}
  function duration(action){return action.end==null||action.start==null?0:Math.max(0,action.end-action.start);}
  function fmt(seconds){return (Number(seconds)||0).toFixed(2)+'s';}

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
    var total=project.actions.reduce(function(sum,action){return sum+duration(action);},0);
    var buckets={value:0,necessary:0,waste:0};
    project.actions.forEach(function(action){buckets[action.value]=(buckets[action.value]||0)+duration(action);});
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
    project.actions.forEach(function(action){if(action.id!==id)return;if(event.target.hasAttribute('data-desc'))action.description=event.target.value;else action.direction=event.target.value;});
  });
  document.getElementById('table').addEventListener('change',function(event){
    var valueId=event.target.getAttribute('data-value'),ecrsId=event.target.getAttribute('data-ecrs');
    project.actions.forEach(function(action){
      if(action.id===valueId)action.value=event.target.value;
      if(action.id===ecrsId)action.ecrs=event.target.value;
    });
    renderTimeline();renderStats();
  });
  document.getElementById('table').addEventListener('click',function(event){
    var id=event.target.getAttribute('data-del');if(!id)return;
    project.actions=project.actions.filter(function(action){return action.id!==id;});render();
  });

  function mimeFor(name,fallback){
    var lower=String(name||'').toLowerCase();
    if(lower.endsWith('.webm'))return 'video/webm';
    if(lower.endsWith('.ogg')||lower.endsWith('.ogv'))return 'video/ogg';
    if(lower.endsWith('.mp4')||lower.endsWith('.m4v'))return 'video/mp4';
    return fallback&&fallback.indexOf('video/')===0?fallback:'video/mp4';
  }
  function showVideo(blob,name){
    if(!blob)return Promise.reject(new Error('没有视频数据'));
    var type=blob.type&&blob.type.indexOf('video/')===0?blob.type:mimeFor(name,blob.type);
    var typed=blob.type===type?blob:new Blob([blob],{type:type});
    if(player._url)URL.revokeObjectURL(player._url);
    player._url=URL.createObjectURL(typed);
    player.preload='auto';player.playsInline=true;player.muted=false;
    player.src=player._url;
    player.load();
    return new Promise(function(resolve,reject){
      function done(){player.removeEventListener('loadeddata',done);player.removeEventListener('error',fail);resolve();}
      function fail(){player.removeEventListener('loadeddata',done);player.removeEventListener('error',fail);var code=player.error&&player.error.code;reject(new Error(code===4?'浏览器无法解码该视频，请使用 H.264 的 MP4 或 VP8/VP9 的 WebM':'视频加载失败'));}
      if(player.readyState>=2){resolve();return;}
      player.addEventListener('loadeddata',done);player.addEventListener('error',fail);
    });
  }
  document.getElementById('videoFile').onchange=function(){
    var file=this.files&&this.files[0];if(!file)return;
    project.videoName=file.name;project.videoKey='video_'+project.id+'_'+Date.now().toString(36);
    var typed=file.type&&file.type.indexOf('video/')===0?file:new File([file],file.name,{type:mimeFor(file.name)});
    showVideo(typed,file.name).catch(function(error){alert(error.message||'视频无法播放');});
    storeVideo(project.videoKey,typed).catch(function(){project.videoKey='';});
  };
  SPEEDS.forEach(function(speed){
    var button=document.createElement('button');button.type='button';button.className='btn';button.textContent=speed+'x';button.setAttribute('aria-pressed',speed===1?'true':'false');
    button.onclick=function(){player.playbackRate=speed;document.querySelectorAll('#speeds button').forEach(function(item){item.setAttribute('aria-pressed',item===button?'true':'false');});};
    document.getElementById('speeds').appendChild(button);
  });
  document.getElementById('play').onclick=function(){
    if(!player.currentSrc&&!player.src){alert('请先导入视频');return;}
    var pending=player.play();
    if(pending&&typeof pending.catch==='function')pending.catch(function(error){alert('无法播放：'+(error&&error.message?error.message:'浏览器拒绝了播放'));});
  };
  document.getElementById('pause').onclick=function(){player.pause();};
  function step(sign){var amount=Number(document.getElementById('nudge').value)||1/project.fps;player.pause();player.currentTime=Math.max(0,player.currentTime+sign*amount);render();}
  document.getElementById('back').onclick=function(){step(-1);};
  document.getElementById('forward').onclick=function(){step(1);};
  player.addEventListener('timeupdate',function(){document.getElementById('clock').textContent=fmt(player.currentTime||0);});
  player.addEventListener('loadedmetadata',renderTimeline);

  function newAction(start,end){return {id:uid(),description:'',start:start,end:end,value:'necessary',ecrs:'R',direction:''};}
  document.getElementById('markStart').onclick=function(){project.actions.push(newAction(player.currentTime,null));render();};
  document.getElementById('markEnd').onclick=function(){
    var open=null;project.actions.forEach(function(action){if(action.end==null)open=action;});
    if(!open){alert('没有未结束的动作');return;}
    open.end=Math.max(open.start,player.currentTime);render();
  };
  document.getElementById('markOther').onclick=function(){
    var time=player.currentTime;project.actions.push(newAction(time,time+0.5));render();
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
    file.text().then(function(text){project=JSON.parse(text);project.actions=project.actions||[];project.fields=project.fields||[];if(!project.id)project.id=uid();render();});
  };
  document.getElementById('archive').addEventListener('click',function(event){
    var id=event.target.getAttribute('data-open');if(!id)return;
    var item=archive.filter(function(entry){return entry.id===id;})[0];if(!item)return;
    project=clone(item);render();
    if(item.videoKey)loadVideo(item.videoKey).then(function(blob){if(blob)return showVideo(blob,item.videoName||project.videoName);}).catch(function(error){alert(error.message||'无法恢复本机视频，请重新导入');});
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
    var total=project.actions.reduce(function(sum,action){return sum+duration(action);},0);
    stats.addRow(['项目字段','值']);project.fields.forEach(function(field){stats.addRow([field.label,field.value]);});
    stats.addRow([]);stats.addRow(['分类','时长(秒)','占比']);
    ['value','necessary','waste'].forEach(function(key){
      var amount=project.actions.reduce(function(sum,action){return sum+(action.value===key?duration(action):0);},0);
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

  window.addEventListener('message',function(event){
    if(event.origin!==location.origin||!event.data||event.data.source!=='wb-host')return;
    if(event.data.type==='projects'&&Array.isArray(event.data.projects)){archive=event.data.projects;renderArchive();}
  });
  try{archive=JSON.parse(localStorage.getItem('wb_ecrs_archive')||'[]');}catch(e){archive=[];}
  parent.postMessage({source:'wb-ecrs',type:'request'},location.origin);
  render();
})();
