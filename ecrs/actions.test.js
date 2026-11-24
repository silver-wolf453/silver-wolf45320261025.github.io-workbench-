var assert=require('assert');
var A=require('./actions.js');

var rows=A.rowsFromMarks([
  {id:'s',type:'start',time:0.77,description:'开始'},
  {id:'i',type:'insert',time:128.96,description:'吹干'},
  {id:'e',type:'end',time:399.1,description:'结束'}
]);
assert.strictEqual(rows.length,3);
assert.deepStrictEqual(rows.map(function(row){return row.description;}),['开始','吹干','结束']);
assert.deepStrictEqual(rows.map(function(row){return [row.start,row.end,A.duration(row)];}),[
  [0.77,399.1,398.33],
  [0.77,128.96,128.19],
  [128.96,399.1,270.14]
]);
assert.notStrictEqual(rows[0].end,401);
assert.notStrictEqual(A.duration(rows[1]),0.5);
assert.notStrictEqual(A.duration(rows[2]),0.5);
var stats=A.statsFromRows(rows);
assert.strictEqual(stats.total,398.33);
assert.strictEqual(stats.buckets.necessary,398.33);
assert.strictEqual(stats.buckets.customer,0);
assert.strictEqual(stats.buckets.business,0);
assert.strictEqual(stats.buckets.waste,0);
assert.strictEqual(A.round2(stats.buckets.necessary+stats.buckets.customer+stats.buckets.business+stats.buckets.waste),stats.total);

var chained=A.rowsFromMarks([
  {id:'s2',type:'start',time:0,description:'开始',value:'value'},
  {id:'a',type:'insert',time:10,description:'甲',value:'value'},
  {id:'b',type:'insert',time:25,description:'乙',value:'waste'},
  {id:'e2',type:'end',time:40,description:'结束',value:'necessary'}
]);
assert.deepStrictEqual(chained.map(function(row){return [row.description,row.start,row.end,A.duration(row)];}),[
  ['开始',0,40,40],
  ['甲',0,10,10],
  ['乙',10,25,15],
  ['结束',25,40,15]
]);
var chainedStats=A.statsFromRows(chained);
assert.strictEqual(chainedStats.total,40);
assert.strictEqual(chainedStats.buckets.customer,10);
assert.strictEqual(chainedStats.buckets.waste,15);
assert.strictEqual(chainedStats.buckets.necessary,15);
assert.strictEqual(chainedStats.buckets.business,0);

var only=A.rowsFromMarks([
  {id:'s3',type:'start',time:1.25,description:'开始',value:'value'},
  {id:'e3',type:'end',time:3,description:'结束'}
]);
assert.strictEqual(only.length,1);
assert.strictEqual(only[0].start,1.25);
assert.strictEqual(only[0].end,3);
assert.strictEqual(A.duration(only[0]),1.75);
assert.strictEqual(A.statsFromRows(only).total,1.75);
assert.strictEqual(A.statsFromRows(only).buckets.customer,1.75);

assert.strictEqual(A.round2(0.1+0.2),0.3);
assert.strictEqual(A.duration({start:0.1,end:0.3}),0.2);

assert.strictEqual(A.vsmKey('顾客增值'),'customer');
assert.strictEqual(A.vsmKey('业务增值'),'business');
assert.strictEqual(A.vsmKey('必要非增值'),'necessary');
assert.strictEqual(A.vsmKey('浪费'),'waste');
assert.strictEqual(A.vsmKey('增值'),'customer');
assert.strictEqual(A.vsmKey('value'),'customer');
assert.strictEqual(A.vsmKey('非增值'),'necessary');
assert.strictEqual(A.vsmKey('必要'),'necessary');
assert.strictEqual(A.vsmKey('非增值/必要'),'necessary');
assert.strictEqual(A.vsmKey('waste'),'waste');
assert.strictEqual(A.vsmKey('其他'),'');
assert.strictEqual(A.vsmKey(''),'');

