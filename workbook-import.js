(function(root, factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.WorkbookImport=api;
})(typeof globalThis!=='undefined'?globalThis:this, function(){
  var BORDER_NAMES=['none','thin','hair','dotted','dashed','dashDot','dashDotDot','double','medium','mediumDashed','mediumDashDot','mediumDashDotDot','slantDashDot','thick'];
  var INDEXED=['000000','FFFFFF','FF0000','00FF00','0000FF','FFFF00','FF00FF','00FFFF','000000','FFFFFF','FF0000','00FF00','0000FF','FFFF00','FF00FF','00FFFF','800000','008000','000080','808000','800080','008080','C0C0C0','808080','9999FF','993366','FFFFCC','CCFFFF','660066','FF8080','0066CC','CCCCFF','000080','FF00FF','FFFF00','00FFFF','800080','800000','008080','0000FF','00CCFF','CCFFFF','CCFFCC','FFFF99','99CCFF','FF99CC','CC99FF','FFCC99','3366FF','33CCCC','99CC00','FFCC00','FF9900','FF6600','666699','969696','003366','339966','003300','333300','993300','993366','333399','333333'];
  var GIST_FILE_LIMIT=900*1024;
  var SIDE_NAME={t:'top',b:'bottom',l:'left',r:'right'};

  function excelColor(color, palette){
    if(!color)return null;
    if(typeof color==='string')return {rgb:color.charAt(0)==='#'?color:'#'+color};
    var hex=null;
    if(color.argb)hex=String(color.argb).replace(/[^0-9a-f]/gi,'').slice(-6);
    else if(color.theme!=null&&palette&&palette[color.theme])hex=String(palette[color.theme]).replace('#','').slice(-6);
    else if(color.indexed!=null){
      var indexed=Number(color.indexed);
      if(indexed===64)hex='000000';
      else if(indexed===65)hex='FFFFFF';
      else if(INDEXED[indexed])hex=INDEXED[indexed];
    }
    if(!hex||hex.length<6)return null;
    hex=hex.slice(-6).toUpperCase();
    if(color.tint){
      var tint=Number(color.tint);
      if(tint)hex=[0,2,4].map(function(offset){var n=parseInt(hex.slice(offset,offset+2),16);var next=tint<0?n*(1+tint):n+(255-n)*tint;return Math.max(0,Math.min(255,Math.round(next))).toString(16).padStart(2,'0');}).join('').toUpperCase();
    }
    return {rgb:'#'+hex};
  }
  function borderSide(edge, palette){
    if(!edge||!edge.style||edge.style==='none')return null;
    var index=BORDER_NAMES.indexOf(edge.style);
    if(index<=0)return null;
    return {s:index, cl:excelColor(edge.color, palette)||{rgb:'#000000'}};
  }
  function cellBorder(cell){
    if(!cell)return null;
    return cell.border||(cell.style&&cell.style.border)||null;
  }
  function ensureCell(sheet, row, col){
    if(!sheet.cellData[row])sheet.cellData[row]={};
    if(!sheet.cellData[row][col])sheet.cellData[row][col]={};
    var data=sheet.cellData[row][col];
    if(!data.s||typeof data.s!=='object'||Array.isArray(data.s))data.s={};
    if(!data.s.bd||typeof data.s.bd!=='object')data.s.bd={};
    return data;
  }
  function applyMergeBorders(worksheet, sheet, palette){
    (sheet.mergeData||[]).forEach(function(range){
      if(!range||range.endRow<range.startRow||range.endColumn<range.startColumn)return;
      function read(row, col, key){
        var border=cellBorder(worksheet.getCell(row+1, col+1));
        return borderSide(border&&border[SIDE_NAME[key]], palette);
      }
      function along(key, horizontal){
        var found=null;
        if(horizontal){
          var row=key==='t'?range.startRow:range.endRow;
          for(var col=range.startColumn;col<=range.endColumn&&!found;col++)found=read(row, col, key);
        }else{
          var column=key==='l'?range.startColumn:range.endColumn;
          for(var r=range.startRow;r<=range.endRow&&!found;r++)found=read(r, column, key);
        }
        return found;
      }
      var sides={t:along('t', true),b:along('b', true),l:along('l', false),r:along('r', false)};
      if(!sides.t&&!sides.b&&!sides.l&&!sides.r)return;
      for(var row=range.startRow;row<=range.endRow;row++){
        for(var col=range.startColumn;col<=range.endColumn;col++){
          var edge=row===range.startRow||row===range.endRow||col===range.startColumn||col===range.endColumn;
          if(!edge)continue;
          var data=ensureCell(sheet, row, col);
          if(row===range.startRow&&sides.t)data.s.bd.t=sides.t;
          if(row===range.endRow&&sides.b)data.s.bd.b=sides.b;
          if(col===range.startColumn&&sides.l)data.s.bd.l=sides.l;
          if(col===range.endColumn&&sides.r)data.s.bd.r=sides.r;
        }
      }
    });
    return sheet;
  }
  function bytesToBase64(buffer){
    if(buffer==null)return '';
    if(typeof buffer==='string'){
      if(buffer.indexOf('data:')===0){var comma=buffer.indexOf(',');return comma>=0?buffer.slice(comma+1).replace(/\s/g,''):'';}
      var compact=buffer.replace(/\s/g,'');
      if(/^[A-Za-z0-9+/=]+$/.test(compact)&&compact.length>=4)return compact;
      var raw=new Uint8Array(buffer.length);
      for(var i=0;i<buffer.length;i++)raw[i]=buffer.charCodeAt(i)&255;
      return encodeBytes(raw);
    }
    if(typeof buffer.toString==='function'){
      try{
        var encoded=buffer.toString('base64');
        if(typeof encoded==='string'&&/^[A-Za-z0-9+/=\s]+$/.test(encoded)&&encoded.replace(/\s/g,'').length>=4)return encoded.replace(/\s/g,'');
      }catch(ignore){}
    }
    var view=null;
    if(typeof Uint8Array!=='undefined'&&buffer instanceof Uint8Array)view=buffer;
    else if(buffer.buffer&&typeof buffer.byteLength==='number')view=new Uint8Array(buffer.buffer, buffer.byteOffset||0, buffer.byteLength);
    else if(typeof buffer.length==='number'){
      view=new Uint8Array(buffer.length);
      for(var n=0;n<buffer.length;n++)view[n]=Number(buffer[n])&255;
    }
    return view?encodeBytes(view):'';
  }
  function encodeBytes(bytes){
    var parts=[];
    for(var i=0;i<bytes.length;i+=24576){
      var slice=bytes.subarray?bytes.subarray(i,i+24576):bytes.slice(i,i+24576);
      parts.push(String.fromCharCode.apply(null, slice));
    }
    return btoa(parts.join(''));
  }
  function imageMime(extension){
    var ext=String(extension||'').toLowerCase();
    if(ext==='png')return 'image/png';
    if(ext==='gif')return 'image/gif';
    if(ext==='jpg'||ext==='jpeg')return 'image/jpeg';
    return '';
  }
  function validDataUrl(value){
    return typeof value==='string'&&/^data:image\/(png|jpeg|gif);base64,[A-Za-z0-9+/=]+$/.test(value);
  }
  function columnPixels(sheet, col){
    var info=sheet&&sheet.columnData&&sheet.columnData[col];
    if(info&&typeof info.w==='number'&&info.w>0)return info.w;
    return (sheet&&sheet.defaultColumnWidth)||75;
  }
  function rowPixels(sheet, row){
    var info=sheet&&sheet.rowData&&sheet.rowData[row];
    if(info&&typeof info.h==='number'&&info.h>0)return info.h;
    return (sheet&&sheet.defaultRowHeight)||20;
  }
  function axisPixels(sheet, axis, index){return axis==='col'?columnPixels(sheet, index):rowPixels(sheet, index);}
  function spanPixels(sheet, axis, start, end){
    if(!(end>start))return 16;
    var a=Math.floor(start), b=Math.floor(end), size=0;
    size+=axisPixels(sheet, axis, a)*(1-(start-a));
    for(var i=a+1;i<b;i++)size+=axisPixels(sheet, axis, i);
    if(b>a)size+=axisPixels(sheet, axis, b)*(end-b);
    else size=axisPixels(sheet, axis, a)*(end-start);
    return size;
  }
  function placeDrawing(range, sheet){
    range=range||{};
    var tl=range.tl||{}, br=range.br||null, ext=range.ext||{};
    var colFrac=typeof tl.col==='number'?tl.col:(typeof tl.nativeCol==='number'?tl.nativeCol:0);
    var rowFrac=typeof tl.row==='number'?tl.row:(typeof tl.nativeRow==='number'?tl.nativeRow:0);
    var column=Math.max(0, Math.floor(colFrac));
    var row=Math.max(0, Math.floor(rowFrac));
    var width=br&&typeof br.col==='number'?spanPixels(sheet, 'col', colFrac, br.col):Number(ext.width)||80;
    var height=br&&typeof br.row==='number'?spanPixels(sheet, 'row', rowFrac, br.row):Number(ext.height)||60;
    return {
      mode:'float',
      row:row,
      column:column,
      dx:Math.max(0, Math.round((colFrac-column)*columnPixels(sheet, column))),
      dy:Math.max(0, Math.round((rowFrac-row)*rowPixels(sheet, row))),
      w:Math.max(16, Math.round(width)),
      h:Math.max(16, Math.round(height))
    };
  }
  function readWorksheetImages(worksheet, sheet){
    if(!worksheet||typeof worksheet.getImages!=='function')return [];
    var workbook=worksheet.workbook;
    var images=[];
    worksheet.getImages().forEach(function(item){
      var media=workbook&&workbook.getImage&&workbook.getImage(item.imageId);
      if(!media)return;
      var mime=imageMime(media.extension);
      var base64=bytesToBase64(media.buffer||media.base64);
      if(!mime||!/^[A-Za-z0-9+/=]+$/.test(base64))return;
      var placed=placeDrawing(item.range||{}, sheet);
      images.push({mime:mime, dataUrl:'data:'+mime+';base64,'+base64, row:placed.row, column:placed.column, dx:placed.dx, dy:placed.dy, w:placed.w, h:placed.h, mode:'float'});
    });
    return images;
  }
  function redactSecrets(value, max){
    return String(value==null?'':value).replace(/ghp_[A-Za-z0-9_]+/g,'[redacted]').replace(/github_pat_[A-Za-z0-9_]+/g,'[redacted]').replace(/sk-[A-Za-z0-9_-]{8,}/g,'[redacted]').replace(/Bearer\s+\S+/gi,'Bearer [redacted]').replace(/((?:token|access_token|api[_-]?key|apikey|authorization|password)=)[^&\s]+/gi,'$1[redacted]').replace(/(token\s+)\S+/gi,'$1[redacted]').replace(/\u0000/g,'').replace(/\s+/g,' ').trim().slice(0,max||180);
  }
  function normalizeLogEntry(entry){
    if(!entry||typeof entry.action!=='string'||typeof entry.time!=='string'||!/^\d{4}-\d{2}-\d{2}T[0-9:.]+Z$/.test(entry.time))return null;
    if(typeof entry.sessionId!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(entry.sessionId))return null;
    if(!Number.isInteger(entry.sequence)||entry.sequence<0||entry.sequence>100000000)return null;
    var detail=entry.detail&&typeof entry.detail==='object'?entry.detail:{};
    var cleanDetail={};
    Object.keys(detail).forEach(function(key){
      if(!/^[a-zA-Z][a-zA-Z0-9_-]{0,40}$/.test(key))return;
      var value=detail[key];
      if(typeof value==='string'){var text=redactSecrets(value, 240);if(text)cleanDetail[key]=text;}
      else if(typeof value==='number'&&Number.isFinite(value))cleanDetail[key]=value;
      else if(typeof value==='boolean')cleanDetail[key]=value;
    });
    return {time:entry.time, sessionId:entry.sessionId, sequence:entry.sequence, action:entry.action, label:typeof entry.label==='string'?redactSecrets(entry.label, 80):'', detail:cleanDetail};
  }
  function mergeOperationLogs(local, remote, limit){
    var cap=Number.isInteger(limit)&&limit>0?limit:8000;
    var map=new Map();
    function add(list, overwrite){
      (list||[]).forEach(function(entry){
        var clean=normalizeLogEntry(entry);
        if(!clean)return;
        var key=clean.sessionId+'#'+clean.sequence;
        if(overwrite||!map.has(key))map.set(key, clean);
      });
    }
    add(remote, false);
    add(local, true);
    var merged=Array.from(map.values());
    merged.sort(function(a,b){
      if(a.time<b.time)return -1;
      if(a.time>b.time)return 1;
      if(a.sessionId<b.sessionId)return -1;
      if(a.sessionId>b.sessionId)return 1;
      return a.sequence-b.sequence;
    });
    if(merged.length>cap)merged=merged.slice(merged.length-cap);
    return merged;
  }
  function utf8Size(text){
    if(typeof TextEncoder!=='undefined')return new TextEncoder().encode(text).length;
    return unescape(encodeURIComponent(text)).length;
  }
  function validImage(image){return !!(image&&validDataUrl(image.dataUrl));}
  function stripProductForCloud(product){
    if(!product||typeof product!=='object')return;
    delete product.workbookHistory;
    var snapshot=product.workbookSnapshot;
    if(!snapshot||typeof snapshot!=='object')return;
    if(snapshot.workbenchExcel)delete snapshot.workbenchExcel.originalBase64;
    if(Array.isArray(snapshot.workbenchImages))snapshot.workbenchImages=snapshot.workbenchImages.filter(validImage);
  }
  function stripCellSidecars(product){
    var sheets=product&&product.workbookSnapshot&&product.workbookSnapshot.sheets;
    if(!sheets)return;
    Object.keys(sheets).forEach(function(id){
      var rows=sheets[id]&&sheets[id].cellData||{};
      Object.keys(rows).forEach(function(row){
        Object.keys(rows[row]||{}).forEach(function(col){
          if(rows[row][col]&&rows[row][col].custom)delete rows[row][col].custom;
        });
      });
    });
  }
  function packState(state){
    var copy=JSON.parse(JSON.stringify(state||{}));
    delete copy.operationLogs;
    (copy.worktimeProducts||[]).forEach(stripProductForCloud);
    var text=JSON.stringify(copy);
    if(utf8Size(text)<=GIST_FILE_LIMIT)return text;
    (copy.worktimeProducts||[]).forEach(stripCellSidecars);
    text=JSON.stringify(copy);
    if(utf8Size(text)<=GIST_FILE_LIMIT)return text;
    var images=[];
    (copy.worktimeProducts||[]).forEach(function(product, productIndex){
      var list=product.workbookSnapshot&&product.workbookSnapshot.workbenchImages||[];
      list.forEach(function(image, imageIndex){images.push({productIndex:productIndex, imageIndex:imageIndex, size:utf8Size(image.dataUrl||'')});});
    });
    images.sort(function(a,b){return b.size-a.size;});
    images.forEach(function(item){
      if(utf8Size(text)<=GIST_FILE_LIMIT)return;
      var product=copy.worktimeProducts[item.productIndex];
      var list=product&&product.workbookSnapshot&&product.workbookSnapshot.workbenchImages;
      if(list&&list[item.imageIndex])list[item.imageIndex].dataUrl='';
      text=JSON.stringify(copy);
    });
    (copy.worktimeProducts||[]).forEach(function(product){
      var list=product.workbookSnapshot&&product.workbookSnapshot.workbenchImages;
      if(list)product.workbookSnapshot.workbenchImages=list.filter(validImage);
    });
    return JSON.stringify(copy);
  }
  function packLogs(events, retentionLimit){
    var list=(events||[]).slice();
    function body(items){return JSON.stringify({formatVersion:1, retentionLimit:retentionLimit||8000, events:items});}
    if(utf8Size(body(list))<=GIST_FILE_LIMIT)return body(list);
    var lo=0, hi=list.length;
    while(lo<hi){
      var mid=(lo+hi)>>1;
      if(utf8Size(body(list.slice(mid)))<=GIST_FILE_LIMIT)hi=mid;
      else lo=mid+1;
    }
    return body(list.slice(lo));
  }
  function packCloudFiles(state, events, retentionLimit){
    return {
      'workbench.json':{content:packState(state)},
      'operation-log.json':{content:packLogs(events, retentionLimit)}
    };
  }
  return {
    BORDER_NAMES:BORDER_NAMES,
    GIST_FILE_LIMIT:GIST_FILE_LIMIT,
    excelColor:excelColor,
    borderSide:borderSide,
    applyMergeBorders:applyMergeBorders,
    bytesToBase64:bytesToBase64,
    imageMime:imageMime,
    validDataUrl:validDataUrl,
    placeDrawing:placeDrawing,
    readWorksheetImages:readWorksheetImages,
    redactSecrets:redactSecrets,
    mergeOperationLogs:mergeOperationLogs,
    utf8Size:utf8Size,
    packState:packState,
    packLogs:packLogs,
    packCloudFiles:packCloudFiles
  };
});
