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
    var doc=eng.iframe&&eng.iframe.contentDocument,canvas=doc&&gridCanvas(doc),sheet=activeSheet(eng);
    var root=doc&&(doc.getElementById('univerRoot')||doc.body);
    if(!canvas||!sheet||!root)return null;
    var rect;try{rect=sheet.getRange(row,col).getCellRect();}catch(error){return null;}
    if(!rect)return null;
    var canvasBox=canvas.getBoundingClientRect(),rootBox=root.getBoundingClientRect();
    return {x:canvasBox.left-rootBox.left+rect.left,y:canvasBox.top-rootBox.top+rect.top,w:rect.width,h:rect.height};
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

  var selectedImageId=null;
  var IMAGE_HANDLES=['nw','n','ne','e','se','s','sw','w'];
  var IMAGE_SVG='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M21 15.5l-4.5-4.5L7 20"/></svg>';
  function traceImage(name,item){
    if(typeof logOperation!=='function')return;
    logOperation('workbook_ui',{source:'image',command:'image.'+name,label:name,target:item?'r'+(item.row+1)+'c'+(item.column+1):''});
  }
  function sheetLimits(sheet){
    var rows=200,cols=26;
    try{if(sheet.getMaxRows)rows=sheet.getMaxRows();else if(sheet.getRowCount)rows=sheet.getRowCount();}catch(ignore){}
    try{if(sheet.getMaxColumns)cols=sheet.getMaxColumns();else if(sheet.getColumnCount)cols=sheet.getColumnCount();}catch(ignore){}
    return {rows:Math.max(1,rows||200),cols:Math.max(1,cols||26)};
  }
  function axisIndex(sheet,axis,local,limit){
    var lo=0,hi=Math.max(0,limit-1),guard=0;
    while(lo<=hi&&guard++<48){
      var mid=(lo+hi)>>1,rect;
      try{rect=sheet.getRange(axis==='row'?mid:0,axis==='col'?mid:0).getCellRect();}catch(error){return lo;}
      if(!rect)return lo;
      var start=axis==='col'?rect.left:rect.top,size=axis==='col'?rect.width:rect.height;
      if(local<start)hi=mid-1;
      else if(local>=start+(size||0))lo=mid+1;
      else return mid;
    }
    return Math.max(0,Math.min(limit-1,lo));
  }
  function cellAtClient(eng,clientX,clientY){
    var doc=eng.iframe&&eng.iframe.contentDocument,canvas=doc&&gridCanvas(doc),sheet=activeSheet(eng);
    if(!canvas||!sheet)return null;
    var box=canvas.getBoundingClientRect(),limits=sheetLimits(sheet);
    var localX=clientX-box.left,localY=clientY-box.top;
    var column=axisIndex(sheet,'col',localX,limits.cols),row=axisIndex(sheet,'row',localY,limits.rows);
    var origin=cellOrigin(eng,row,column);if(!origin)return {row:row,column:column,dx:0,dy:0};
    var root=doc.getElementById('univerRoot')||doc.body,rootBox=root.getBoundingClientRect();
    return {row:row,column:column,dx:Math.round(clientX-rootBox.left-origin.x),dy:Math.round(clientY-rootBox.top-origin.y)};
  }
  function imageBox(eng,item,origin){
    var floating=item.mode!=='cell'||item._drag;
    if(floating)return {left:origin.x+(item.dx||0),top:origin.y+(item.dy||0),w:Math.max(16,item.w||16),h:Math.max(16,item.h||16)};
    var maxW=Math.max(16,(origin.w||item.w)-4),maxH=Math.max(16,(origin.h||item.h)-4);
    var scale=Math.min(1,maxW/Math.max(1,item.w||1),maxH/Math.max(1,item.h||1));
    return {left:origin.x+2,top:origin.y+2,w:Math.max(16,Math.round((item.w||16)*scale)),h:Math.max(16,Math.round((item.h||16)*scale))};
  }
  function settleImage(eng,item){
    var origin=cellOrigin(eng,item.row,item.column);if(!origin)return;
    var doc=eng.iframe.contentDocument,root=doc.getElementById('univerRoot')||doc.body,rootBox=root.getBoundingClientRect();
    var hit=cellAtClient(eng,rootBox.left+origin.x+(item.dx||0)+2,rootBox.top+origin.y+(item.dy||0)+2);
    if(!hit)return;
    item.row=hit.row;item.column=hit.column;
    if(item.mode==='cell'){item.dx=2;item.dy=2;}
    else{item.dx=hit.dx;item.dy=hit.dy;}
  }
  function deleteImage(eng,item){
    if(!item)return;
    eng.extras.workbenchImages=imagesOf(eng).filter(function(image){return image.id!==item.id;});
    if(selectedImageId===item.id)selectedImageId=null;
    traceImage('delete',item);
    renderImages();
  }
  function showImageContextMenu(eng,item,clientX,clientY){
    var doc=eng.iframe.contentDocument;if(!doc)return;
    var old=doc.getElementById('wbImageMenu');if(old)old.remove();
    var menu=doc.createElement('div');menu.id='wbImageMenu';menu.className='wb-sheet-menu';menu.setAttribute('role','menu');
    menu.style.left=clientX+'px';menu.style.top=clientY+'px';
    var choices=item.mode==='cell'?[['转为浮动','float'],['删除','delete']]:[['嵌入单元格','cell'],['删除','delete']];
    choices.forEach(function(choice){
      var button=doc.createElement('button');button.type='button';button.textContent=choice[0];button.setAttribute('role','menuitem');
      button.addEventListener('click',function(event){
        event.preventDefault();event.stopPropagation();menu.remove();
        if(choice[1]==='delete'){deleteImage(eng,item);return;}
        if(choice[1]==='cell'){
          var hit=item._pointer?cellAtClient(eng,item._pointer.x,item._pointer.y):null;
          if(hit){item.row=hit.row;item.column=hit.column;}
          item.mode='cell';item.dx=2;item.dy=2;
          traceImage('embed',item);
        }else{item.mode='float';if(item.dx==null)item.dx=2;if(item.dy==null)item.dy=2;traceImage('float',item);}
        renderImages();
      });
      menu.appendChild(button);
    });
    doc.body.appendChild(menu);
    setTimeout(function(){doc.addEventListener('pointerdown',function close(event){if(!menu.contains(event.target)){menu.remove();doc.removeEventListener('pointerdown',close,true);}},true);},0);
  }
  function bindImageNode(eng,doc,node,item){
    node.addEventListener('pointerdown',function(event){
      if(event.button!==0)return;
      var handle=event.target.getAttribute&&event.target.getAttribute('data-handle');
      event.preventDefault();event.stopPropagation();
      if(node.setPointerCapture&&event.pointerId!=null){try{node.setPointerCapture(event.pointerId);}catch(ignore){}}
      selectedImageId=item.id;node.classList.add('is-selected');
      var origin=cellOrigin(eng,item.row,item.column);if(!origin)return;
      var startX=event.clientX,startY=event.clientY,startW=item.w||16,startH=item.h||16,startDx=item.dx||0,startDy=item.dy||0,ratio=startW/Math.max(1,startH);
      item._drag=true;
      function move(ev){
        var dw=ev.clientX-startX,dh=ev.clientY-startY,w=startW,h=startH,dx=startDx,dy=startDy;
        if(handle){
          if(handle.indexOf('e')>=0)w=startW+dw;
          if(handle.indexOf('s')>=0)h=startH+dh;
          if(handle.indexOf('w')>=0){w=startW-dw;dx=startDx+dw;}
          if(handle.indexOf('n')>=0){h=startH-dh;dy=startDy+dh;}
          if(handle.length===2&&!ev.shiftKey){
            if(Math.abs(dw)>=Math.abs(dh))h=w/ratio;else w=h*ratio;
            if(handle.indexOf('w')>=0)dx=startDx+(startW-w);
            if(handle.indexOf('n')>=0)dy=startDy+(startH-h);
          }
          item.w=Math.max(16,Math.round(w));item.h=Math.max(16,Math.round(h));item.dx=Math.round(dx);item.dy=Math.round(dy);
        }else{item.dx=Math.round(startDx+dw);item.dy=Math.round(startDy+dh);}
        var box=imageBox(eng,item,origin);
        node.style.left=box.left+'px';node.style.top=box.top+'px';node.style.width=box.w+'px';node.style.height=box.h+'px';
      }
      function up(){
        doc.removeEventListener('pointermove',move);doc.removeEventListener('pointerup',up);
        item._drag=false;settleImage(eng,item);traceImage(handle?'resize':'move',item);renderImages();
      }
      doc.addEventListener('pointermove',move);doc.addEventListener('pointerup',up);
    });
    node.addEventListener('contextmenu',function(event){
      event.preventDefault();event.stopPropagation();
      selectedImageId=item.id;item._pointer={x:event.clientX,y:event.clientY};
      showImageContextMenu(eng,item,event.clientX,event.clientY);
      renderImages();
    });
  }
  function addImage(file,mode){
    var eng=engine();if(!eng||!eng.ready){if(typeof toast==='function')toast('请等待表格打开');return;}
    var sheet=activeSheet(eng);if(!sheet)return;
    var cell=activeCell(sheet);
    if(typeof logOperation==='function')logOperation('file_import',{source:'image',fileName:String(file.name||'').split(/[\\/]/).pop(),fileSize:file.size||0,fileType:file.type||'',count:1});
    resizeImage(file).then(function(picture){
      var item={id:uid(),sheetId:sheetId(sheet),mode:mode==='cell'?'cell':'float',row:cell.row,column:cell.column,dx:8,dy:8,w:picture.width,h:picture.height,mime:picture.mime,dataUrl:picture.dataUrl};
      imagesOf(eng).push(item);selectedImageId=item.id;renderImages();traceImage('insert',item);
      if(typeof toast==='function')toast(item.mode==='float'?'已添加浮动图片':'已嵌入单元格图片');
    }).catch(function(error){if(typeof toast==='function')toast(error.message||'图片添加失败');});
  }

  function renderImages(){
    var eng=engine(),doc=eng&&eng.iframe&&eng.iframe.contentDocument,root=doc&&doc.getElementById('univerRoot');
    if(!eng||!doc||!root)return;
    var layer=doc.getElementById('wbImageLayer');
    if(!layer){layer=doc.createElement('div');layer.id='wbImageLayer';doc.body.appendChild(layer);}
    var rootBox=root.getBoundingClientRect();
    layer.style.left=rootBox.left+'px';layer.style.top=rootBox.top+'px';layer.style.width=rootBox.width+'px';layer.style.height=rootBox.height+'px';
    var sheet=activeSheet(eng),current=sheetId(sheet),seen={};
    imagesOf(eng).forEach(function(item){
      if(!item||typeof item.dataUrl!=='string'||!item.dataUrl||(item.sheetId&&item.sheetId!==current))return;
      if(!item.id)item.id=uid();
      if(item.row==null)item.row=0;
      if(item.column==null)item.column=0;
      if(item.mode!=='cell')item.mode='float';
      var origin=cellOrigin(eng,item.row,item.column);if(!origin)return;
      seen[item.id]=true;
      var box=imageBox(eng,item,origin);
      var node=layer.querySelector('[data-image-id="'+item.id+'"]');
      if(!node){
        node=doc.createElement('div');
        node.className='wb-sheet-image';node.setAttribute('data-image-id',item.id);
        node.innerHTML='<img alt="" draggable="false" src="'+item.dataUrl+'">'+IMAGE_HANDLES.map(function(handle){return '<i data-handle="'+handle+'"></i>';}).join('');
        bindImageNode(eng,doc,node,item);
        layer.appendChild(node);
      }
      node.setAttribute('data-mode',item.mode||'float');
      node.classList.toggle('is-selected',selectedImageId===item.id);
      node.classList.toggle('is-float',item.mode!=='cell');
      if(node.style.left!==box.left+'px')node.style.left=box.left+'px';
      if(node.style.top!==box.top+'px')node.style.top=box.top+'px';
      if(node.style.width!==box.w+'px')node.style.width=box.w+'px';
      if(node.style.height!==box.h+'px')node.style.height=box.h+'px';
    });
    Array.prototype.forEach.call(layer.querySelectorAll('[data-image-id]'),function(node){if(!seen[node.getAttribute('data-image-id')])node.remove();});
  }

  function iframeStyle(doc){
    if(doc.getElementById('wbImageStyle'))return;
    var style=doc.createElement('style');style.id='wbImageStyle';
    style.textContent='#univerRoot{position:relative}#wbImageLayer{position:fixed;pointer-events:none;z-index:30}#wbRibbonBar{position:fixed;z-index:40;display:flex;gap:2px;align-items:center}#wbInsertImage{position:fixed;z-index:45;display:inline-flex;align-items:center;justify-content:center;padding:0;border:0;border-radius:6px;background:transparent;color:#1f2329;cursor:pointer}#wbInsertImage[hidden]{display:none!important}#wbInsertImage:hover{background:#f2f3f5}.wb-sheet-image{position:absolute;padding:0;border:1px solid transparent;background:transparent;pointer-events:auto;overflow:visible;box-sizing:border-box;cursor:grab;touch-action:none}.wb-sheet-image.is-selected{border-color:#1a73e8;z-index:2;cursor:move}.wb-sheet-image img{width:100%;height:100%;object-fit:contain;display:block;pointer-events:none}.wb-sheet-image i[data-handle]{display:none;position:absolute;width:7px;height:7px;background:#fff;border:1px solid #1a73e8;box-sizing:border-box}.wb-sheet-image.is-selected i[data-handle]{display:block}.wb-sheet-image i[data-handle="nw"]{left:-4px;top:-4px;cursor:nwse-resize}.wb-sheet-image i[data-handle="n"]{left:calc(50% - 3px);top:-4px;cursor:ns-resize}.wb-sheet-image i[data-handle="ne"]{right:-4px;top:-4px;cursor:nesw-resize}.wb-sheet-image i[data-handle="e"]{right:-4px;top:calc(50% - 3px);cursor:ew-resize}.wb-sheet-image i[data-handle="se"]{right:-4px;bottom:-4px;cursor:nwse-resize}.wb-sheet-image i[data-handle="s"]{left:calc(50% - 3px);bottom:-4px;cursor:ns-resize}.wb-sheet-image i[data-handle="sw"]{left:-4px;bottom:-4px;cursor:nesw-resize}.wb-sheet-image i[data-handle="w"]{left:-4px;top:calc(50% - 3px);cursor:ew-resize}.wb-sheet-menu{position:fixed;z-index:90;min-width:148px;background:#fff;border:1px solid #e3e5e8;border-radius:8px;box-shadow:0 8px 24px rgba(32,32,32,.16);padding:4px;color:#1f2329;font:13px/20px Microsoft YaHei,Arial,sans-serif}.wb-sheet-menu button{display:block;width:100%;text-align:left;border:0;background:transparent;padding:6px 10px;border-radius:6px;cursor:pointer;color:#1f2329}.wb-sheet-menu button:hover{background:#f2f3f5}';
    doc.head.appendChild(style);
  }
  function ribbonTabs(doc){return Array.prototype.slice.call(doc.querySelectorAll('button[role="tab"]'));}
  function placeRibbonBar(eng){
    var doc=eng.iframe&&eng.iframe.contentDocument,bar=doc&&doc.getElementById('wbRibbonBar');
    if(!bar)return;
    var tabs=ribbonTabs(doc).filter(function(button){return !button.hasAttribute('data-wb-ribbon');});
    var last=tabs[tabs.length-1],sample=tabs.filter(function(button){return button.getAttribute('aria-selected')!=='true';})[0]||tabs[0];
    if(!last){bar.style.visibility='hidden';return;}
    if(sample)Array.prototype.forEach.call(bar.children,function(button){if(button.className!==sample.className)button.className=sample.className;});
    var box=last.getBoundingClientRect();
    bar.style.visibility='visible';
    bar.style.left=Math.round(box.right+8)+'px';
    bar.style.top=Math.round(box.top)+'px';
  }
  function mountRibbon(eng){
    var doc=eng.iframe&&eng.iframe.contentDocument;if(!doc||doc.getElementById('wbRibbonBar'))return;
    var bar=doc.createElement('div');
    bar.id='wbRibbonBar';bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','工作簿工具');
    [['历史','历史版本',openHistory],['AI','表格助手',openAgent],['导出','导出 Excel',function(){if(typeof exportProductEditorExcel==='function')exportProductEditorExcel();}],['导入','导入 Excel',function(){var input=document.getElementById('productExcelFile');if(input)input.click();}]].forEach(function(item){
      var button=doc.createElement('button');
      button.type='button';button.title=item[1];button.textContent=item[0];button.setAttribute('data-wb-ribbon',item[0]);
      button.addEventListener('click',function(event){event.preventDefault();event.stopPropagation();item[2]();});
      bar.appendChild(button);
    });
    doc.body.appendChild(bar);
    if(!doc.__wbInsertImage){
      doc.__wbInsertImage=true;
      doc.addEventListener('click',function(event){
        var button=event.target&&event.target.closest&&event.target.closest('button[role="tab"]');
        if(!button)return;
        if((button.getAttribute('title')||button.textContent||'').trim()!=='插入')return;
        setTimeout(function(){if(engine()===eng)scheduleInsertImageButton(eng);},40);
      },true);
      doc.addEventListener('pointerdown',function(event){
        if(event.target.closest&&(event.target.closest('.wb-sheet-image')||event.target.closest('.wb-sheet-menu')||event.target.closest('#wbInsertImage')))return;
        if(!selectedImageId)return;
        selectedImageId=null;renderImages();
      },true);
      doc.addEventListener('keydown',function(event){
        if(event.key!=='Delete'&&event.key!=='Backspace')return;
        var node=event.target;if(node&&node.nodeType===3)node=node.parentElement;
        if(node&&node.closest&&node.closest('[contenteditable="true"],input,textarea'))return;
        if(eng.pendingEdit)return;
        var item=imagesOf(eng).filter(function(image){return image.id===selectedImageId;})[0];
        if(!item)return;
        event.preventDefault();event.stopPropagation();
        deleteImage(eng,item);
      },true);
    }
    placeRibbonBar(eng);
    placeInsertImageButton(eng);
  }
  function controlName(node){return ((node&&(node.getAttribute('aria-label')||node.getAttribute('title')||node.textContent))||'').replace(/\s+/g,' ').trim();}
  function placeInsertImageButton(eng){
    var doc=eng.iframe&&eng.iframe.contentDocument;if(!doc)return;
    var buttons=Array.prototype.slice.call(doc.querySelectorAll('button'));
    var main=buttons.filter(function(button){return controlName(button)==='图标集'&&button.offsetWidth>0;})[0];
    var more=main&&main.nextElementSibling;
    var anchor=more&&controlName(more).indexOf('图标集')===0&&more.offsetWidth>0?more:main;
    var placeBefore=false;
    if(!anchor){anchor=buttons.filter(function(button){return controlName(button)==='更多'&&button.offsetWidth>0;}).pop();placeBefore=!!anchor;}
    var button=doc.getElementById('wbInsertImage');
    if(!button){
      button=doc.createElement('button');
      button.id='wbInsertImage';button.type='button';button.title='插入图片';button.setAttribute('aria-label','插入图片');
      button.innerHTML=IMAGE_SVG;
      button.addEventListener('click',function(event){event.preventDefault();event.stopPropagation();pickImage('float');});
      doc.body.appendChild(button);
    }
    if(!anchor){button.hidden=true;return;}
    var pre=anchor.getBoundingClientRect();
    if(pre.left<0||pre.right>(doc.documentElement.clientWidth||0)-8){try{anchor.scrollIntoView({block:'nearest',inline:'nearest'});}catch(ignore){}}
    button.hidden=false;
    var box=anchor.getBoundingClientRect(),host=(main||anchor).getBoundingClientRect();
    button.style.left=Math.round((placeBefore?box.left-host.width-6:box.right+6))+'px';
    button.style.top=Math.round(host.top)+'px';
    button.style.width=Math.round(host.width)+'px';
    button.style.height=Math.round(host.height)+'px';
  }
  function scheduleInsertImageButton(eng){
    var tries=0;
    (function tick(){
      if(engine()!==eng)return;
      placeInsertImageButton(eng);
      var doc=eng.iframe&&eng.iframe.contentDocument,button=doc&&doc.getElementById('wbInsertImage');
      if(button&&!button.hidden)return;
      if(++tries<15)setTimeout(tick,80);
    })();
  }
  function installPaste(eng){
    var doc=eng.iframe&&eng.iframe.contentDocument;if(!doc||doc.__wbImagePaste)return;doc.__wbImagePaste=true;
    doc.addEventListener('paste',function(event){
      var files=event.clipboardData&&event.clipboardData.files;
      if(!files||!files.length)return;
      var images=Array.prototype.filter.call(files,function(file){return /^image\//.test(file.type);});
      if(!images.length)return;
      event.preventDefault();event.stopPropagation();
      images.forEach(function(file){addImage(file,'float');});
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
    try{
      eng=eng||engine();if(!eng||eng.__wbSheetTools||!eng.iframe)return;eng.__wbSheetTools=true;
      if(!eng.extras)eng.extras={};if(!eng.extras.workbenchImages)eng.extras.workbenchImages=[];
      iframeStyle(eng.iframe.contentDocument);
      installPaste(eng);
      mountRibbon(eng);
      if(imagesOf(eng).length)renderImages();
      var doc=eng.iframe.contentDocument;
      if(doc&&!doc.__wbImageRefresh){
        doc.__wbImageRefresh=true;
        doc.addEventListener('scroll',function(){try{if(engine()===eng&&imagesOf(eng).length)renderImages();}catch(ignore){}},true);
      }
      eng.__wbImageTimer=setInterval(function(){
        try{
          if(engine()!==eng){clearInterval(eng.__wbImageTimer);return;}
          placeRibbonBar(eng);
          placeInsertImageButton(eng);
          if(imagesOf(eng).length)renderImages();
        }catch(ignore){}
      },1000);
    }catch(error){if(typeof logOperation==='function'){var detail=typeof operationFaultDetail==='function'?operationFaultDetail(error):{status:'failed',message:error&&error.message};detail.source='image';detail.command='image.boot';logOperation('workbook_ui',detail);}}
  }

  window.recordProductWorkbookHistory=recordProductWorkbookHistory;
  window.installSheetTools=installSheetTools;
  window.wbOpenHistoryPanel=openHistory;
  window.wbOpenAgentPanel=openAgent;
  window.wbAddPickedImage=function(){pickImage('float');};
  window.wbSheetToolsReady=true;
})();
