/* Sheet tools for the product workbook.
   Images: the shipped Univer 1.4.0 bundle does not register the open-source
   @univerjs/preset-sheets-drawing plugin (Apache-2.0). Rebuilding that preset
   into the shared bundle would change the desktop editor, so images are stored
   with the workbook and drawn over the sheet, then written through ExcelJS.
   AI: Univer's spreadsheet agent is a Pro feature (license + Universer). This
   panel calls an OpenAI-compatible endpoint configured on this device only. */
(function(){
  if(!document.getElementById('wbSheetToolsStyle')){
    var style=document.createElement('style');style.id='wbSheetToolsStyle';
    style.textContent='#wbImageLayer{position:absolute;inset:0;pointer-events:none;z-index:4}.wb-sheet-image{position:absolute;padding:0;border:1px solid rgba(36,86,230,.45);background:#fff;pointer-events:auto;cursor:grab}.wb-sheet-image img{width:100%;height:100%;object-fit:cover;display:block}.wb-sheet-image-ops{position:absolute;left:0;right:0;bottom:0;display:flex;gap:4px;background:rgba(23,26,33,.72);color:#fff;font-size:11px}.wb-sheet-image-ops i{flex:1;font-style:normal;text-align:center}.wb-history-dialog,.wb-agent-panel{position:absolute;z-index:20;color:#171a21}.wb-history-dialog{inset:0;background:rgba(15,18,30,.35);display:flex;align-items:center;justify-content:center;padding:16px}.wb-history-card,.wb-agent-panel{background:#fff;border-radius:14px;padding:16px;width:min(460px,100%);box-shadow:0 16px 50px rgba(15,18,30,.2)}.wb-history-list{max-height:280px;overflow:auto;margin:10px 0}.wb-history-item{display:flex;justify-content:space-between;width:100%;margin:0 0 6px;padding:8px 10px;border:1px solid #dfe4ec;border-radius:8px;background:#fff;cursor:pointer}.wb-history-actions{display:flex;gap:8px;flex-wrap:wrap}.wb-agent-panel{top:64px;right:16px;width:min(360px,calc(100% - 32px))} .wb-agent-panel input,.wb-agent-panel textarea{width:100%;margin:4px 0 8px;padding:8px;border:1px solid #dfe4ec;border-radius:8px}.wb-agent-panel pre{white-space:pre-wrap;font-size:12px}';
    document.head.appendChild(style);
  }
  var AGENT_KEY='wb_sheet_agent_v1';
  var HISTORY_LIMIT=8;
  var HISTORY_BYTES=1800000;
  var FIELD_KEYS=['fieldSchema','fieldValues','fieldResults','fieldArchive','pn','name','spec','workHours','productCategory','projectCategory','version','date','modifiedBy','totalManpower','totalBomHours','productStatus'];

  function clone(value){return JSON.parse(JSON.stringify(value));}
  function uid(){return typeof window.uid==='function'?window.uid():Date.now().toString(36)+Math.random().toString(36).slice(2,8);}
  function stamp(){return typeof now==='function'?now():new Date().toISOString();}
  function engine(){return window._productWorkbookEngine||null;}
  function imagesOf(target){
    if(!target)return [];
    if(target.extras)return target.extras.workbenchImages||(target.extras.workbenchImages=[]);
    return target.workbenchImages||(target.workbenchImages=[]);
  }

  function recordProductWorkbookHistory(draft){
    if(!draft||!draft.workbookSnapshot)return;
    var fields={};
    FIELD_KEYS.forEach(function(key){if(draft[key]!==undefined)fields[key]=clone(draft[key]);});
    var entry={id:uid(),savedAt:stamp(),workbookSnapshot:clone(draft.workbookSnapshot),fields:fields};
    var list=Array.isArray(draft.workbookHistory)?draft.workbookHistory.slice():[];
    list.push(entry);
    while(list.length>HISTORY_LIMIT)list.shift();
    while(list.length>1&&JSON.stringify(list).length>HISTORY_BYTES)list.shift();
    draft.workbookHistory=list;
  }

  function activeSheet(eng){
    var book=eng&&eng.univerAPI&&eng.univerAPI.getActiveWorkbook&&eng.univerAPI.getActiveWorkbook();
    return book&&book.getActiveSheet?book.getActiveSheet():null;
  }
  function sheetId(sheet){return sheet&&sheet.getSheetId?sheet.getSheetId():'';}
  function activeCell(sheet){
    var range=sheet&&sheet.getActiveRange&&sheet.getActiveRange();
    var row=range&&range.getRow?range.getRow():0;
    var col=range&&range.getColumn?range.getColumn():0;
    return {row:row||0,column:col||0};
  }
  function gridCanvas(doc){
    var list=Array.prototype.slice.call(doc.querySelectorAll('canvas'));
    list.sort(function(a,b){return (b.getBoundingClientRect().width*b.getBoundingClientRect().height)-(a.getBoundingClientRect().width*a.getBoundingClientRect().height);});
    return list[0]||null;
  }
  function cellOrigin(eng,row,col){
    var frame=eng.iframe,doc=frame.contentDocument,canvas=gridCanvas(doc),sheet=activeSheet(eng);
    if(!canvas||!sheet)return null;
    var rect=sheet.getRange(row,col).getCellRect();
    var host=document.getElementById('productWorkbookHost').getBoundingClientRect();
    var fr=frame.getBoundingClientRect(),cr=canvas.getBoundingClientRect();
    return {x:fr.left-host.left+cr.left+rect.left,y:fr.top-host.top+cr.top+rect.top,w:rect.width,h:rect.height};
  }

  function resizeImage(file){
    return new Promise(function(resolve,reject){
      var reader=new FileReader();
      reader.onerror=function(){reject(new Error('图片读取失败'));};
      reader.onload=function(){
        var image=new Image();
        image.onload=function(){
          var scale=Math.min(1,960/Math.max(image.width,image.height));
          var canvas=document.createElement('canvas');
          canvas.width=Math.max(1,Math.round(image.width*scale));
          canvas.height=Math.max(1,Math.round(image.height*scale));
          canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
          var mime=file.type==='image/png'?'image/png':'image/jpeg';
          resolve({dataUrl:canvas.toDataURL(mime,0.82),mime:mime,width:Math.min(160,canvas.width),height:Math.min(120,canvas.height)});
        };
        image.onerror=function(){reject(new Error('图片无法解码'));};
        image.src=reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function addImage(file,mode){
    var eng=engine();if(!eng||!eng.ready){if(typeof toast==='function')toast('请等待表格打开');return;}
    var sheet=activeSheet(eng);if(!sheet)return;
    var cell=activeCell(sheet);
    resizeImage(file).then(function(picture){
      var list=imagesOf(eng);
      var same=list.filter(function(item){return item.sheetId===sheetId(sheet)&&item.mode==='cell'&&item.row===cell.row&&item.column===cell.column;}).length;
      list.push({id:uid(),sheetId:sheetId(sheet),mode:mode==='float'?'float':'cell',row:cell.row,column:cell.column,dx:mode==='float'?12:same*28,dy:mode==='float'?12:4,w:picture.width,h:picture.height,mime:picture.mime,dataUrl:picture.dataUrl});
      renderImages();
      if(typeof toast==='function')toast(mode==='float'?'已添加浮动图片':'已嵌入单元格图片');
    }).catch(function(error){if(typeof toast==='function')toast(error.message||'图片添加失败');});
  }

  function renderImages(){
    var eng=engine(),host=document.getElementById('productWorkbookHost'),layer=document.getElementById('wbImageLayer');
    if(!eng||!host)return;
    if(!layer){layer=document.createElement('div');layer.id='wbImageLayer';host.appendChild(layer);}
    host.style.position='relative';
    var sheet=activeSheet(eng),current=sheetId(sheet);
    layer.innerHTML='';
    imagesOf(eng).forEach(function(item){
      if(item.sheetId!==current)return;
      var origin=cellOrigin(eng,item.row,item.column);if(!origin)return;
      var node=document.createElement('button');
      node.type='button';node.className='wb-sheet-image'+(item.mode==='float'?' is-float':'');
      node.style.left=(origin.x+(item.dx||0))+'px';
      node.style.top=(origin.y+(item.dy||0))+'px';
      node.style.width=item.w+'px';node.style.height=item.h+'px';
      node.innerHTML='<img alt="" src="'+item.dataUrl+'"><span class="wb-sheet-image-ops"><i data-act="mode">'+(item.mode==='float'?'嵌入':'浮动')+'</i><i data-act="delete">删除</i></span>';
      node.querySelector('[data-act="mode"]').addEventListener('click',function(event){event.stopPropagation();item.mode=item.mode==='float'?'cell':'float';renderImages();});
      node.querySelector('[data-act="delete"]').addEventListener('click',function(event){event.stopPropagation();eng.extras.workbenchImages=imagesOf(eng).filter(function(image){return image.id!==item.id;});renderImages();});
      if(item.mode==='float'){
        node.addEventListener('pointerdown',function(event){
          if(event.target.closest('.wb-sheet-image-ops'))return;
          var startX=event.clientX,startY=event.clientY,dx=item.dx||0,dy=item.dy||0;
          function move(ev){item.dx=dx+ev.clientX-startX;item.dy=dy+ev.clientY-startY;node.style.left=(origin.x+item.dx)+'px';node.style.top=(origin.y+item.dy)+'px';}
          function up(){document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);}
          document.addEventListener('pointermove',move);document.addEventListener('pointerup',up);
        });
      }
      layer.appendChild(node);
    });
  }

  function installPaste(eng){
    var doc=eng.iframe&&eng.iframe.contentDocument;if(!doc||doc.__wbImagePaste)return;doc.__wbImagePaste=true;
    doc.addEventListener('paste',function(event){
      var files=event.clipboardData&&event.clipboardData.files;
      if(!files||!files.length)return;
      var images=Array.prototype.filter.call(files,function(file){return /^image\//.test(file.type);});
      if(!images.length)return;
      event.preventDefault();event.stopPropagation();
      images.forEach(function(file){addImage(file,'cell');});
    },true);
  }

  function pickImage(mode){
    var input=document.createElement('input');input.type='file';input.accept='image/*';
    input.onchange=function(){if(input.files&&input.files[0])addImage(input.files[0],mode);};
    input.click();
  }

  function extensionOf(mime){return mime==='image/png'?'png':mime==='image/gif'?'gif':'jpeg';}
  function rawBase64(dataUrl){var comma=String(dataUrl||'').indexOf(',');return comma>=0?dataUrl.slice(comma+1):String(dataUrl||'');}
  window.wbExcelAttachImages=function(workbook,snapshot){
    var images=snapshot&&snapshot.workbenchImages||[];if(!images.length||!workbook)return;
    var byName={};(workbook.worksheets||[]).forEach(function(sheet){byName[sheet.name]=sheet;});
    images.forEach(function(item){
      var source=snapshot.sheets&&snapshot.sheets[item.sheetId];
      var worksheet=source&&byName[source.name];if(!worksheet)return;
      var id=workbook.addImage({base64:rawBase64(item.dataUrl),extension:extensionOf(item.mime)});
      var col=item.column+(item.mode==='float'?(item.dx||0)/120:0),row=item.row+(item.mode==='float'?(item.dy||0)/28:0);
      worksheet.addImage(id,{tl:{col:col,row:row},ext:{width:item.w||80,height:item.h||60},editAs:item.mode==='float'?'absolute':'oneCell'});
    });
  };
  window.wbExcelReadImages=function(workbook,snapshot){
    var images=[],nameToId={};
    Object.keys(snapshot.sheets||{}).forEach(function(id){nameToId[snapshot.sheets[id].name]=id;});
    (workbook.worksheets||[]).forEach(function(worksheet){
      if(typeof worksheet.getImages!=='function')return;
      worksheet.getImages().forEach(function(item){
        var media=workbook.getImage&&workbook.getImage(item.imageId);
        var range=item.range||{},tl=range.tl||{},ext=range.ext||{};
        var col=Math.max(0,Math.floor(tl.nativeCol!=null?tl.nativeCol:tl.col||0));
        var row=Math.max(0,Math.floor(tl.nativeRow!=null?tl.nativeRow:tl.row||0));
        var buffer=media&&(media.buffer||media.base64);
        if(!buffer)return;
        var mime=media.extension==='png'?'image/png':'image/jpeg';
        images.push({id:uid(),sheetId:nameToId[worksheet.name]||'',mode:range.editAs==='absolute'?'float':'cell',row:row,column:col,dx:0,dy:0,w:Math.round(ext.width||80),h:Math.round(ext.height||60),mime:mime,dataUrl:'data:'+mime+';base64,'+buffer});
      });
    });
    return images;
  };

  function historyDialog(html){
    var old=document.getElementById('wbHistoryDialog');if(old)old.remove();
    var dialog=document.createElement('div');dialog.id='wbHistoryDialog';dialog.className='wb-history-dialog';dialog.innerHTML=html;
    document.getElementById('modalBox').appendChild(dialog);
    return dialog;
  }
  function applyVersion(entry){
    var draft=window._worktimeDraft;if(!draft||!entry)return;
    draft.workbookSnapshot=clone(entry.workbookSnapshot);
    FIELD_KEYS.forEach(function(key){if(entry.fields&&entry.fields[key]!==undefined)draft[key]=clone(entry.fields[key]);});
    if(typeof mountProductFieldEditor==='function')mountProductFieldEditor(draft);
    if(typeof initProductWorkbookEditor==='function')initProductWorkbookEditor(document.getElementById('productWorkbookHost'),draft).then(function(){if(window.installSheetTools)window.installSheetTools(engine());});
    if(typeof toast==='function')toast('已进入所选历史版本');
  }
  function openHistory(){
    var draft=window._worktimeDraft;if(!draft)return;
    var list=Array.isArray(draft.workbookHistory)?draft.workbookHistory:[];
    var rows=list.slice().reverse().map(function(entry){
      return '<button type="button" class="wb-history-item" data-id="'+entry.id+'"><strong>'+entry.savedAt.replace('T',' ').slice(0,19)+'</strong><span>保存结果</span></button>';
    }).join('')||'<p class="muted">还没有历史版本。成功保存后才会记入历史。</p>';
    var dialog=historyDialog('<div class="wb-history-card" role="dialog" aria-labelledby="wbHistoryTitle"><h3 id="wbHistoryTitle">历史版本</h3><p>只记录成功保存的结果。进入某一版本前，可以选择先保存当前内容。</p><div class="wb-history-list">'+rows+'</div><button type="button" class="btn" id="wbHistoryClose">关闭</button></div>');
    dialog.querySelector('#wbHistoryClose').onclick=function(){dialog.remove();};
    dialog.querySelectorAll('.wb-history-item').forEach(function(button){
      button.onclick=function(){
        var entry=list.filter(function(item){return item.id===button.getAttribute('data-id');})[0];
        var ask=historyDialog('<div class="wb-history-card" role="dialog"><h3>切换历史版本</h3><p>进入该版本前，是否先把当前内容保存为一个版本？未保存的修改不会自动进入历史。</p><div class="wb-history-actions"><button type="button" class="btn primary" id="wbHistorySave">保存并进入</button><button type="button" class="btn" id="wbHistorySkip">不保存并进入</button><button type="button" class="btn" id="wbHistoryCancel">取消</button></div></div>');
        ask.querySelector('#wbHistoryCancel').onclick=function(){ask.remove();};
        ask.querySelector('#wbHistorySkip').onclick=function(){ask.remove();dialog.remove();applyVersion(entry);};
        ask.querySelector('#wbHistorySave').onclick=function(){
          saveWorktimeProduct({keepOpen:true}).then(function(ok){if(ok===false)return;ask.remove();dialog.remove();applyVersion(entry);});
        };
      };
    });
  }

  function agentConfig(){try{return JSON.parse(localStorage.getItem(AGENT_KEY)||'{}');}catch(e){return {};}}
  function saveAgentConfig(config){localStorage.setItem(AGENT_KEY,JSON.stringify({endpoint:config.endpoint||'',model:config.model||'gpt-4o-mini',apiKey:config.apiKey||''}));}
  function sheetText(){
    var sheet=activeSheet(engine());if(!sheet)return '';
    var lines=[];
    for(var row=0;row<40;row++){
      var cells=[];
      for(var col=0;col<12;col++){
        var value=sheet.getRange(row,col).getValue();
        cells.push(value==null?'':String(value).replace(/\t/g,' '));
      }
      if(cells.join('').trim())lines.push(cells.join('\t'));
    }
    return lines.join('\n');
  }
  function applyAgentActions(actions){
    var book=engine().univerAPI.getActiveWorkbook();
    (actions||[]).forEach(function(action){
      if(!action||!action.a1)return;
      var sheet=action.sheet?book.getSheetByName&&book.getSheetByName(action.sheet):book.getActiveSheet();
      sheet=sheet||book.getActiveSheet();
      var range=sheet.getRange(action.a1);
      if(action.formula)range.setValue(String(action.formula).charAt(0)==='='?String(action.formula):'='+action.formula);
      else if(action.value!==undefined)range.setValue(action.value);
    });
  }
  function openAgent(){
    var config=agentConfig();
    var old=document.getElementById('wbAgentPanel');if(old){old.remove();return;}
    function attr(value){return String(value==null?'':value).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];});}
    var panel=document.createElement('aside');panel.id='wbAgentPanel';panel.className='wb-agent-panel';
    panel.innerHTML='<h3>表格助手</h3><p class="muted">Univer 官方表格 AI 属于 Pro，需要许可证和 Universer 服务，GitHub Pages 不能托管。这里使用你自己的 OpenAI 兼容接口，密钥只存在这台设备，不进入云端同步。</p><label>接口地址<input id="wbAgentEndpoint" value="'+attr(config.endpoint||'https://api.openai.com/v1/chat/completions')+'"></label><label>模型<input id="wbAgentModel" value="'+attr(config.model||'gpt-4o-mini')+'"></label><label>API Key<input id="wbAgentKey" type="password" autocomplete="off" value="'+attr(config.apiKey||'')+'"></label><textarea id="wbAgentPrompt" rows="4" placeholder="例如：把 A 列的数量和 B 列的单价相乘，结果写到 C 列"></textarea><div class="wb-history-actions"><button type="button" class="btn primary" id="wbAgentSend">发送</button><button type="button" class="btn" id="wbAgentClose">关闭</button></div><pre id="wbAgentReply"></pre>';
    document.getElementById('modalBox').appendChild(panel);
    panel.querySelector('#wbAgentClose').onclick=function(){panel.remove();};
    panel.querySelector('#wbAgentSend').onclick=function(){
      var endpoint=panel.querySelector('#wbAgentEndpoint').value.trim();
      var model=panel.querySelector('#wbAgentModel').value.trim()||'gpt-4o-mini';
      var apiKey=panel.querySelector('#wbAgentKey').value;
      saveAgentConfig({endpoint:endpoint,model:model,apiKey:apiKey});
      var reply=panel.querySelector('#wbAgentReply');
      if(!endpoint||!apiKey){reply.textContent='请先填写接口地址和 API Key。密钥只保存在本机 localStorage。';return;}
      reply.textContent='正在处理…';
      var system='你是电子表格数据处理专家。只返回 JSON：{"message":"说明","actions":[{"a1":"C2","value":123},{"a1":"D2","formula":"=A2*B2","sheet":"工序"}]}。不要返回 Markdown。actions 可为空。';
      fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+apiKey},body:JSON.stringify({model:model,temperature:0,messages:[{role:'system',content:system},{role:'user',content:'当前工作表：\n'+sheetText()+'\n\n要求：'+panel.querySelector('#wbAgentPrompt').value}]})}).then(function(response){if(!response.ok)throw new Error('接口返回 '+response.status);return response.json();}).then(function(data){
        var text=data&&data.choices&&data.choices[0]&&data.choices[0].message&&data.choices[0].message.content||'';
        var json=JSON.parse(String(text).replace(/^```json|```$/g,'').trim());
        applyAgentActions(json.actions||[]);
        reply.textContent=json.message||'已按返回的操作更新表格。';
      }).catch(function(error){reply.textContent=error.message||'助手请求失败';});
    };
  }

  function installSheetTools(eng){
    eng=eng||engine();if(!eng||eng.__wbSheetTools)return;eng.__wbSheetTools=true;
    if(!eng.extras.workbenchImages)eng.extras.workbenchImages=[];
    installPaste(eng);
    renderImages();
    eng.__wbImageTimer=setInterval(function(){if(engine()===eng)renderImages();else clearInterval(eng.__wbImageTimer);},700);
  }

  window.recordProductWorkbookHistory=recordProductWorkbookHistory;
  window.installSheetTools=installSheetTools;
  window.wbOpenHistoryPanel=openHistory;
  window.wbOpenAgentPanel=openAgent;
  window.wbAddPickedImage=function(mode){pickImage(mode);};
  window.wbSheetToolsReady=true;
})();
