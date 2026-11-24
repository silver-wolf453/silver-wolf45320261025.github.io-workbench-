var assert=require('assert');
var fs=require('fs');
var os=require('os');
var path=require('path');
var child=require('child_process');
var ExcelJS=require('./vendor/exceljs-4.4.0.min.js');
var Import=require('./workbook-import.js');

var png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAFAAAAAwCAIAAAAJh2qgAAAACXBIWXMAAAABAAAAAQBPJcTWAAAAU0lEQVR4nO3PAQkAIBDAQAvZzmr2M4awP1iA3drnjmp9PwAGBgYGBgYeE3A94HrA9YDrAdcDrgdcD7gecD3gesD1gOsB1wOuB1wPuB5wPeB6wPUerZwLLReMxAkAAAAASUVORK5CYII=','base64');
var jpeg=Buffer.from('/9j/4AAQSkZJRgABAgAAAQABAAD//gAQTGF2YzYwLjMxLjEwMgD/2wBDAAgEBAQEBAUFBQUFBQYGBgYGBgYGBgYGBgYHBwcICAgHBwcGBgcHCAgICAkJCQgICAgJCQoKCgwMCwsODg4RERT/xABMAAEBAAAAAAAAAAAAAAAAAAAABAEBAQAAAAAAAAAAAAAAAAAAAAYQAQAAAAAAAAAAAAAAAAAAAAARAQAAAAAAAAAAAAAAAAAAAAD/wAARCABIAHgDASIAAhEAAxEA/9oADAMBAAIRAxEAPwCABErsAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB//2Q==','base64');

function borderOf(sheet, row, col, side){
  var cell=sheet.cellData[row]&&sheet.cellData[row][col];
  return cell&&cell.s&&cell.s.bd&&cell.s.bd[side];
}

