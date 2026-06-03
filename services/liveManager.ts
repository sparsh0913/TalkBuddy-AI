import { base64ToUint8Array, createPCMBlob, decodeAudioData } from '@/lib/audioUtils';
import { INPUT_SAMPLE_RATE, MODEL, OUTPUT_SAMPLE_RATE } from '@/lib/constants';
import { ConnectionState, LiveManagerCallbacks } from '@/types';
import { GoogleGenAI, LiveServerMessage, Modality, Session } from '@google/genai';
import { uint } from 'three/tsl';

export class LiveManager {
private ai: GoogleGenAI;
private activeSession: Session | null = null;
private inputAudioContext: AudioContext | null = null;
private outputAudioContext: AudioContext | null = null;
private outputNode : GainNode | null = null;
private mediaStream : MediaStream | null=null;
private workletNode : AudioWorkletNode | null=null;
private inputSource: MediaStreamAudioSourceNode | null=null;
private nextStartTime = 0;
private sources = new Set<AudioBufferSourceNode>();
private callbacks: LiveManagerCallbacks | null=null;
private isMuted:boolean;

constructor(callbacks:LiveManagerCallbacks){
this.ai = new GoogleGenAI({
  apiKey:process.env.NEXT_PUBLIC_GEMINI_API_KEY,
});
this.callbacks = callbacks;
}
   async startSession(){
    
   try{
      //connecting
    this.callbacks?.onStateChange(
      ConnectionState.CONNECTING
    )
    const config = { 
      responseModalities: [Modality.AUDIO],
      systemInstruction : "You are a helpful and friendly AI Assisant" 
    
    
    };

      //creating session on connect button
    this.activeSession = await this.ai.live.connect({
    model: MODEL,
    callbacks: {
      onopen: ()=> {
        this.callbacks?.onStateChange(ConnectionState.CONNECTED);
      },
      onmessage: this.handleMessage.bind(this),
      onerror:(e)=> {
        this.callbacks?.onStateChange(ConnectionState.ERROR);
        this.callbacks?.onError("Could not connect")
      },
      onclose: function (e) {
        console.debug('Close:', e.reason);
      },
    },
    config: config,
  });

 //Audio Processing using Audio Context 
  this.inputAudioContext = new AudioContext({
    sampleRate:INPUT_SAMPLE_RATE
  });

  this.outputAudioContext = new AudioContext({
    sampleRate:OUTPUT_SAMPLE_RATE
  })

  if(this.inputAudioContext.state === 'suspended'){
    this.inputAudioContext.resume();
  }

   if(this.outputAudioContext.state === 'suspended'){
    this.outputAudioContext.resume();
  }

  //creating Node
  this.outputNode = this.outputAudioContext.createGain(); //controlling volume
  this.outputNode.connect(this.outputAudioContext.destination);

  //using worklet to create node in new thread
  await this.inputAudioContext.audioWorklet.addModule("/worklet/mic-processor.js");

  this.workletNode = new AudioWorkletNode(
    this.inputAudioContext,
    "mic-processor"
  );

  this.workletNode.port.onmessage = (event)=>{
    const pcmBlob = createPCMBlob(event.data as Float32Array);
  
    this.activeSession?.sendRealtimeInput({
      audio: pcmBlob,
    })
  }

  //getting media streams from microphone step1
  this.mediaStream = await navigator.mediaDevices.getUserMedia({
    audio:{
      sampleRate:INPUT_SAMPLE_RATE,
      channelCount:1,
      echoCancellation:true,
      noiseSuppression:true,
      autoGainControl:true
    }
  });

  //creating media stream source -> Source Node
 this.inputSource = this.inputAudioContext.createMediaStreamSource(this.mediaStream);
this.inputSource.connect(this.workletNode);
console.log("session", this.activeSession);
   }catch(e){
    console.error(e);
      this.callbacks?.onStateChange(ConnectionState.ERROR);
        this.callbacks?.onError("Something went wrong")
   }
    }

   async handleMessage(message : LiveServerMessage){
     
      const serverContent = message.serverContent;

      if(serverContent?.interrupted){
        this.stopAllAudio();
      }
      const base64Data = serverContent?.modelTurn?.parts?.[0].inlineData?.data;

      //transcription
      
      if(!base64Data) return;
     await this.playAudioChunk(base64Data as string);
      
    }

     //playing the audio from AI
    async playAudioChunk(audioData:string){           
    const uintData = base64ToUint8Array(audioData); //converting data from base64 

       if(!this.outputAudioContext || !this.outputNode) return;
     const audioBuffer = await decodeAudioData(uintData, this.outputAudioContext, OUTPUT_SAMPLE_RATE ,1); //creating audio buffer 

  if(this.nextStartTime < this.outputAudioContext.currentTime){
    this.nextStartTime = this.outputAudioContext.currentTime;
  }

     const source = this.outputAudioContext.createBufferSource();
     source.buffer = audioBuffer;  //connecting audio buffer to buffer source
     source.connect(this.outputNode); //connecting buffer source to output node
     source.start(this.nextStartTime); //starting the source
     this.nextStartTime += audioBuffer.duration;

     source.addEventListener('ended', ()=>{ //if source ended then deleting it from sources
      this.sources.delete(source);
     })
     this.sources.add(source);
    }

    //adding interruption feature
    async stopAllAudio(){
  this.sources.forEach((source)=>{
   try{
     source.stop();
   } catch{}
  })
  this.sources.clear();
  if(this.outputAudioContext){
  this.nextStartTime = this.outputAudioContext?.currentTime;
  }
    }

    setMute(isMuted:boolean){
    this.isMuted = isMuted;
    if(this.mediaStream){
      this.mediaStream.getAudioTracks().forEach((track)=>{
        track.enabled = !isMuted;
      })
    }
    }
}