var analyzed=A.analyzeRegions([
  {id:'op1',title:'操作员1动作明细',marks:[
    {id:'s',type:'start',time:0.77,description:'开始'},
    {id:'i',type:'insert',time:128.96,description:'吹干'},
    {id:'e',type:'end',time:399.1,description:'结束'}
  ]},
  {id:'eq1',title:'设备1动作明细',marks:[
    {id:'s2',type:'start',time:2,description:'启动',value:'waste',flow:'操作'},
    {id:'e2',type:'end',time:5.5,description:'停止',value:'waste',flow:'操作'}
  ]}
]);
assert.strictEqual(analyzed.length,2);
assert.strictEqual(analyzed[0].title,'操作员1动作明细');
assert.deepStrictEqual(analyzed[0].rows.map(function(row){return [row.start,row.end,A.duration(row)];}),[
  [0.77,399.1,398.33],
  [0.77,128.96,128.19],
  [128.96,399.1,270.14]
]);
assert.strictEqual(analyzed[0].stats.total,398.33);
assert.strictEqual(analyzed[0].stats.buckets.necessary,398.33);
assert.strictEqual(analyzed[0].stats.buckets.waste,0);
assert.strictEqual(analyzed[1].rows.length,1);
assert.strictEqual(analyzed[1].rows[0].start,2);
assert.strictEqual(analyzed[1].rows[0].end,5.5);
assert.strictEqual(A.duration(analyzed[1].rows[0]),3.5);
assert.strictEqual(analyzed[1].stats.total,3.5);
assert.strictEqual(analyzed[1].stats.buckets.waste,3.5);
assert.strictEqual(analyzed[1].stats.flows.operation,3.5);
assert.strictEqual(analyzed[0].stats.flows.operation,0);
assert.notStrictEqual(analyzed[0].rows[0].id,analyzed[1].rows[0].id);

assert.strictEqual(A.flowKey('存储'),'storage');
assert.strictEqual(A.flowKey('等待'),'wait');
assert.strictEqual(A.flowKey('storage'),'storage');
assert.strictEqual(A.flowKey('wait'),'wait');
assert.notStrictEqual(A.flowKey('存储'),'wait');
assert.notStrictEqual(A.flowKey('等待'),'storage');
var kept=A.rowsFromMarks([
  {id:'s',type:'start',time:0,description:'存',flow:'存储',value:'necessary'},
  {id:'i',type:'insert',time:2,description:'等',flow:'等待',value:'waste'},
  {id:'e',type:'end',time:5,description:'止',flow:'storage',value:'necessary'}
]);
assert.strictEqual(kept[0].flow,'storage');
assert.strictEqual(kept[1].flow,'wait');
assert.strictEqual(kept[2].flow,'storage');
var keptStats=A.statsFromRows(kept);
assert.strictEqual(keptStats.total,5);
assert.strictEqual(keptStats.flows.storage,3);
assert.strictEqual(keptStats.flows.wait,2);
assert.strictEqual(keptStats.flows.operation,0);

var dPath='a5.25 5.25 0 0 1 0 10.5';
var trianglePath='L8 13.15';
assert.ok(A.flowSymbol('wait').indexOf(dPath)>=0);
assert.ok(A.flowSymbol('等待').indexOf(dPath)>=0);
assert.ok(A.flowSymbol('wait').indexOf(trianglePath)<0);
assert.ok(A.flowSymbol('storage').indexOf(trianglePath)>=0);
assert.ok(A.flowSymbol('存储').indexOf(trianglePath)>=0);
assert.ok(A.flowSymbol('storage').indexOf(dPath)<0);
assert.strictEqual(A.flowSymbol('等待'),A.flowSymbol('wait'));
assert.strictEqual(A.flowSymbol('存储'),A.flowSymbol('storage'));
assert.notStrictEqual(A.flowSymbol('存储'),A.flowSymbol('等待'));
assert.ok(A.flowSymbol('operation').indexOf('<circle')>=0);
assert.ok(A.flowSymbol('operation').indexOf('<rect')<0);
assert.ok(A.flowSymbol('inspect').indexOf('<rect x="2.75"')>=0);
assert.ok(A.flowSymbol('inspect').indexOf('<circle')<0);
assert.ok(A.flowSymbol('transport').indexOf('M2.75 8h9.2')>=0);
var combined=A.flowSymbol('op-inspect');
assert.ok(combined.indexOf('<circle')>=0);
assert.ok(combined.indexOf('<rect x="5.4"')>=0);
assert.ok(combined.indexOf(dPath)<0);
assert.ok(combined.indexOf(trianglePath)<0);
assert.strictEqual(A.flowSymbol('操作+检验'),combined);
assert.strictEqual(A.flowSymbol(''),'');

assert.strictEqual(A.regionHeading('people',1),'操作员1');
assert.strictEqual(A.regionHeading('people',2),'操作员2');
assert.strictEqual(A.regionHeading('equipment',1),'设备1');
assert.strictEqual(A.regionHeading('equipment',3),'设备3');
assert.ok(A.regionHeading('people',1).indexOf('动作明细')<0);
assert.ok(A.regionHeading('equipment',2).indexOf('动作明细')<0);