(async function(){
  var wb=new ExcelJS.Workbook();
  var ws=wb.addWorksheet('标准工时表');
  ws.getCell('A1').value='产品分类';
  ws.mergeCells('A1:C2');
  ws.getCell('E5').value='单格';
  ws.getCell('E5').fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF31879B'}};
  ws.getColumn(1).width=18;
  ws.getRow(1).height=24;
  var pngId=wb.addImage({buffer:png,extension:'png'});
  ws.addImage(pngId,{tl:{col:3.2,row:0.4},ext:{width:140,height:70},editAs:'oneCell'});
  var jpgId=wb.addImage({buffer:jpeg,extension:'jpeg'});
  ws.addImage(jpgId,{tl:{col:0.1,row:3.2},br:{col:2.8,row:6.5},editAs:'twoCell'});
  var raw=Buffer.from(await wb.xlsx.writeBuffer());
  var dir=fs.mkdtempSync(path.join(os.tmpdir(),'wb-xlsx-'));
  var baseFile=path.join(dir,'base.xlsx');
  var patchedFile=path.join(dir,'borders.xlsx');
  fs.writeFileSync(baseFile, raw);
  var patcher=path.join(dir,'patch.py');
  fs.writeFileSync(patcher, patchSource(baseFile, patchedFile));
  child.execFileSync('python3',[patcher],{stdio:'inherit'});
  raw=fs.readFileSync(patchedFile);
  var loaded=new ExcelJS.Workbook();
  await loaded.xlsx.load(raw);
  var worksheet=loaded.getWorksheet('标准工时表');
  var palette=['FFFFFF','000000','E7E6E6','44546A','4472C4','ED7D31','A5A5A5','FFC000','5B9BD5','70AD47','0563C1','954F72'];
  var sheet={mergeData:[{startRow:0,startColumn:0,endRow:1,endColumn:2}],cellData:{},columnData:{0:{w:18*7+5}},rowData:{0:{h:24*4/3}},defaultColumnWidth:75,defaultRowHeight:20};
  sheet.cellData[0]={0:{v:'产品分类',t:1,s:Import.excelColor&&{}}};
  Import.applyMergeBorders(worksheet, sheet, palette);
  [['t',0,0],['t',0,1],['t',0,2]].forEach(function(item){
    var side=borderOf(sheet, item[1], item[2], item[0]);
    assert.ok(side, 'missing top '+item[2]);
    assert.strictEqual(side.s, 1);
    assert.strictEqual(side.cl.rgb, '#112233');
  });
  [['b',1,0],['b',1,1],['b',1,2]].forEach(function(item){
    var side=borderOf(sheet, item[1], item[2], item[0]);
    assert.ok(side, 'missing bottom '+item[2]);
    assert.strictEqual(side.s, 8);
    assert.strictEqual(side.cl.rgb, '#808080');
  });
  [0,1].forEach(function(row){
    var left=borderOf(sheet, row, 0, 'l');
    var right=borderOf(sheet, row, 2, 'r');
    assert.strictEqual(left.s, 3);
    assert.strictEqual(left.cl.rgb, '#445566');
    assert.strictEqual(right.s, 4);
    assert.strictEqual(right.cl.rgb, '#4472C4');
  });
  var single=worksheet.getCell('E5');
  assert.strictEqual(Import.borderSide(single.border.top, palette).s, 4);
  assert.strictEqual(Import.borderSide(single.border.bottom, palette).s, 7);
  assert.strictEqual(Import.borderSide(single.border.left, palette).s, 2);
  var right=Import.borderSide(single.border.right, palette);
  assert.strictEqual(right.s, 13);
  assert.ok(right.cl.rgb&&right.cl.rgb!=='#000000');

  var images=Import.readWorksheetImages(worksheet, sheet);
  assert.strictEqual(images.length, 2);
  images.forEach(function(image){
    assert.ok(Import.validDataUrl(image.dataUrl));
    assert.strictEqual(image.mode, 'float');
    var bytes=Buffer.from(image.dataUrl.split(',')[1], 'base64');
    assert.ok(bytes[0]===0x89||bytes[0]===0xFF);
    assert.strictEqual(image.dataUrl.indexOf('\u0000'), -1);
  });
  var floating=images.filter(function(image){return image.w===140&&image.h===70;})[0];
  var spanned=images.filter(function(image){return image!==floating;})[0];
  assert.ok(floating);
  assert.strictEqual(floating.column, 3);
  assert.strictEqual(floating.row, 0);
  assert.ok(floating.dx>0&&floating.dy>0);
  assert.strictEqual(spanned.column, 0);
  assert.strictEqual(spanned.row, 3);
  assert.ok(spanned.w>80&&spanned.h>40);

  var phone=[
    {time:'2026-11-24T01:00:00.000Z',sessionId:'phone',sequence:1,action:'app_open',label:'打开',detail:{message:'safe'}},
    {time:'2026-11-24T01:00:01.000Z',sessionId:'phone',sequence:2,action:'sync_push',label:'上传',detail:{message:'Authorization: Bearer ghp_abcdefghijklmnopqrstuvwxyz012345'}}
  ];
  var desktop=[{time:'2026-11-24T02:00:00.000Z',sessionId:'desktop',sequence:1,action:'route_view',label:'切换',detail:{status:'ok'}},{time:'2026-11-24T01:00:00.000Z',sessionId:'phone',sequence:1,action:'app_open',label:'打开',detail:{message:'本机这条保留'}}];
  var merged=Import.mergeOperationLogs(desktop, phone, 8000);
  assert.strictEqual(merged.length, 3);
  assert.strictEqual(merged[0].detail.message, '本机这条保留');
  assert.strictEqual(merged[2].sessionId, 'desktop');
  assert.ok(merged[1].detail.message.indexOf('ghp_')<0);
  assert.ok(merged[1].detail.message.indexOf('[redacted]')>=0);
  var capped=Import.mergeOperationLogs(
    [{time:'2026-11-24T03:00:00.000Z',sessionId:'desktop',sequence:2,action:'app_open',detail:{}}],
    [{time:'2026-11-24T01:00:00.000Z',sessionId:'phone',sequence:1,action:'app_open',detail:{}},{time:'2026-11-24T02:00:00.000Z',sessionId:'phone',sequence:2,action:'app_open',detail:{}}],
    2
  );
  assert.strictEqual(capped.length, 2);
  assert.strictEqual(capped[0].sessionId+capped[0].sequence, 'phone2');
  assert.strictEqual(capped[1].sessionId, 'desktop');

  var bulky='A'.repeat(1200000);
  var state={tasks:[],projects:[],worktimeProducts:[{id:'p',updatedAt:'2026-11-24T00:00:00.000Z',workbookHistory:[{id:'h'}],workbookSnapshot:{workbenchExcel:{originalBase64:bulky},workbenchImages:images,sheets:{s:{cellData:{0:{0:{v:'x',custom:{wbExcel:{style:{font:{name:'A'}}}}}}},mergeData:sheet.mergeData}}}}]};
  var packed=Import.packCloudFiles(state, merged, 8000);
  assert.ok(Import.utf8Size(packed['workbench.json'].content)<=Import.GIST_FILE_LIMIT);
  assert.ok(Import.utf8Size(packed['operation-log.json'].content)<=Import.GIST_FILE_LIMIT);
  var cloud=JSON.parse(packed['workbench.json'].content);
  assert.strictEqual(cloud.worktimeProducts[0].workbookHistory, undefined);
  assert.strictEqual(cloud.worktimeProducts[0].workbookSnapshot.workbenchExcel.originalBase64, undefined);
  assert.strictEqual(cloud.worktimeProducts[0].workbookSnapshot.workbenchImages.length, 2);
  assert.ok(packed['workbench.json'].content.indexOf('\u0000')<0);

  var many=[];
  for(var i=0;i<5000;i++)many.push({time:'2026-11-24T00:00:'+String(i%60).padStart(2,'0')+'.'+String(i%1000).padStart(3,'0')+'Z',sessionId:'s',sequence:i,action:'ui_click',detail:{message:'x'.repeat(400)}});
  var logFile=Import.packLogs(many, 8000);
  assert.ok(Import.utf8Size(logFile)<=Import.GIST_FILE_LIMIT);
  var kept=JSON.parse(logFile).events;
  assert.ok(kept.length<many.length);
  assert.strictEqual(kept[kept.length-1].sequence, 4999);
  assert.ok(kept[0].sequence>0);

  fs.copyFileSync(patchedFile, '/tmp/wb-import-fixture.xlsx');
  console.log('workbook import self-check ok');
  console.log(patchedFile);
})().catch(function(error){console.error(error);process.exit(1);});

