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
  function copyFields(mark){
    return {
      id:mark.id,
      description:mark.description||'',
      value:mark.value||'necessary',
      ecrs:mark.ecrs||'R',
      direction:mark.direction||''
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
  function statsFromRows(rows){
    var buckets={value:0,necessary:0,waste:0},total=0,list=Array.isArray(rows)?rows:[],i=0;
    while(i<list.length){
      var row=list[i];
      if(row.kind!=='cycle'){
        var plain=duration(row);
        total+=plain;
        buckets[row.value]=(buckets[row.value]||0)+plain;
        i++;
        continue;
      }
      var details=[];
      i++;
      while(i<list.length&&(list[i].kind==='insert'||list[i].kind==='tail')&&list[i].cycleId===row.id){
        details.push(list[i]);
        i++;
      }
      var counted=details.length?details:[row];
      counted.forEach(function(item){
        var amount=duration(item);
        total+=amount;
        buckets[item.value]=(buckets[item.value]||0)+amount;
      });
    }
    return {
      total:round2(total),
      buckets:{
        value:round2(buckets.value||0),
        necessary:round2(buckets.necessary||0),
        waste:round2(buckets.waste||0)
      }
    };
  }
  var api={round2:round2,duration:duration,rowsFromMarks:rowsFromMarks,statsFromRows:statsFromRows};
  root.EcrsActions=api;
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
