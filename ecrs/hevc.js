/* Desktop HEVC playback through WebCodecs when the platform decoder accepts hvc1/hev1. */
(function(root){
  function supported(track){
    if(!track||!track.description||typeof VideoDecoder==='undefined'||!VideoDecoder.isConfigSupported)return Promise.resolve(false);
    var config={codec:track.codecString||track.codec,codedWidth:track.width||16,codedHeight:track.height||16,description:track.description};
    return VideoDecoder.isConfigSupported(config).then(function(result){return !!(result&&result.supported);},function(){return false;});
  }
  function attach(file,info,video,canvas){
    var track=info.video,samples=track.samples||[];
    if(!samples.length)return Promise.reject(new Error('没有视频样本'));
    var ctx=canvas.getContext('2d');
    var time=0,rate=1,paused=true,index=0,generation=0,pumping=false,last=0,raf=0,closed=false;
    var decoder=new VideoDecoder({
      output:function(frame){
        var stamp=frame.timestamp/1e6;
        if(Math.abs(stamp-time)<0.2||stamp<=time+0.001){
          if(canvas.width!==(frame.displayWidth||frame.codedWidth))canvas.width=frame.displayWidth||frame.codedWidth;
          if(canvas.height!==(frame.displayHeight||frame.codedHeight))canvas.height=frame.displayHeight||frame.codedHeight;
          ctx.drawImage(frame,0,0,canvas.width,canvas.height);
        }
        frame.close();
      },
      error:function(){}
    });
    decoder.configure({codec:track.codecString||track.codec,codedWidth:track.width||16,codedHeight:track.height||16,description:track.description,optimizeForLatency:true});
    function emit(type){try{video.dispatchEvent(new Event(type));}catch(ignore){}}
    function nearestKey(target){
      var key=0;
      for(var i=0;i<samples.length;i++){if(samples[i].key&&samples[i].pts<=target+0.0001)key=i;if(samples[i].pts>target)break;}
      return key;
    }
    function pump(gen){
      if(pumping)return;pumping=true;
      (async function(){
        try{
          while(!closed&&gen===generation&&index<samples.length){
            var sample=samples[index];
            if(paused&&sample.pts>time+0.04)break;
            if(!paused&&sample.pts>time+0.8)break;
            index++;
            var data=new Uint8Array(await file.slice(sample.offset,sample.offset+sample.size).arrayBuffer());
            if(gen!==generation||closed)return;
            decoder.decode(new EncodedVideoChunk({type:sample.key?'key':'delta',timestamp:Math.round(sample.pts*1e6),data:data}));
            while(decoder.decodeQueueSize>5)await new Promise(function(resolve){setTimeout(resolve,8);});
          }
        }catch(ignore){}
        pumping=false;
      })();
    }
    function tick(now){
      if(closed||paused)return;
      if(!last)last=now;
      time+=Math.max(0,now-last)/1000*rate;last=now;
      if(time>=info.duration){time=info.duration;paused=true;emit('pause');emit('timeupdate');return;}
      emit('timeupdate');pump(generation);raf=requestAnimationFrame(tick);
    }
    var control={
      duration:info.duration||0,
      getTime:function(){return time;},
      getRate:function(){return rate;},
      setRate:function(value){rate=value||1;emit('ratechange');},
      play:function(){paused=false;last=0;emit('play');pump(generation);raf=requestAnimationFrame(tick);return Promise.resolve();},
      pause:function(){paused=true;if(raf)cancelAnimationFrame(raf);emit('pause');},
      seek:function(value){time=Math.max(0,Math.min(info.duration||0,value||0));generation++;index=nearestKey(time);var gen=generation;decoder.flush().then(function(){pump(gen);}).catch(function(){pump(gen);});emit('timeupdate');},
      stop:function(){closed=true;paused=true;if(raf)cancelAnimationFrame(raf);try{decoder.close();}catch(ignore){}}
    };
    video.hidden=true;canvas.hidden=false;
    index=0;pump(generation);
    emit('loadedmetadata');emit('loadeddata');emit('canplay');
    return Promise.resolve(control);
  }
  root.EcrsHevc={supported:supported,attach:attach};
})(window);