function patchSource(src, dest){
  return 'import zipfile, io, re\n'+
    'src='+JSON.stringify(src)+'\n'+
    'dest='+JSON.stringify(dest)+'\n'+
    'borders='+JSON.stringify('<borders count="7"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="dotted"><color rgb="FF445566"/></left><right/><top style="thin"><color rgb="FF112233"/></top><bottom/><diagonal/></border><border><left/><right/><top style="thin"><color rgb="FF112233"/></top><bottom/><diagonal/></border><border><left style="dotted"><color rgb="FF445566"/></left><right/><top/><bottom style="medium"><color indexed="23"/></bottom><diagonal/></border><border><left/><right/><top/><bottom style="medium"><color indexed="23"/></bottom><diagonal/></border><border><left/><right style="dashed"><color theme="4"/></right><top/><bottom style="medium"><color indexed="23"/></bottom><diagonal/></border><border><left style="hair"><color rgb="FF000000"/></left><right style="thick"><color theme="5" tint="-0.25"/></right><top style="dashed"><color rgb="FF00B050"/></top><bottom style="double"><color rgb="FF000000"/></bottom><diagonal/></border></borders>')+'\n'+
    'xfs="""<cellXfs count="8"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="2" borderId="0" xfId="0" applyFill="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="2" xfId="0" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="3" xfId="0" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="4" xfId="0" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="5" xfId="0" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="2" borderId="6" xfId="0" applyFill="1" applyBorder="1"/></cellXfs>"""\n'+
    'zin=zipfile.ZipFile(src)\n'+
    'styles=zin.read("xl/styles.xml").decode()\n'+
    'styles=re.sub(r"<borders count=\\"1\\">.*?</borders>", borders, styles, count=1)\n'+
    'styles=re.sub(r"<cellXfs count=\\"2\\">.*?</cellXfs>", xfs, styles, count=1)\n'+
    'sheet=zin.read("xl/worksheets/sheet1.xml").decode()\n'+
    'styles_for={"A1":"2","B1":"3","C1":"3","A2":"4","B2":"5","C2":"6","E5":"7"}\n'+
    'def paint(match):\n'+
    '    addr=match.group(1)\n'+
    '    rest=re.sub(r\'\\s+s="\\d+"\', "", match.group(2))\n'+
    '    return \'<c r="%s" s="%s"%s\'%(addr, styles_for[addr], rest)\n'+
    'sheet=re.sub(r\'<c r="([A-Z]+\\d+)"([^>]*)\', paint, sheet)\n'+
    'out=io.BytesIO()\n'+
    'with zipfile.ZipFile(out,"w") as zout:\n'+
    '    for item in zin.infolist():\n'+
    '        data=zin.read(item.filename)\n'+
    '        if item.filename=="xl/styles.xml": data=styles.encode()\n'+
    '        if item.filename=="xl/worksheets/sheet1.xml": data=sheet.encode()\n'+
    '        zout.writestr(item, data)\n'+
    'open(dest,"wb").write(out.getvalue())\n';
}