function stamp(decision){return {type:decision.type,time:decision.time};}
var opMarks=[],eqMarks=[{type:'start',time:1}];
var made=0;
function once(decision){made++;return stamp(decision);}
assert.strictEqual(A.applyRegionMark(opMarks,'start',0.77,once).ok,true);
assert.strictEqual(made,1);
assert.strictEqual(A.applyRegionMark(opMarks,'start',1,once).code,'open');
assert.strictEqual(made,1);
assert.strictEqual(opMarks.length,1);
assert.strictEqual(eqMarks.length,1);
assert.strictEqual(A.openStartIndex(eqMarks),0);
assert.strictEqual(A.applyRegionMark(eqMarks,'insert',0.2,once).code,'order');
assert.strictEqual(eqMarks.length,1);
assert.strictEqual(made,1);
assert.strictEqual(A.applyRegionMark(opMarks,'insert',128.96,once).ok,true);
assert.strictEqual(A.applyRegionMark(opMarks,'end',399.1,once).ok,true);
assert.deepStrictEqual(A.rowsFromMarks(opMarks).map(function(row){return A.duration(row);}),[398.33,128.19,270.14]);
assert.strictEqual(A.statsFromRows(A.rowsFromMarks(opMarks)).total,398.33);
assert.strictEqual(A.openStartIndex(eqMarks),0);
assert.strictEqual(A.prepareRegionMark([],'end',1).code,'none');
assert.strictEqual(A.prepareRegionMark([],'insert',1).code,'need-start');
assert.strictEqual(A.prepareRegionMark(null,'start',1).code,'missing');
var clamped=[];
A.applyRegionMark(clamped,'start',5,stamp);
assert.strictEqual(A.applyRegionMark(clamped,'end',1,stamp).time,5);
assert.strictEqual(clamped[1].time,5);
var same=[];
A.applyRegionMark(same,'start',2,stamp);
assert.strictEqual(A.prepareRegionMark(same,'insert',2).ok,true);
assert.strictEqual(A.prepareRegionMark([],'start',-4).time,0);

var fs=require('fs');
var path=require('path');
var page=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
var app=fs.readFileSync(path.join(__dirname,'app.js'),'utf8');
assert.strictEqual(page.indexOf('id="markStart"'),-1);
assert.strictEqual(page.indexOf('id="markEnd"'),-1);
assert.strictEqual(page.indexOf('id="markOther"'),-1);
assert.ok(page.indexOf('id="play"')>=0);
assert.ok(page.indexOf('id="pause"')>=0);
assert.ok(page.indexOf('id="zoomToggle"')>=0);
assert.ok(page.indexOf('id="exportExcel"')>=0);
assert.ok(app.indexOf('EcrsActions.flowSymbol')>=0);
assert.strictEqual(app.indexOf(dPath),-1);
assert.strictEqual(app.indexOf(trianglePath),-1);
assert.ok(app.indexOf('data-region-id')>=0);
assert.ok(app.indexOf('stopPropagation')>=0);
assert.ok(app.indexOf('regionById(id)')>=0);
assert.strictEqual(app.indexOf('activeMarks'),-1);
assert.ok(app.indexOf('标记开始')>=0);
assert.ok(app.indexOf('标记结束')>=0);
assert.ok(app.indexOf('插入重叠动作')>=0);
assert.strictEqual(app.indexOf("+'动作明细'"),-1);
assert.strictEqual((app.match(/动作明细/g)||[]).length,3);
var rootHtml=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
var manual=fs.readFileSync(path.join(__dirname,'..','manual'),'utf8');
assert.ok(rootHtml.indexOf('content="2026.11.24.1"')>=0);
assert.ok(rootHtml.indexOf("WORKBENCH_BUILD='2026.11.24.1'")>=0);
assert.ok(page.indexOf('app.css?v=2026.11.18.1')>=0);
assert.ok(page.indexOf('actions.js?v=2026.11.18.1')>=0);
assert.ok(page.indexOf('app.js?v=2026.11.18.1')>=0);
assert.ok(app.indexOf("ECRS_BUILD='2026.11.18.1'")>=0);
assert.ok(manual.indexOf('当前为 2026.11.24.1。')>=0);
assert.ok(manual.indexOf('符号依次是圆、方、箭头、倒三角、D，以及圆内套方。')>=0);
assert.ok(manual.indexOf('### 2026.11.18.1')>=0);

console.log('ecrs action timing self-check ok');
console.log(rows.map(function(row,index){
  return (index+1)+' '+row.description+' '+row.start+' → '+row.end+' 时长 '+A.duration(row);
}).join('\n'));
