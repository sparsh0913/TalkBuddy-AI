// random-noise-processor.js
class MicProcessor extends AudioWorkletProcessor {
  process(inputs) {
    this.port.postMessage(inputs);
    return true;
  }
}

registerProcessor("mic-processor", MicProcessor);