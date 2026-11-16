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
assert.strictEqual(stats.buckets.value,0);
assert.strictEqual(stats.buckets.waste,0);
assert.strictEqual(A.round2(stats.buckets.necessary+stats.buckets.value+stats.buckets.waste),stats.total);

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
assert.strictEqual(chainedStats.buckets.value,10);
assert.strictEqual(chainedStats.buckets.waste,15);
assert.strictEqual(chainedStats.buckets.necessary,15);

var only=A.rowsFromMarks([
  {id:'s3',type:'start',time:1.25,description:'开始',value:'value'},
  {id:'e3',type:'end',time:3,description:'结束'}
]);
assert.strictEqual(only.length,1);
assert.strictEqual(only[0].start,1.25);
assert.strictEqual(only[0].end,3);
assert.strictEqual(A.duration(only[0]),1.75);
assert.strictEqual(A.statsFromRows(only).total,1.75);
assert.strictEqual(A.statsFromRows(only).buckets.value,1.75);

assert.strictEqual(A.round2(0.1+0.2),0.3);
assert.strictEqual(A.duration({start:0.1,end:0.3}),0.2);

console.log('ecrs action timing self-check ok');
console.log(rows.map(function(row,index){
  return (index+1)+' '+row.description+' '+row.start+' → '+row.end+' 时长 '+A.duration(row);
}).join('\n'));
