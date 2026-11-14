/* Pure MP4 box reader: moov/trak/stsd. No dependencies. */
(function(root){
  function fourcc(bytes, offset){return String.fromCharCode(bytes[offset],bytes[offset+1],bytes[offset+2],bytes[offset+3]);}
  function headerAt(view, offset, limit){
    if(offset+8>limit)return null;
    var size=view.getUint32(offset),header=8;
    var type=fourcc(new Uint8Array(view.buffer,view.byteOffset+offset+4,4),0);
    if(size===1){if(offset+16>limit)return null;size=Number(view.getBigUint64(offset+8));header=16;}
    else if(size===0)size=limit-offset;
    if(size<header||offset+size>limit+1)return null;
    return {type:type,size:size,header:header,start:offset,end:offset+size};
  }
  function children(view, box){
    var list=[],offset=box.start+box.header,end=box.end;
    if(box.type==='meta')offset+=4;
    while(offset+8<=end){
      var child=headerAt(view,offset,end);if(!child)break;
      list.push(child);offset=child.end;
    }
    return list;
  }
  function findChild(view, box, type){
    var list=children(view,box);
    for(var i=0;i<list.length;i++)if(list[i].type===type)return list[i];
    return null;
  }
  function findPath(view, box, types){
    var current=box;
    for(var i=0;i<types.length;i++){current=current&&findChild(view,current,types[i]);}
    return current;
  }
  function handlerType(view, trak){
    var hdlr=findPath(view,trak,['mdia','hdlr']);
    if(!hdlr||hdlr.start+20>hdlr.end)return '';
    return fourcc(new Uint8Array(view.buffer,view.byteOffset+hdlr.start+16,4),0);
  }
  function mdhd(view, trak){
    var box=findPath(view,trak,['mdia','mdhd']);
    if(!box)return {timescale:1,duration:0};
    var version=view.getUint8(box.start+box.header);
    var timescale,duration;
    if(version===1){timescale=view.getUint32(box.start+box.header+20);duration=Number(view.getBigUint64(box.start+box.header+24));}
    else{timescale=view.getUint32(box.start+box.header+12);duration=view.getUint32(box.start+box.header+16);}
    return {timescale:timescale||1,duration:duration||0};
  }
  function visualSize(view, entry){
    var widthAt=entry.start+32,heightAt=entry.start+34;
    if(heightAt+2>entry.end)return {width:0,height:0};
    return {width:view.getUint16(widthAt),height:view.getUint16(heightAt)};
  }
  function codecProfile(view, entry, codec){
    var offset=entry.start+86,end=entry.end,profile='';
    var description=null;
    while(offset+8<=end){
      var box=headerAt(view,offset,end);if(!box)break;
      if(box.type==='avcC'&&box.header+4<=box.end){
        profile=view.getUint8(box.start+box.header+1)+'.'+view.getUint8(box.start+box.header+3);
      }
      if(box.type==='hvcC'&&box.end-box.start-box.header>13){
        var bodyStart=box.start+box.header;
        var b1=view.getUint8(bodyStart+1);
        var space=['','A','B','C'][(b1>>6)&3];
        var profileIdc=b1&31;
        var compat=view.getUint32(bodyStart+2).toString(16).toUpperCase();
        var tier=(b1&32)?'H':'L';
        var level=view.getUint8(bodyStart+12);
        var constraints=[];
        for(var i=6;i<=11;i++)constraints.push(view.getUint8(bodyStart+i));
        while(constraints.length&&constraints[constraints.length-1]===0)constraints.pop();
        profile=space+profileIdc+'.'+compat+'.'+tier+level+(constraints.length?'.'+constraints.map(function(n){return n.toString(16).toUpperCase();}).join('.'):'');
        description=new Uint8Array(view.buffer,view.byteOffset+bodyStart,box.end-bodyStart);
      }
      if(box.type==='avcC')description=new Uint8Array(view.buffer,view.byteOffset+box.start+box.header,box.end-box.start-box.header);
      offset=box.end;
    }
    return {profile:profile,description:description,codecString:codec==='avc1'||codec==='avc3'?(codec+'.'+profile):codec+(profile?'.'+profile:'')};
  }
  function sampleEntry(view, stsd){
    var offset=stsd.start+stsd.header+8;
    if(offset+8>stsd.end)return null;
    return headerAt(view,offset,stsd.end);
  }
  function readEntries(view, box, width){
    var count=view.getUint32(box.start+box.header+4),out=[],offset=box.start+box.header+8;
    for(var i=0;i<count&&offset+width<=box.end;i++){
      if(width===8)out.push({count:view.getUint32(offset),delta:view.getUint32(offset+4)});
      else if(width===12)out.push({first:view.getUint32(offset),samples:view.getUint32(offset+4)});
      else out.push(width===4?view.getUint32(offset):Number(view.getBigUint64(offset)));
      offset+=width;
    }
    return out;
  }
  function videoSamples(view, trak, timescale){
    var stbl=findPath(view,trak,['mdia','minf','stbl']);if(!stbl)return [];
    var stts=findChild(view,stbl,'stts'),stsc=findChild(view,stbl,'stsc'),stsz=findChild(view,stbl,'stsz'),stco=findChild(view,stbl,'stco'),co64=findChild(view,stbl,'co64'),stss=findChild(view,stbl,'stss');
    if(!stts||!stsc||!stsz||(!stco&&!co64))return [];
    var durations=[],groups=readEntries(view,stts,8);
    groups.forEach(function(group){for(var i=0;i<group.count;i++)durations.push(group.delta);});
    var chunks=readEntries(view,stsc,12);
    var sampleSize=view.getUint32(stsz.start+stsz.header+4),sampleCount=view.getUint32(stsz.start+stsz.header+8),sizes=[];
    if(sampleSize===0){var sizeOffset=stsz.start+stsz.header+12;for(var s=0;s<sampleCount&&sizeOffset+4<=stsz.end;s++){sizes.push(view.getUint32(sizeOffset));sizeOffset+=4;}}
    var offsets=stco?readEntries(view,stco,4):readEntries(view,co64,8);
    var sync=null;
    if(stss){sync={};var syncCount=view.getUint32(stss.start+stss.header+4),syncOffset=stss.start+stss.header+8;for(var k=0;k<syncCount&&syncOffset+4<=stss.end;k++){sync[view.getUint32(syncOffset)]=true;syncOffset+=4;}}
    var expanded=[],c;
    for(c=0;c<chunks.length;c++){
      var last=c+1<chunks.length?chunks[c+1].first:offsets.length+1;
      for(var chunk=chunks[c].first;chunk<last&&chunk-1<offsets.length;chunk++)expanded.push({offset:offsets[chunk-1],samples:chunks[c].samples});
    }
    var samples=[],index=0,time=0;
    expanded.forEach(function(chunk){
      var cursor=chunk.offset;
      for(var n=0;n<chunk.samples;n++){
        var bytes=sampleSize||sizes[index]||0;
        samples.push({offset:cursor,size:bytes,pts:time/timescale,key:!sync||!!sync[index+1]});
        cursor+=bytes;time+=durations[index]||0;index++;
      }
    });
    return samples;
  }
  function parseMoov(bytes){
    var view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    var moov={type:'moov',size:bytes.byteLength,header:8,start:0,end:bytes.byteLength};
    var tracks=[],video=null,audio=null;
    children(view,moov).forEach(function(child){
      if(child.type!=='trak')return;
      var kind=handlerType(view,child),timing=mdhd(view,child),stsd=findPath(view,child,['mdia','minf','stbl','stsd']);
      var entry=stsd&&sampleEntry(view,stsd),codec=entry?entry.type:'';
      var track={kind:kind,codec:codec,timescale:timing.timescale,duration:timing.duration,seconds:timing.duration/timing.timescale};
      if(kind==='vide'&&entry){
        var size=visualSize(view,entry),extra=codecProfile(view,entry,codec);
        track.width=size.width;track.height=size.height;track.profile=extra.profile;track.codecString=extra.codecString;track.description=extra.description;
        track.samples=videoSamples(view,child,timing.timescale);
        if(!video)video=track;
      }
      if(kind==='soun'){if(!audio)audio=track;}
      tracks.push(track);
    });
    return {tracks:tracks,trackCount:tracks.length,video:video,audio:audio,duration:video?video.seconds:(tracks[0]?tracks[0].seconds:0)};
  }
  async function inspectFile(file){
    var size=file.size,offset=0,guard=0;
    while(offset+8<=size&&guard++<128){
      var head=new DataView(await file.slice(offset,Math.min(size,offset+16)).arrayBuffer());
      var boxSize=head.getUint32(0),header=8,type=fourcc(new Uint8Array(head.buffer),4);
      if(boxSize===1){boxSize=Number(head.getBigUint64(8));header=16;}
      else if(boxSize===0)boxSize=size-offset;
      if(boxSize<header)break;
      if(type==='moov'){
        if(boxSize>48*1024*1024)throw new Error('moov 过大');
        var bytes=new Uint8Array(await file.slice(offset,offset+boxSize).arrayBuffer());
        var info=parseMoov(bytes);
        info.moovOffset=offset;info.moovSize=boxSize;
        return info;
      }
      offset+=boxSize;
    }
    throw new Error('找不到 moov');
  }
  function trakKind(view, trak){return handlerType(view,trak);}
  async function dropAudio(file){
    var buffer=await file.arrayBuffer();
    var view=new DataView(buffer),bytes=new Uint8Array(buffer),offset=0,moov=null,mdatStart=buffer.byteLength;
    while(offset+8<=buffer.byteLength){
      var box=headerAt(view,offset,buffer.byteLength);if(!box)break;
      if(box.type==='moov')moov=box;
      if(box.type==='mdat'&&box.start<mdatStart)mdatStart=box.start;
      offset=box.end;
    }
    if(!moov)throw new Error('找不到 moov');
    var remove=[],cursor=moov.start+moov.header;
    while(cursor+8<=moov.end){
      var child=headerAt(view,cursor,moov.end);if(!child)break;
      if(child.type==='trak'&&trakKind(view,child)==='soun')remove.push(child);
      cursor=child.end;
    }
    if(!remove.length)return file;
    var parts=[],from=0,removed=0;
    remove.forEach(function(box){parts.push(bytes.subarray(from,box.start));removed+=box.size;from=box.end;});
    parts.push(bytes.subarray(from));
    var total=0;parts.forEach(function(part){total+=part.length;});
    var out=new Uint8Array(total),at=0;
    parts.forEach(function(part){out.set(part,at);at+=part.length;});
    var newMoovSize=moov.size-removed;
    var moovAt=moov.start;
    new DataView(out.buffer).setUint32(moovAt,newMoovSize);
    if(moov.start<mdatStart){
      var delta=-removed,outView=new DataView(out.buffer),scan=moovAt+8,moovEnd=moovAt+newMoovSize;
      while(scan+8<=moovEnd){
        var inner=headerAt(outView,scan,moovEnd);if(!inner)break;
        if(inner.type==='stco'||inner.type==='co64'){
          var count=outView.getUint32(inner.start+inner.header+4),entry=inner.start+inner.header+8,wide=inner.type==='co64'?8:4;
          for(var i=0;i<count;i++){
            if(wide===8){var value=Number(outView.getBigUint64(entry));if(value>=mdatStart)outView.setBigUint64(entry,BigInt(value+delta));}
            else{var narrow=outView.getUint32(entry);if(narrow>=mdatStart)outView.setUint32(entry,narrow+delta);}
            entry+=wide;
          }
        }
        scan=inner.type==='moov'||inner.type==='trak'||inner.type==='mdia'||inner.type==='minf'||inner.type==='stbl'?inner.start+inner.header:inner.end;
        if(inner.type!=='moov'&&inner.type!=='trak'&&inner.type!=='mdia'&&inner.type!=='minf'&&inner.type!=='stbl')continue;
      }
    }
    return new Blob([out],{type:'video/mp4'});
  }
  function summary(info){
    if(!info)return '无法解析 MP4 结构';
    var video=info.video,audio=info.audio;
    var text='视频 '+(video?video.codec+(video.profile?'/'+video.profile:'')+' '+video.width+'x'+video.height:'无');
    text+='，音轨 '+(audio?audio.codec:'无')+'，轨道 '+info.trackCount;
    return text;
  }
  function hevc(info){return !!(info&&info.video&&(info.video.codec==='hvc1'||info.video.codec==='hev1'));}
  function avc(info){return !!(info&&info.video&&(info.video.codec==='avc1'||info.video.codec==='avc3'));}
  function awkwardAudio(info){return !!(info&&info.audio&&info.audio.codec!=='mp4a');}
  root.EcrsMp4={inspectFile:inspectFile,parseMoov:parseMoov,dropAudio:dropAudio,summary:summary,hevc:hevc,avc:avc,awkwardAudio:awkwardAudio};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.EcrsMp4;
})(typeof window!=='undefined'?window:globalThis);
