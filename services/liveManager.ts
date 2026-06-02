import { createPCMBlob } from '@/lib/audioUtils';
import { INPUT_SAMPLE_RATE, MODEL, OUTPUT_SAMPLE_RATE } from '@/lib/constants';
import { GoogleGenAI, Modality, Session } from '@google/genai';

export class LiveManager {
private ai: GoogleGenAI;
private activeSession: Session | null = null;
private inputAudioContext: AudioContext | null = null;
private outputAudioContext: AudioContext | null = null;
private outputNode : GainNode | null = null;
private mediaStream : MediaStream | null=null;
private workletNode : AudioWorkletNode | null=null;
private inputSource: MediaStreamAudioSourceNode | null=null;

constructor(){
this.ai = new GoogleGenAI({
  apiKey:process.env.NEXT_PUBLIC_GEMINI_API_KEY,
});
}
   async startSession(){
    const config = { 
      responseModalities: [Modality.AUDIO],
      systemInstruction : "You are a helpful and friendly AI Assisant" };
      //creating session on connect button
    this.activeSession = await this.ai.live.connect({
    model: MODEL,
    callbacks: {
      onopen: function () {
        console.debug('Opened');
      },
      onmessage: function (message) {
        console.debug(message);
      },
      onerror: function (e) {
        console.debug('Error:', e.message);
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
    console.log(pcmBlob);
  }

  //getting media streams 
  this.mediaStream = await navigator.mediaDevices.getUserMedia({
    audio:{
      sampleRate:INPUT_SAMPLE_RATE,
      channelCount:1,
      echoCancellation:true,
      noiseSuppression:true,
      autoGainControl:true
    }
  });

  //creating media stream source
 this.inputSource = this.inputAudioContext.createMediaStreamSource(this.mediaStream);

this.inputSource.connect(this.workletNode);


  console.log("session", this.activeSession);
    }
}