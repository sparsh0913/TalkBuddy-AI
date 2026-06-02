// random-noise-processor.js
class MicProcessor extends AudioWorkletProcessor {
  process(inputs) {

    if(!inputs.length) return true;

    const input = inputs[0];
    if(!input.length) return true;
    const channelData = input[0];

    //copying data from array to new array for reuse to save it when new data overwrites original one
    const pcm = new Float32Array(channelData.length); 
    pcm.set(channelData);

    this.port.postMessage(pcm);
    return true;
  }
}

registerProcessor("mic-processor", MicProcessor);