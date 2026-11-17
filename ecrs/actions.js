/* ECRS action rows. Marks are the source of truth; rows are derived.
   Descriptions stay on the marks (user-typed, empty until edited). */
(function(root){
  function round2(n){
    var x=Number(n);
    if(!isFinite(x)) return 0;
    return Math.round((x+Number.EPSILON)*100)/100;
  }
  function duration(action){
    if(!action||action.end==null||action.start==null) return 0;
    return round2(Math.max(0,Number(action.end)-Number(action.start)));
  }
  function vsmKey(value){
    var raw=value==null?'':String(value).trim();
    if(raw==='customer'||raw==='顾客增值') return 'customer';
    if(raw==='business'||raw==='业务增值') return 'business';
    if(raw==='necessary'||raw==='必要非增值') return 'necessary';
    if(raw==='waste'||raw==='浪费') return 'waste';
    if(raw==='value'||raw==='增值') return 'customer';
    if(raw==='非增值'||raw==='必要'||raw==='非增值/必要') return 'necessary';
    return '';
  }
  function flowKey(value){
    var raw=value==null?'':String(value).trim();
    var map={
      operation:'operation',inspect:'inspect',transport:'transport',storage:'storage',wait:'wait','op-inspect':'op-inspect',
      '操作':'operation','检验':'inspect','搬运':'transport','存储':'storage','等待':'wait','操作+检验':'op-inspect'
    };
    return map[raw]||'';
  }
  function copyFields(mark){
    var value=mark.value;
    if(value==null) value='necessary';
    else value=vsmKey(value);
    return {
      id:mark.id,
      description:mark.description||'',
      value:value,
      ecrs:mark.ecrs||'R',
      direction:mark.direction||'',
      flow:flowKey(mark.flow)
    };
  }
  function rowsFromMarks(marks){
    var rows=[],list=Array.isArray(marks)?marks:[],i=0;
    while(i<list.length){
      if(list[i].type!=='start'){i++;continue;}
      var start=list[i],inserts=[],end=null;
      i++;
      while(i<list.length&&list[i].type!=='start'){
        if(list[i].type==='insert'){inserts.push(list[i]);i++;}
        else if(list[i].type==='end'){end=list[i];i++;break;}
        else i++;
      }
      inserts=inserts.slice().sort(function(a,b){return a.time-b.time;});
      var startT=round2(start.time);
      var endT=end?round2(Math.max(startT,end.time)):null;
      var cycle=copyFields(start);
      cycle.cycleId=start.id;
      cycle.kind='cycle';
      cycle.start=startT;
      cycle.end=endT;
      rows.push(cycle);
      var prev=startT;
      inserts.forEach(function(mark){
        var boundary=round2(Math.max(prev,mark.time));
        var row=copyFields(mark);
        row.cycleId=start.id;
        row.kind='insert';
        row.start=prev;
        row.end=boundary;
        rows.push(row);
        prev=boundary;
      });
      if(end&&inserts.length){
        var tail=copyFields(end);
        tail.cycleId=start.id;
        tail.kind='tail';
        tail.start=prev;
        tail.end=endT;
        rows.push(tail);
      }
    }
    return rows;
  }
  function emptyBuckets(){return {customer:0,business:0,necessary:0,waste:0};}
  function emptyFlows(){return {operation:0,inspect:0,transport:0,storage:0,wait:0,'op-inspect':0};}
  function addKnown(target,key,amount){
    if(!Object.prototype.hasOwnProperty.call(target,key)) return;
    target[key]+=amount;
  }
  function statsFromRows(rows){
    var buckets=emptyBuckets(),flows=emptyFlows(),total=0,list=Array.isArray(rows)?rows:[],i=0;
    function take(item){
      var amount=duration(item);
      total+=amount;
      addKnown(buckets,vsmKey(item.value),amount);
      addKnown(flows,flowKey(item.flow),amount);
    }
    while(i<list.length){
      var row=list[i];
      if(row.kind!=='cycle'){
        take(row);
        i++;
        continue;
      }
      var details=[];
      i++;
      while(i<list.length&&(list[i].kind==='insert'||list[i].kind==='tail')&&list[i].cycleId===row.id){
        details.push(list[i]);
        i++;
      }
      (details.length?details:[row]).forEach(take);
    }
    Object.keys(buckets).forEach(function(key){buckets[key]=round2(buckets[key]);});
    Object.keys(flows).forEach(function(key){flows[key]=round2(flows[key]);});
    return {total:round2(total),buckets:buckets,flows:flows};
  }
  function analyzeRegions(regions){
    var list=Array.isArray(regions)?regions:[];
    return list.map(function(region){
      var rows=rowsFromMarks(region&&region.marks);
      return {id:region&&region.id,title:region&&region.title,rows:rows,stats:statsFromRows(rows)};
    });
  }
  var api={
    round2:round2,
    duration:duration,
    rowsFromMarks:rowsFromMarks,
    statsFromRows:statsFromRows,
    analyzeRegions:analyzeRegions,
    vsmKey:vsmKey,
    flowKey:flowKey
  };
  root.EcrsActions=api;
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
