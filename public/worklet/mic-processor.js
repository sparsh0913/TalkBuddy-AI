// random-noise-processor.js
class MicProcessor extends AudioWorkletProcessor {
  process(inputs) {
    console.log("inputs", inputs);
    return true;
  }
}

registerProcessor("mic-processor", MicProcessor);